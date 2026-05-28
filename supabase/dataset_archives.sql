-- Versioned snapshot store for editable datasets (Unit Modeler + Xero P&L).
-- Each save creates one row; the application trims to ARCHIVE_MAX (10) rows
-- per dataset_type so the table never grows unbounded.

create table if not exists dataset_archives (
  id          text primary key,
  dataset_type text not null check (dataset_type in ('UNIT', 'XERO')),
  label        text,
  payload      text not null,
  created_at   timestamptz not null default now(),
  created_by   text
);

create index if not exists dataset_archives_type_created_idx
  on dataset_archives (dataset_type, created_at desc);

-- RLS: mirror the existing tables in this project. Adjust as needed for your
-- authentication model. The default below allows any authenticated user to
-- read and write archive rows, which matches `unit_adjustments` etc.
alter table dataset_archives enable row level security;

drop policy if exists "dataset_archives_select" on dataset_archives;
create policy "dataset_archives_select" on dataset_archives
  for select using (auth.role() = 'authenticated');

drop policy if exists "dataset_archives_insert" on dataset_archives;
create policy "dataset_archives_insert" on dataset_archives
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "dataset_archives_delete" on dataset_archives;
create policy "dataset_archives_delete" on dataset_archives
  for delete using (auth.role() = 'authenticated');
