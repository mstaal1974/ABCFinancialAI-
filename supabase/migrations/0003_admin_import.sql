-- Maison Obsidian — admin spreadsheet imports
-- Adds: comparison_price_cents, opens up an upsert path so the admin UI
-- can patch the catalogue from the client (provided the user is signed
-- in). In production replace the open insert/update RLS with a proper
-- admin role check or move the import behind an Edge Function.

alter table public.fragrances
  add column if not exists comparison_price_cents integer
    check (comparison_price_cents is null or comparison_price_cents > 0);

-- Allow signed-in users to insert / update fragrances. Tighten in
-- production by gating on a custom claim (e.g. role = 'admin') or by
-- routing imports through a Supabase Edge Function with the service-role
-- key.
drop policy if exists "fragrances_admin_insert" on public.fragrances;
create policy "fragrances_admin_insert"
  on public.fragrances for insert
  with check (auth.uid() is not null);

drop policy if exists "fragrances_admin_update" on public.fragrances;
create policy "fragrances_admin_update"
  on public.fragrances for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
