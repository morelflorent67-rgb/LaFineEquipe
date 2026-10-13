-- =============================================================================
-- 0600 · Matchs FACEIT
-- Un match = une ligne, identifiée par son identifiant FACEIT : plusieurs joueurs
-- suivis dans la même partie donnent une seule carte. Score et map uniquement
-- s'ils sont renvoyés par l'API officielle.
-- =============================================================================

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  faceit_match_id text not null unique check (faceit_match_id ~ '^[A-Za-z0-9-]{8,80}$'),
  status text not null check (status in ('unknown', 'scheduled', 'ready', 'ongoing', 'finished', 'cancelled', 'aborted')),
  status_raw text check (char_length(status_raw) <= 40),
  map_key text check (map_key ~ '^[a-z0-9_]{2,40}$'),
  map_name text check (char_length(map_name) <= 40),
  started_at timestamptz,
  finished_at timestamptz,
  score jsonb,
  winner_faction text check (winner_faction in ('faction1', 'faction2')),
  factions jsonb not null default '{}'::jsonb,
  competition_name text check (char_length(competition_name) <= 120),
  faceit_url text not null check (faceit_url ~ '^https://www\.faceit\.com/'),
  source text not null check (source in ('faceit_history', 'faceit_match', 'demo')),
  details_fetched_at timestamptz,
  last_checked_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_recent on public.matches ((coalesce(finished_at, started_at)) desc nulls last);
create trigger matches_touch before update on public.matches
  for each row execute function public._touch_updated_at();

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  faction text check (faction in ('faction1', 'faction2')),
  primary key (match_id, player_id)
);
create index match_players_player on public.match_players (player_id);

alter table public.matches enable row level security;
alter table public.match_players enable row level security;
revoke all on public.matches, public.match_players from anon, authenticated;
grant select on public.matches, public.match_players to anon, authenticated;

create policy matches_read on public.matches for select to anon, authenticated using (true);
create policy match_players_read on public.match_players for select to anon, authenticated using (true);

-- Résultat d'un joueur dans un match : win / loss / cancelled / unknown.
create function public._player_result(m public.matches, p_faction text) returns text
language sql immutable
as $$
  select case
    when m.status in ('cancelled', 'aborted') then 'cancelled'
    when m.status = 'finished' and m.winner_faction is not null and p_faction is not null
      then case when m.winner_faction = p_faction then 'win' else 'loss' end
    else 'unknown'
  end
$$;

create function public._match_json(m public.matches) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', m.id,
    'faceitMatchId', m.faceit_match_id,
    'status', m.status,
    'mapKey', m.map_key,
    'mapName', m.map_name,
    'startedAt', m.started_at,
    'finishedAt', m.finished_at,
    'score', m.score,
    'winnerFaction', m.winner_faction,
    'factions', m.factions,
    'competitionName', m.competition_name,
    'faceitUrl', m.faceit_url,
    'source', m.source,
    'lastCheckedAt', m.last_checked_at,
    'isDemo', m.is_demo,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', p.id,
        'nickname', fp.nickname,
        'avatarUrl', fp.avatar_url,
        'faction', mp.faction,
        'result', public._player_result(m, mp.faction)
      ) order by lower(fp.nickname))
      from public.match_players mp
      join public.players p on p.id = mp.player_id
      join public.faceit_profiles fp on fp.faceit_player_id = p.faceit_player_id
      where mp.match_id = m.id
    ), '[]'::jsonb)
  )
$$;

create function public.list_recent_matches(p_limit integer default 10, p_player_id uuid default null) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(public._match_json(m) order by coalesce(m.finished_at, m.started_at) desc nulls last), '[]'::jsonb)
  from (
    select m.*
      from public.matches m
     where m.status in ('finished', 'cancelled', 'aborted')
       and (p_player_id is null or exists (
             select 1 from public.match_players mp where mp.match_id = m.id and mp.player_id = p_player_id))
     order by coalesce(m.finished_at, m.started_at) desc nulls last
     limit greatest(1, least(p_limit, 50))
  ) m
$$;

-- N derniers résultats (V/D/annulé/inconnu) par joueur.
create function public.recent_results(p_player_ids uuid[], p_n integer default 5) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('playerId', pid, 'results', res)), '[]'::jsonb)
  from (
    select pid, coalesce((
      select jsonb_agg(x.j order by x.at desc)
      from (
        select jsonb_build_object(
                 'matchId', m.id,
                 'faceitMatchId', m.faceit_match_id,
                 'result', public._player_result(m, mp.faction),
                 'at', coalesce(m.finished_at, m.started_at),
                 'mapName', m.map_name
               ) as j,
               coalesce(m.finished_at, m.started_at) as at
          from public.match_players mp
          join public.matches m on m.id = mp.match_id
         where mp.player_id = pid and m.status in ('finished', 'cancelled', 'aborted')
         order by coalesce(m.finished_at, m.started_at) desc nulls last
         limit greatest(1, least(p_n, 20))
      ) x
    ), '[]'::jsonb) as res
    from unnest(p_player_ids) as pid
  ) t
$$;

-- État « match en cours ». Tant qu'aucune source n'est validée : 'unavailable'.
create function public.get_live_state() returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'source', l.source,
    'verifiedAt', l.verified_at,
    'lastMatchesSyncOkAt', (select max(r.finished_at) from public.sync_runs r
                             where r.job = 'matches' and r.status in ('ok', 'partial')),
    'lastMatchesSyncStatus', (select r.status from public.sync_runs r
                               where r.job = 'matches' and r.status <> 'running'
                               order by r.started_at desc limit 1),
    'ongoing', case when l.source = 'none' then '[]'::jsonb else coalesce((
      select jsonb_agg(public._match_json(m) order by m.started_at desc nulls last)
        from public.matches m where m.status in ('ready', 'ongoing')
    ), '[]'::jsonb) end
  )
  from public.live_detection l
  where l.id = 1
$$;

-- ---------------------------------------------------------------------------
-- Synchronisation (rôle service)
-- ---------------------------------------------------------------------------
-- p : { faceitMatchId, status, statusRaw, mapKey, mapName, startedAt, finishedAt, score,
--       winnerFaction, factions, competitionName, faceitUrl, source, detailsFetched,
--       players: [{ faceitPlayerId, faction }] }
create function public.sync_upsert_match(p jsonb) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.matches as m (
    faceit_match_id, status, status_raw, map_key, map_name, started_at, finished_at, score,
    winner_faction, factions, competition_name, faceit_url, source, details_fetched_at, last_checked_at
  ) values (
    p ->> 'faceitMatchId', p ->> 'status', p ->> 'statusRaw', p ->> 'mapKey', p ->> 'mapName',
    (p ->> 'startedAt')::timestamptz, (p ->> 'finishedAt')::timestamptz,
    case when jsonb_typeof(p -> 'score') = 'object' then p -> 'score' end,
    p ->> 'winnerFaction', coalesce(p -> 'factions', '{}'::jsonb), p ->> 'competitionName',
    p ->> 'faceitUrl', p ->> 'source',
    case when coalesce((p ->> 'detailsFetched')::boolean, false) then now() end,
    now()
  )
  on conflict (faceit_match_id) do update set
    status = excluded.status,
    status_raw = excluded.status_raw,
    map_key = coalesce(excluded.map_key, m.map_key),
    map_name = coalesce(excluded.map_name, m.map_name),
    started_at = coalesce(excluded.started_at, m.started_at),
    finished_at = coalesce(excluded.finished_at, m.finished_at),
    score = coalesce(excluded.score, m.score),
    winner_faction = coalesce(excluded.winner_faction, m.winner_faction),
    factions = case when excluded.factions = '{}'::jsonb then m.factions else excluded.factions end,
    competition_name = coalesce(excluded.competition_name, m.competition_name),
    faceit_url = excluded.faceit_url,
    source = case when m.source = 'faceit_match' then m.source else excluded.source end,
    details_fetched_at = coalesce(excluded.details_fetched_at, m.details_fetched_at),
    last_checked_at = now()
  returning id into v_id;

  insert into public.match_players (match_id, player_id, faction)
  select v_id, pl.id, x.faction
    from jsonb_to_recordset(coalesce(p -> 'players', '[]'::jsonb)) as x(faceit_player_id uuid, faction text)
    join public.players pl on pl.faceit_player_id = x.faceit_player_id
  on conflict (match_id, player_id) do update set faction = excluded.faction;

  return v_id;
end
$$;

create function public.sync_matches_needing_details(p_limit integer default 10) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(faceit_match_id), '[]'::jsonb)
  from (
    select faceit_match_id
      from public.matches
     where details_fetched_at is null and not is_demo
       and status in ('finished', 'cancelled', 'aborted')
     order by coalesce(finished_at, started_at) desc nulls last
     limit greatest(1, least(p_limit, 50))
  ) t
$$;

create function public.sync_match_targets() returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('playerId', p.id, 'faceitPlayerId', p.faceit_player_id)), '[]'::jsonb)
  from public.players p
  join public.faceit_profiles fp using (faceit_player_id)
  where p.active and not fp.is_demo
$$;

revoke all on function public.sync_upsert_match(jsonb), public.sync_matches_needing_details(integer),
  public.sync_match_targets()
  from public, anon, authenticated;
grant execute on function public.sync_upsert_match(jsonb), public.sync_matches_needing_details(integer),
  public.sync_match_targets()
  to service_role;

-- ---------------------------------------------------------------------------
-- Suppression d'un joueur du roster : refusée s'il a un historique (run, match).
-- Dans ce cas, l'admin le désactive au lieu de le supprimer.
-- ---------------------------------------------------------------------------
create function public.admin_delete_player(p_player_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  if exists (select 1 from public.elo_run_participants where player_id = p_player_id)
     or exists (select 1 from public.match_players where player_id = p_player_id) then
    perform public._raise('LFE_IN_USE');
  end if;
  delete from public.players where id = p_player_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;
revoke all on function public.admin_delete_player(uuid) from public, anon;
grant execute on function public.admin_delete_player(uuid) to authenticated;

-- Après validation d'une source par le spike FACEIT (docs/faceit-feasibility.md).
create function public.admin_set_live_detection(p_source text, p_note text) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  update public.live_detection
     set source = p_source,
         verified_at = case when p_source = 'none' then null else now() end,
         verification_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = 1;
end
$$;
revoke all on function public.admin_set_live_detection(text, text) from public, anon;
grant execute on function public.admin_set_live_detection(text, text) to authenticated;
