begin;
select plan(23);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('leaver@test.local');
select tests.create_user('member-1@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
select tests.act_as_database();

-- The audit_log may already hold entries from other test data; every check below looks only at
-- the businesses created in this transaction (their ids are new).

-- Recording changes ---------------------------------------------------------------------------

select results_eq(
  $$
    select table_name, action, actor, actor_user_id, record_id
    from public.audit_log
    where business_id = tests.business_id('iron-gym')
    order by id
  $$,
  $$
    values
      ('businesses', 'insert', 'user', tests.get_user_id('owner-a@test.local'),
        tests.business_id('iron-gym')),
      ('business_staff', 'insert', 'user', tests.get_user_id('owner-a@test.local'),
        tests.get_user_id('owner-a@test.local'))
  $$,
  'creating a business records the business and its owner, done by the signed-in user'
);

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff'),
  (tests.business_id('iron-gym'), tests.get_user_id('leaver@test.local'), 'staff');

select set_eq(
  $$
    select actor from public.audit_log
    where table_name = 'business_staff'
      and record_id = tests.get_user_id('admin-a@test.local')
  $$,
  $$ values ('database') $$,
  'changes made directly in the database are recorded as such'
);

select tests.authenticate_as('owner-a@test.local');
insert into public.plans (business_id, name, billing_interval, amount)
values (tests.business_id('iron-gym'), 'Iron Monthly', 'month', 3000);
update public.plans set active = false where name = 'Iron Monthly';
update public.plans set active = false where name = 'Iron Monthly';
select tests.act_as_database();

select results_eq(
  $$
    select action, changed_columns, old_data ->> 'active', new_data ->> 'active'
    from public.audit_log
    where table_name = 'plans' and business_id = tests.business_id('iron-gym')
    order by id
  $$,
  $$
    values
      ('insert', '{}'::text[], null, 'true'),
      ('update', '{active}'::text[], 'true', 'false')
  $$,
  'inserts and updates are recorded with what changed; an update that changes nothing is not'
);

-- What server code does after creating the Stripe price.
select tests.authenticate_as_service_role();
update public.plans set stripe_price_id = 'price_iron' where name = 'Iron Monthly';
select tests.act_as_database();

select results_eq(
  $$
    select actor, actor_user_id, changed_columns, new_data ? 'stripe_price_id',
      new_data ->> 'has_stripe_price'
    from public.audit_log
    where table_name = 'plans' and business_id = tests.business_id('iron-gym')
    order by id desc
    limit 1
  $$,
  $$ values ('server', null::uuid, '{has_stripe_price,stripe_price_id}'::text[], false, 'true') $$,
  'server code is recorded as the server, and a Stripe id is named but its value is not stored'
);

update public.businesses set stripe_account_id = 'acct_audit_iron' where slug = 'iron-gym';
select tests.authenticate_as_service_role();
select public.apply_account_updated('evt_audit_1', 'acct_audit_iron', true);
select tests.act_as_database();

select results_eq(
  $$
    select actor, changed_columns
    from public.audit_log
    where table_name = 'businesses' and business_id = tests.business_id('iron-gym')
      and action = 'update'
    order by id
  $$,
  $$
    values
      ('database', '{has_stripe_account,stripe_account_id}'::text[]),
      ('stripe_webhook', '{charges_enabled}'::text[])
  $$,
  'a Stripe webhook is recorded as the webhook'
);

insert into public.members (business_id, user_id, stripe_customer_id)
values (tests.business_id('iron-gym'), tests.get_user_id('member-1@test.local'), 'cus_audit_1');
select tests.authenticate_as_service_role();
select public.apply_subscription_event('evt_audit_2', 'customer.subscription.created',
  'acct_audit_iron',
  '{"id": "sub_audit_1", "customer_id": "cus_audit_1", "price_id": "price_iron",
    "status": "active", "current_period_end": 1798761600, "cancel_at": null}');
-- A later event with the same snapshot rewrites only updated_at. (Done by hand here: inside one
-- transaction now() never moves, so a second event couldn't show it.)
update public.subscriptions
set updated_at = updated_at + interval '1 hour'
where stripe_subscription_id = 'sub_audit_1';
select tests.act_as_database();

select results_eq(
  $$
    select action, actor
    from public.audit_log
    where table_name = 'subscriptions' and business_id = tests.business_id('iron-gym')
  $$,
  $$ values ('insert', 'stripe_webhook') $$,
  'an event that only bumps updated_at adds no history'
);

select tests.authenticate_as('owner-a@test.local');
delete from public.business_staff where user_id = tests.get_user_id('leaver@test.local');
select tests.act_as_database();

select results_eq(
  $$
    select action, actor, old_data ->> 'role', new_data
    from public.audit_log
    where table_name = 'business_staff' and action = 'delete'
      and business_id = tests.business_id('iron-gym')
  $$,
  $$ values ('delete', 'user', 'staff', null::jsonb) $$,
  'a delete is recorded with the row as it was'
);

-- A signed-in user can't pass their change off as server code's.
select tests.authenticate_as('owner-a@test.local');
select set_config('app.actor', 'reconciliation', true);
update public.plans set name = 'Iron Monthly Plus' where name = 'Iron Monthly';
select tests.act_as_database();
select set_config('app.actor', '', true);

select results_eq(
  $$
    select actor, changed_columns
    from public.audit_log
    where table_name = 'plans' and business_id = tests.business_id('iron-gym')
    order by id desc
    limit 1
  $$,
  $$ values ('user', '{name}'::text[]) $$,
  'a signed-in user is always recorded as the user'
);

-- Reading the history -------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select set_eq(
  $$ select distinct business_id from public.audit_log $$,
  $$ values (tests.business_id('iron-gym')) $$,
  'owners see their own business''s history, and no one else''s'
);
select tests.authenticate_as('admin-a@test.local');
select set_eq(
  $$ select distinct business_id from public.audit_log $$,
  $$ values (tests.business_id('iron-gym')) $$,
  'admins see their business''s history'
);
select tests.authenticate_as('staff-a@test.local');
select is_empty(
  $$ select 1 from public.audit_log $$,
  'plain staff do not see the history (it includes payments)'
);
select tests.authenticate_as('member-1@test.local');
select is_empty($$ select 1 from public.audit_log $$, 'members do not see the history');
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select distinct business_id from public.audit_log $$,
  $$ values (tests.business_id('yoga-loft')) $$,
  'the owner of business B sees only business B''s history'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.audit_log $$,
  '42501', 'permission denied for table audit_log',
  'visitors cannot read the history'
);

-- Append-only ---------------------------------------------------------------------------------

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$
    insert into public.audit_log (business_id, actor, table_name, record_id, action)
    values (tests.business_id('iron-gym'), 'user', 'plans', gen_random_uuid(), 'insert')
  $$,
  '42501', 'permission denied for table audit_log',
  'users cannot write history entries'
);
select throws_ok(
  $$ update public.audit_log set actor = 'database' $$,
  '42501', 'permission denied for table audit_log',
  'users cannot change history entries'
);
select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', 'permission denied for table audit_log',
  'users cannot delete history entries'
);

select tests.authenticate_as_service_role();
select throws_ok(
  $$
    insert into public.audit_log (business_id, actor, table_name, record_id, action)
    values (tests.business_id('iron-gym'), 'server', 'plans', gen_random_uuid(), 'insert')
  $$,
  '42501', 'permission denied for table audit_log',
  'server code cannot write history entries either'
);
select throws_ok(
  $$ update public.audit_log set actor = 'database' $$,
  '42501', 'permission denied for table audit_log',
  'server code cannot change history entries'
);
select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', 'permission denied for table audit_log',
  'server code cannot delete history entries'
);

-- Even the table's owner, who has every privilege, is stopped by the triggers.
select tests.act_as_database();
select throws_ok(
  $$ update public.audit_log set actor = 'database' where business_id = tests.business_id('iron-gym') $$,
  'P0001', 'audit_log is append-only: its rows can''t be changed or deleted',
  'the table owner cannot change history entries'
);
select throws_ok(
  $$ delete from public.audit_log where business_id = tests.business_id('iron-gym') $$,
  'P0001', 'audit_log is append-only: its rows can''t be changed or deleted',
  'the table owner cannot delete history entries'
);
select throws_ok(
  $$ truncate public.audit_log $$,
  'P0001', 'audit_log is append-only: its rows can''t be changed or deleted',
  'the table owner cannot empty the history'
);

select * from finish();
rollback;
