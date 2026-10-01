-- Reconciliation: a scheduled job re-reads each business's Stripe account and fixes whatever our
-- copy got wrong (a webhook that never arrived, or one we failed to process for longer than
-- Stripe keeps retrying). Webhooks stay the main path; this is the safety net.
--
-- The job hands Stripe's current objects to the functions below, which apply them through the
-- same upserts the webhooks use. A correction is whatever that changed: each one is logged, in
-- the same transaction as the fix, with the row as it was and as it is now.

-- One row per run of the job.
create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- 'failed' means at least one business couldn't be checked (see errors); the others were.
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  businesses_checked integer not null default 0,
  corrections integer not null default 0,
  -- [{ "business_id": ..., "message": ... }]
  errors jsonb not null default '[]'
);

-- Every fix the job made. Append-only, like the audit log.
create table public.reconciliation_corrections (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.reconciliation_runs (id) on delete restrict,
  business_id uuid not null,
  object_type text not null check (object_type in ('account', 'subscription', 'payment')),
  stripe_id text not null,
  -- Our row before the fix (null when it was missing altogether) and after it.
  old_data jsonb,
  new_data jsonb not null,
  created_at timestamptz not null default now()
);

create index reconciliation_corrections_run_id on public.reconciliation_corrections (run_id);
create index reconciliation_corrections_business_id
  on public.reconciliation_corrections (business_id);

-- Platform operations data: RLS on with no policies and (by our default privileges) no grants
-- to the API roles, so only server code reads it. Even server code can't rewrite corrections.
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_corrections enable row level security;
revoke all on public.reconciliation_corrections from service_role;
grant select, insert on public.reconciliation_corrections to service_role;

create trigger reconciliation_corrections_are_append_only
  before update or delete on public.reconciliation_corrections
  for each row execute function private.reject_change();
create trigger reconciliation_corrections_cannot_be_truncated
  before truncate on public.reconciliation_corrections
  for each statement execute function private.reject_change();

-- Payments ---------------------------------------------------------------------------------------

-- Our copy of a Stripe invoice, created or updated, for one of our subscriptions (the caller
-- has already made sure the subscription belongs to the account the invoice came from). One row
-- per invoice, so a failed invoice that's paid on a later retry moves to paid. Returns the
-- payment's id.
create function private.upsert_payment(target_subscription_id uuid, invoice jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_payment_id uuid;
begin
  insert into public.payments (
    business_id, member_id, subscription_id, stripe_invoice_id, amount, application_fee,
    currency, status, paid_at
  )
  select
    s.business_id,
    s.member_id,
    s.id,
    invoice ->> 'id',
    (invoice ->> 'amount')::integer,
    (invoice ->> 'application_fee')::integer,
    invoice ->> 'currency',
    (invoice ->> 'status')::public.payment_status,
    to_timestamp((invoice ->> 'paid_at')::bigint)
  from public.subscriptions s
  where s.id = target_subscription_id
  on conflict (stripe_invoice_id) do update
  set amount = excluded.amount,
      application_fee = excluded.application_fee,
      status = excluded.status,
      paid_at = excluded.paid_at,
      subscription_id = excluded.subscription_id
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- The webhook's invoice function now shares that upsert (same behavior as before).
create or replace function public.apply_invoice_event(
  event_id text,
  event_type text,
  account_id text,
  subscription jsonb,
  invoice jsonb
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_subscription_id uuid;
begin
  perform set_config('app.actor', 'stripe_webhook', true);

  insert into public.stripe_events (event_id, type, account_id)
  values (apply_invoice_event.event_id, event_type, apply_invoice_event.account_id)
  on conflict on constraint stripe_events_pkey do nothing;
  if not found then
    return 'duplicate';
  end if;

  -- The invoice's subscription first, so the payment can be recorded even if the
  -- subscription's own events haven't arrived yet.
  v_subscription_id := private.upsert_subscription(apply_invoice_event.account_id, subscription);
  if v_subscription_id is null then
    return 'ignored';
  end if;
  perform private.upsert_payment(v_subscription_id, invoice);
  return 'applied';
end;
$$;

-- What reconciliation compares --------------------------------------------------------------------

create function private.subscription_state(target_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', status,
    'plan_id', plan_id,
    'current_period_end', current_period_end,
    'cancel_at', cancel_at
  )
  from public.subscriptions
  where stripe_subscription_id = target_id;
$$;

create function private.payment_state(target_id text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', status,
    'amount', amount,
    'application_fee', application_fee,
    'currency', currency,
    'paid_at', paid_at
  )
  from public.payments
  where stripe_invoice_id = target_id;
$$;

-- Reconciling ----------------------------------------------------------------------------------

-- Whether the business behind a connected account can take payments. Returns the number of
-- corrections (0 or 1).
create function public.reconcile_account(run_id uuid, account_id text, charges_enabled boolean)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  perform set_config('app.actor', 'reconciliation', true);

  update public.businesses b
  set charges_enabled = reconcile_account.charges_enabled
  where b.stripe_account_id = reconcile_account.account_id
    and b.charges_enabled is distinct from reconcile_account.charges_enabled
  returning b.id into v_business_id;
  if v_business_id is null then
    return 0;
  end if;

  insert into public.reconciliation_corrections (
    run_id, business_id, object_type, stripe_id, old_data, new_data
  )
  values (
    reconcile_account.run_id,
    v_business_id,
    'account',
    reconcile_account.account_id,
    jsonb_build_object('charges_enabled', not reconcile_account.charges_enabled),
    jsonb_build_object('charges_enabled', reconcile_account.charges_enabled)
  );
  return 1;
end;
$$;

-- Subscription snapshots (the same JSON the webhooks send) from one connected account. Returns
-- the number of corrections; snapshots that aren't ours are skipped.
create function public.reconcile_subscriptions(run_id uuid, account_id text, snapshots jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_before jsonb;
  v_after jsonb;
  v_subscription_id uuid;
  v_corrections integer := 0;
begin
  perform set_config('app.actor', 'reconciliation', true);

  for v_snapshot in select value from jsonb_array_elements(snapshots) loop
    v_before := private.subscription_state(v_snapshot ->> 'id');
    v_subscription_id := private.upsert_subscription(reconcile_subscriptions.account_id, v_snapshot);
    continue when v_subscription_id is null;

    v_after := private.subscription_state(v_snapshot ->> 'id');
    if v_before is distinct from v_after then
      insert into public.reconciliation_corrections (
        run_id, business_id, object_type, stripe_id, old_data, new_data
      )
      select reconcile_subscriptions.run_id, s.business_id, 'subscription', v_snapshot ->> 'id',
        v_before, v_after
      from public.subscriptions s
      where s.id = v_subscription_id;
      v_corrections := v_corrections + 1;
    end if;
  end loop;

  return v_corrections;
end;
$$;

-- Invoice snapshots (the same JSON the webhooks send) from one connected account. Run it after
-- reconcile_subscriptions, so every invoice's subscription is already there. An invoice is ours
-- only if its subscription is, and belongs to the business behind this account.
create function public.reconcile_payments(run_id uuid, account_id text, snapshots jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_before jsonb;
  v_after jsonb;
  v_subscription_id uuid;
  v_payment_id uuid;
  v_corrections integer := 0;
begin
  perform set_config('app.actor', 'reconciliation', true);

  for v_snapshot in select value from jsonb_array_elements(snapshots) loop
    select s.id
    into v_subscription_id
    from public.subscriptions s
    join public.businesses b on b.id = s.business_id
    where s.stripe_subscription_id = v_snapshot ->> 'subscription_id'
      and b.stripe_account_id = reconcile_payments.account_id;
    continue when v_subscription_id is null;

    v_before := private.payment_state(v_snapshot ->> 'id');
    v_payment_id := private.upsert_payment(v_subscription_id, v_snapshot);

    v_after := private.payment_state(v_snapshot ->> 'id');
    if v_before is distinct from v_after then
      insert into public.reconciliation_corrections (
        run_id, business_id, object_type, stripe_id, old_data, new_data
      )
      select reconcile_payments.run_id, p.business_id, 'payment', v_snapshot ->> 'id',
        v_before, v_after
      from public.payments p
      where p.id = v_payment_id;
      v_corrections := v_corrections + 1;
    end if;
  end loop;

  return v_corrections;
end;
$$;

-- Only the reconciliation job (service role) runs these.
grant execute on function private.upsert_payment(uuid, jsonb) to service_role;
grant execute on function private.subscription_state(text) to service_role;
grant execute on function private.payment_state(text) to service_role;
grant execute on function public.reconcile_account(uuid, text, boolean) to service_role;
grant execute on function public.reconcile_subscriptions(uuid, text, jsonb) to service_role;
grant execute on function public.reconcile_payments(uuid, text, jsonb) to service_role;
