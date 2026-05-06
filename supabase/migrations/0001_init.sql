-- Maison Obsidian — initial schema
-- Tables: fragrances, commits, subscribers, sample_box_orders
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
  gender        text not null default 'unisex'
                check (gender in ('masculine','feminine','unisex')),
  moq           integer not null check (moq > 0),
  committed     integer not null default 0,
  batch_closes_at timestamptz not null,
  vip_only      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.commits (
  id                  uuid primary key default gen_random_uuid(),
  fragrance_id        text not null references public.fragrances(id) on delete cascade,
  user_id             uuid references auth.users(id) on delete set null,
  user_email          text,
  custom_label        text,
  payment_intent_id   text not null,
  status              text not null default 'authorized'
    check (status in ('authorized','captured','released','void')),
  created_at          timestamptz not null default now()
);
create index if not exists commits_fragrance_id_idx on public.commits(fragrance_id);
create index if not exists commits_user_id_idx       on public.commits(user_id);
create index if not exists commits_status_idx        on public.commits(status);

create table if not exists public.subscribers (
  email      text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  tier       text not null default 'general' check (tier in ('general','vip')),
  created_at timestamptz not null default now()
);

-- Sample Box: a customer chooses N fragrances (default 5) for a flat price.
create table if not exists public.sample_box_orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  user_email      text,
  fragrance_ids   text[] not null,
  price_cents     integer not null check (price_cents > 0),
  status          text not null default 'authorized'
    check (status in ('authorized','captured','shipped','released','void')),
  created_at      timestamptz not null default now(),
  constraint sample_box_size check (array_length(fragrance_ids, 1) between 1 and 10)
);
create index if not exists sample_box_user_id_idx on public.sample_box_orders(user_id);
create index if not exists sample_box_status_idx  on public.sample_box_orders(status);

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

-- Row-Level Security.
alter table public.fragrances         enable row level security;
alter table public.commits            enable row level security;
alter table public.subscribers        enable row level security;
alter table public.sample_box_orders  enable row level security;

drop policy if exists "fragrances_read" on public.fragrances;
create policy "fragrances_read"
  on public.fragrances for select
  using (true);

-- Anonymous can insert a commit (MVP). Authenticated users can also read
-- their own commits (so account pages can list them).
drop policy if exists "commits_insert" on public.commits;
create policy "commits_insert"
  on public.commits for insert
  with check (true);

drop policy if exists "commits_select_own" on public.commits;
create policy "commits_select_own"
  on public.commits for select
  using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "subscribers_insert" on public.subscribers;
create policy "subscribers_insert"
  on public.subscribers for insert
  with check (true);

drop policy if exists "sample_box_insert" on public.sample_box_orders;
create policy "sample_box_insert"
  on public.sample_box_orders for insert
  with check (true);

drop policy if exists "sample_box_select_own" on public.sample_box_orders;
create policy "sample_box_select_own"
  on public.sample_box_orders for select
  using (auth.uid() is not null and user_id = auth.uid());

-- Seed (idempotent) — mirrors src/lib/data.ts so live + offline match.
insert into public.fragrances
  (id, slug, name, inspiration, tagline, story, concentration, oil_percent, volume_ml, price_cents, gender, moq, committed, batch_closes_at, vip_only)
values
  ('f-001','obsidian-no-1','Obsidian No. 1','Inspired by Aventus','Smoked pineapple, birch, ambergris.','A signature opening of Sicilian pineapple charred over Laotian oud smoke.','Extrait de Parfum',30,50,18500,'masculine',20,12,'2026-06-15',false),
  ('f-002','noir-imperial','Noir Impérial','Inspired by Tom Ford Tobacco Vanille','Pipe tobacco, cocoa, dried fig.','An aged tobacco leaf wrapped in vanilla orchid and Madagascan cocoa.','Extrait de Parfum',30,50,19500,'unisex',25,19,'2026-06-10',false),
  ('f-003','saffron-vellum','Saffron Vellum','Inspired by Baccarat Rouge 540','Saffron, jasmine, ambered woods.','Persian saffron threads steeped in jasmine sambac.','Extrait de Parfum',30,50,21500,'unisex',30,30,'2026-05-28',false),
  ('f-004','atelier-rose','Atelier Rose','Inspired by Roses on Ice','Taif rose, lychee, frozen oud.','A glacial bouquet of Taif rose laid over chilled lychee.','Extrait de Parfum',30,50,19000,'feminine',20,7,'2026-07-01',true),
  ('f-005','khaleeji-oud','Khaleeji Oud','Inspired by Initio Oud for Greatness','Lavender, oud, saffron smoke.','A diplomat''s signature.','Extrait de Parfum',30,50,22500,'masculine',25,22,'2026-06-20',false),
  ('f-006','bleu-marbre','Bleu Marbre','Inspired by Bleu de Chanel','Citron, ginger, sandalwood.','Mediterranean citron and pink pepper rise off icy ginger.','Extrait de Parfum',30,50,17500,'masculine',20,5,'2026-07-12',false),
  ('f-007','velours-iris','Velours d''Iris','Inspired by La Vie est Belle','Iris pallida, suede, vanilla orchid.','Powdered Tuscan iris draped over honeyed suede.','Extrait de Parfum',30,50,18500,'feminine',20,11,'2026-06-28',false),
  ('f-008','tubereuse-blanche','Tubéreuse Blanche','Inspired by Carolina Herrera Good Girl','Tuberose, almond, cocoa noir.','A heady stem of Indian tuberose laid over salted almond and cocoa noir.','Extrait de Parfum',30,50,19500,'feminine',22,8,'2026-07-05',false),
  ('f-009','sauvage-onyx','Sauvage Onyx','Inspired by Sauvage Elixir','Liquorice, grapefruit, cinnamon.','Calabrian bergamot, liquorice and grapefruit zest over a base of patchouli, vetiver, amber.','Extrait de Parfum',30,50,19500,'masculine',25,17,'2026-06-25',false)
on conflict (id) do update set
  gender = excluded.gender,
  inspiration = excluded.inspiration,
  tagline = excluded.tagline;
