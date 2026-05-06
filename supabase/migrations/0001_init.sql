-- Maison Obsidian — initial schema
-- Tables: fragrances, commits, subscribers
-- The frontend gracefully degrades to seed data when these tables are empty.

create extension if not exists "pgcrypto";

create table if not exists public.fragrances (
  id            text primary key,
  slug          text unique not null,
  name          text not null,
  inspiration   text not null,
  tagline       text not null,
  story         text not null,
  concentration text not null,
  oil_percent   integer not null check (oil_percent between 0 and 40),
  volume_ml     integer not null,
  price_cents   integer not null check (price_cents > 0),
  moq           integer not null check (moq > 0),
  committed     integer not null default 0,
  batch_closes_at timestamptz not null,
  vip_only      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.commits (
  id                  uuid primary key default gen_random_uuid(),
  fragrance_id        text not null references public.fragrances(id) on delete cascade,
  user_email          text,
  custom_label        text,
  payment_intent_id   text not null,
  status              text not null default 'authorized'
    check (status in ('authorized','captured','released','void')),
  created_at          timestamptz not null default now()
);
create index if not exists commits_fragrance_id_idx on public.commits(fragrance_id);
create index if not exists commits_status_idx on public.commits(status);

create table if not exists public.subscribers (
  email      text primary key,
  tier       text not null default 'general' check (tier in ('general','vip')),
  created_at timestamptz not null default now()
);

-- Keep `fragrances.committed` in sync as commits land/leave.
create or replace function public.sync_fragrance_committed()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.fragrances
       set committed = committed + 1
     where id = new.fragrance_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.fragrances
       set committed = greatest(0, committed - 1)
     where id = old.fragrance_id;
    return old;
  elsif (tg_op = 'UPDATE') then
    -- A commit being released after the fact decrements the live count.
    if (old.status <> 'released' and new.status = 'released') then
      update public.fragrances
         set committed = greatest(0, committed - 1)
       where id = new.fragrance_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_commits_sync on public.commits;
create trigger trg_commits_sync
  after insert or update or delete on public.commits
  for each row execute function public.sync_fragrance_committed();

-- Row-Level Security. Allow anonymous reads of the catalogue, anonymous
-- inserts of commits/subscribers (this is an MVP) — but never reads of other
-- people's commits or updates from the client.
alter table public.fragrances  enable row level security;
alter table public.commits     enable row level security;
alter table public.subscribers enable row level security;

drop policy if exists "fragrances_read" on public.fragrances;
create policy "fragrances_read"
  on public.fragrances for select
  using (true);

drop policy if exists "commits_insert" on public.commits;
create policy "commits_insert"
  on public.commits for insert
  with check (true);

drop policy if exists "subscribers_insert" on public.subscribers;
create policy "subscribers_insert"
  on public.subscribers for insert
  with check (true);

-- Seed (idempotent) — mirrors src/lib/data.ts so live + offline match.
insert into public.fragrances
  (id, slug, name, inspiration, tagline, story, concentration, oil_percent, volume_ml, price_cents, moq, committed, batch_closes_at, vip_only)
values
  ('f-001','obsidian-no-1','Obsidian No. 1','Inspired by Aventus','Smoked pineapple, birch, ambergris.','A signature opening of Sicilian pineapple charred over Laotian oud smoke.','Extrait de Parfum',30,50,18500,20,12,'2026-06-15',false),
  ('f-002','noir-imperial','Noir Impérial','Inspired by Tom Ford Tobacco Vanille','Pipe tobacco, cocoa, dried fig.','An aged tobacco leaf wrapped in vanilla orchid and Madagascan cocoa.','Extrait de Parfum',30,50,19500,25,19,'2026-06-10',false),
  ('f-003','saffron-vellum','Saffron Vellum','Inspired by Baccarat Rouge 540','Saffron, jasmine, ambered woods.','Persian saffron threads steeped in jasmine sambac.','Extrait de Parfum',30,50,21500,30,30,'2026-05-28',false),
  ('f-004','atelier-rose','Atelier Rose','Inspired by Roses on Ice','Taif rose, lychee, frozen oud.','A glacial bouquet of Taif rose laid over chilled lychee.','Extrait de Parfum',30,50,19000,20,7,'2026-07-01',true),
  ('f-005','khaleeji-oud','Khaleeji Oud','Inspired by Initio Oud for Greatness','Lavender, oud, saffron smoke.','A diplomat''s signature.','Extrait de Parfum',30,50,22500,25,22,'2026-06-20',false),
  ('f-006','bleu-marbre','Bleu Marbre','Inspired by Bleu de Chanel','Citron, ginger, sandalwood.','Mediterranean citron and pink pepper rise off icy ginger.','Extrait de Parfum',30,50,17500,20,5,'2026-07-12',false)
on conflict (id) do nothing;
