begin;
select plan(3);

select has_schema('private');

select schema_privs_are(
  'private', 'anon', array[]::text[],
  'anon has no privileges on the private schema'
);
select schema_privs_are(
  'private', 'authenticated', array[]::text[],
  'authenticated has no privileges on the private schema'
);

select * from finish();
rollback;
