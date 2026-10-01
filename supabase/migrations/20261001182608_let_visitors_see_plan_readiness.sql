-- The public join page asks for "active plans that can be bought" for every viewer, signed in
-- or not. Signed-in staff can also see their own unfinished plans through RLS, so the page
-- filters on has_stripe_price explicitly, and visitors need to be allowed to read it. It's a
-- yes/no flag; the Stripe price id itself stays server-only.
grant select (has_stripe_price) on public.plans to anon;
