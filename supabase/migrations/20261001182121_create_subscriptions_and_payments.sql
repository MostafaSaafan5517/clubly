-- Subscriptions and payments, mirrored from Stripe. Only server code writes them (webhooks and
-- reconciliation, as the service role); members and staff can only read their own share.

-- Stripe's subscription statuses, as Stripe names them.
create type public.subscription_status as enum (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

create type public.payment_status as enum ('paid', 'failed');

-- Composite keys let the tables below insist that a member and a plan belong to the same
-- business as the row that references them: a subscription can never join a member of one
-- business to a plan of another.
alter table public.members add unique (id, business_id);
alter table public.plans add unique (id, business_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  member_id uuid not null,
  plan_id uuid not null,
  stripe_subscription_id text not null unique,
  status public.subscription_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, business_id)
    references public.members (id, business_id) on delete restrict,
  foreign key (plan_id, business_id)
    references public.plans (id, business_id) on delete restrict
);

create index subscriptions_member_id on public.subscriptions (member_id);
create index subscriptions_business_id on public.subscriptions (business_id);

-- One row per Stripe invoice. A failed invoice that's paid on a later retry is the same row,
-- moving from failed to paid.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  member_id uuid not null,
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  stripe_invoice_id text not null unique,
  -- Smallest currency unit, as Stripe reports it.
  amount integer not null check (amount >= 0),
  application_fee integer not null default 0 check (application_fee >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status public.payment_status not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (member_id, business_id)
    references public.members (id, business_id) on delete restrict,
  -- A paid invoice has a payment time; a failed one doesn't.
  check ((status = 'paid') = (paid_at is not null))
);

create index payments_member_id on public.payments (member_id);
create index payments_business_id_paid_at on public.payments (business_id, paid_at desc);

alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- True when the membership belongs to the signed-in user. Security definer so the policies
-- below don't depend on (or loop through) the members table's own RLS.
create function private.owns_membership(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members
    where id = target_member_id
      and user_id = (select auth.uid())
  );
$$;

grant execute on function private.owns_membership(uuid) to authenticated;

-- Read-only for API roles, and never the Stripe ids.
grant select (
  id, business_id, member_id, plan_id, status, current_period_end, cancel_at_period_end,
  created_at, updated_at
) on public.subscriptions to authenticated;

grant select (
  id, business_id, member_id, subscription_id, amount, application_fee, currency, status,
  paid_at, created_at
) on public.payments to authenticated;

create policy "members see their own subscriptions; staff see their business's"
  on public.subscriptions for select to authenticated
  using (
    private.owns_membership(member_id)
    or private.has_business_role(business_id, '{owner,admin,staff}')
  );

-- Payments are revenue, so plain staff (front desk, coaches) don't see them; owners and admins do.
create policy "members see their own payments; owners and admins see their business's"
  on public.payments for select to authenticated
  using (
    private.owns_membership(member_id)
    or private.has_business_role(business_id, '{owner,admin}')
  );
