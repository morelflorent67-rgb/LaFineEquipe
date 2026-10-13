-- =============================================================================
-- 0800 · Classement ELO permanent (décision du 13/10/2026, remplace les runs)
-- Plus de saison, de dates de run ni de remise à zéro : chaque joueur actif du roster
-- est classé en continu. Son « ELO d'ajout » est le relevé FACEIT pris au moment où
-- l'admin l'ajoute (ou le réactive) ; progression = ELO actuel − ELO d'ajout.
-- Rien n'est reconstitué avant l'ajout. Les relevés existants sont conservés.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Suppression du modèle par runs
-- ---------------------------------------------------------------------------
drop function public.list_elo_runs();
drop function public.get_elo_run(text);
drop function public.admin_save_run(jsonb);
drop function public.admin_delete_run(uuid);
drop function public.admin_add_participant(uuid, uuid);
drop function public.admin_remove_participant(uuid, uuid);
drop function public.sync_fill_starting_elos();
drop function public._fill_starting_elos();
drop function public._run_phase(public.elo_runs);
drop table public.elo_run_participants;
drop table public.elo_runs;

-- ---------------------------------------------------------------------------
-- 2. ELO d'ajout porté par le joueur
-- ---------------------------------------------------------------------------
alter table public.players
  add column added_elo integer check (added_elo between 0 and 10000),
  add column added_at timestamptz;

-- Reprise de l'existant : premier relevé enregistré autour de l'ajout, sinon date d'ajout.
update public.players p
   set added_at = coalesce((
     select min(s.measured_at) from public.elo_snapshots s
      where s.faceit_player_id = p.faceit_player_id and s.measured_at >= p.created_at - interval '10 minutes'
   ), p.created_at);
update public.players p
   set added_elo = (
     select s.elo from public.elo_snapshots s
      where s.faceit_player_id = p.faceit_player_id and s.measured_at >= p.added_at
      order by s.measured_at asc limit 1
   );
alter table public.players alter column added_at set default now(), alter column added_at set not null;

-- Le JSON d'un joueur expose désormais son ELO d'ajout.
create or replace function public._player_json(p public.players, fp public.faceit_profiles) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'group', p.roster_group,
    'active', p.active,
    'displayOrder', p.display_order,
    'isDemo', p.is_demo,
    'createdAt', p.created_at,
    'addedAt', p.added_at,
    'addedElo', p.added_elo,
    'profile', public._profile_json(fp)
  )
$$;

-- ELO d'ajout encore inconnu (profil sans CS2 à l'ajout, ou joueur réactivé) :
-- premier relevé réel enregistré à partir de added_at. Aucune valeur inventée.
create function public._fill_baselines() returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with firsts as (
    select p.id, s.elo
      from public.players p
      cross join lateral (
        select es.elo from public.elo_snapshots es
         where es.faceit_player_id = p.faceit_player_id and es.measured_at >= p.added_at
         order by es.measured_at asc limit 1
      ) s
     where p.added_elo is null
  )
  update public.players pl set added_elo = f.elo from firsts f where pl.id = f.id;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Enregistre un profil FACEIT et, pour un joueur du roster avec un ELO CS2, un relevé daté.
-- Un relevé identique au précédent (même ELO, même niveau) moins de 6 h après n'est pas
-- dupliqué : la fraîcheur reste visible via faceit_profiles.fetched_at.
create or replace function public._save_profile_with_snapshot(p_profile jsonb, p_run_id uuid, p_source text) returns void
language plpgsql
as $$
declare
  v_id uuid;
  v_elo integer := (p_profile ->> 'cs2Elo')::integer;
  v_level smallint := (p_profile ->> 'cs2Level')::smallint;
  v_at timestamptz := coalesce((p_profile ->> 'fetchedAt')::timestamptz, now());
  v_last public.elo_snapshots;
begin
  v_id := public._upsert_faceit_profile(p_profile);
  if v_elo is null or not exists (select 1 from public.players where faceit_player_id = v_id) then
    return;
  end if;
  select * into v_last from public.elo_snapshots where faceit_player_id = v_id order by measured_at desc limit 1;
  if v_last.id is not null and v_last.elo = v_elo and v_last.skill_level is not distinct from v_level
     and v_at - v_last.measured_at < interval '6 hours' then
    return;
  end if;
  insert into public.elo_snapshots (faceit_player_id, elo, skill_level, measured_at, source, sync_run_id)
  values (v_id, v_elo, v_level, v_at, p_source, p_run_id);
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Administration du roster
-- ---------------------------------------------------------------------------
-- Ajout : profil + joueur + premier relevé dans la même transaction. Le joueur entre
-- immédiatement au classement à son ELO actuel, progression 0.
create or replace function public.admin_add_player(p_profile jsonb, p_group text default 'team') returns jsonb
language plpgsql
as $$
declare
  v_faceit uuid := (p_profile ->> 'faceitPlayerId')::uuid;
  v_existing uuid;
  v_id uuid;
begin
  perform public._require_admin();
  select id into v_existing from public.players where faceit_player_id = v_faceit;
  if v_existing is not null then
    perform public._raise('LFE_DUPLICATE', jsonb_build_object('playerId', v_existing));
  end if;
  perform public._upsert_faceit_profile(p_profile);
  insert into public.players (faceit_player_id, roster_group, created_by, display_order, added_elo, added_at)
  values (
    v_faceit,
    p_group,
    auth.uid(),
    (select coalesce(max(display_order), 0) + 10 from public.players),
    (p_profile ->> 'cs2Elo')::integer,
    coalesce((p_profile ->> 'fetchedAt')::timestamptz, now())
  )
  returning id into v_id;
  perform public._save_profile_with_snapshot(p_profile, null, 'faceit_data_api');
  return jsonb_build_object('id', v_id);
end
$$;

-- Réactiver un joueur = le faire revenir au classement : son ELO d'ajout sera le
-- prochain relevé (l'application en prend un immédiatement).
drop function public.admin_update_player(uuid, text, boolean, integer);
create function public.admin_update_player(
  p_player_id uuid, p_group text, p_active boolean, p_display_order integer
) returns jsonb
language plpgsql
as $$
declare
  v_was_active boolean;
begin
  perform public._require_admin();
  select active into v_was_active from public.players where id = p_player_id;
  if v_was_active is null then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  update public.players
     set roster_group = p_group,
         active = p_active,
         display_order = p_display_order,
         added_at = case when not v_was_active and p_active then now() else added_at end,
         added_elo = case when not v_was_active and p_active then null else added_elo end
   where id = p_player_id;
  return jsonb_build_object('reactivated', not v_was_active and p_active);
end
$$;
revoke all on function public.admin_update_player(uuid, text, boolean, integer) from public, anon;
grant execute on function public.admin_update_player(uuid, text, boolean, integer) to authenticated;

-- Relevé immédiat demandé par un admin (rafraîchissement manuel, réactivation).
create or replace function public.admin_record_profile(p_profile jsonb) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  perform public._save_profile_with_snapshot(p_profile, null, 'faceit_data_api');
  perform public._fill_baselines();
end
$$;

-- Supprimer n'est possible que sans historique de matchs ; sinon on désactive le joueur
-- (il sort du classement, ses relevés sont conservés).
create or replace function public.admin_delete_player(p_player_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  if exists (select 1 from public.match_players where player_id = p_player_id) then
    perform public._raise('LFE_IN_USE');
  end if;
  delete from public.players where id = p_player_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Lecture publique : historique d'un joueur depuis son ajout
-- ---------------------------------------------------------------------------
-- Tous les relevés depuis l'ajout ; au-delà de 400, le dernier relevé de chaque
-- journée (heure de Paris) pour garder une réponse légère.
create function public.get_elo_history(p_player_id uuid) returns jsonb
language plpgsql stable
as $$
declare
  p public.players;
  v_n integer;
  v_points jsonb;
begin
  select * into p from public.players where id = p_player_id;
  if p.id is null then
    return null;
  end if;
  select count(*) into v_n from public.elo_snapshots s
   where s.faceit_player_id = p.faceit_player_id and s.measured_at >= p.added_at;
  if v_n <= 400 then
    select coalesce(jsonb_agg(jsonb_build_object('elo', s.elo, 'level', s.skill_level, 'measuredAt', s.measured_at)
                              order by s.measured_at), '[]'::jsonb)
      into v_points
      from public.elo_snapshots s
     where s.faceit_player_id = p.faceit_player_id and s.measured_at >= p.added_at;
  else
    select coalesce(jsonb_agg(jsonb_build_object('elo', d.elo, 'level', d.skill_level, 'measuredAt', d.measured_at)
                              order by d.measured_at), '[]'::jsonb)
      into v_points
      from (
        select distinct on ((s.measured_at at time zone 'Europe/Paris')::date) s.elo, s.skill_level, s.measured_at
          from public.elo_snapshots s
         where s.faceit_player_id = p.faceit_player_id and s.measured_at >= p.added_at
         order by (s.measured_at at time zone 'Europe/Paris')::date, s.measured_at desc
      ) d;
  end if;
  return jsonb_build_object(
    'playerId', p.id,
    'addedAt', p.added_at,
    'addedElo', p.added_elo,
    'total', v_n,
    'compacted', v_n > 400,
    'points', v_points
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Synchronisation : déclenchement public limité dans le temps
-- ---------------------------------------------------------------------------
alter table public.sync_runs drop constraint sync_runs_trigger_check;
alter table public.sync_runs add constraint sync_runs_trigger_check check (trigger in ('cron', 'admin', 'script', 'public'));

-- Intervalle minimal entre une actualisation demandée depuis le site et le passage précédent.
create function public._public_refresh_interval() returns interval
language sql immutable
as $$ select interval '2 minutes' $$;

create or replace function public.sync_begin(p_job text, p_trigger text) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_last timestamptz;
begin
  -- Un passage resté « running » plus de 15 minutes est considéré comme abandonné.
  update public.sync_runs
     set status = 'error', finished_at = now(), error_code = 'abandoned'
   where job = p_job and status = 'running' and started_at < now() - interval '15 minutes';
  if exists (select 1 from public.sync_runs where job = p_job and status = 'running') then
    perform public._raise('LFE_BUSY');
  end if;
  if p_trigger = 'public' then
    select max(started_at) into v_last from public.sync_runs where job = p_job;
    if v_last is not null and v_last > now() - public._public_refresh_interval() then
      perform public._raise('LFE_TOO_SOON', jsonb_build_object('retryAt', v_last + public._public_refresh_interval()));
    end if;
  end if;
  insert into public.sync_runs (job, trigger) values (p_job, p_trigger) returning id into v_id;
  return v_id;
end
$$;

-- État public de l'actualisation (bouton « Actualiser » et fraîcheur affichée).
create function public.refresh_status() returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'running', exists (select 1 from public.sync_runs
                        where job = 'profiles' and status = 'running' and started_at > now() - interval '15 minutes'),
    'lastStartedAt', max(r.started_at),
    'availableAt', max(r.started_at) + public._public_refresh_interval(),
    'lastOkAt', max(r.finished_at) filter (where r.status in ('ok', 'partial')),
    'now', now()
  )
  from public.sync_runs r
  where r.job = 'profiles'
$$;

create function public.sync_fill_baselines() returns integer
language sql
as $$ select public._fill_baselines() $$;

revoke all on function public._fill_baselines() from public, anon;
grant execute on function public._fill_baselines() to authenticated, service_role;
revoke all on function public.sync_fill_baselines() from public, anon, authenticated;
grant execute on function public.sync_fill_baselines() to service_role;
