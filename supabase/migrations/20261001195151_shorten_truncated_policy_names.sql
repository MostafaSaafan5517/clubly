-- Postgres cuts identifiers to 63 bytes, with only a notice. Five policy names were longer and
-- were stored cut off mid-word (`... their busine`). Same policies, same rules: only the names
-- change, to ones that fit. A pgTAP test now keeps every policy name under the limit.

alter policy "people can view their businesses and businesses that take payme"
  on public.businesses
  rename to "people see their businesses and those taking payments";

alter policy "members see their own memberships; staff see their business's m"
  on public.members
  rename to "members see their memberships; staff see their members";

alter policy "users can view their own profile and the people at their busine"
  on public.profiles
  rename to "users see their own profile and people at their businesses";

-- Exactly 63 characters, so it wasn't cut, but it was at the limit.
alter policy "members see their own subscriptions; staff see their business's"
  on public.subscriptions
  rename to "members see their subscriptions; staff see their business's";

alter policy "members see their own payments; owners and admins see their bus"
  on public.payments
  rename to "members see their payments; owners and admins see revenue";
