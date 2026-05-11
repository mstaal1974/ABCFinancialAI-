-- Maison Obsidian — dispatch & shipment tracking
-- Every commit, sample box order, and gift-subscription monthly pick
-- generates a shipment row that admin staff can update with carrier and
-- tracking info. Members see their own shipments via the My Orders page
-- and the inline drawer badges.

create extension if not exists "pgcrypto";

create table if not exists public.shipments (
  id                uuid primary key default gen_random_uuid(),
  -- Source linkage. source_type discriminates which table source_id
  -- points to; we don't add hard FKs so an order may be archived
  -- without the shipment row disappearing from the audit trail.
  source_type       text not null
                    check (source_type in ('commit','sample_box','subscription_pick')),
  source_id         text not null,
  -- Member identity (mirrors the source row). user_id is nullable to
  -- accommodate anonymous / demo accounts.
  user_id           uuid references auth.users(id) on delete set null,
  user_email        text,
  -- Lifecycle: pending → packed → shipped → delivered, with cancelled
  -- as the terminal off-path state.
  status            text not null default 'pending'
                    check (status in ('pending','packed','shipped','delivered','cancelled')),
  -- Carrier + tracking info filled in by admin once dispatched.
  carrier           text,
  tracking_number   text,
  tracking_url      text,
  -- Optional human-readable destination snapshot (no FK to a separate
  -- address table — we keep address handling out of scope for the MVP).
  recipient_name    text,
  recipient_address text,
  notes             text,
  -- Lifecycle timestamps. Set by the application (or admin UI) when the
  -- status transitions; created_at/updated_at are bookkeeping only.
  packed_at         timestamptz,
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (source_type, source_id)
);
create index if not exists shipments_user_id_idx     on public.shipments(user_id);
create index if not exists shipments_user_email_idx  on public.shipments(user_email);
create index if not exists shipments_status_idx      on public.shipments(status);
create index if not exists shipments_source_type_idx on public.shipments(source_type);

-- Touch updated_at on every change so the admin manager can sort by
-- "recently edited" without extra columns.
create or replace function public.touch_shipments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_shipments_touch on public.shipments;
create trigger trg_shipments_touch
  before update on public.shipments
  for each row execute function public.touch_shipments_updated_at();

-- Row-Level Security.
alter table public.shipments enable row level security;

-- Members read their own shipments. Match on user_id when we have a
-- real Supabase auth uuid; otherwise fall back to user_email so demo
-- accounts can still see their (locally-tracked) shipments.
drop policy if exists "shipments_select_own" on public.shipments;
create policy "shipments_select_own"
  on public.shipments for select
  using (
    (auth.uid() is not null and user_id = auth.uid())
    or
    (auth.email() is not null and user_email = auth.email())
  );

-- Inserts are open in the MVP because they're auto-created from the
-- same client actions that already write commits / sample boxes / picks.
-- In production move this behind a server function with the service
-- role key.
drop policy if exists "shipments_insert" on public.shipments;
create policy "shipments_insert"
  on public.shipments for insert
  with check (true);

-- Admin updates: any signed-in user. Tighten in production by gating
-- on a custom claim (e.g. role = 'admin') or routing through an Edge
-- Function.
drop policy if exists "shipments_admin_update" on public.shipments;
create policy "shipments_admin_update"
  on public.shipments for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Admin can also read every shipment row. We model "admin" as any
-- signed-in user for the MVP (matching the existing fragrances_admin_*
-- policy pattern). The client-side AdminGate restricts who actually
-- sees the admin UI via VITE_ADMIN_EMAILS. In production, tighten this
-- by gating on a custom JWT claim (e.g. role = 'admin').
drop policy if exists "shipments_admin_select_all" on public.shipments;
create policy "shipments_admin_select_all"
  on public.shipments for select
  using (auth.uid() is not null);
