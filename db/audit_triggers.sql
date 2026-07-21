-- ============================================================================
-- Database-level audit capture — guarantees EVERY change is recorded
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER db/roles_and_rls.sql (it needs the
-- audit_log table + the append-only setup defined there).
--
-- WHY
--   The app writes to Supabase directly from the browser and logs changes with
--   client-side sbAudit() calls. That is best-effort only: some paths don't log
--   (e.g. enrolment plans), and — critically — anyone with the anon key and a
--   valid JWT can PATCH/POST/DELETE against the PostgREST API directly, bypassing
--   the app entirely and leaving NO client-side audit entry. This trigger makes
--   the database itself record every INSERT/UPDATE/DELETE on the core tables, so
--   "any change made by anyone, through any path" is captured with the acting
--   user and a server timestamp that the client cannot forge.
--
--   The app's existing client-side audit rows still add human-readable context
--   (e.g. "QLD · CERT-IV · Aug-26"); these DB-captured rows are the completeness
--   guarantee underneath them. Both land in the same audit_log.

create extension if not exists pgcrypto;  -- gen_random_uuid()

create or replace function public.audit_capture()
returns trigger
language plpgsql
security definer                 -- runs as owner so it can write audit_log under RLS
set search_path = public
as $$
declare
  -- Actor is taken from the request JWT (or the uid, or 'system' for service-role
  -- / non-request writes) — never from client-supplied columns, so it can't be forged.
  v_actor  text := coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text, 'system');
  v_old    jsonb;
  v_new    jsonb;
  v_key    text;
  v_maxlen constant int := 10000;  -- cap stored value size to avoid audit-row bloat
begin
  if (TG_OP = 'DELETE') then
    v_old := to_jsonb(OLD);
    v_key := coalesce(v_old ->> 'key', v_old ->> 'id', v_old ->> 'user_id');
  elsif (TG_OP = 'UPDATE') then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    if v_old = v_new then return NEW; end if;   -- ignore no-op updates
    v_key := coalesce(v_new ->> 'key', v_new ->> 'id', v_new ->> 'user_id');
  else -- INSERT
    v_new := to_jsonb(NEW);
    v_key := coalesce(v_new ->> 'key', v_new ->> 'id', v_new ->> 'user_id');
  end if;

  insert into public.audit_log
    (id, user_email, user_name, action, entity, detail, old_value, new_value, created_at)
  values (
    gen_random_uuid()::text,
    v_actor, v_actor,
    TG_OP,                                                    -- INSERT | UPDATE | DELETE
    upper(TG_TABLE_NAME),                                     -- e.g. UNIT_ADJUSTMENTS
    format('%s on %s%s', TG_OP, TG_TABLE_NAME,
           case when v_key is not null then ' · ' || v_key else '' end),
    left(v_old::text, v_maxlen),
    left(v_new::text, v_maxlen),
    now()
  );

  if (TG_OP = 'DELETE') then return OLD; else return NEW; end if;
end;
$$;

-- Attach to every table that holds business/financial data or roles. Deliberately
-- NOT attached to audit_log itself (would self-log / recurse) — its integrity is
-- covered by the append-only policy + audit_stamp trigger in roles_and_rls.sql.
do $$
declare t text;
begin
  foreach t in array array[
    'unit_adjustments','coa_adjustments','hiring_plan','people_overrides',
    'xero_actuals','scenarios','enrolment_plans','user_roles'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_capture_trg on public.%I;', t);
      execute format(
        'create trigger audit_capture_trg after insert or update or delete on public.%I '
        'for each row execute function public.audit_capture();', t);
    else
      raise notice 'audit_capture: table public.% not found — skipped', t;
    end if;
  end loop;
end $$;

-- Verify afterwards:
--   select event_object_table, trigger_name
--     from information_schema.triggers
--    where trigger_name = 'audit_capture_trg' order by event_object_table;
