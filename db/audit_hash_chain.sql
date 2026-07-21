-- ============================================================================
-- Tamper-evident audit log — hash chaining
-- ============================================================================
-- Run in the Supabase SQL editor AFTER db/roles_and_rls.sql (this replaces the
-- audit_stamp() trigger function defined there) and, ideally, after
-- db/audit_triggers.sql. Idempotent and safe to re-run.
--
-- WHAT THIS GIVES YOU
--   Each audit_log row stores prev_hash + row_hash, where
--     row_hash = sha256( prev_hash || '||' || <this row's content> ).
--   The rows form a chain: prev_hash of row N equals row_hash of row N-1. If
--   anyone edits, reorders, or deletes a historical row — even with direct
--   database access — every row after it fails to recompute, so the tampering is
--   DETECTABLE by walking the chain (public.verify_audit_chain()). Combined with
--   the append-only RLS from roles_and_rls.sql, the trail is tamper-evident.
--   (Tamper-evident, not tamper-proof: it detects changes, it can't prevent a
--   sufficiently privileged actor from rewriting the whole chain. For stronger
--   immutability also remove admin DELETE on audit_log and/or periodically export
--   the latest row_hash to an external store.)

create extension if not exists pgcrypto;  -- digest()

-- ── 1. Chain columns + ordering sequence ────────────────────────────────────
alter table public.audit_log add column if not exists seq       bigint;
alter table public.audit_log add column if not exists prev_hash text;
alter table public.audit_log add column if not exists row_hash  text;
create sequence if not exists public.audit_log_seq;
create index if not exists audit_log_seq_idx on public.audit_log (seq);

-- ── 2. Canonical payload helper ─────────────────────────────────────────────
-- The exact string hashed for a row. Used identically by the trigger, the
-- backfill, and the verifier — they MUST agree or the chain won't validate.
create or replace function public.audit_payload(
  p_id text, p_user_email text, p_action text, p_entity text,
  p_detail text, p_old text, p_new text, p_created timestamptz, p_seq bigint)
returns text language sql immutable set search_path = public as $$
  select coalesce(p_id,'')        || '|' || coalesce(p_user_email,'') || '|' ||
         coalesce(p_action,'')    || '|' || coalesce(p_entity,'')     || '|' ||
         coalesce(p_detail,'')    || '|' || coalesce(p_old,'')        || '|' ||
         coalesce(p_new,'')       || '|' || coalesce(p_created::text,'') || '|' ||
         coalesce(p_seq::text,'');
$$;

-- ── 3. audit_stamp(): server-set actor/timestamp + hash chain ───────────────
-- Replaces the audit_stamp() from roles_and_rls.sql (same trigger, richer body).
-- Serialised with a transaction-level advisory lock so concurrent writers can't
-- fork the chain; a transaction-local GUC carries the running tip so multi-row
-- INSERT statements (e.g. the restore's batched audit rows) chain correctly even
-- though sibling rows aren't yet visible to a per-row trigger.
create or replace function public.audit_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prev    text;
  v_payload text;
begin
  perform pg_advisory_xact_lock(hashtext('audit_log_hash_chain'));

  -- Actor + timestamp are server-authoritative (never trust the client's).
  new.user_email := coalesce(nullif(auth.jwt() ->> 'email', ''), new.user_email, 'unknown');
  new.created_at := now();

  -- Previous hash: the transaction-local tip if this txn has already written a
  -- row (handles multi-row inserts + multiple statements), else the committed tip.
  v_prev := current_setting('audit.tip_hash', true);
  if v_prev is null or v_prev = '' then
    select row_hash into v_prev from public.audit_log order by seq desc nulls last limit 1;
    v_prev := coalesce(v_prev, 'GENESIS');
  end if;

  if new.seq is null then new.seq := nextval('public.audit_log_seq'); end if;
  new.prev_hash := v_prev;
  v_payload := public.audit_payload(new.id, new.user_email, new.action, new.entity,
                                    new.detail, new.old_value, new.new_value,
                                    new.created_at, new.seq);
  new.row_hash := encode(digest(v_prev || '||' || v_payload, 'sha256'), 'hex');

  perform set_config('audit.tip_hash', new.row_hash, true); -- true = transaction-local
  return new;
end;
$$;

-- Ensure the trigger exists (roles_and_rls.sql already creates it; harmless here).
drop trigger if exists audit_stamp_trg on public.audit_log;
create trigger audit_stamp_trg
  before insert on public.audit_log
  for each row execute function public.audit_stamp();

-- ── 4. Backfill existing rows ───────────────────────────────────────────────
-- Chain any pre-existing rows that have no hash yet, in (created_at, id) order,
-- continuing from the current committed tip. Re-running only touches null rows.
do $$
declare
  r        record;
  v_prev   text;
  v_seq    bigint;
  v_payload text;
  v_hash   text;
begin
  select row_hash, seq into v_prev, v_seq
    from public.audit_log where row_hash is not null order by seq desc limit 1;
  v_prev := coalesce(v_prev, 'GENESIS');
  v_seq  := coalesce(v_seq, 0);

  for r in
    select ctid, * from public.audit_log where row_hash is null
    order by created_at nulls first, id
  loop
    v_seq := v_seq + 1;
    v_payload := public.audit_payload(r.id, r.user_email, r.action, r.entity,
                                      r.detail, r.old_value, r.new_value,
                                      r.created_at, v_seq);
    v_hash := encode(digest(v_prev || '||' || v_payload, 'sha256'), 'hex');
    update public.audit_log
       set seq = v_seq, prev_hash = v_prev, row_hash = v_hash
     where ctid = r.ctid;
    v_prev := v_hash;
  end loop;

  perform setval('public.audit_log_seq', greatest(v_seq, 1), true);
end $$;

-- ── 5. Verifier ─────────────────────────────────────────────────────────────
-- Walk the whole chain and report the first break (if any). Run any time:
--   select * from public.verify_audit_chain();
create or replace function public.verify_audit_chain()
returns table(ok boolean, rows_checked bigint, first_broken_seq bigint, detail text)
language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_prev   text := 'GENESIS';
  v_calc   text;
  v_payload text;
  n        bigint := 0;
begin
  for r in select * from public.audit_log order by seq loop
    v_payload := public.audit_payload(r.id, r.user_email, r.action, r.entity,
                                      r.detail, r.old_value, r.new_value,
                                      r.created_at, r.seq);
    v_calc := encode(digest(v_prev || '||' || v_payload, 'sha256'), 'hex');
    n := n + 1;
    if r.prev_hash is distinct from v_prev or r.row_hash is distinct from v_calc then
      ok := false; rows_checked := n; first_broken_seq := r.seq;
      detail := 'Chain broken at seq ' || r.seq
             || ' — a row at or before here was altered, deleted, or reordered.';
      return next; return;
    end if;
    v_prev := r.row_hash;
  end loop;
  ok := true; rows_checked := n; first_broken_seq := null;
  detail := 'Chain intact (' || n || ' rows).';
  return next;
end;
$$;

revoke all on function public.verify_audit_chain() from public;
grant execute on function public.verify_audit_chain() to authenticated;
