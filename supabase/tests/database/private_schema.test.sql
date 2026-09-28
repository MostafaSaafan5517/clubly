begin;
select plan(3);

select has_schema('private');

select schema_privs_are(
  'private', 'anon', array[]::text[],
  'anon has no privileges on the private schema'
);
-- RLS policies run as the signed-in user, so they need to reach the helpers in private.
select schema_privs_are(
  'private', 'authenticated', array['USAGE'],
  'authenticated can only use (not create in) the private schema'
);

select * from finish();
rollback;
