begin;
select plan(16);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('outsider@test.local');

-- Creating a business ----------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select isnt(
  public.create_business('Iron Gym', 'iron-gym'),
  null,
  'a signed-in user can create a business'
);
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
reset role;

select results_eq(
  $$
    select s.user_id, s.role::text
    from public.business_staff s
    join public.businesses b on b.id = s.business_id
    where b.slug = 'iron-gym'
  $$,
  $$ values (tests.get_user_id('owner-a@test.local'), 'owner') $$,
  'the creator becomes the only staff member, as owner'
);

insert into public.business_staff (business_id, user_id, role) values
  ((select id from public.businesses where slug = 'iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  ((select id from public.businesses where slug = 'iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.create_business('Anon Gym', 'anon-gym') $$,
  '42501', 'permission denied for function create_business',
  'visitors who are not signed in cannot create a business'
);
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select public.create_business('No User', 'no-user') $$,
  '42501', 'You must be signed in to create a business',
  'create_business refuses a call with no signed-in user'
);

-- Seeing businesses ------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select results_eq(
  $$ select slug from public.businesses $$,
  $$ values ('iron-gym') $$,
  'an owner sees only their own business'
);
select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$ select slug from public.businesses $$,
  $$ values ('iron-gym') $$,
  'staff see the business they work at'
);
select tests.authenticate_as('owner-b@test.local');
select results_eq(
  $$ select slug from public.businesses $$,
  $$ values ('yoga-loft') $$,
  'the owner of business B cannot see business A'
);
select tests.authenticate_as('outsider@test.local');
select is_empty(
  $$ select 1 from public.businesses $$,
  'a user with no business sees none'
);

-- Changing businesses ----------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
update public.businesses set name = 'Iron Gym Downtown' where slug = 'iron-gym';
reset role;
select is(
  (select name from public.businesses where slug = 'iron-gym'),
  'Iron Gym Downtown',
  'admins can rename their business'
);

select tests.authenticate_as('staff-a@test.local');
update public.businesses set name = 'Renamed By Staff' where slug = 'iron-gym';
select tests.authenticate_as('owner-b@test.local');
update public.businesses set name = 'Taken Over' where slug = 'iron-gym';
reset role;
select is(
  (select name from public.businesses where slug = 'iron-gym'),
  'Iron Gym Downtown',
  'staff, and owners of other businesses, cannot rename a business'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ update public.businesses set slug = 'new-slug' where slug = 'iron-gym' $$,
  '42501', 'permission denied for table businesses',
  'owners cannot change the slug'
);
select throws_ok(
  $$ update public.businesses set charges_enabled = true where slug = 'iron-gym' $$,
  '42501', 'permission denied for table businesses',
  'owners cannot mark their own business as able to take payments'
);
select throws_ok(
  $$ update public.businesses set stripe_account_id = 'acct_fake' where slug = 'iron-gym' $$,
  '42501', 'permission denied for table businesses',
  'owners cannot point their business at a different Stripe account'
);
select throws_ok(
  $$ insert into public.businesses (name, slug) values ('Direct', 'direct-insert') $$,
  '42501', 'permission denied for table businesses',
  'businesses can only be created through create_business'
);
select throws_ok(
  $$ delete from public.businesses where slug = 'iron-gym' $$,
  '42501', 'permission denied for table businesses',
  'users cannot delete businesses'
);
reset role;

select results_eq(
  $$ select slug, charges_enabled, stripe_account_id from public.businesses where slug = 'iron-gym' $$,
  $$ values ('iron-gym', false, null::text) $$,
  'the business is unchanged after the refused changes'
);

select * from finish();
rollback;
