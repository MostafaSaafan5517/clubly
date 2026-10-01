begin;
select plan(24);
select tests.clear_tenant_data();

select tests.create_user('owner-a@test.local');
select tests.create_user('member-1@test.local');
select tests.create_user('member-2@test.local');
select tests.create_user('owner-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
select tests.act_as_database();

update public.businesses set stripe_account_id = 'acct_rec_iron' where slug = 'iron-gym';
update public.businesses set stripe_account_id = 'acct_rec_yoga', charges_enabled = true
where slug = 'yoga-loft';

insert into public.plans (business_id, name, billing_interval, amount, stripe_price_id) values
  (tests.business_id('iron-gym'), 'Iron Monthly', 'month', 3000, 'price_rec_monthly'),
  (tests.business_id('yoga-loft'), 'Yoga Monthly', 'month', 4000, 'price_rec_yoga');

insert into public.members (business_id, user_id, stripe_customer_id) values
  (tests.business_id('iron-gym'), tests.get_user_id('member-1@test.local'), 'cus_rec_1'),
  (tests.business_id('iron-gym'), tests.get_user_id('member-2@test.local'), 'cus_rec_2');

-- What the webhooks recorded before some events went missing: member 2's subscription and its
-- invoice are stale (Stripe has since been paid); member 1's never arrived at all.
insert into public.subscriptions (business_id, member_id, plan_id, stripe_subscription_id, status)
select m.business_id, m.id, p.id, 'sub_rec_2', 'past_due'
from public.members m, public.plans p
where m.stripe_customer_id = 'cus_rec_2' and p.stripe_price_id = 'price_rec_monthly';
insert into public.payments (business_id, member_id, subscription_id, stripe_invoice_id, amount,
  currency, status)
select s.business_id, s.member_id, s.id, 'in_rec_2', 3000, 'usd', 'failed'
from public.subscriptions s
where s.stripe_subscription_id = 'sub_rec_2';

insert into public.reconciliation_runs (id) values ('11111111-1111-1111-1111-111111111111');

select tests.authenticate_as_service_role();

-- Accounts ------------------------------------------------------------------------------------

select is(
  public.reconcile_account('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', true),
  1,
  'a business Stripe says can take payments, but we missed it, is corrected'
);
select results_eq(
  $$
    select b.charges_enabled, c.object_type, c.stripe_id, c.old_data, c.new_data
    from public.reconciliation_corrections c
    join public.businesses b on b.id = c.business_id
    where c.run_id = '11111111-1111-1111-1111-111111111111' and c.object_type = 'account'
  $$,
  $$
    values (true, 'account', 'acct_rec_iron', '{"charges_enabled": false}'::jsonb,
      '{"charges_enabled": true}'::jsonb)
  $$,
  'the fix and its correction are recorded together'
);
select is(
  public.reconcile_account('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', true),
  0,
  'an account that already matches is left alone'
);

-- Subscriptions -------------------------------------------------------------------------------

select is(
  public.reconcile_subscriptions('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', '[
    {"id": "sub_rec_1", "customer_id": "cus_rec_1", "price_id": "price_rec_monthly",
     "status": "active", "current_period_end": 1798761600, "cancel_at": null},
    {"id": "sub_rec_2", "customer_id": "cus_rec_2", "price_id": "price_rec_monthly",
     "status": "active", "current_period_end": 1798761600, "cancel_at": null},
    {"id": "sub_rec_x", "customer_id": "cus_unknown", "price_id": "price_rec_monthly",
     "status": "active", "current_period_end": 1798761600, "cancel_at": null}
  ]'),
  2,
  'a missing subscription is created and a stale one fixed; one that isn''t ours is skipped'
);
select results_eq(
  $$
    select stripe_id, old_data ->> 'status', new_data ->> 'status'
    from public.reconciliation_corrections
    where run_id = '11111111-1111-1111-1111-111111111111' and object_type = 'subscription'
    order by id
  $$,
  $$ values ('sub_rec_1', null, 'active'), ('sub_rec_2', 'past_due', 'active') $$,
  'each subscription correction records what we had and what we have now'
);
select results_eq(
  $$
    select s.stripe_subscription_id, s.status::text, m.stripe_customer_id,
      s.current_period_end
    from public.subscriptions s
    join public.members m on m.id = s.member_id
    order by s.stripe_subscription_id
  $$,
  $$
    values
      ('sub_rec_1', 'active', 'cus_rec_1', to_timestamp(1798761600)),
      ('sub_rec_2', 'active', 'cus_rec_2', to_timestamp(1798761600))
  $$,
  'the subscriptions now match Stripe, linked to the right members'
);
select is(
  public.reconcile_subscriptions('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', '[
    {"id": "sub_rec_1", "customer_id": "cus_rec_1", "price_id": "price_rec_monthly",
     "status": "active", "current_period_end": 1798761600, "cancel_at": null},
    {"id": "sub_rec_2", "customer_id": "cus_rec_2", "price_id": "price_rec_monthly",
     "status": "active", "current_period_end": 1798761600, "cancel_at": null}
  ]'),
  0,
  'running again finds nothing to correct'
);
select is(
  public.reconcile_subscriptions('11111111-1111-1111-1111-111111111111', 'acct_rec_yoga', '[
    {"id": "sub_rec_y", "customer_id": "cus_rec_1", "price_id": "price_rec_monthly",
     "status": "active", "current_period_end": 1798761600, "cancel_at": null}
  ]'),
  0,
  'another business''s Stripe account can''t create subscriptions for this business'
);
select is_empty(
  $$ select 1 from public.subscriptions where stripe_subscription_id = 'sub_rec_y' $$,
  'so no such subscription exists'
);

-- Payments ------------------------------------------------------------------------------------

select is(
  public.reconcile_payments('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', '[
    {"id": "in_rec_1", "subscription_id": "sub_rec_1", "amount": 3000,
     "application_fee": 150, "currency": "usd", "status": "paid", "paid_at": 1796083200},
    {"id": "in_rec_2", "subscription_id": "sub_rec_2", "amount": 3000,
     "application_fee": 150, "currency": "usd", "status": "paid", "paid_at": 1796083200},
    {"id": "in_rec_x", "subscription_id": "sub_rec_x", "amount": 3000,
     "application_fee": 150, "currency": "usd", "status": "paid", "paid_at": 1796083200}
  ]'),
  2,
  'a missing payment is recorded and a stale one fixed; one that isn''t ours is skipped'
);
select results_eq(
  $$
    select stripe_id, old_data ->> 'status', new_data ->> 'status'
    from public.reconciliation_corrections
    where run_id = '11111111-1111-1111-1111-111111111111' and object_type = 'payment'
    order by id
  $$,
  $$ values ('in_rec_1', null, 'paid'), ('in_rec_2', 'failed', 'paid') $$,
  'each payment correction records what we had and what we have now'
);
select results_eq(
  $$
    select p.stripe_invoice_id, p.status::text, p.amount, p.application_fee, p.paid_at,
      m.stripe_customer_id
    from public.payments p
    join public.members m on m.id = p.member_id
    order by p.stripe_invoice_id
  $$,
  $$
    values
      ('in_rec_1', 'paid', 3000, 150, to_timestamp(1796083200), 'cus_rec_1'),
      ('in_rec_2', 'paid', 3000, 150, to_timestamp(1796083200), 'cus_rec_2')
  $$,
  'the payments now match Stripe, fee included, linked to the right members'
);
select is(
  public.reconcile_payments('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', '[
    {"id": "in_rec_1", "subscription_id": "sub_rec_1", "amount": 3000,
     "application_fee": 150, "currency": "usd", "status": "paid", "paid_at": 1796083200}
  ]'),
  0,
  'a payment that already matches is left alone'
);
select is(
  public.reconcile_payments('11111111-1111-1111-1111-111111111111', 'acct_rec_yoga', '[
    {"id": "in_rec_y", "subscription_id": "sub_rec_1", "amount": 1,
     "application_fee": 0, "currency": "usd", "status": "paid", "paid_at": 1796083200}
  ]'),
  0,
  'another business''s Stripe account can''t record payments for this business'
);

-- Every fix shows in the business's history as the reconciliation job's.
select tests.act_as_database();
select set_eq(
  $$
    select distinct table_name, action
    from public.audit_log
    where business_id = tests.business_id('iron-gym') and actor = 'reconciliation'
  $$,
  $$
    values ('businesses', 'update'), ('subscriptions', 'insert'), ('subscriptions', 'update'),
      ('payments', 'insert'), ('payments', 'update')
  $$,
  'the fixes are in the audit log, attributed to reconciliation'
);
select is(
  (select count(*)::int from public.reconciliation_corrections where run_id = '11111111-1111-1111-1111-111111111111'),
  5,
  'and the corrections log has exactly one entry per fix'
);

-- (Corrections can't be cleared between tests, so every check above looks only at this run.)

-- Append-only and server-only -------------------------------------------------------------------

select tests.authenticate_as_service_role();
select throws_ok(
  $$ update public.reconciliation_corrections set stripe_id = 'x' $$,
  '42501', 'permission denied for table reconciliation_corrections',
  'server code cannot change corrections'
);
select throws_ok(
  $$ delete from public.reconciliation_corrections $$,
  '42501', 'permission denied for table reconciliation_corrections',
  'server code cannot delete corrections'
);
select tests.act_as_database();
select throws_ok(
  $$ update public.reconciliation_corrections set stripe_id = 'x' $$,
  'P0001', 'reconciliation_corrections is append-only: its rows can''t be changed or deleted',
  'the table owner cannot change corrections'
);
select throws_ok(
  $$ truncate public.reconciliation_corrections $$,
  'P0001', 'reconciliation_corrections is append-only: its rows can''t be changed or deleted',
  'the table owner cannot empty the corrections log'
);

select tests.authenticate_as('owner-a@test.local');
select throws_ok(
  $$ select 1 from public.reconciliation_runs $$,
  '42501', 'permission denied for table reconciliation_runs',
  'users cannot read reconciliation runs'
);
select throws_ok(
  $$ select 1 from public.reconciliation_corrections $$,
  '42501', 'permission denied for table reconciliation_corrections',
  'users cannot read corrections (they see fixes in their audit log)'
);
select throws_ok(
  $$ select public.reconcile_account('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', false) $$,
  '42501', 'permission denied for function reconcile_account',
  'users cannot run reconciliation'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.reconcile_subscriptions('11111111-1111-1111-1111-111111111111', 'acct_rec_iron', '[]') $$,
  '42501', 'permission denied for function reconcile_subscriptions',
  'visitors cannot run reconciliation'
);

select * from finish();
rollback;
