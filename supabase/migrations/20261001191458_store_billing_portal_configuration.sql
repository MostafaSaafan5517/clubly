-- Members manage their billing in Stripe's Customer Portal. Their subscriptions live on the
-- business's connected account, so the portal must be configured on that account: the platform
-- creates one configuration per business through the API, the first time a member opens the
-- portal, and keeps its id here.
--
-- Like the other Stripe ids, only server code (the service role) reads or writes it: no grant
-- for the API roles.
alter table public.businesses add column stripe_portal_configuration_id text unique;
