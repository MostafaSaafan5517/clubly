-- Stripe schedules the end of a subscription in two ways: the `cancel_at_period_end` flag, or a
-- `cancel_at` date. The Customer Portal uses the date and leaves the flag false, so storing only
-- the flag missed every cancellation a member made in the portal. We now store the date the
-- subscription will end, whichever way Stripe expressed it (the webhook snapshot works it out),
-- so one column answers "is this subscription ending, and when?".

alter table public.subscriptions add column cancel_at timestamptz;

update public.subscriptions
set cancel_at = current_period_end
where cancel_at_period_end;

alter table public.subscriptions drop column cancel_at_period_end;

grant select (cancel_at) on public.subscriptions to authenticated;

-- Same as before, except for cancel_at. `create or replace` keeps the function's grants.
create or replace function private.upsert_subscription(account_id text, subscription jsonb)
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
    cancel_at
  )
  values (
    v_business_id,
    v_member_id,
    v_plan_id,
    subscription ->> 'id',
    (subscription ->> 'status')::public.subscription_status,
    to_timestamp((subscription ->> 'current_period_end')::bigint),
    to_timestamp((subscription ->> 'cancel_at')::bigint)
  )
  on conflict (stripe_subscription_id) do update
  set status = excluded.status,
      plan_id = excluded.plan_id,
      current_period_end = excluded.current_period_end,
      cancel_at = excluded.cancel_at,
      updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;
