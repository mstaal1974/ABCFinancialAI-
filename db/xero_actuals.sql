-- Xero P&L actuals persistence (shared source of truth).
--
-- Before this table existed, an uploaded Xero P&L was stored only in the
-- uploader's browser localStorage. Because the uploaded actuals OVERRIDE
-- budgeted revenue and costs in every calculation, each computer computed a
-- different Revenue / Payments / Net Cashflow / Closing Balance depending on
-- whether — and which — Xero file it happened to hold. Running this once in the
-- Supabase SQL editor makes the upload org-wide so every login sees the same
-- numbers. If this table is absent, the app silently falls back to localStorage.
--
-- One shared row for the whole organisation (id = 'shared'): the actuals are a
-- single company-wide dataset, not a per-user overlay.

create table if not exists public.xero_actuals (
  id          text primary key,          -- always 'shared' (one org-wide row)
  data        text not null,             -- full Xero actuals payload JSON
  user_email  text,                      -- who last uploaded
  updated_at  timestamptz not null default now()
);

alter table public.xero_actuals enable row level security;

drop policy if exists "xero_actuals_authenticated_all" on public.xero_actuals;
create policy "xero_actuals_authenticated_all"
  on public.xero_actuals
  for all
  to authenticated
  using (true)
  with check (true);
