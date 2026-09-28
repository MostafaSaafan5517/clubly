-- Who can see and change businesses, business staff and profiles, and how a business is created.

-- RLS policies run as the calling user, so signed-in users need to reach the helper below.
-- The schema is still not exposed through the API.
grant usage on schema private to authenticated;

-- True when the signed-in user works at the business with one of the given roles.
-- Security definer so it can read business_staff without going through business_staff's own
-- RLS; otherwise the staff policies, which call this function, would recurse into themselves.
create function private.has_business_role(
  target_business_id uuid,
  allowed_roles public.staff_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_staff
    where business_id = target_business_id
      and user_id = (select auth.uid())
      and role = any (allowed_roles)
  );
$$;

grant execute on function private.has_business_role(uuid, public.staff_role[]) to authenticated;

-- Businesses -------------------------------------------------------------------------------

-- Only the name can be changed by users. Stripe fields change only from server-side code, and
-- the slug is part of public URLs.
grant select on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;

create policy "staff can view their businesses"
  on public.businesses for select to authenticated
  using (private.has_business_role(id, '{owner,admin,staff}'));

create policy "owners and admins can rename their business"
  on public.businesses for update to authenticated
  using (private.has_business_role(id, '{owner,admin}'))
  with check (private.has_business_role(id, '{owner,admin}'));

-- Creating a business inserts the business and its owner in one transaction. Plain inserts
-- can't do this under RLS: the creator isn't staff until the second insert, so the first one
-- would have nothing to satisfy a policy.
create function public.create_business(business_name text, business_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_id uuid := (select auth.uid());
  new_business_id uuid;
begin
  if creator_id is null then
    raise exception 'You must be signed in to create a business' using errcode = '42501';
  end if;

  insert into public.businesses (name, slug)
  values (business_name, business_slug)
  returning id into new_business_id;

  insert into public.business_staff (business_id, user_id, role)
  values (new_business_id, creator_id, 'owner');

  return new_business_id;
end;
$$;

grant execute on function public.create_business(text, text) to authenticated;

-- Business staff ---------------------------------------------------------------------------

grant select, insert, delete on public.business_staff to authenticated;
grant update (role) on public.business_staff to authenticated;

create policy "staff can view their colleagues"
  on public.business_staff for select to authenticated
  using (private.has_business_role(business_id, '{owner,admin,staff}'));

-- Owners add admins or staff; admins add staff. Nobody inserts an owner: only
-- create_business does that.
create policy "owners and admins can add staff"
  on public.business_staff for insert to authenticated
  with check (
    (role = 'staff' and private.has_business_role(business_id, '{owner,admin}'))
    or (role = 'admin' and private.has_business_role(business_id, '{owner}'))
  );

-- Only the owner changes roles. The owner's own row can't change (a business always keeps its
-- owner), and nobody can be promoted to owner.
create policy "owners can change staff roles"
  on public.business_staff for update to authenticated
  using (role <> 'owner' and private.has_business_role(business_id, '{owner}'))
  with check (role <> 'owner');

-- Owners remove admins or staff, admins remove staff, and anyone except the owner can leave.
create policy "staff can be removed or leave"
  on public.business_staff for delete to authenticated
  using (
    role <> 'owner'
    and (
      private.has_business_role(business_id, '{owner}')
      or (role = 'staff' and private.has_business_role(business_id, '{admin}'))
      or user_id = (select auth.uid())
    )
  );

-- Profiles ---------------------------------------------------------------------------------

-- Email comes from auth and is synced by trigger; users edit only their name.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- One policy per action: Postgres evaluates every permissive policy for each row, so merging
-- them keeps the check to a single pass.
create policy "users can view their own and their colleagues' profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.business_staff
      where business_staff.user_id = profiles.id
        and private.has_business_role(business_staff.business_id, '{owner,admin,staff}')
    )
  );

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
