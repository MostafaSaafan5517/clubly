-- A business's revenue figures, one row per currency. Security invoker: it runs as the caller,
-- so RLS decides what it can add up. Only owners and admins can read payments, so for anyone
-- else the payment figures come out as zero.
--
-- Monthly recurring revenue (MRR) counts active subscriptions and those whose latest payment
-- Stripe is retrying (past_due), with yearly plans as a twelfth of their price. Trials count once
-- they pay. Payment figures cover payments made (or, for failed ones, attempted) in the last
-- `window_days` days, by the database's clock.
-- Amounts are in the currency's smallest unit, like everywhere else.
create function public.business_revenue(target_business_id uuid, window_days integer)
returns table (
  currency text,
  monthly_recurring_revenue bigint,
  gross_revenue bigint,
  platform_fees bigint,
  failed_payments integer
)
language sql
stable
set search_path = ''
as $$
  with recurring as (
    select
      p.currency,
      sum(case p.billing_interval when 'month' then p.amount else p.amount / 12.0 end) as mrr
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.business_id = target_business_id
      and s.status in ('active', 'past_due')
    group by p.currency
  ),
  recent_payments as (
    select
      pay.currency,
      sum(pay.amount) filter (where pay.status = 'paid') as gross,
      sum(pay.application_fee) filter (where pay.status = 'paid') as fees,
      count(*) filter (where pay.status = 'failed') as failed
    from public.payments pay
    where pay.business_id = target_business_id
      and coalesce(pay.paid_at, pay.created_at) >= now() - make_interval(days => window_days)
    group by pay.currency
  )
  select
    coalesce(r.currency, rp.currency),
    round(coalesce(r.mrr, 0))::bigint,
    coalesce(rp.gross, 0)::bigint,
    coalesce(rp.fees, 0)::bigint,
    coalesce(rp.failed, 0)::integer
  from recurring r
  full join recent_payments rp on rp.currency = r.currency
  order by 1;
$$;

grant execute on function public.business_revenue(uuid, integer) to authenticated;
