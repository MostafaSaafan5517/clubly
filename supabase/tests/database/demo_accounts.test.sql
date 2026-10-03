begin;
select plan(16);
select tests.clear_tenant_data();

select tests.create_user('demo-owner@test.local');
select tests.create_user('demo-member@test.local');
select tests.create_user('real-owner@test.local');

select tests.authenticate_as('demo-owner@test.local');
select public.create_business('Demo Gym', 'demo-gym');
select tests.authenticate_as('real-owner@test.local');
select public.create_business('Real Gym', 'real-gym');
select tests.act_as_database();

insert into public.plans (business_id, name, billing_interval, amount)
values (tests.business_id('demo-gym'), 'Monthly', 'month', 3000);
insert into public.members (business_id, user_id)
values (tests.business_id('demo-gym'), tests.get_user_id('demo-member@test.local'));

-- What pnpm seed:demo does once the demo is in place.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"demo": true}'
where email in ('demo-owner@test.local', 'demo-member@test.local');

-- Demo accounts can look --------------------------------------------------------------------

select tests.authenticate_as('demo-owner@test.local');
select results_eq(
  $$ select name, (select count(*) from public.plans), (select count(*) from public.members)
     from public.businesses $$,
  $$ values ('Demo Gym'::text, 1::bigint, 1::bigint) $$,
  'a demo owner still sees their business, its plans and its members'
);

-- ...but not change anything ----------------------------------------------------------------

select throws_ok(
  $$ update public.businesses set name = 'Taken Over' $$,
  '42501', 'Demo accounts are read-only',
  'a demo owner cannot rename their business'
);
select throws_ok(
  $$ insert into public.plans (business_id, name, billing_interval, amount)
     values (tests.business_id('demo-gym'), 'Free', 'month', 50) $$,
  '42501', 'Demo accounts are read-only',
  'a demo owner cannot create plans'
);
select throws_ok(
  $$ update public.plans set active = false $$,
  '42501', 'Demo accounts are read-only',
  'a demo owner cannot archive plans'
);
select throws_ok(
  $$ update public.members set status = 'suspended' $$,
  '42501', 'Demo accounts are read-only',
  'a demo owner cannot suspend members'
);
select throws_ok(
  $$ insert into public.business_staff (business_id, user_id, role)
     values (tests.business_id('demo-gym'), tests.get_user_id('real-owner@test.local'), 'admin') $$,
  '42501', 'Demo accounts are read-only',
  'a demo owner cannot add staff'
);
select throws_ok(
  $$ select public.create_business('Another Gym', 'another-gym') $$,
  '42501', 'Demo accounts are read-only',
  'a demo account cannot create a business'
);
select throws_ok(
  $$ update public.profiles set full_name = 'Someone Else' $$,
  '42501', 'Demo accounts are read-only',
  'a demo account cannot rename itself'
);

select tests.authenticate_as('demo-member@test.local');
select throws_ok(
  $$ insert into public.members (business_id, user_id)
     values (tests.business_id('real-gym'), tests.get_user_id('demo-member@test.local')) $$,
  '42501', 'Demo accounts are read-only',
  'a demo member cannot join another business'
);

-- Everyone else is unaffected ---------------------------------------------------------------

select tests.authenticate_as('real-owner@test.local');
select lives_ok(
  $$ update public.businesses set name = 'Real Gym & Spa' where id = tests.business_id('real-gym') $$,
  'other accounts still change their own data'
);
select tests.authenticate_as_service_role();
select lives_ok(
  $$ update public.businesses set charges_enabled = true where id = tests.business_id('demo-gym') $$,
  'server code (webhooks, reconciliation) still updates the demo business'
);

-- Sign-in details ---------------------------------------------------------------------------

select tests.act_as_database();
select throws_ok(
  $$ update auth.users set encrypted_password = 'changed' where email = 'demo-owner@test.local' $$,
  '42501', 'Demo accounts can''t change their sign-in details',
  'a demo account''s password cannot change'
);
select throws_ok(
  $$ update auth.users set email_change = 'mine@example.com' where email = 'demo-owner@test.local' $$,
  '42501', 'Demo accounts can''t change their sign-in details',
  'a demo account cannot start an email change'
);
select throws_ok(
  $$ delete from auth.users where email = 'demo-member@test.local' $$,
  '42501', 'Demo accounts can''t be deleted',
  'a demo account cannot be deleted'
);
select lives_ok(
  $$ update auth.users set encrypted_password = 'changed' where email = 'real-owner@test.local' $$,
  'other accounts still change their password'
);

-- The seed script's way back in: remove the mark, then the password can be reset.
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'demo'
where email = 'demo-owner@test.local';
select lives_ok(
  $$ update auth.users set encrypted_password = 'reset' where email = 'demo-owner@test.local' $$,
  'once unmarked, a demo account''s password can be reset'
);

select * from finish();
rollback;
