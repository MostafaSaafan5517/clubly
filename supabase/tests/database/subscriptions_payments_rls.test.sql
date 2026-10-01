begin;
select plan(18);
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
reset role;

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

insert into public.plans (business_id, name, billing_interval, amount, stripe_price_id) values
  (tests.business_id('iron-gym'), 'Iron Monthly', 'month', 3000, 'price_iron'),
  (tests.business_id('yoga-loft'), 'Yoga Monthly', 'month', 4000, 'price_yoga');

insert into public.members (business_id, user_id) values
  (tests.business_id('iron-gym'), tests.get_user_id('member-1@test.local')),
  (tests.business_id('iron-gym'), tests.get_user_id('member-2@test.local')),
  (tests.business_id('yoga-loft'), tests.get_user_id('member-b@test.local'));

-- What the webhooks will write (as the service role).
insert into public.subscriptions (business_id, member_id, plan_id, stripe_subscription_id, status)
select m.business_id, m.id, p.id, s.stripe_id, s.status::public.subscription_status
from (values
  ('member-1@test.local', 'Iron Monthly', 'sub_1', 'active'),
  ('member-2@test.local', 'Iron Monthly', 'sub_2', 'past_due'),
  ('member-b@test.local', 'Yoga Monthly', 'sub_b', 'trialing')
) as s (email, plan_name, stripe_id, status)
join public.members m on m.user_id = tests.get_user_id(s.email)
join public.plans p on p.name = s.plan_name;

insert into public.payments (business_id, member_id, stripe_invoice_id, amount, currency, status, paid_at)
select m.business_id, m.id, s.invoice_id, s.amount, 'usd', s.status::public.payment_status,
  case when s.status = 'paid' then now() end
from (values
  ('member-1@test.local', 'in_1', 3000, 'paid'),
  ('member-2@test.local', 'in_2', 3100, 'failed'),
  ('member-b@test.local', 'in_b', 4000, 'paid')
) as s (email, invoice_id, amount, status)
join public.members m on m.user_id = tests.get_user_id(s.email);

-- Integrity ---------------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.subscriptions (business_id, member_id, plan_id, stripe_subscription_id, status)
    select tests.business_id('iron-gym'), m.id, p.id, 'sub_cross_plan', 'active'
    from public.members m, public.plans p
    where m.user_id = tests.get_user_id('member-1@test.local') and p.name = 'Yoga Monthly'
  $$,
  '23503', null,
  'a subscription cannot join a member of one business to a plan of another'
);
select throws_ok(
  $$
    insert into public.subscriptions (business_id, member_id, plan_id, stripe_subscription_id, status)
    select tests.business_id('iron-gym'), m.id, p.id, 'sub_cross_member', 'active'
    from public.members m, public.plans p
    where m.user_id = tests.get_user_id('member-b@test.local') and p.name = 'Iron Monthly'
  $$,
  '23503', null,
  'a subscription cannot belong to a member of another business'
);
select throws_ok(
  $$
    insert into public.subscriptions (business_id, member_id, plan_id, stripe_subscription_id, status)
    select m.business_id, m.id, p.id, 'sub_1', 'active'
    from public.members m, public.plans p
    where m.user_id = tests.get_user_id('member-1@test.local') and p.name = 'Iron Monthly'
  $$,
  '23505', null,
  'a Stripe subscription is stored only once'
);
select throws_ok(
  $$
    insert into public.payments (business_id, member_id, stripe_invoice_id, amount, currency, status)
    select m.business_id, m.id, 'in_no_time', 3000, 'usd', 'paid'
    from public.members m where m.user_id = tests.get_user_id('member-1@test.local')
  $$,
  '23514', null,
  'a paid payment must say when it was paid'
);

-- Reading subscriptions ----------------------------------------------------------------------

select tests.authenticate_as('member-1@test.local');
select set_eq(
  $$ select status::text from public.subscriptions $$,
  $$ values ('active') $$,
  'members see only their own subscription'
);
select tests.authenticate_as('staff-a@test.local');
select set_eq(
  $$ select status::text from public.subscriptions $$,
  $$ values ('active'), ('past_due') $$,
  'staff see their business''s subscriptions'
);
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select status::text from public.subscriptions $$,
  $$ values ('trialing') $$,
  'the owner of business B cannot see business A''s subscriptions'
);

-- Reading payments --------------------------------------------------------------------------

select tests.authenticate_as('member-1@test.local');
select set_eq(
  $$ select amount from public.payments $$,
  $$ values (3000) $$,
  'members see only their own payments'
);
select tests.authenticate_as('owner-a@test.local');
select set_eq(
  $$ select amount from public.payments $$,
  $$ values (3000), (3100) $$,
  'owners see their business''s payments'
);
select tests.authenticate_as('admin-a@test.local');
select set_eq(
  $$ select amount from public.payments $$,
  $$ values (3000), (3100) $$,
  'admins see their business''s payments'
);
select tests.authenticate_as('staff-a@test.local');
select is_empty(
  $$ select 1 from public.payments $$,
  'plain staff do not see revenue'
);
select tests.authenticate_as('owner-b@test.local');
select set_eq(
  $$ select amount from public.payments $$,
  $$ values (4000) $$,
  'the owner of business B cannot see business A''s payments'
);

-- Visitors, Stripe ids and writes ------------------------------------------------------------

select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.subscriptions $$,
  '42501', 'permission denied for table subscriptions',
  'visitors cannot read subscriptions'
);
select throws_ok(
  $$ select 1 from public.payments $$,
  '42501', 'permission denied for table payments',
  'visitors cannot read payments'
);

select tests.authenticate_as('member-1@test.local');
select throws_ok(
  $$ select stripe_subscription_id from public.subscriptions $$,
  '42501', 'permission denied for table subscriptions',
  'Stripe subscription ids are not readable through the API'
);
select throws_ok(
  $$ update public.subscriptions set status = 'active' $$,
  '42501', 'permission denied for table subscriptions',
  'members cannot change a subscription''s status (only Stripe can, via webhooks)'
);
select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ select stripe_invoice_id from public.payments $$,
  '42501', 'permission denied for table payments',
  'Stripe invoice ids are not readable through the API'
);
select throws_ok(
  $$
    insert into public.payments (business_id, member_id, stripe_invoice_id, amount, currency, status, paid_at)
    select m.business_id, m.id, 'in_fake', 1, 'usd', 'paid', now()
    from public.members m where m.user_id = tests.get_user_id('member-1@test.local')
  $$,
  '42501', 'permission denied for table payments',
  'owners cannot record payments themselves'
);
reset role;

select * from finish();
rollback;
