-- Maison Obsidian — gift cards
-- Sender purchases a value, recipient redeems via a code/link, balance is
-- applied automatically against any commit or sample box order.

create extension if not exists "pgcrypto";

create table if not exists public.gift_cards (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,
  amount_cents      integer not null check (amount_cents between 2000 and 200000),
  balance_cents     integer not null check (balance_cents >= 0),
  sender_name       text not null,
  sender_email      text,
  sender_user_id    uuid references auth.users(id) on delete set null,
  recipient_name    text not null,
  recipient_email   text not null,
  message           text,
  status            text not null default 'active'
                    check (status in ('active','redeemed','spent','expired')),
  scheduled_for     timestamptz,
  redeemed_at       timestamptz,
  redeemed_by_email text,
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint balance_le_amount check (balance_cents <= amount_cents)
);
create index if not exists gift_cards_code_idx                on public.gift_cards(code);
create index if not exists gift_cards_recipient_email_idx     on public.gift_cards(recipient_email);
create index if not exists gift_cards_redeemed_by_user_id_idx on public.gift_cards(redeemed_by_user_id);
create index if not exists gift_cards_status_idx              on public.gift_cards(status);

-- Sample box orders: capture how each order was paid (gift vs card).
alter table public.sample_box_orders
  add column if not exists gift_cents   integer not null default 0 check (gift_cents   >= 0),
  add column if not exists charge_cents integer not null default 0 check (charge_cents >= 0);

-- Mirror on commits, in case a future commit is partially gift-funded.
alter table public.commits
  add column if not exists gift_cents   integer not null default 0 check (gift_cents   >= 0),
  add column if not exists charge_cents integer not null default 0 check (charge_cents >= 0);

-- Row-Level Security.
alter table public.gift_cards enable row level security;

-- Anyone with the code can look it up (the code itself acts as a bearer
-- token). In production, prefer routing this through a server function
-- with rate limiting; for the MVP the read-by-code is open.
drop policy if exists "gift_cards_read_by_code" on public.gift_cards;
create policy "gift_cards_read_by_code"
  on public.gift_cards for select
  using (true);

-- Inserts (purchases) are open in the MVP. Move to a server route in
-- production, paired with a successful Stripe charge.
drop policy if exists "gift_cards_insert" on public.gift_cards;
create policy "gift_cards_insert"
  on public.gift_cards for insert
  with check (true);

-- Recipients can claim a card by updating its status/balance. Tighten
-- this to `auth.email() = recipient_email` if you want to prevent
-- third-party redemption.
drop policy if exists "gift_cards_update_redeem" on public.gift_cards;
create policy "gift_cards_update_redeem"
  on public.gift_cards for update
  using (true)
  with check (
    status in ('active','redeemed','spent','expired')
    and balance_cents <= amount_cents
  );

-- Helper: claim a gift card by code. Returns the card row.
create or replace function public.claim_gift_card(
  p_code  text,
  p_email text
)
returns public.gift_cards
language plpgsql
security definer
as $$
declare
  card public.gift_cards;
begin
  update public.gift_cards
     set status = 'redeemed',
         redeemed_at = coalesce(redeemed_at, now()),
         redeemed_by_email = coalesce(redeemed_by_email, p_email),
         redeemed_by_user_id = coalesce(redeemed_by_user_id, auth.uid())
   where code = upper(p_code)
     and status in ('active','redeemed')
   returning * into card;

  if not found then
    raise exception 'Gift card % is not redeemable', p_code;
  end if;
  return card;
end;
$$;
