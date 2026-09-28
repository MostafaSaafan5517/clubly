-- Objects are created here the same way migrations create them (as postgres) to prove the API
-- roles get nothing until a migration grants it on purpose.
begin;
select plan(8);

create function private.probe() returns integer language sql as 'select 1';

select ok(
  not has_function_privilege('anon', 'private.probe()', 'execute'),
  'new private functions are not executable by anon'
);
select ok(
  not has_function_privilege('authenticated', 'private.probe()', 'execute'),
  'new private functions are not executable by authenticated'
);

create function public.probe() returns integer language sql as 'select 1';

select ok(
  not has_function_privilege('anon', 'public.probe()', 'execute'),
  'new public functions are not executable by anon'
);
select ok(
  not has_function_privilege('authenticated', 'public.probe()', 'execute'),
  'new public functions are not executable by authenticated'
);

create table public.probe (id bigint generated always as identity primary key);

select table_privs_are(
  'public', 'probe', 'anon', array[]::text[],
  'new public tables grant nothing to anon'
);
select table_privs_are(
  'public', 'probe', 'authenticated', array[]::text[],
  'new public tables grant nothing to authenticated'
);
select sequence_privs_are(
  'public', 'probe_id_seq', 'authenticated', array[]::text[],
  'new public sequences grant nothing to authenticated'
);
-- Server-side code (webhooks, reconciliation) runs as service_role and still needs access.
-- (One privilege per call: a comma-separated list is true if ANY of them is held.)
select ok(
  has_table_privilege('service_role', 'public.probe', 'select')
    and has_table_privilege('service_role', 'public.probe', 'insert')
    and has_table_privilege('service_role', 'public.probe', 'update')
    and has_table_privilege('service_role', 'public.probe', 'delete'),
  'service_role keeps full access to new public tables'
);

select * from finish();
rollback;
