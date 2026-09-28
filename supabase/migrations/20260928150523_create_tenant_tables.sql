-- Tenant tables: who the users are, which businesses exist, who works at each business,
-- what each business sells, and who has joined each business.

-- Supabase's defaults give anon and authenticated every privilege on each new table, sequence
-- and function in public (TRUNCATE included, which RLS does not cover), leaving RLS as the only
-- guard. Reverse that for objects our migrations create: the API roles get nothing until a
-- migration grants it, so a forgotten grant fails closed. service_role keeps its access.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

create type public.staff_role as enum ('owner', 'admin', 'staff');
create type public.billing_interval as enum ('month', 'year');
-- The business's own decision about a member. Billing status lives on subscriptions, so a
-- declined card never looks like a ban.
create type public.member_status as enum ('active', 'suspended');

-- One row per signed-up user, created by the trigger below. auth.users is not readable through
-- the API, so names and emails shown in the app come from here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 100),
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  -- Used in the public join page URL.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 50),
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Business-side people (owner, admins, staff). Customers are in members, not here.
create table public.business_staff (
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- References profiles, not auth.users, so the API can join a staff row to a name.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- Exactly one owner per business; ownership changes are a transfer, not a second owner.
create unique index business_staff_one_owner on public.business_staff (business_id)
  where role = 'owner';
create index business_staff_user_id on public.business_staff (user_id);

-- Plans and members carry billing history, so they use RESTRICT: deleting a business or a
-- user can never silently erase them.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  billing_interval public.billing_interval not null,
  -- Smallest currency unit (cents), exactly as Stripe stores it.
  amount integer not null check (amount > 0),
  -- Lowercase ISO code, the format Stripe returns.
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  stripe_price_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index plans_business_id on public.plans (business_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  stripe_customer_id text unique,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  -- One membership per person per business; the same person can join several businesses.
  unique (business_id, user_id)
);

create index members_user_id on public.members (user_id);

-- RLS on everywhere, with no policies yet: every row is hidden from the API roles until a
-- policy allows it.
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_staff enable row level security;
alter table public.plans enable row level security;
alter table public.members enable row level security;

-- Keep profiles in step with auth.users. Security definer because the trigger fires as
-- whichever role changed auth.users; search_path is empty so every name must be qualified.
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  -- Name is optional (magic-link sign-ups may not send one). Trim and cap it here rather than
  -- let the column check reject it, which would fail the whole sign-up.
  values (
    new.id,
    new.email,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 100)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();
