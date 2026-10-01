-- What a visitor who is not signed in can reach: exactly what a business's public join page
-- needs, and nothing else.
begin;
select plan(11);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('member-a@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
reset role;

-- Iron Gym can take payments and has a connected Stripe account; Yoga Loft is still onboarding.
update public.businesses set charges_enabled = true, stripe_account_id = 'acct_iron'
where slug = 'iron-gym';

insert into public.plans (business_id, name, billing_interval, amount, active, stripe_price_id) values
  (tests.business_id('iron-gym'), 'Monthly', 'month', 3000, true, 'price_iron_monthly'),
  (tests.business_id('iron-gym'), 'Old Yearly', 'year', 25000, false, null),
  (tests.business_id('yoga-loft'), 'Yoga Monthly', 'month', 4000, true, null);

insert into public.members (business_id, user_id)
values (tests.business_id('iron-gym'), tests.get_user_id('member-a@test.local'));

select tests.authenticate_as_anon();

-- What the join page reads
select results_eq(
  $$ select name, slug from public.businesses $$,
  $$ values ('Iron Gym', 'iron-gym') $$,
  'visitors see only businesses that take payments'
);
select results_eq(
  $$ select name, billing_interval::text, amount, currency from public.plans $$,
  $$ values ('Monthly', 'month', 3000, 'usd') $$,
  'visitors see only active plans of businesses that take payments'
);

-- What it must not read
select throws_ok(
  $$ select stripe_account_id from public.businesses $$,
  '42501', 'permission denied for table businesses',
  'visitors cannot read Stripe account ids'
);
select throws_ok(
  $$ select stripe_price_id from public.plans $$,
  '42501', 'permission denied for table plans',
  'visitors cannot read Stripe price ids'
);
select throws_ok(
  $$ select 1 from public.members $$,
  '42501', 'permission denied for table members',
  'visitors cannot read members'
);
select throws_ok(
  $$ select 1 from public.business_staff $$,
  '42501', 'permission denied for table business_staff',
  'visitors cannot read staff'
);
select throws_ok(
  $$ select 1 from public.profiles $$,
  '42501', 'permission denied for table profiles',
  'visitors cannot read profiles'
);

-- What it must not change
select throws_ok(
  $$
    insert into public.members (business_id, user_id)
    values (tests.business_id('iron-gym'), tests.get_user_id('member-a@test.local'))
  $$,
  '42501', 'permission denied for table members',
  'visitors cannot join without signing in'
);
select throws_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount)
    values (tests.business_id('iron-gym'), 'Free', 'month', 1)
  $$,
  '42501', 'permission denied for table plans',
  'visitors cannot create plans'
);
select throws_ok(
  $$ update public.businesses set name = 'Defaced' $$,
  '42501', 'permission denied for table businesses',
  'visitors cannot change businesses'
);

-- The same join page for a signed-in user who isn't staff or a member.
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select name from public.plans where business_id = tests.business_id('iron-gym') $$,
  $$ values ('Monthly') $$,
  'signed-in users browsing another business see the same public plans'
);

select * from finish();
rollback;
