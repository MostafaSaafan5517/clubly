begin;
select plan(27);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local', 'Olivia Owner');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('newcomer@test.local', 'Nina Newcomer');
select tests.create_user('second@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
select tests.act_as_database();

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

create function pg_temp.token_hash(token text) returns text language sql as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.token_hash(text) to authenticated;

-- Making invites ----------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select lives_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash)
     values (tests.business_id('iron-gym'), 'admin', pg_temp.token_hash('admin-link')) $$,
  'owners invite admins'
);
select throws_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash)
     values (tests.business_id('iron-gym'), 'owner', pg_temp.token_hash('owner-link')) $$,
  '42501', 'new row violates row-level security policy for table "staff_invites"',
  'nobody invites an owner'
);
select throws_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash, expires_at)
     values (tests.business_id('iron-gym'), 'staff', pg_temp.token_hash('forever'), 'infinity') $$,
  '42501', 'permission denied for table staff_invites',
  'users cannot choose when an invite expires'
);
select throws_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash, created_by)
     values (tests.business_id('iron-gym'), 'staff', pg_temp.token_hash('framed'),
             tests.get_user_id('admin-a@test.local')) $$,
  '42501', 'permission denied for table staff_invites',
  'users cannot say someone else made an invite'
);

select tests.authenticate_as('admin-a@test.local');
select lives_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash)
     values (tests.business_id('iron-gym'), 'staff', pg_temp.token_hash('staff-link')) $$,
  'admins invite staff'
);
select throws_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash)
     values (tests.business_id('iron-gym'), 'admin', pg_temp.token_hash('admin-by-admin')) $$,
  '42501', 'new row violates row-level security policy for table "staff_invites"',
  'admins cannot invite admins'
);

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash)
     values (tests.business_id('iron-gym'), 'staff', pg_temp.token_hash('staff-by-staff')) $$,
  '42501', 'new row violates row-level security policy for table "staff_invites"',
  'staff cannot invite anyone'
);

select tests.authenticate_as('owner-b@test.local');
select throws_ok(
  $$ insert into public.staff_invites (business_id, role, token_hash)
     values (tests.business_id('iron-gym'), 'staff', pg_temp.token_hash('cross-tenant')) $$,
  '42501', 'new row violates row-level security policy for table "staff_invites"',
  'owners cannot invite people to another business'
);

select tests.act_as_database();
select results_eq(
  $$ select role::text, created_by, expires_at - created_at
     from public.staff_invites order by role $$,
  $$ values ('admin', tests.get_user_id('owner-a@test.local'), interval '7 days'),
            ('staff', tests.get_user_id('admin-a@test.local'), interval '7 days') $$,
  'an invite records who made it and expires in a week'
);

-- Seeing invites ----------------------------------------------------------------------------

select tests.authenticate_as('admin-a@test.local');
select results_eq(
  $$ select role::text from public.staff_invites order by role $$,
  $$ values ('admin'), ('staff') $$,
  'owners and admins see their business''s invites'
);
select throws_ok(
  $$ select token_hash from public.staff_invites $$,
  '42501', 'permission denied for table staff_invites',
  'nobody reads the token hashes back'
);
select tests.authenticate_as('staff-a@test.local');
select is_empty($$ select 1 from public.staff_invites $$, 'staff see no invites');
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select 1 from public.staff_invites $$,
  'other businesses'' owners see no invites'
);

-- Opening a link ----------------------------------------------------------------------------

select tests.authenticate_as('newcomer@test.local');
select results_eq(
  $$ select business_name, role::text from public.staff_invite_details('admin-link') $$,
  $$ values ('Iron Gym', 'admin') $$,
  'whoever holds a link sees which business and role it''s for'
);
select is_empty(
  $$ select 1 from public.staff_invite_details('no-such-link') $$,
  'an unknown link shows nothing'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.staff_invite_details('admin-link') $$,
  '42501', 'permission denied for function staff_invite_details',
  'visitors must sign in to open a link'
);

-- Accepting ---------------------------------------------------------------------------------

select tests.authenticate_as('newcomer@test.local');
select is(
  public.accept_staff_invite('admin-link'), 'iron-gym',
  'accepting a link answers with the business''s address'
);
select tests.act_as_database();
select results_eq(
  $$ select role::text from public.business_staff
     where user_id = tests.get_user_id('newcomer@test.local') $$,
  $$ values ('admin') $$,
  'the newcomer works at the business with the invite''s role'
);
select results_eq(
  $$ select accepted_by from public.staff_invites where role = 'admin' $$,
  $$ values (tests.get_user_id('newcomer@test.local')) $$,
  'the invite records who used it'
);

select tests.authenticate_as('second@test.local');
select throws_ok(
  $$ select public.accept_staff_invite('admin-link') $$,
  'P0002', 'This invite link is invalid, used or expired',
  'a link works only once'
);
select is_empty(
  $$ select 1 from public.staff_invite_details('admin-link') $$,
  'a used link shows nothing'
);

select tests.authenticate_as('staff-a@test.local');
select throws_ok(
  $$ select public.accept_staff_invite('staff-link') $$,
  '23505', 'You already work at this business',
  'someone already on the staff cannot use a link'
);

select tests.act_as_database();
update public.staff_invites set expires_at = now() - interval '1 second' where role = 'staff';
select tests.authenticate_as('second@test.local');
select throws_ok(
  $$ select public.accept_staff_invite('staff-link') $$,
  'P0002', 'This invite link is invalid, used or expired',
  'an expired link no longer works'
);

-- Revoking ----------------------------------------------------------------------------------

select tests.act_as_database();
insert into public.staff_invites (business_id, role, token_hash, created_by) values
  (tests.business_id('iron-gym'), 'admin', pg_temp.token_hash('pending-admin'),
   tests.get_user_id('owner-a@test.local'));

select tests.authenticate_as('admin-a@test.local');
delete from public.staff_invites where role = 'admin';
select tests.act_as_database();
select results_eq(
  $$ select count(*) from public.staff_invites where role = 'admin' $$,
  $$ values (2::bigint) $$,
  'admins cannot revoke admin invites'
);

select tests.authenticate_as('owner-a@test.local');
delete from public.staff_invites where role = 'admin';
select tests.act_as_database();
select results_eq(
  $$ select accepted_by from public.staff_invites where role = 'admin' $$,
  $$ values (tests.get_user_id('newcomer@test.local')) $$,
  'owners revoke unused invites; used ones stay as a record'
);

-- History -----------------------------------------------------------------------------------

select results_eq(
  $$ select action, actor from public.audit_log
     where table_name = 'staff_invites' and business_id = tests.business_id('iron-gym')
     order by id $$,
  $$ values ('insert', 'user'), ('insert', 'user'), ('update', 'user'), ('update', 'database'),
            ('insert', 'database'), ('delete', 'user') $$,
  'making, using and revoking invites is in the business''s history'
);
select results_eq(
  $$ select actor_user_id from public.audit_log
     where table_name = 'business_staff' and action = 'insert'
       and record_id = tests.get_user_id('newcomer@test.local') $$,
  $$ values (tests.get_user_id('newcomer@test.local')) $$,
  'the history shows the newcomer joining by themselves'
);

select * from finish();
rollback;
