-- Maison Obsidian — gift subscriptions
-- A sender purchases a 3 / 6 / 12-month "Discovery" plan up front. The
-- recipient redeems via code/link, then picks one fragrance from the
-- catalogue per included month. Each pick is queued for shipping.

create extension if not exists "pgcrypto";

create table if not exists public.gift_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  plan_months         integer not null check (plan_months in (3, 6, 12)),
  price_cents         integer not null check (price_cents > 0),
  status              text not null default 'active'
                      check (status in ('active','redeemed','completed','cancelled')),
  sender_name         text not null,
  sender_email        text,
  sender_user_id      uuid references auth.users(id) on delete set null,
  recipient_name      text not null,
  recipient_email     text not null,
  message             text,
  scheduled_for       timestamptz,
  redeemed_at         timestamptz,
  redeemed_by_email   text,
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists gift_subscriptions_code_idx
  on public.gift_subscriptions(code);
create index if not exists gift_subscriptions_recipient_email_idx
  on public.gift_subscriptions(recipient_email);
create index if not exists gift_subscriptions_redeemed_by_user_id_idx
  on public.gift_subscriptions(redeemed_by_user_id);
create index if not exists gift_subscriptions_status_idx
  on public.gift_subscriptions(status);

-- One row per monthly pick. month_index is 1..plan_months and is unique
-- per subscription so the recipient can't double-claim a month.
create table if not exists public.gift_subscription_picks (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.gift_subscriptions(id) on delete cascade,
  month_index     integer not null check (month_index >= 1),
  fragrance_id    text not null references public.fragrances(id) on delete restrict,
  picked_at       timestamptz not null default now(),
  ship_at         timestamptz,
  status          text not null default 'queued'
                  check (status in ('queued','shipped','cancelled')),
  unique (subscription_id, month_index)
);
create index if not exists gift_subscription_picks_subscription_id_idx
  on public.gift_subscription_picks(subscription_id);
create index if not exists gift_subscription_picks_status_idx
  on public.gift_subscription_picks(status);

-- Row-Level Security.
alter table public.gift_subscriptions      enable row level security;
alter table public.gift_subscription_picks enable row level security;

-- The code itself acts as a bearer token — anyone with it can read the
-- subscription. In production, route this through a server function with
-- rate limiting; for the MVP the read-by-code is open.
drop policy if exists "gift_subscriptions_read_by_code" on public.gift_subscriptions;
create policy "gift_subscriptions_read_by_code"
  on public.gift_subscriptions for select
  using (true);

drop policy if exists "gift_subscriptions_insert" on public.gift_subscriptions;
create policy "gift_subscriptions_insert"
  on public.gift_subscriptions for insert
  with check (true);

-- Recipient can mark the subscription redeemed/completed. Tighten in
-- production to `auth.email() = recipient_email`.
drop policy if exists "gift_subscriptions_update_redeem" on public.gift_subscriptions;
create policy "gift_subscriptions_update_redeem"
  on public.gift_subscriptions for update
  using (true)
  with check (status in ('active','redeemed','completed','cancelled'));

-- Picks: anyone with the parent subscription can see them; only signed-in
-- users can insert. In production, restrict insert to the redeemed user.
drop policy if exists "gift_subscription_picks_read" on public.gift_subscription_picks;
create policy "gift_subscription_picks_read"
  on public.gift_subscription_picks for select
  using (true);

drop policy if exists "gift_subscription_picks_insert" on public.gift_subscription_picks;
create policy "gift_subscription_picks_insert"
  on public.gift_subscription_picks for insert
  with check (auth.uid() is not null);
