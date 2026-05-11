-- Maison Obsidian — round-trip fragrance notes + visuals
-- Adds JSON storage for the note pyramid and the four bottle/glass colors
-- so admin-created fragrances can persist every detail through Supabase.

alter table public.fragrances
  add column if not exists notes        jsonb       not null default '[]'::jsonb,
  add column if not exists bottle_color text        not null default '#0e0e12',
  add column if not exists glass_tint   text        not null default '#1a1a22',
  add column if not exists liquid_color text        not null default '#3b2a18',
  add column if not exists accent       text        not null default '#c9a961';

-- Backfill notes for the seed fragrances so they survive the round-trip
-- the next time the admin saves them. Each note is `{name, family}`
-- where family ∈ ('top','heart','base'). These mirror src/lib/data.ts.
update public.fragrances set notes = '[
  {"name":"Pineapple","family":"top"},
  {"name":"Bergamot","family":"top"},
  {"name":"Black Currant","family":"top"},
  {"name":"Birch Tar","family":"heart"},
  {"name":"Rose Absolute","family":"heart"},
  {"name":"Patchouli","family":"heart"},
  {"name":"Ambergris","family":"base"},
  {"name":"Oakmoss","family":"base"},
  {"name":"Vanilla","family":"base"}
]'::jsonb
where id = 'f-001' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Pipe Tobacco","family":"top"},
  {"name":"Spiced Rum","family":"top"},
  {"name":"Cocoa Noir","family":"heart"},
  {"name":"Vanilla Orchid","family":"heart"},
  {"name":"Dried Fig","family":"heart"},
  {"name":"Tonka Bean","family":"base"},
  {"name":"Sandalwood","family":"base"},
  {"name":"Tobacco Absolute","family":"base"}
]'::jsonb
where id = 'f-002' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Saffron","family":"top"},
  {"name":"Jasmine Sambac","family":"heart"},
  {"name":"Cedarwood","family":"base"},
  {"name":"Ambergris","family":"base"}
]'::jsonb
where id = 'f-003' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Taif Rose","family":"top"},
  {"name":"Lychee","family":"top"},
  {"name":"Iced Oud","family":"heart"},
  {"name":"White Musk","family":"base"}
]'::jsonb
where id = 'f-004' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Lavender","family":"top"},
  {"name":"Saffron Smoke","family":"heart"},
  {"name":"Aged Oud","family":"base"},
  {"name":"Cypriol","family":"base"}
]'::jsonb
where id = 'f-005' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Citron","family":"top"},
  {"name":"Pink Pepper","family":"top"},
  {"name":"Ginger","family":"heart"},
  {"name":"Sandalwood","family":"base"},
  {"name":"White Amber","family":"base"}
]'::jsonb
where id = 'f-006' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Iris Pallida","family":"top"},
  {"name":"Honeyed Suede","family":"heart"},
  {"name":"Vanilla Orchid","family":"base"}
]'::jsonb
where id = 'f-007' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Tuberose","family":"top"},
  {"name":"Salted Almond","family":"heart"},
  {"name":"Cocoa Noir","family":"base"}
]'::jsonb
where id = 'f-008' and notes = '[]'::jsonb;

update public.fragrances set notes = '[
  {"name":"Calabrian Bergamot","family":"top"},
  {"name":"Grapefruit Zest","family":"top"},
  {"name":"Liquorice","family":"heart"},
  {"name":"Cinnamon","family":"heart"},
  {"name":"Patchouli","family":"base"},
  {"name":"Vetiver","family":"base"},
  {"name":"Amber","family":"base"}
]'::jsonb
where id = 'f-009' and notes = '[]'::jsonb;

-- Backfill visuals for the seed fragrances so the bottle renders match
-- the in-code seed when the admin loads them.
update public.fragrances set bottle_color = '#0a0a0c', glass_tint = '#1c1408', liquid_color = '#5a3514', accent = '#c9a961'
  where id = 'f-002' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#100806', glass_tint = '#2b1208', liquid_color = '#a04a1c', accent = '#d9b370'
  where id = 'f-003' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#120a0d', glass_tint = '#2a1218', liquid_color = '#9c4660', accent = '#e0b884'
  where id = 'f-004' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#070708', glass_tint = '#161018', liquid_color = '#2c1a0c', accent = '#c9a961'
  where id = 'f-005' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#06080c', glass_tint = '#0c1422', liquid_color = '#1f3a5e', accent = '#c9a961'
  where id = 'f-006' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#1a0d10', glass_tint = '#311722', liquid_color = '#b8627c', accent = '#e3bf7a'
  where id = 'f-007' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#0c0a14', glass_tint = '#1d1830', liquid_color = '#5b3b86', accent = '#d6b66f'
  where id = 'f-008' and bottle_color = '#0e0e12';
update public.fragrances set bottle_color = '#050608', glass_tint = '#0d141c', liquid_color = '#13344f', accent = '#c9a961'
  where id = 'f-009' and bottle_color = '#0e0e12';
