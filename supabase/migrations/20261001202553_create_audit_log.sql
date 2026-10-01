-- An append-only history of every change to tenant data: who made it, to which row, what changed
-- (before and after), and when. Triggers write it, never application code, so no code path can
-- forget to log; and once written, nobody can change or delete an entry.

create table public.audit_log (
  id bigint generated always as identity primary key,
  -- No foreign keys: the history must outlive the rows it describes.
  business_id uuid not null,
  -- Who made the change: a signed-in user, the Stripe webhook, the reconciliation job, other
  -- server code (the service role), or someone working in the database directly.
  actor text not null
    check (actor in ('user', 'stripe_webhook', 'reconciliation', 'server', 'database')),
  -- The signed-in user behind the change, when there is one.
  actor_user_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  -- For updates: the columns whose values changed.
  changed_columns text[] not null default '{}',
  -- The row before and after, without Stripe ids (owners can read this; Stripe ids stay
  -- server-only). A changed Stripe id is still listed in changed_columns.
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_business_id_id on public.audit_log (business_id, id desc);

-- Append-only, in two layers. No API role (not even the service role) may insert, update or
-- delete; only the trigger function below writes, as the table's owner. And for the owner
-- itself, updates, deletes and truncation are rejected by triggers.
alter table public.audit_log enable row level security;
revoke all on public.audit_log from service_role;
grant select on public.audit_log to service_role, authenticated;

create policy "owners and admins see their business's history"
  on public.audit_log for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'));

create function private.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: its rows can''t be changed or deleted', tg_table_name;
end;
$$;

create trigger audit_log_is_append_only
  before update or delete on public.audit_log
  for each row execute function private.reject_change();
create trigger audit_log_cannot_be_truncated
  before truncate on public.audit_log
  for each statement execute function private.reject_change();

-- Who is making the current change. A signed-in user's request is always "user" (they can't
-- claim to be anything else). Server code may name itself through the transaction-local
-- `app.actor` setting, as the Stripe webhook functions do; otherwise the service role is
-- "server", and anything without an API role (migrations, psql) is "database".
create function private.current_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when auth.role() = 'authenticated' then 'user'
    else coalesce(
      nullif(current_setting('app.actor', true), ''),
      case when auth.role() = 'service_role' then 'server' else 'database' end
    )
  end;
$$;

create function private.without_stripe_ids(row_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select row_data - array(
    select key from jsonb_object_keys(row_data) as key where key like 'stripe\_%'
  );
$$;

-- The audit trigger. Its one argument names the column that identifies a row (business_staff
-- has no id of its own). Security definer: it writes as the table's owner, the only role allowed
-- to insert into audit_log.
create function private.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed text[] := '{}';
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(changed.key order by changed.key), '{}')
    into v_changed
    from jsonb_each(v_new) as changed
    where changed.key <> 'updated_at'
      and changed.value is distinct from v_old -> changed.key;
    -- An update that changes nothing (or only the updated_at timestamp) isn't history.
    if cardinality(v_changed) = 0 then
      return null;
    end if;
  end if;

  insert into public.audit_log (
    business_id, actor, actor_user_id, table_name, record_id, action, changed_columns,
    old_data, new_data
  )
  values (
    (v_row ->> case when tg_table_name = 'businesses' then 'id' else 'business_id' end)::uuid,
    private.current_actor(),
    auth.uid(),
    tg_table_name,
    (v_row ->> tg_argv[0])::uuid,
    lower(tg_op),
    v_changed,
    private.without_stripe_ids(v_old),
    private.without_stripe_ids(v_new)
  );
  return null;
end;
$$;

create trigger record_audit_log
  after insert or update or delete on public.businesses
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.business_staff
  for each row execute function private.record_audit_log('user_id');
create trigger record_audit_log
  after insert or update or delete on public.plans
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.members
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.subscriptions
  for each row execute function private.record_audit_log('id');
create trigger record_audit_log
  after insert or update or delete on public.payments
  for each row execute function private.record_audit_log('id');

-- The Stripe webhook functions name themselves as the actor; same bodies as before otherwise.
create or replace function public.apply_account_updated(
  event_id text,
  account_id text,
  charges_enabled boolean
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.actor', 'stripe_webhook', true);

  insert into public.stripe_events (event_id, type, account_id)
  values (apply_account_updated.event_id, 'account.updated', apply_account_updated.account_id)
  on conflict on constraint stripe_events_pkey do nothing;

  if not found then
    return false;
  end if;

  update public.businesses
  set charges_enabled = apply_account_updated.charges_enabled
  where stripe_account_id = apply_account_updated.account_id;

  return true;
end;
$$;

create or replace function public.apply_subscription_event(
  event_id text,
  event_type text,
  account_id text,
  subscription jsonb
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.actor', 'stripe_webhook', true);

  insert into public.stripe_events (event_id, type, account_id)
  values (apply_subscription_event.event_id, event_type, apply_subscription_event.account_id)
  on conflict on constraint stripe_events_pkey do nothing;
  if not found then
    return 'duplicate';
  end if;

  if private.upsert_subscription(apply_subscription_event.account_id, subscription) is null then
    return 'ignored';
  end if;
  return 'applied';
end;
$$;

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

  v_subscription_id := private.upsert_subscription(apply_invoice_event.account_id, subscription);
  if v_subscription_id is null then
    return 'ignored';
  end if;

  -- One row per invoice: a failed invoice that's paid on a later retry moves to paid.
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
  where s.id = v_subscription_id
  on conflict (stripe_invoice_id) do update
  set amount = excluded.amount,
      application_fee = excluded.application_fee,
      status = excluded.status,
      paid_at = excluded.paid_at,
      subscription_id = excluded.subscription_id;

  return 'applied';
end;
$$;
