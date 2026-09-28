begin;
select plan(5);

select has_schema('private');

select schema_privs_are(
  'private', 'anon', array[]::text[],
  'anon has no privileges on the private schema'
);
select schema_privs_are(
  'private', 'authenticated', array[]::text[],
  'authenticated has no privileges on the private schema'
);

-- A function created the way our migrations create them (as postgres) must not be executable
-- by the API roles until a migration grants it on purpose.
create function private.probe() returns integer language sql as 'select 1';

select ok(
  not has_function_privilege('anon', 'private.probe()', 'execute'),
  'new functions are not executable by anon by default'
);
select ok(
  not has_function_privilege('authenticated', 'private.probe()', 'execute'),
  'new functions are not executable by authenticated by default'
);

select * from finish();
rollback;
