create table public.routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  created_by text,
  source text not null default 'planned' check (source in ('planned','imported')),
  source_url text,
  prompt text,
  params jsonb,
  coords jsonb not null,
  waypoints jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  region text,
  tags text[] not null default '{}',
  notes text,
  driven boolean not null default false
);
create index routes_created_at_idx on public.routes (created_at desc);
alter table public.routes enable row level security;

create table public.route_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route_id uuid references public.routes(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  kind text not null check (kind in ('closed','harder','easier','missing','note')),
  note text,
  created_by text
);
create index route_reports_route_idx on public.route_reports (route_id);
create index route_reports_geo_idx on public.route_reports (lat, lon);
alter table public.route_reports enable row level security;
