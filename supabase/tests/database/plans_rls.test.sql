begin;
select plan(12);

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('outsider@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
reset role;

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

-- Iron Gym can take payments (what the Stripe webhook will set); Yoga Loft can't yet.
update public.businesses set charges_enabled = true where slug = 'iron-gym';

insert into public.plans (business_id, name, billing_interval, amount, active, stripe_price_id) values
  (tests.business_id('iron-gym'), 'Monthly', 'month', 3000, true, 'price_iron_monthly'),
  (tests.business_id('iron-gym'), 'Old Yearly', 'year', 25000, false, null),
  (tests.business_id('yoga-loft'), 'Yoga Monthly', 'month', 4000, true, null);

-- Seeing plans -----------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$ select name from public.plans where business_id = tests.business_id('iron-gym') $$,
  $$ values ('Monthly'), ('Old Yearly') $$,
  'staff see all of their business''s plans, archived ones included'
);
select tests.authenticate_as('outsider@test.local');
select set_eq(
  $$ select name from public.plans $$,
  $$ values ('Monthly') $$,
  'other users see only active plans of businesses that take payments'
);
select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$ select stripe_price_id from public.plans $$,
  '42501', 'permission denied for table plans',
  'Stripe price ids are not readable through the API'
);

-- Creating plans ---------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
select lives_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount)
    values (tests.business_id('iron-gym'), 'Yearly', 'year', 30000)
  $$,
  'admins can create plans'
);
select throws_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount, stripe_price_id)
    values (tests.business_id('iron-gym'), 'Sneaky', 'month', 100, 'price_someone_elses')
  $$,
  '42501', 'permission denied for table plans',
  'users cannot set a plan''s Stripe price id'
);
select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount)
    values (tests.business_id('iron-gym'), 'Staff Special', 'month', 100)
  $$,
  '42501', 'new row violates row-level security policy for table "plans"',
  'staff cannot create plans'
);
select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount)
    values (tests.business_id('iron-gym'), 'Planted', 'month', 100)
  $$,
  '42501', 'new row violates row-level security policy for table "plans"',
  'the owner of business B cannot create plans for business A'
);

-- Changing plans ---------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
update public.plans set active = false, name = 'Staff Edit' where name = 'Monthly';
select tests.authenticate_as('owner-b@test.local');
update public.plans set active = false, name = 'Hijacked' where name = 'Monthly';
reset role;
select results_eq(
  $$ select name, active from public.plans where stripe_price_id = 'price_iron_monthly' $$,
  $$ values ('Monthly', true) $$,
  'staff, and owners of other businesses, cannot edit a plan'
);

select tests.authenticate_as('owner-a@test.local');
update public.plans set name = 'Monthly Classic', active = false where name = 'Monthly';
select throws_ok(
  $$ update public.plans set amount = 1 where name = 'Monthly Classic' $$,
  '42501', 'permission denied for table plans',
  'a plan''s price cannot be changed after creation'
);
select throws_ok(
  $$ update public.plans set currency = 'eur' where name = 'Monthly Classic' $$,
  '42501', 'permission denied for table plans',
  'a plan''s currency cannot be changed after creation'
);
select throws_ok(
  $$ delete from public.plans where name = 'Monthly Classic' $$,
  '42501', 'permission denied for table plans',
  'plans cannot be deleted, only archived'
);
reset role;
select results_eq(
  $$ select name, active, amount from public.plans where stripe_price_id = 'price_iron_monthly' $$,
  $$ values ('Monthly Classic', false, 3000) $$,
  'owners can rename and archive a plan, and its price is unchanged'
);

select * from finish();
rollback;
