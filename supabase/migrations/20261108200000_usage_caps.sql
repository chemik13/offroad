-- Daily usage counters + caps (protects the owner's Anthropic key if the group code leaks)
create table if not exists public.usage_daily (day date not null, kind text not null, n int not null default 0, primary key (day, kind));
alter table public.usage_daily enable row level security;
insert into public.app_config (k, v) values ('cap_claude', '150'), ('cap_overpass', '400'), ('cap_import', '100') on conflict (k) do nothing;
create or replace function public.use_quota(k text, cap int) returns boolean language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Jerusalem')::date; v int;
begin
  insert into usage_daily (day, kind, n) values (d, k, 1) on conflict (day, kind) do update set n = usage_daily.n + 1 returning n into v;
  return v <= cap;
end $$;
revoke all on function public.use_quota(text, int) from public, anon, authenticated;
