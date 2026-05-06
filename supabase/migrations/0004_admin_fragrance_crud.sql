-- Maison Obsidian — admin fragrance CRUD
-- Allows the admin UI to delete individual fragrances. Insert/update
-- policies were established in 0003. Tighten in production by gating
-- on a custom claim (e.g. role = 'admin').

drop policy if exists "fragrances_admin_delete" on public.fragrances;
create policy "fragrances_admin_delete"
  on public.fragrances for delete
  using (auth.uid() is not null);
