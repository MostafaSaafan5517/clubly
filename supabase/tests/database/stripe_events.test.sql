begin;
select plan(10);
select tests.clear_tenant_data();
truncate public.stripe_events;

select tests.create_user('owner-a@test.local');
select tests.authenticate_as('owner-a@test.local');
select public.create_business('Iron Gym', 'iron-gym');
reset role;
update public.businesses set stripe_account_id = 'acct_iron' where slug = 'iron-gym';

-- Applying an event --------------------------------------------------------------------------

select is(
  public.apply_account_updated('evt_1', 'acct_iron', true),
  true,
  'a new account.updated event is applied'
);
select results_eq(
  $$ select charges_enabled from public.businesses where slug = 'iron-gym' $$,
  $$ values (true) $$,
  'it updates whether the business can take payments'
);
select results_eq(
  $$ select event_id, type, account_id from public.stripe_events $$,
  $$ values ('evt_1', 'account.updated', 'acct_iron') $$,
  'and records the event'
);

-- The same event delivered again ------------------------------------------------------------

-- Change the business by other means, then redeliver evt_1: it must not apply again.
update public.businesses set charges_enabled = false where slug = 'iron-gym';

select is(
  public.apply_account_updated('evt_1', 'acct_iron', true),
  false,
  'a duplicate delivery is reported as already processed'
);
select results_eq(
  $$ select charges_enabled from public.businesses where slug = 'iron-gym' $$,
  $$ values (false) $$,
  'and does not apply its effect a second time'
);
select is(
  (select count(*)::int from public.stripe_events where event_id = 'evt_1'),
  1,
  'and is recorded only once'
);

-- Events for accounts we don't know are recorded and change nothing.
select is(
  public.apply_account_updated('evt_2', 'acct_unknown', true),
  true,
  'an event for an unknown account is recorded'
);

-- Who can call it --------------------------------------------------------------------------

select ok(
  has_function_privilege('service_role', 'public.apply_account_updated(text, text, boolean)', 'execute'),
  'the service role (webhook route) can apply events'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_account_updated(text, text, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.apply_account_updated(text, text, boolean)', 'execute'),
  'signed-in users and visitors cannot apply events'
);
select ok(
  not has_table_privilege('authenticated', 'public.stripe_events', 'select')
    and not has_table_privilege('anon', 'public.stripe_events', 'select'),
  'signed-in users and visitors cannot read processed events'
);

select * from finish();
rollback;
