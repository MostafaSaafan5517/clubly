-- Applying Stripe subscription and invoice events. The webhook route re-reads each object from
-- Stripe (so a late or out-of-order event still writes the current state) and hands these
-- functions a snapshot as JSON. Each function records the event and applies it in one
-- transaction, like apply_account_updated.

-- Our copy of a Stripe subscription, created or updated. It's linked through ids we stored
-- ourselves, never through metadata: the member by their Stripe customer, the plan by its Stripe
-- price, and only when the event's connected account is that member's business's account (so an
-- event from one business's Stripe account can never touch another business's rows).
-- Returns the subscription's id, or null when it isn't one of ours.
create function private.upsert_subscription(account_id text, subscription jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_business_id uuid;
  v_plan_id uuid;
  v_subscription_id uuid;
begin
  select m.id, m.business_id
  into v_member_id, v_business_id
  from public.members m
  join public.businesses b on b.id = m.business_id
  where m.stripe_customer_id = subscription ->> 'customer_id'
    and b.stripe_account_id = upsert_subscription.account_id;
  if v_member_id is null then
    return null;
  end if;

  select p.id
  into v_plan_id
  from public.plans p
  where p.stripe_price_id = subscription ->> 'price_id'
    and p.business_id = v_business_id;
  if v_plan_id is null then
    return null;
  end if;

  insert into public.subscriptions (
    business_id, member_id, plan_id, stripe_subscription_id, status, current_period_end,
    cancel_at_period_end
  )
  values (
    v_business_id,
    v_member_id,
    v_plan_id,
    subscription ->> 'id',
    (subscription ->> 'status')::public.subscription_status,
    to_timestamp((subscription ->> 'current_period_end')::bigint),
    (subscription ->> 'cancel_at_period_end')::boolean
  )
  on conflict (stripe_subscription_id) do update
  set status = excluded.status,
      plan_id = excluded.plan_id,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- checkout.session.completed and customer.subscription.created/updated/deleted.
-- Returns 'applied', 'duplicate' (already processed) or 'ignored' (not one of ours).
create function public.apply_subscription_event(
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

-- invoice.paid and invoice.payment_failed. The invoice's subscription is upserted first, so the
-- payment can be recorded even if its subscription's own events haven't arrived yet.
create function public.apply_invoice_event(
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

-- Only the webhook route (service role) may apply events. It calls the private helper through
-- these functions, so it needs to reach that one helper too.
grant usage on schema private to service_role;
grant execute on function private.upsert_subscription(text, jsonb) to service_role;
grant execute on function public.apply_subscription_event(text, text, text, jsonb) to service_role;
grant execute on function public.apply_invoice_event(text, text, text, jsonb, jsonb) to service_role;
