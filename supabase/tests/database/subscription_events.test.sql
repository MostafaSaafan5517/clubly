begin;
select plan(22);
select tests.clear_tenant_data();
truncate public.stripe_events;

select tests.create_user('owner-a@test.local');
select tests.create_user('member-1@test.local');
select tests.create_user('owner-b@test.local');
select tests.create_user('member-b@test.local');

select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
select tests.authenticate_as('owner-b@test.local');
select public.create_business('Yoga Loft', 'yoga-loft');
reset role;

update public.businesses set stripe_account_id = 'acct_iron', charges_enabled = true
where slug = 'iron-gym';
update public.businesses set stripe_account_id = 'acct_yoga', charges_enabled = true
where slug = 'yoga-loft';

insert into public.plans (business_id, name, billing_interval, amount, stripe_price_id) values
  (tests.business_id('iron-gym'), 'Iron Monthly', 'month', 3000, 'price_monthly'),
  (tests.business_id('iron-gym'), 'Iron Yearly', 'year', 30000, 'price_yearly'),
  (tests.business_id('yoga-loft'), 'Yoga Monthly', 'month', 4000, 'price_yoga');

insert into public.members (business_id, user_id, stripe_customer_id) values
  (tests.business_id('iron-gym'), tests.get_user_id('member-1@test.local'), 'cus_1'),
  (tests.business_id('yoga-loft'), tests.get_user_id('member-b@test.local'), 'cus_b');

-- Subscription events ------------------------------------------------------------------------

select is(
  public.apply_subscription_event('evt_1', 'customer.subscription.created', 'acct_iron',
    '{"id": "sub_1", "customer_id": "cus_1", "price_id": "price_monthly", "status": "active",
      "current_period_end": 1798761600, "cancel_at_period_end": false}'),
  'applied',
  'a new subscription event is applied'
);
select results_eq(
  $$
    select s.status::text, p.name, s.current_period_end, s.cancel_at_period_end
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.stripe_subscription_id = 'sub_1'
  $$,
  $$ values ('active', 'Iron Monthly', to_timestamp(1798761600), false) $$,
  'it creates the subscription, linked to the member''s plan'
);
select is(
  (select m.stripe_customer_id from public.subscriptions s join public.members m on m.id = s.member_id
   where s.stripe_subscription_id = 'sub_1'),
  'cus_1',
  'and to the member who owns the Stripe customer'
);

select is(
  public.apply_subscription_event('evt_1', 'customer.subscription.created', 'acct_iron',
    '{"id": "sub_1", "customer_id": "cus_1", "price_id": "price_monthly", "status": "canceled",
      "current_period_end": 1798761600, "cancel_at_period_end": false}'),
  'duplicate',
  'the same event delivered again is reported as a duplicate'
);
select is(
  (select status::text from public.subscriptions where stripe_subscription_id = 'sub_1'),
  'active',
  'and changes nothing, even if its snapshot differs'
);

select is(
  public.apply_subscription_event('evt_2', 'customer.subscription.updated', 'acct_iron',
    '{"id": "sub_1", "customer_id": "cus_1", "price_id": "price_yearly", "status": "past_due",
      "current_period_end": 1830297600, "cancel_at_period_end": true}'),
  'applied',
  'a later event for the same subscription is applied'
);
select results_eq(
  $$
    select s.status::text, p.name, s.cancel_at_period_end
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.stripe_subscription_id = 'sub_1'
  $$,
  $$ values ('past_due', 'Iron Yearly', true) $$,
  'and updates it in place, including a switch to another plan'
);
select is(
  (select count(*)::int from public.subscriptions),
  1,
  'still one subscription row'
);

-- Events that aren't ours ---------------------------------------------------------------------

select is(
  public.apply_subscription_event('evt_3', 'customer.subscription.created', 'acct_iron',
    '{"id": "sub_x", "customer_id": "cus_unknown", "price_id": "price_monthly",
      "status": "active", "current_period_end": null, "cancel_at_period_end": false}'),
  'ignored',
  'a subscription for an unknown customer is ignored'
);
select is(
  public.apply_subscription_event('evt_4', 'customer.subscription.created', 'acct_yoga',
    '{"id": "sub_y", "customer_id": "cus_1", "price_id": "price_monthly",
      "status": "active", "current_period_end": null, "cancel_at_period_end": false}'),
  'ignored',
  'an event from another business''s Stripe account cannot touch this business''s member'
);
select is(
  public.apply_subscription_event('evt_5', 'customer.subscription.created', 'acct_iron',
    '{"id": "sub_z", "customer_id": "cus_1", "price_id": "price_yoga",
      "status": "active", "current_period_end": null, "cancel_at_period_end": false}'),
  'ignored',
  'a price from another business cannot be linked to this business''s member'
);
select results_eq(
  $$ select count(*)::int from public.subscriptions $$,
  $$ values (1) $$,
  'ignored events create no subscriptions'
);
select results_eq(
  $$ select count(*)::int from public.stripe_events where event_id in ('evt_3', 'evt_4', 'evt_5') $$,
  $$ values (3) $$,
  'but they are recorded, so they are not processed again'
);

-- Invoice events ----------------------------------------------------------------------------

select is(
  public.apply_invoice_event('evt_6', 'invoice.payment_failed', 'acct_iron',
    '{"id": "sub_1", "customer_id": "cus_1", "price_id": "price_yearly", "status": "past_due",
      "current_period_end": 1830297600, "cancel_at_period_end": false}',
    '{"id": "in_1", "amount": 30000, "application_fee": 0, "currency": "usd",
      "status": "failed", "paid_at": null}'),
  'applied',
  'a failed payment is applied'
);
select results_eq(
  $$ select status::text, amount, paid_at from public.payments where stripe_invoice_id = 'in_1' $$,
  $$ values ('failed', 30000, null::timestamptz) $$,
  'it records the failed payment'
);

select is(
  public.apply_invoice_event('evt_7', 'invoice.paid', 'acct_iron',
    '{"id": "sub_1", "customer_id": "cus_1", "price_id": "price_yearly", "status": "active",
      "current_period_end": 1830297600, "cancel_at_period_end": false}',
    '{"id": "in_1", "amount": 30000, "application_fee": 1500, "currency": "usd",
      "status": "paid", "paid_at": 1799000000}'),
  'applied',
  'paying the same invoice on a retry is applied'
);
select results_eq(
  $$
    select p.status::text, p.application_fee, p.paid_at, s.status::text
    from public.payments p join public.subscriptions s on s.id = p.subscription_id
    where p.stripe_invoice_id = 'in_1'
  $$,
  $$ values ('paid', 1500, to_timestamp(1799000000), 'active') $$,
  'the same payment row moves to paid, and the subscription to active'
);
select is(
  (select count(*)::int from public.payments where stripe_invoice_id = 'in_1'),
  1,
  'still one payment row for the invoice'
);

select is(
  public.apply_invoice_event('evt_8', 'invoice.paid', 'acct_yoga',
    '{"id": "sub_b", "customer_id": "cus_b", "price_id": "price_yoga", "status": "active",
      "current_period_end": 1798761600, "cancel_at_period_end": false}',
    '{"id": "in_b", "amount": 4000, "application_fee": 200, "currency": "usd",
      "status": "paid", "paid_at": 1798000000}'),
  'applied',
  'an invoice can arrive before its subscription''s own events'
);
select results_eq(
  $$
    select s.status::text, p.amount
    from public.payments p join public.subscriptions s on s.id = p.subscription_id
    where p.stripe_invoice_id = 'in_b'
  $$,
  $$ values ('active', 4000) $$,
  'and creates both the subscription and the payment'
);

-- Who can call them -------------------------------------------------------------------------

select ok(
  has_function_privilege('service_role', 'public.apply_subscription_event(text, text, text, jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.apply_invoice_event(text, text, text, jsonb, jsonb)', 'execute'),
  'the webhook route (service role) can apply subscription and invoice events'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_subscription_event(text, text, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.apply_subscription_event(text, text, text, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.apply_invoice_event(text, text, text, jsonb, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.apply_invoice_event(text, text, text, jsonb, jsonb)', 'execute'),
  'signed-in users and visitors cannot apply events'
);

select * from finish();
rollback;
