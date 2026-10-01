-- Stripe webhooks: every event we have applied, and the functions that apply them.

-- The primary key is what makes webhooks idempotent: Stripe can deliver the same event more
-- than once, but a second delivery can't insert a second row, so its effect can't apply twice.
create table public.stripe_events (
  event_id text primary key,
  type text not null,
  -- The connected account the event came from (null for events on the platform account).
  account_id text,
  processed_at timestamptz not null default now()
);

-- Server-only: RLS on with no policies, and (by our default privileges) no grants to the API
-- roles. Only the service role, which the webhook route uses, can touch it.
alter table public.stripe_events enable row level security;

-- Records an account.updated event and applies it in one transaction, so a crash can never
-- leave the event marked as processed without its effect, or the effect without the record.
-- Returns false when the event was already processed (a duplicate delivery).
create function public.apply_account_updated(
  event_id text,
  account_id text,
  charges_enabled boolean
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.stripe_events (event_id, type, account_id)
  values (apply_account_updated.event_id, 'account.updated', apply_account_updated.account_id)
  on conflict on constraint stripe_events_pkey do nothing;

  if not found then
    return false;
  end if;

  update public.businesses
  set charges_enabled = apply_account_updated.charges_enabled
  where stripe_account_id = apply_account_updated.account_id;

  return true;
end;
$$;

grant execute on function public.apply_account_updated(text, text, boolean) to service_role;
