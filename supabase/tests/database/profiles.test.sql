begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'jane@example.com', '{"full_name": "  Jane Doe  "}'),
  ('00000000-0000-0000-0000-00000000000b', 'magic@example.com', '{"full_name": ""}'),
  ('00000000-0000-0000-0000-00000000000c', 'long@example.com',
    jsonb_build_object('full_name', repeat('x', 150)));

select results_eq(
  $$ select email, full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('jane@example.com', 'Jane Doe') $$,
  'signing up creates a profile with the email and the trimmed name'
);
-- Compare whole rows, so a missing profile can't pass as "name is null".
select results_eq(
  $$ select email, full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  $$ values ('magic@example.com', null::text) $$,
  'a blank name is stored as null'
);
select is(
  (select char_length(full_name) from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  100,
  'an overlong name is cut to 100 characters instead of failing the sign-up'
);

update auth.users set email = 'jane.new@example.com'
where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select email from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'jane.new@example.com',
  'changing the auth email updates the profile'
);

update auth.users set raw_user_meta_data = '{"full_name": "Someone Else"}'
where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Jane Doe',
  'after sign-up, the profile owns the name (auth metadata changes do not overwrite it)'
);

delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';

select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  'deleting a user with no memberships removes their profile'
);

select * from finish();
rollback;
