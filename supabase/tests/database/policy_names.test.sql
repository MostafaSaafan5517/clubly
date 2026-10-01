begin;
select plan(1);

-- Postgres cuts identifiers to 63 bytes without an error (only a notice), so a long policy name
-- is stored truncated. A name of 63 or more characters is either truncated or one character
-- away from it.
select is_empty(
  $$
    select tablename || ': ' || policyname
    from pg_policies
    where schemaname = 'public' and length(policyname) >= 63
  $$,
  'policy names fit in 62 characters'
);

select * from finish();
rollback;
