-- A member's account page names the plan they subscribe to. Until now a plan was visible only to
-- staff and, while it's on sale, to everyone, so a member whose plan was later archived (or whose
-- business stopped taking payments) would lose sight of what they're paying for.

-- True when the signed-in user has a subscription, in any status, to the plan. Security definer
-- like the other helpers, so the plans policy doesn't run through the subscriptions and members
-- policies on every row.
create function private.subscribes_to_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions
    join public.members on members.id = subscriptions.member_id
    where subscriptions.plan_id = target_plan_id
      and members.user_id = (select auth.uid())
  );
$$;

grant execute on function private.subscribes_to_plan(uuid) to authenticated;

alter policy "staff see all plans; everyone sees active plans of businesses that take payments"
  on public.plans
  rename to "staff and subscribers see their plans; all see plans on sale";

alter policy "staff and subscribers see their plans; all see plans on sale"
  on public.plans
  using (
    private.has_business_role(business_id, '{owner,admin,staff}')
    or private.subscribes_to_plan(id)
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
