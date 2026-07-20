-- ============================================================================
-- Roles + Row-Level Security for EduGrowth BI
-- ============================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE the
-- policy changes in scenarios.sql / xero_actuals.sql — both depend on the
-- public.is_admin() helper defined here.
--
-- WHY THIS EXISTS
--   The browser talks directly to Supabase with the public anon key + a per-user
--   JWT. There is no application server, so Postgres RLS is the ONLY thing that
--   can enforce authorisation. Previously every policy was `using (true)`, which
--   let any authenticated user read, overwrite, and DELETE all rows — including
--   other people's financial data and salaries, and the audit log. This script
--   introduces an admin/member role model and locks destructive / org-wide
--   operations to admins, while keeping the shared financial data readable (and
--   normally editable) by all authenticated staff.
--
-- DATA-MODEL DECISION (state it, don't assume):
--   This app is single-organisation. All financial data (unit adjustments, chart
--   of accounts, hiring plan, staff overrides, Xero actuals) is intentionally a
--   SHARED dataset every authenticated user sees — that is the product design,
--   and it is why the app has no per-user scoping. So the policies below are:
--     • read  : any authenticated user      (shared org view)
--     • write : any authenticated user      (collaborative editing)
--     • DELETE / org-wide destructive ops : admin only
--   If you later need per-user or multi-tenant isolation, add an org_id column
--   and scope the SELECT/WRITE policies by it — the seams are marked below.
--
-- ⚠️  CRITICAL OPERATOR STEP — DROP PRE-EXISTING BLANKET POLICIES
--   Postgres combines permissive policies with OR. If an old `using(true)`
--   policy still exists on any table, these tighter policies DO NOTHING (the old
--   one keeps granting everything). For each table below, first inspect and drop
--   any pre-existing policy that is not created here:
--       select schemaname, tablename, policyname, cmd, qual, with_check
--         from pg_policies where schemaname = 'public' order by tablename;
--       drop policy if exists "<old_policy_name>" on public.<table>;
--   The `drop policy if exists` lines below only cover the names this project
--   knows about; drop any others you find.
-- ============================================================================

-- ── 1. Roles table ──────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin','member')),
  updated_at timestamptz not null default now()
);

-- ── 2. is_admin() helper ────────────────────────────────────────────────────
-- MUST be defined before any policy references it: `language sql` bodies are
-- validated at creation, so both this function (which reads user_roles) and the
-- policies below (which call this function) require their dependencies to already
-- exist. Order is therefore: table → function → policies. SECURITY DEFINER lets
-- it read user_roles without being subject to RLS (avoids policy recursion); the
-- fixed search_path prevents search-path hijacking.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ── 3. user_roles RLS policies (now that is_admin() exists) ──────────────────
alter table public.user_roles enable row level security;

-- A user may read their OWN role row (the client calls this to decide UI gating).
drop policy if exists "user_roles_self_read" on public.user_roles;
create policy "user_roles_self_read"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- Only admins may read everyone's roles or change any role assignment.
drop policy if exists "user_roles_admin_read" on public.user_roles;
create policy "user_roles_admin_read"
  on public.user_roles for select to authenticated
  using (public.is_admin());

drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_admin_write"
  on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 4. Bootstrap the first admin ────────────────────────────────────────────
-- Roles default to 'member', so nobody is admin until you set one. Run this once
-- with the email of your platform administrator (find the uuid in Auth → Users):
--
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'mstaal@abctraining.edu.au'
--   on conflict (user_id) do update set role = 'admin', updated_at = now();
--
-- Thereafter admins manage roles via the user_roles_admin_write policy.

-- ── 5. Core financial tables ────────────────────────────────────────────────
-- `create table if not exists` is a no-op on your existing production tables
-- (it will NOT alter columns) — it only helps fresh/local installs. The column
-- shapes below are inferred from the app code; reconcile them against your live
-- schema with `supabase db pull` when you can. The RLS statements DO apply to
-- the existing tables.
--
-- Policy shape for all four: read+write for any authenticated user, DELETE for
-- admins only. Making DELETE admin-only is what blocks the "Reset all data"
-- operation (which deletes rows) at the database level, regardless of the UI.

create table if not exists public.unit_adjustments (
  key text primary key,
  value jsonb
  -- , org_id uuid   -- ← add + index here if you introduce multi-tenancy
);
create table if not exists public.coa_adjustments (
  key text primary key,
  value jsonb
);
create table if not exists public.hiring_plan (
  id text primary key,
  role_id text,
  count integer,
  start_month text,
  region text,
  filled boolean default false,
  event_type text default 'hire'
);
create table if not exists public.people_overrides (
  key text primary key,
  value text            -- app stores JSON.stringify(...) here
);

do $$
declare t text;
begin
  foreach t in array array['unit_adjustments','coa_adjustments','hiring_plan','people_overrides']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_read',      t);
    execute format('drop policy if exists %I on public.%I;', t||'_write',     t);
    execute format('drop policy if exists %I on public.%I;', t||'_write_upd', t);
    execute format('drop policy if exists %I on public.%I;', t||'_delete',    t);
    -- read: any authenticated user (shared org view). Tighten here for tenancy.
    execute format('create policy %I on public.%I for select to authenticated using (true);', t||'_read', t);
    -- insert + update: any authenticated user (collaborative editing).
    execute format('create policy %I on public.%I for insert to authenticated with check (true);', t||'_write', t);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true);', t||'_write_upd', t);
    -- delete: admins only (blocks "Reset all data" for non-admins server-side).
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin());', t||'_delete', t);
  end loop;
end $$;

-- NOTE on people_overrides (salaries): read is left open to all authenticated
-- users to match the app's current staffing views. If salary figures must be
-- confidential, change its _read policy to `using (public.is_admin())`.

-- ── 6. Audit log — append-only + server-stamped actor ───────────────────────
-- The audit trail must be tamper-resistant: any authenticated user may INSERT
-- (their actions get logged) and SELECT (read history), but UPDATE is forbidden
-- and DELETE is admin-only. A trigger overrides the client-supplied actor and
-- timestamp with the authenticated identity + server clock, so entries cannot be
-- forged under another user or backdated. (Advances review item #10.)
create table if not exists public.audit_log (
  id text primary key,
  user_email text,
  user_name text,
  action text,
  entity text,
  detail text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_insert" on public.audit_log;
create policy "audit_log_insert"
  on public.audit_log for insert to authenticated with check (true);

drop policy if exists "audit_log_read" on public.audit_log;
create policy "audit_log_read"
  on public.audit_log for select to authenticated using (true);

-- No UPDATE policy at all → updates are denied for everyone (append-only).
drop policy if exists "audit_log_delete" on public.audit_log;
create policy "audit_log_delete"
  on public.audit_log for delete to authenticated using (public.is_admin());

create or replace function public.audit_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_email := coalesce(auth.jwt() ->> 'email', 'unknown');
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists audit_stamp_trg on public.audit_log;
create trigger audit_stamp_trg
  before insert on public.audit_log
  for each row execute function public.audit_stamp();
