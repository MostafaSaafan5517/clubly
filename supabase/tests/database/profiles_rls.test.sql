begin;
select plan(8);

select tests.create_user('owner-a@test.local', 'Alice Owner');
select tests.create_user('staff-a@test.local', 'Sam Staff');
select tests.create_user('owner-b@test.local', 'Bea Owner');
select tests.create_user('outsider@test.local', 'Olly Outsider');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
reset role;

insert into public.business_staff (business_id, user_id, role)
values (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

-- Seeing profiles --------------------------------------------------------------------------

select tests.authenticate_as('outsider@test.local');
select set_eq(
  $$ select email from public.profiles $$,
  $$ values ('outsider@test.local') $$,
  'a user with no business sees only their own profile'
);
select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$ select email from public.profiles $$,
  $$ values ('staff-a@test.local'), ('owner-a@test.local') $$,
  'staff see their colleagues'' profiles and nobody else''s'
);
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select email from public.profiles $$,
  $$ values ('owner-b@test.local') $$,
  'the owner of business B cannot see business A''s people'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.profiles $$,
  '42501', 'permission denied for table profiles',
  'visitors who are not signed in cannot read profiles'
);

-- Changing profiles ------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
update public.profiles set full_name = 'Alice A. Owner' where email = 'owner-a@test.local';
update public.profiles set full_name = 'Renamed By Boss' where email = 'staff-a@test.local';
select throws_ok(
  $$ update public.profiles set email = 'stolen@test.local' where email = 'owner-a@test.local' $$,
  '42501', 'permission denied for table profiles',
  'users cannot change their email here (it comes from auth)'
);
select throws_ok(
  $$ insert into public.profiles (id, email) values (gen_random_uuid(), 'fake@test.local') $$,
  '42501', 'permission denied for table profiles',
  'users cannot create profiles directly'
);
reset role;

select is(
  (select full_name from public.profiles where email = 'owner-a@test.local'),
  'Alice A. Owner',
  'users can change their own name'
);
select is(
  (select full_name from public.profiles where email = 'staff-a@test.local'),
  'Sam Staff',
  'users cannot change a colleague''s name, even as owner'
);

select * from finish();
rollback;
