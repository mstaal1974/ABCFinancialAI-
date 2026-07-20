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

-- Row-level security. Requires public.is_admin() — run db/roles_and_rls.sql first.
-- Scenarios are visible to the whole org (read = any authenticated user), but a
-- user may only create/edit/delete their OWN scenarios (owner matched by email),
-- except admins who may manage any. The owner check on INSERT/UPDATE also stops
-- a client stamping someone else's user_email onto a row (mass-assignment).
alter table public.scenarios enable row level security;

drop policy if exists "scenarios_authenticated_all" on public.scenarios;  -- old blanket using(true)
drop policy if exists "scenarios_read"   on public.scenarios;
drop policy if exists "scenarios_insert" on public.scenarios;
drop policy if exists "scenarios_update" on public.scenarios;
drop policy if exists "scenarios_delete" on public.scenarios;

create policy "scenarios_read"
  on public.scenarios for select to authenticated
  using (true);
create policy "scenarios_insert"
  on public.scenarios for insert to authenticated
  with check (user_email = (auth.jwt() ->> 'email') or public.is_admin());
create policy "scenarios_update"
  on public.scenarios for update to authenticated
  using (user_email = (auth.jwt() ->> 'email') or public.is_admin())
  with check (user_email = (auth.jwt() ->> 'email') or public.is_admin());
create policy "scenarios_delete"
  on public.scenarios for delete to authenticated
  using (user_email = (auth.jwt() ->> 'email') or public.is_admin());

-- ── Enrolment Planner (Student Goal-Seek) ────────────────────────────────────
-- Stores the saved enrolment plan (target, mix rows, client segments, capacity).
-- One row per user (id = 'plan-<email>'). Also optional — falls back to
-- localStorage when absent.
create table if not exists public.enrolment_plans (
  id          text primary key,
  data        text not null,            -- full plan JSON
  user_email  text,
  updated_at  timestamptz not null default now()
);

-- Same model as scenarios: org-wide read, owner-or-admin write. Requires
-- public.is_admin() (run db/roles_and_rls.sql first).
alter table public.enrolment_plans enable row level security;

drop policy if exists "enrolment_plans_authenticated_all" on public.enrolment_plans;  -- old blanket using(true)
drop policy if exists "enrolment_plans_read"   on public.enrolment_plans;
drop policy if exists "enrolment_plans_insert" on public.enrolment_plans;
drop policy if exists "enrolment_plans_update" on public.enrolment_plans;
drop policy if exists "enrolment_plans_delete" on public.enrolment_plans;

create policy "enrolment_plans_read"
  on public.enrolment_plans for select to authenticated
  using (true);
create policy "enrolment_plans_insert"
  on public.enrolment_plans for insert to authenticated
  with check (user_email = (auth.jwt() ->> 'email') or public.is_admin());
create policy "enrolment_plans_update"
  on public.enrolment_plans for update to authenticated
  using (user_email = (auth.jwt() ->> 'email') or public.is_admin())
  with check (user_email = (auth.jwt() ->> 'email') or public.is_admin());
create policy "enrolment_plans_delete"
  on public.enrolment_plans for delete to authenticated
  using (user_email = (auth.jwt() ->> 'email') or public.is_admin());
