create or replace function public.pick_due_tile(refresh_days int default 21)
returns setof public.tile_queue
language sql
security definer
set search_path = public
as $$
  update public.tile_queue q set last_try = now()
  where q.key = (
    select key from public.tile_queue
    where (last_ok is null or last_ok < now() - make_interval(days => refresh_days))
      and (last_try is null or last_try < now() - interval '20 minutes')
    order by last_ok asc nulls first, priority asc, fails asc
    limit 1
    for update skip locked
  )
  returning q.*;
$$;
revoke all on function public.pick_due_tile(int) from public, anon, authenticated;
