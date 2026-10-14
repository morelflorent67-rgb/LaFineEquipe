-- =============================================================================
-- 1600 · Mur des lamentations public (décision du 14/10/2026)
-- 1. Banlist : les entrées ACTIVES (et leur profil FACEIT) sont lisibles par tous.
--    Les entrées archivées et les notes internes restent réservées à l'admin.
-- 2. Wall of Shame : statistiques par joueur suivi et par match, copiées telles que
--    renvoyées par GET /matches/{id}/stats (Kills, Deaths, Headshots %, ADR, Result).
--    Classement calculé sur les 30 derniers jours, joueurs « team » uniquement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Banlist publique
-- ---------------------------------------------------------------------------
drop policy avoid_entries_read_members on public.avoid_list_entries;
grant select on public.avoid_list_entries to anon;
create policy avoid_entries_read_public on public.avoid_list_entries
  for select to anon, authenticated
  using (status = 'active' or (select public.is_admin()));

-- Un profil FACEIT est public s'il est au roster (politique existante) ou sur la Banlist active.
drop policy faceit_profiles_read_members on public.faceit_profiles;
create policy faceit_profiles_read_wall on public.faceit_profiles
  for select to anon, authenticated
  using (exists (
    select 1 from public.avoid_list_entries a
     where a.faceit_player_id = faceit_profiles.faceit_player_id and a.status = 'active'
  ));
create policy faceit_profiles_read_admin on public.faceit_profiles
  for select to authenticated using ((select public.is_admin()));

-- Lecture publique, toujours sans motif. La RLS ne laisse voir les archives qu'à l'admin.
create or replace function public.list_avoid_entries(p_status text default 'active') returns jsonb
language plpgsql stable
as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'status', a.status,
        'addedAt', a.added_at,
        'archivedAt', a.archived_at,
        'isDemo', a.is_demo,
        'profile', public._profile_json(fp)
      ) order by a.added_at desc
    )
    from public.avoid_list_entries a
    join public.faceit_profiles fp using (faceit_player_id)
    where p_status = 'all' or a.status = p_status
  ), '[]'::jsonb);
end
$$;
grant execute on function public.list_avoid_entries(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Statistiques de match par joueur suivi
-- ---------------------------------------------------------------------------
alter table public.matches add column player_stats_fetched_at timestamptz;

create table public.match_player_stats (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  kills integer not null check (kills between 0 and 200),
  deaths integer not null check (deaths between 0 and 200),
  headshots_pct numeric(5, 2) not null check (headshots_pct between 0 and 100),
  adr numeric(6, 2) check (adr between 0 and 1000),
  won boolean,
  fetched_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index match_player_stats_player on public.match_player_stats (player_id);

alter table public.match_player_stats enable row level security;
revoke all on public.match_player_stats from anon, authenticated;
grant select on public.match_player_stats to anon, authenticated;
create policy match_player_stats_read on public.match_player_stats
  for select to anon, authenticated using (true);

-- Matchs terminés récents dont les stats joueurs n'ont pas encore été lues.
create function public.sync_matches_needing_player_stats(p_days integer default 30, p_limit integer default 30) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(faceit_match_id), '[]'::jsonb)
  from (
    select m.faceit_match_id
      from public.matches m
     where m.status = 'finished' and not m.is_demo and m.player_stats_fetched_at is null
       and m.finished_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
       and exists (select 1 from public.match_players mp where mp.match_id = m.id)
     order by m.finished_at desc
     limit greatest(1, least(p_limit, 50))
  ) t
$$;

-- p_stats : [{ faceitPlayerId, kills, deaths, headshotsPct, adr, won }] (déjà validé côté serveur).
-- Seuls les joueurs du roster sont enregistrés ; le match est marqué « lu » même sans ligne,
-- pour ne pas redemander indéfiniment des stats absentes.
create function public.sync_save_player_stats(p_faceit_match_id text, p_stats jsonb) returns integer
language plpgsql
as $$
declare
  v_match uuid;
  v_count integer;
begin
  select id into v_match from public.matches where faceit_match_id = p_faceit_match_id;
  if v_match is null then
    perform public._raise('LFE_NOT_FOUND', jsonb_build_object('match', p_faceit_match_id));
  end if;

  insert into public.match_player_stats (match_id, player_id, kills, deaths, headshots_pct, adr, won)
  select v_match, pl.id, x."kills", x."deaths", x."headshotsPct", x."adr", x."won"
    from jsonb_to_recordset(case when jsonb_typeof(p_stats) = 'array' then p_stats else '[]'::jsonb end)
      as x("faceitPlayerId" uuid, "kills" integer, "deaths" integer, "headshotsPct" numeric, "adr" numeric, "won" boolean)
    join public.players pl on pl.faceit_player_id = x."faceitPlayerId"
  on conflict (match_id, player_id) do update set
    kills = excluded.kills, deaths = excluded.deaths, headshots_pct = excluded.headshots_pct,
    adr = excluded.adr, won = excluded.won, fetched_at = now();
  get diagnostics v_count = row_count;

  update public.matches set player_stats_fetched_at = now() where id = v_match;
  return v_count;
end
$$;

revoke all on function public.sync_matches_needing_player_stats(integer, integer), public.sync_save_player_stats(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_matches_needing_player_stats(integer, integer), public.sync_save_player_stats(text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Wall of Shame : 5 catégories, 3 « lauréats » max chacune, joueurs « team » actifs.
-- Records sur un match : Le Touriste (moins de kills), La Passoire (plus de morts).
-- Moyennes (3 matchs minimum) : Le Myope (HS %), Le Pacifiste (ADR), Le Chat noir (% de victoires).
-- ---------------------------------------------------------------------------
create function public.wall_of_shame(p_days integer default 30) returns jsonb
language sql stable
as $$
  with params as (
    select greatest(1, least(p_days, 90)) as days, now() as at
  ),
  base as (
    select s.*, m.finished_at, m.map_name, m.faceit_url, m.is_demo as match_demo,
           p.id as pid, fp.nickname, fp.avatar_url, fp.cs2_skill_level, fp.is_demo as profile_demo
      from public.match_player_stats s
      join public.matches m on m.id = s.match_id
      join public.players p on p.id = s.player_id
      join public.faceit_profiles fp on fp.faceit_player_id = p.faceit_player_id
     cross join params
     where p.active and p.roster_group = 'team'
       and m.status = 'finished'
       and m.finished_at >= params.at - make_interval(days => params.days)
  ),
  who as (
    select distinct on (pid) pid, jsonb_build_object(
      'playerId', pid, 'nickname', nickname, 'avatarUrl', avatar_url,
      'cs2Level', cs2_skill_level, 'isDemo', profile_demo
    ) as j
    from base
  ),
  agg as (
    select pid, count(*)::int as n,
           round(avg(headshots_pct), 1) as hs,
           round(avg(adr) filter (where adr is not null), 1) as adr,
           count(*) filter (where adr is not null)::int as n_adr,
           count(*) filter (where won is not null)::int as n_res,
           round(100.0 * count(*) filter (where won) / nullif(count(*) filter (where won is not null), 0), 0) as winrate
      from base group by pid
  ),
  touriste as (
    select jsonb_agg(x.j order by x.rk) as rows from (
      select jsonb_build_object('player', w.j, 'value', b.kills, 'matches', 1,
               'match', jsonb_build_object('mapName', b.map_name, 'finishedAt', b.finished_at, 'faceitUrl', b.faceit_url, 'isDemo', b.match_demo)) as j,
             row_number() over (order by b.kills asc, b.deaths desc, b.finished_at desc) as rk
        from (select distinct on (pid) * from base order by pid, kills asc, deaths desc, finished_at desc) b
        join who w using (pid)
    ) x where x.rk <= 3
  ),
  passoire as (
    select jsonb_agg(x.j order by x.rk) as rows from (
      select jsonb_build_object('player', w.j, 'value', b.deaths, 'matches', 1,
               'match', jsonb_build_object('mapName', b.map_name, 'finishedAt', b.finished_at, 'faceitUrl', b.faceit_url, 'isDemo', b.match_demo)) as j,
             row_number() over (order by b.deaths desc, b.kills asc, b.finished_at desc) as rk
        from (select distinct on (pid) * from base order by pid, deaths desc, kills asc, finished_at desc) b
        join who w using (pid)
    ) x where x.rk <= 3
  ),
  myope as (
    select jsonb_agg(x.j order by x.rk) as rows from (
      select jsonb_build_object('player', w.j, 'value', a.hs, 'matches', a.n) as j,
             row_number() over (order by a.hs asc, a.n desc) as rk
        from agg a join who w using (pid) where a.n >= 3
    ) x where x.rk <= 3
  ),
  pacifiste as (
    select jsonb_agg(x.j order by x.rk) as rows from (
      select jsonb_build_object('player', w.j, 'value', a.adr, 'matches', a.n_adr) as j,
             row_number() over (order by a.adr asc, a.n_adr desc) as rk
        from agg a join who w using (pid) where a.n_adr >= 3
    ) x where x.rk <= 3
  ),
  chat_noir as (
    select jsonb_agg(x.j order by x.rk) as rows from (
      select jsonb_build_object('player', w.j, 'value', a.winrate, 'matches', a.n_res) as j,
             row_number() over (order by a.winrate asc, a.n_res desc) as rk
        from agg a join who w using (pid) where a.n_res >= 3
    ) x where x.rk <= 3
  )
  select jsonb_build_object(
    'days', (select days from params),
    'computedAt', (select at from params),
    'matchesCounted', (select count(distinct match_id) from base),
    'playersCounted', (select count(*) from who),
    'categories', jsonb_build_object(
      'touriste', coalesce((select rows from touriste), '[]'::jsonb),
      'passoire', coalesce((select rows from passoire), '[]'::jsonb),
      'myope', coalesce((select rows from myope), '[]'::jsonb),
      'pacifiste', coalesce((select rows from pacifiste), '[]'::jsonb),
      'chatNoir', coalesce((select rows from chat_noir), '[]'::jsonb)
    )
  )
$$;
grant execute on function public.wall_of_shame(integer) to anon, authenticated;
