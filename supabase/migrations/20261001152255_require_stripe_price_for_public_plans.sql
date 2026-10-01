-- A plan is created in two steps: the row first (through RLS, as the user), then its Stripe
-- price, whose id is saved by server code. Until that second step lands, the plan can't be
-- bought, so public pages must not show it.

-- Lets staff see that a plan isn't ready yet, without exposing the price id itself.
alter table public.plans
  add column has_stripe_price boolean
    generated always as (stripe_price_id is not null) stored;

grant select (has_stripe_price) on public.plans to authenticated;

alter policy "visitors see active plans of businesses that take payments"
  on public.plans
  using (
    active
    and stripe_price_id is not null
    and exists (
      select 1
      from public.businesses
      where businesses.id = plans.business_id and businesses.charges_enabled
    )
  );

alter policy "staff see all plans; everyone sees active plans of businesses that take payments"
  on public.plans
  using (
    private.has_business_role(business_id, '{owner,admin,staff}')
    or (
      active
      and stripe_price_id is not null
      and exists (
        select 1
        from public.businesses
        where businesses.id = plans.business_id and businesses.charges_enabled
      )
    )
  );
