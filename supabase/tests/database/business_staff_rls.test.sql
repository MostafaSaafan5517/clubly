begin;
select plan(19);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('staff-a2@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('outsider@test.local');
select tests.create_user('new-1@test.local');
select tests.create_user('new-2@test.local');
select tests.create_user('new-3@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
reset role;

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a2@test.local'), 'staff');

-- Seeing staff -----------------------------------------------------------------------------

select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$ select user_id from public.business_staff $$,
  $$
    values (tests.get_user_id('owner-a@test.local')), (tests.get_user_id('admin-a@test.local')),
           (tests.get_user_id('staff-a@test.local')), (tests.get_user_id('staff-a2@test.local'))
  $$,
  'staff see everyone at their own business'
);
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select user_id from public.business_staff $$,
  $$ values (tests.get_user_id('owner-b@test.local')) $$,
  'the owner of business B cannot see business A''s staff'
);
select tests.authenticate_as('outsider@test.local');
select is_empty($$ select 1 from public.business_staff $$, 'a user with no business sees no staff');

-- Adding staff -----------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values (tests.business_id('iron-gym'), tests.get_user_id('new-1@test.local'), 'admin')
  $$,
  'owners can add admins'
);
select throws_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values (tests.business_id('iron-gym'), tests.get_user_id('new-3@test.local'), 'owner')
  $$,
  '42501', 'new row violates row-level security policy for table "business_staff"',
  'nobody can add a second owner'
);

select tests.authenticate_as('admin-a@test.local');
select lives_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values (tests.business_id('iron-gym'), tests.get_user_id('new-2@test.local'), 'staff')
  $$,
  'admins can add staff'
);
select throws_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values (tests.business_id('iron-gym'), tests.get_user_id('new-3@test.local'), 'admin')
  $$,
  '42501', 'new row violates row-level security policy for table "business_staff"',
  'admins cannot add admins'
);

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values (tests.business_id('iron-gym'), tests.get_user_id('new-3@test.local'), 'staff')
  $$,
  '42501', 'new row violates row-level security policy for table "business_staff"',
  'staff cannot add anyone'
);

select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values (tests.business_id('iron-gym'), tests.get_user_id('new-3@test.local'), 'staff')
  $$,
  '42501', 'new row violates row-level security policy for table "business_staff"',
  'the owner of business B cannot add staff to business A'
);

-- Changing roles ---------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
update public.business_staff set role = 'admin'
where user_id = tests.get_user_id('staff-a@test.local');
update public.business_staff set role = 'admin'
where user_id = tests.get_user_id('owner-a@test.local');
select throws_ok(
  $$
    update public.business_staff set role = 'owner'
    where user_id = tests.get_user_id('staff-a2@test.local')
  $$,
  '42501', 'new row violates row-level security policy for table "business_staff"',
  'nobody can be promoted to owner'
);
select throws_ok(
  $$
    update public.business_staff set business_id = tests.business_id('yoga-loft')
    where user_id = tests.get_user_id('staff-a2@test.local')
  $$,
  '42501', 'permission denied for table business_staff',
  'a staff row cannot be moved to another business'
);

select tests.authenticate_as('admin-a@test.local');
update public.business_staff set role = 'admin'
where user_id = tests.get_user_id('staff-a2@test.local');
reset role;

select is(
  (select role::text from public.business_staff where user_id = tests.get_user_id('staff-a@test.local')),
  'admin',
  'owners can change a staff member''s role'
);
select is(
  (select role::text from public.business_staff where user_id = tests.get_user_id('owner-a@test.local')),
  'owner',
  'the owner cannot change their own role'
);
select is(
  (select role::text from public.business_staff where user_id = tests.get_user_id('staff-a2@test.local')),
  'staff',
  'admins cannot change roles'
);

-- Removing staff ---------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
delete from public.business_staff where user_id = tests.get_user_id('staff-a2@test.local');
delete from public.business_staff where user_id = tests.get_user_id('new-1@test.local');
select tests.authenticate_as('owner-b@test.local');
delete from public.business_staff where user_id = tests.get_user_id('admin-a@test.local');
select tests.authenticate_as('new-2@test.local');
delete from public.business_staff where user_id = tests.get_user_id('new-2@test.local');
select tests.authenticate_as('owner-a@test.local');
delete from public.business_staff where user_id = tests.get_user_id('owner-a@test.local');
reset role;

select is_empty(
  $$ select 1 from public.business_staff where user_id = tests.get_user_id('staff-a2@test.local') $$,
  'admins can remove staff'
);
select isnt_empty(
  $$ select 1 from public.business_staff where user_id = tests.get_user_id('new-1@test.local') $$,
  'admins cannot remove other admins'
);
select isnt_empty(
  $$ select 1 from public.business_staff where user_id = tests.get_user_id('admin-a@test.local') $$,
  'the owner of business B cannot remove business A''s staff'
);
select is_empty(
  $$ select 1 from public.business_staff where user_id = tests.get_user_id('new-2@test.local') $$,
  'staff can leave a business'
);
select isnt_empty(
  $$ select 1 from public.business_staff where user_id = tests.get_user_id('owner-a@test.local') $$,
  'the owner cannot leave their business'
);

select * from finish();
rollback;
