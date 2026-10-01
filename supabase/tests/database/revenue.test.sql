begin;
select plan(6);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('admin-a@test.local');
select tests.create_user('staff-a@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('m1@test.local');
select tests.create_user('m2@test.local');
select tests.create_user('m3@test.local');
select tests.create_user('m4@test.local');
select tests.create_user('m5@test.local');
select tests.create_user('m6@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
select tests.act_as_database();

insert into public.business_staff (business_id, user_id, role) values
  (tests.business_id('iron-gym'), tests.get_user_id('admin-a@test.local'), 'admin'),
  (tests.business_id('iron-gym'), tests.get_user_id('staff-a@test.local'), 'staff');

insert into public.plans (business_id, name, billing_interval, amount) values
  (tests.business_id('iron-gym'), 'Monthly', 'month', 3000),
  (tests.business_id('iron-gym'), 'Yearly', 'year', 36000),
  (tests.business_id('iron-gym'), 'Yearly Small', 'year', 1000);

insert into public.members (business_id, user_id)
select tests.business_id('iron-gym'), tests.get_user_id(email)
from unnest(array['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) as m (name),
  lateral (select m.name || '@test.local' as email) as e;

-- Who's subscribed to what. Recurring revenue counts m1 (active), m2 (past due: Stripe is still
-- billing), m3 (yearly: 36000 / 12) and m6 (yearly: 1000 / 12 = 83.33). Not m4 (trial) or m5
-- (canceled). 3000 + 3000 + 3000 + 83.33 = 9083.33, rounded to 9083.
insert into public.subscriptions (business_id, member_id, plan_id, stripe_subscription_id, status)
select m.business_id, m.id, p.id, 'sub_' || s.member, s.status::public.subscription_status
from (values
  ('m1', 'Monthly', 'active'),
  ('m2', 'Monthly', 'past_due'),
  ('m3', 'Yearly', 'active'),
  ('m4', 'Monthly', 'trialing'),
  ('m5', 'Monthly', 'canceled'),
  ('m6', 'Yearly Small', 'active')
) as s (member, plan_name, status)
join public.members m on m.user_id = tests.get_user_id(s.member || '@test.local')
join public.plans p on p.name = s.plan_name;

-- Payments: two paid in the last 30 days (3000 + 36000, fees 150 + 1800), one paid long
-- before (not counted), and one failed attempt in the window.
insert into public.payments (business_id, member_id, stripe_invoice_id, amount, application_fee,
  currency, status, paid_at)
select m.business_id, m.id, x.invoice, x.amount, x.fee, 'usd', x.status::public.payment_status,
  x.paid_at
from (values
  ('m1', 'in_recent_1', 3000, 150, 'paid', now() - interval '5 days'),
  ('m3', 'in_recent_2', 36000, 1800, 'paid', now() - interval '10 days'),
  ('m1', 'in_old', 3000, 150, 'paid', now() - interval '40 days'),
  ('m2', 'in_failed', 3000, 0, 'failed', null)
) as x (member, invoice, amount, fee, status, paid_at)
join public.members m on m.user_id = tests.get_user_id(x.member || '@test.local');

select tests.authenticate_as('owner-a@test.local');
select results_eq(
  $$ select * from public.business_revenue(tests.business_id('iron-gym'), 30) $$,
  $$ values ('usd', 9083::bigint, 39000::bigint, 1950::bigint, 1) $$,
  'owners get recurring revenue and the last 30 days of payments'
);
select tests.authenticate_as('admin-a@test.local');
select results_eq(
  $$ select * from public.business_revenue(tests.business_id('iron-gym'), 30) $$,
  $$ values ('usd', 9083::bigint, 39000::bigint, 1950::bigint, 1) $$,
  'admins get the same figures'
);
select tests.authenticate_as('staff-a@test.local');
select results_eq(
  $$
    select gross_revenue, platform_fees, failed_payments
    from public.business_revenue(tests.business_id('iron-gym'), 30)
  $$,
  $$ values (0::bigint, 0::bigint, 0) $$,
  'plain staff get no payment figures: RLS hides the payments from them'
);
select tests.authenticate_as('owner-b@test.local');
select is_empty(
  $$ select * from public.business_revenue(tests.business_id('iron-gym'), 30) $$,
  'another business''s owner gets nothing at all'
);
select tests.authenticate_as('owner-a@test.local');
select is_empty(
  $$ select * from public.business_revenue(tests.business_id('yoga-loft'), 30) $$,
  'and neither does this owner for the other business'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.business_revenue(tests.business_id('iron-gym'), 30) $$,
  '42501', 'permission denied for function business_revenue',
  'visitors cannot call it'
);

select * from finish();
rollback;
