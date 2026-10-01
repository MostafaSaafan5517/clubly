begin;
select plan(15);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('member-1@test.local');
select tests.create_user('member-2@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('member-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
select public.create_business('Closed Studio', 'closed-studio');
reset role;

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

update public.businesses set charges_enabled = true where slug in ('iron-gym', 'yoga-loft');

-- Joining ----------------------------------------------------------------------------------

select tests.authenticate_as('member-1@test.local');
select lives_ok(
  $$
    insert into public.members (business_id, user_id)
    values (tests.business_id('iron-gym'), tests.get_user_id('member-1@test.local'))
  $$,
  'a user can join a business that takes payments'
);
select throws_ok(
  $$
    insert into public.members (business_id, user_id)
    values (tests.business_id('iron-gym'), tests.get_user_id('member-1@test.local'))
  $$,
  '23505', null,
  'a user cannot join the same business twice'
);
select throws_ok(
  $$
    insert into public.members (business_id, user_id)
    values (tests.business_id('iron-gym'), tests.get_user_id('member-2@test.local'))
  $$,
  '42501', 'new row violates row-level security policy for table "members"',
  'a user cannot sign someone else up'
);
select throws_ok(
  $$
    insert into public.members (business_id, user_id)
    values (tests.business_id('closed-studio'), tests.get_user_id('member-1@test.local'))
  $$,
  '42501', 'new row violates row-level security policy for table "members"',
  'a user cannot join a business that cannot take payments yet'
);
select throws_ok(
  $$
    insert into public.members (business_id, user_id, stripe_customer_id)
    values (tests.business_id('yoga-loft'), tests.get_user_id('member-1@test.local'), 'cus_fake')
  $$,
  '42501', 'permission denied for table members',
  'users cannot set their own Stripe customer id'
);

select tests.authenticate_as('member-2@test.local');
insert into public.members (business_id, user_id)
values (tests.business_id('iron-gym'), tests.get_user_id('member-2@test.local'));
select tests.authenticate_as('member-b@test.local');
insert into public.members (business_id, user_id)
values (tests.business_id('yoga-loft'), tests.get_user_id('member-b@test.local'));

-- Seeing members ---------------------------------------------------------------------------

select tests.authenticate_as('member-1@test.local');
select set_eq(
  $$ select user_id from public.members $$,
  $$ values (tests.get_user_id('member-1@test.local')) $$,
  'members see only their own membership'
);
select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$ select user_id from public.members $$,
  $$ values (tests.get_user_id('member-1@test.local')), (tests.get_user_id('member-2@test.local')) $$,
  'staff see their business''s members'
);
select throws_ok(
  $$ select stripe_customer_id from public.members $$,
  '42501', 'permission denied for table members',
  'Stripe customer ids are not readable through the API'
);
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select user_id from public.members $$,
  $$ values (tests.get_user_id('member-b@test.local')) $$,
  'the owner of business B cannot see business A''s members'
);

-- A member keeps seeing their business even after it stops taking payments.
reset role;
update public.businesses set charges_enabled = false where slug = 'iron-gym';
select tests.authenticate_as('member-1@test.local');
select set_eq(
  $$ select slug from public.businesses $$,
  $$ values ('iron-gym'), ('yoga-loft') $$,
  'members still see their business when it stops taking payments (plus public ones)'
);
select tests.authenticate_as('member-b@test.local');
select set_eq(
  $$ select slug from public.businesses $$,
  $$ values ('yoga-loft') $$,
  'non-members do not see a business once it stops taking payments'
);

-- Changing members -------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
update public.members set status = 'suspended'
where user_id = tests.get_user_id('member-2@test.local');
select tests.authenticate_as('staff-a@test.local');
update public.members set status = 'suspended'
where user_id = tests.get_user_id('member-1@test.local');
select tests.authenticate_as('member-1@test.local');
update public.members set status = 'suspended'
where user_id = tests.get_user_id('member-1@test.local');
select tests.authenticate_as('owner-b@test.local');
update public.members set status = 'suspended'
where user_id = tests.get_user_id('member-1@test.local');
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    update public.members set business_id = tests.business_id('yoga-loft')
    where user_id = tests.get_user_id('member-1@test.local')
  $$,
  '42501', 'permission denied for table members',
  'a membership cannot be moved to another business'
);
select throws_ok(
  $$ delete from public.members where user_id = tests.get_user_id('member-1@test.local') $$,
  '42501', 'permission denied for table members',
  'memberships cannot be deleted through the API'
);
reset role;

select is(
  (select status::text from public.members where user_id = tests.get_user_id('member-2@test.local')),
  'suspended',
  'admins can suspend a member'
);
select is(
  (select status::text from public.members where user_id = tests.get_user_id('member-1@test.local')),
  'active',
  'staff, the member themselves, and other businesses cannot change a member''s status'
);

select * from finish();
rollback;
