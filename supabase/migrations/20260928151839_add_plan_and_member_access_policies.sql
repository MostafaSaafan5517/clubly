-- Who can see and change plans and members, and what the public join page may read.
--
-- Stripe identifiers (businesses.stripe_account_id, plans.stripe_price_id,
-- members.stripe_customer_id) are read and written only by server code using the service role.
-- The API roles get column-level grants for everything else, so no policy mistake can leak them.

-- True when the signed-in user is a member of the business. Security definer for the same
-- reason as has_business_role: the businesses policy needs to know about members, and the
-- members insert policy needs to know about businesses. Querying each other's RLS-protected
-- tables directly would make Postgres reject the loop as infinite recursion.
create function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members
    where business_id = target_business_id
      and user_id = (select auth.uid())
  );
$$;

grant execute on function private.is_business_member(uuid) to authenticated;

-- Businesses -------------------------------------------------------------------------------

revoke select on public.businesses from authenticated;
grant select (id, name, slug, charges_enabled, created_at) on public.businesses to authenticated;
-- charges_enabled is included because the plans and members policies below check it.
grant select (id, name, slug, charges_enabled) on public.businesses to anon;

drop policy "staff can view their businesses" on public.businesses;

-- A business is visible to its staff, to its members (even if it stops taking payments later),
-- and to everyone once it can take payments, since that's when its join page goes live.
create policy "people can view their businesses and businesses that take payments"
  on public.businesses for select to authenticated
  using (
    charges_enabled
    or private.has_business_role(id, '{owner,admin,staff}')
    or private.is_business_member(id)
  );

create policy "visitors can view businesses that take payments"
  on public.businesses for select to anon
  using (charges_enabled);

-- Plans ------------------------------------------------------------------------------------

grant select (id, business_id, name, billing_interval, amount, currency, active, created_at)
  on public.plans to anon, authenticated;
grant insert (business_id, name, billing_interval, amount, currency)
  on public.plans to authenticated;
-- Price, currency and interval are fixed once created (Stripe prices are immutable too):
-- changing a price means archiving the plan and creating a new one.
grant update (name, active) on public.plans to authenticated;

create policy "staff see all plans; everyone sees active plans of businesses that take payments"
  on public.plans for select to authenticated
  using (
    private.has_business_role(business_id, '{owner,admin,staff}')
    or (
      active
      and exists (
        select 1
        from public.businesses
        where businesses.id = plans.business_id and businesses.charges_enabled
      )
    )
  );

create policy "visitors see active plans of businesses that take payments"
  on public.plans for select to anon
  using (
    active
    and exists (
      select 1
      from public.businesses
      where businesses.id = plans.business_id and businesses.charges_enabled
    )
  );

create policy "owners and admins can create plans"
  on public.plans for insert to authenticated
  with check (private.has_business_role(business_id, '{owner,admin}'));

create policy "owners and admins can edit plans"
  on public.plans for update to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'))
  with check (private.has_business_role(business_id, '{owner,admin}'));

-- Members ----------------------------------------------------------------------------------

grant select (id, business_id, user_id, status, created_at) on public.members to authenticated;
grant insert (business_id, user_id) on public.members to authenticated;
grant update (status) on public.members to authenticated;

create policy "members see their own memberships; staff see their business's members"
  on public.members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_business_role(business_id, '{owner,admin,staff}')
  );

-- People join for themselves only, and only at a business that can take payments.
create policy "users can join businesses that take payments"
  on public.members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.businesses
      where businesses.id = members.business_id and businesses.charges_enabled
    )
  );

-- Suspending or reactivating a member is a business decision; members can't change their own.
create policy "owners and admins can change a member's status"
  on public.members for update to authenticated
  using (private.has_business_role(business_id, '{owner,admin}'))
  with check (private.has_business_role(business_id, '{owner,admin}'));

-- Profiles ---------------------------------------------------------------------------------

drop policy "users can view their own and their colleagues' profiles" on public.profiles;

-- Staff also see their members' profiles (for the members list). Members don't see each other.
create policy "users can view their own profile and the people at their businesses"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.business_staff
      where business_staff.user_id = profiles.id
        and private.has_business_role(business_staff.business_id, '{owner,admin,staff}')
    )
    or exists (
      select 1
      from public.members
      where members.user_id = profiles.id
        and private.has_business_role(members.business_id, '{owner,admin,staff}')
    )
  );
