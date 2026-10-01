begin;
select plan(30);
select tests.clear_tenant_data();

-- Structure
select tables_are(
  'public',
  array[
    'profiles', 'businesses', 'business_staff', 'plans', 'members', 'stripe_events',
    'subscriptions', 'payments'
  ],
  'public contains exactly the expected tables'
);

select is_empty(
  $$
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  $$,
  'every table in public has RLS enabled'
);

-- The full map of table-level grants to the API roles. Most access is granted per column (so
-- Stripe identifiers stay server-only), which doesn't appear here; the RLS test files cover
-- column grants by behavior.
select table_privs_are('public', 'profiles', 'anon', array[]::text[]);
select table_privs_are('public', 'businesses', 'anon', array[]::text[]);
select table_privs_are('public', 'business_staff', 'anon', array[]::text[]);
select table_privs_are('public', 'plans', 'anon', array[]::text[]);
select table_privs_are('public', 'members', 'anon', array[]::text[]);
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT']);
select table_privs_are('public', 'businesses', 'authenticated', array[]::text[]);
select table_privs_are('public', 'business_staff', 'authenticated', array['SELECT', 'INSERT', 'DELETE']);
select table_privs_are('public', 'plans', 'authenticated', array[]::text[]);
select table_privs_are('public', 'members', 'authenticated', array[]::text[]);
-- Processed Stripe events are for the webhook route (service role) only.
select table_privs_are('public', 'stripe_events', 'anon', array[]::text[]);
select table_privs_are('public', 'stripe_events', 'authenticated', array[]::text[]);
-- Subscriptions and payments are read per column and written only by server code.
select table_privs_are('public', 'subscriptions', 'anon', array[]::text[]);
select table_privs_are('public', 'subscriptions', 'authenticated', array[]::text[]);
select table_privs_are('public', 'payments', 'anon', array[]::text[]);
select table_privs_are('public', 'payments', 'authenticated', array[]::text[]);

-- Fixtures: two users (profiles come from the auth trigger) and one business.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'other@example.com');

insert into public.businesses (id, name, slug)
values ('10000000-0000-0000-0000-000000000001', 'Iron Gym', 'iron-gym');

-- Businesses
select throws_ok(
  $$ insert into public.businesses (name, slug) values ('Bad', 'Bad Slug') $$,
  '23514', null, 'slug must be lowercase words joined by dashes'
);
select throws_ok(
  $$ insert into public.businesses (name, slug) values ('Short', 'ab') $$,
  '23514', null, 'slug must be at least 3 characters'
);
select throws_ok(
  $$ insert into public.businesses (name, slug) values ('Copy', 'iron-gym') $$,
  '23505', null, 'slugs are unique'
);
select throws_ok(
  $$ insert into public.businesses (name, slug) values ('   ', 'blank-name') $$,
  '23514', null, 'business name cannot be blank'
);

-- Staff
insert into public.business_staff (business_id, user_id, role)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner');

select throws_ok(
  $$
    insert into public.business_staff (business_id, user_id, role)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'owner')
  $$,
  '23505', null, 'a business has at most one owner'
);

-- Plans
select throws_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount)
    values ('10000000-0000-0000-0000-000000000001', 'Free', 'month', 0)
  $$,
  '23514', null, 'plan amount must be above zero'
);
select throws_ok(
  $$
    insert into public.plans (business_id, name, billing_interval, amount, currency)
    values ('10000000-0000-0000-0000-000000000001', 'Monthly', 'month', 3000, 'USD')
  $$,
  '23514', null, 'currency must be a lowercase 3-letter code'
);

insert into public.plans (business_id, name, billing_interval, amount)
values ('10000000-0000-0000-0000-000000000001', 'Monthly', 'month', 3000);

-- Members
insert into public.members (business_id, user_id)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$
    insert into public.members (business_id, user_id)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b')
  $$,
  '23505', null, 'a person joins a business only once'
);
select is(
  (select status::text from public.members where user_id = '00000000-0000-0000-0000-00000000000b'),
  'active',
  'new members start active'
);

-- Deletes never silently erase billing records
select throws_ok(
  $$ delete from public.businesses where id = '10000000-0000-0000-0000-000000000001' $$,
  '23503', null, 'a business with plans or members cannot be deleted'
);
select throws_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000b' $$,
  '23503', null, 'a user who is a member cannot be deleted'
);

-- Staff rows are only access rows, so they go with their business.
insert into public.businesses (id, name, slug)
values ('10000000-0000-0000-0000-000000000002', 'Empty Studio', 'empty-studio');
insert into public.business_staff (business_id, user_id, role)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'owner');
delete from public.businesses where id = '10000000-0000-0000-0000-000000000002';

select is_empty(
  $$
    select 1 from public.business_staff
    where business_id = '10000000-0000-0000-0000-000000000002'
  $$,
  'deleting a business removes its staff rows'
);

select * from finish();
rollback;
