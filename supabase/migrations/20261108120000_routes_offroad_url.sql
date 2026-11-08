alter table public.routes add column if not exists offroad_url text check (offroad_url is null or offroad_url ~ '^https://off-road\.io/track/[0-9]{6,24}$');
