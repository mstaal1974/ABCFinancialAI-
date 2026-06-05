-- Scenario Lab persistence (optional Supabase sync).
--
-- The Scenario Lab works out-of-the-box using browser localStorage. Running this
-- once in the Supabase SQL editor additionally syncs scenarios across devices and
-- users. If this table does not exist, the app silently falls back to localStorage.
--
-- Scenarios are non-destructive "what-if" overlays — they never touch the
-- committed unit_adjustments / coa_adjustments / hiring_plan tables.

create table if not exists public.scenarios (
  id          text primary key,
  name        text not null default 'Untitled scenario',
  data        text not null,            -- full scenario JSON (levers, notes, etc.)
  user_email  text,
  updated_at  timestamptz not null default now()
);

-- Enable row-level security and allow authenticated users to read/write.
alter table public.scenarios enable row level security;

drop policy if exists "scenarios_authenticated_all" on public.scenarios;
create policy "scenarios_authenticated_all"
  on public.scenarios
  for all
  to authenticated
  using (true)
  with check (true);
