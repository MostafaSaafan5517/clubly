-- Whether a business has a connected Stripe account yet. The account id itself stays
-- server-only; this flag lets the dashboard tell "not connected" from "onboarding unfinished"
-- without granting the id to API roles. Generated, so it can never disagree with the id.
alter table public.businesses
  add column has_stripe_account boolean
    generated always as (stripe_account_id is not null) stored;

grant select (has_stripe_account) on public.businesses to authenticated;
