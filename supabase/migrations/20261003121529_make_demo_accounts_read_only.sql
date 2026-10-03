-- The live demo's accounts share a password that the README publishes, so anyone can sign in as
-- them. They're marked with `demo: true` in their app metadata (`pnpm seed:demo` sets it; only
-- the server can write app metadata) and can look at everything but change nothing: not the
-- business's data, and not their own email or password, which would lock everyone else out.
-- The app says so before trying; these triggers are the guard for anyone calling the API
-- directly with a demo account's token.

-- Reads auth.users rather than the token's claims, so the mark applies at once, not when the
-- token is next refreshed.
create function private.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and raw_app_meta_data -> 'demo' = 'true'::jsonb
  );
$$;

-- Statement-level: one check per write, however many rows it touches. Server code (webhooks,
-- reconciliation) has no signed-in user, so it's never refused.
create function private.reject_demo_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_demo_user() then
    raise exception 'Demo accounts are read-only' using errcode = '42501';
  end if;
  return null;
end;
$$;

create trigger reject_demo_writes
  before insert or update or delete on public.profiles
  for each statement execute function private.reject_demo_writes();
create trigger reject_demo_writes
  before insert or update or delete on public.businesses
  for each statement execute function private.reject_demo_writes();
create trigger reject_demo_writes
  before insert or update or delete on public.business_staff
  for each statement execute function private.reject_demo_writes();
create trigger reject_demo_writes
  before insert or update or delete on public.plans
  for each statement execute function private.reject_demo_writes();
create trigger reject_demo_writes
  before insert or update or delete on public.members
  for each statement execute function private.reject_demo_writes();

-- Supabase Auth changes auth.users with its own role for both a user's request and the admin
-- API, so the database can't tell them apart: a demo account's sign-in details stay fixed until
-- its mark is removed (the seed script removes it, resets the password, then marks it again).
create function private.protect_demo_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Demo accounts can''t be deleted' using errcode = '42501';
  end if;
  if new.email is distinct from old.email
    or new.encrypted_password is distinct from old.encrypted_password
    or new.phone is distinct from old.phone
    or coalesce(new.email_change, '') is distinct from coalesce(old.email_change, '')
    or coalesce(new.phone_change, '') is distinct from coalesce(old.phone_change, '')
  then
    raise exception 'Demo accounts can''t change their sign-in details' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_demo_account
  before update or delete on auth.users
  for each row
  when (old.raw_app_meta_data -> 'demo' = 'true'::jsonb)
  execute function private.protect_demo_account();
