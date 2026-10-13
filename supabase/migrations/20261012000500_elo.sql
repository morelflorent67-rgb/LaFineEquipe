-- =============================================================================
-- 0500 · ELO Run
-- Règles : progression = ELO actuel − ELO de départ.
-- ELO de départ = premier relevé réellement enregistré à partir du début du run
-- (ou de l'arrivée du joueur s'il rejoint en cours). Tant qu'aucun relevé n'existe,
-- le départ reste vide : aucune valeur n'est inventée.
-- =============================================================================

create table public.elo_runs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz,
  published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create trigger elo_runs_touch before update on public.elo_runs
  for each row execute function public._touch_updated_at();

create table public.elo_run_participants (
  run_id uuid not null references public.elo_runs (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  joined_at timestamptz not null default now(),
  starting_elo integer check (starting_elo between 0 and 10000),
  starting_measured_at timestamptz,
  primary key (run_id, player_id),
  check ((starting_elo is null) = (starting_measured_at is null))
);
create index elo_run_participants_player on public.elo_run_participants (player_id);

create table public.elo_snapshots (
  id bigint generated always as identity primary key,
  faceit_player_id uuid not null references public.faceit_profiles (faceit_player_id) on delete cascade,
  elo integer not null check (elo between 0 and 10000),
  skill_level smallint check (skill_level between 1 and 10),
  measured_at timestamptz not null default now(),
  source text not null default 'faceit_data_api' check (source in ('faceit_data_api', 'demo')),
  sync_run_id uuid references public.sync_runs (id) on delete set null
);
create index elo_snapshots_player_time on public.elo_snapshots (faceit_player_id, measured_at desc);

alter table public.elo_runs enable row level security;
alter table public.elo_run_participants enable row level security;
alter table public.elo_snapshots enable row level security;

revoke all on public.elo_runs, public.elo_run_participants, public.elo_snapshots from anon, authenticated;
grant select on public.elo_runs, public.elo_run_participants, public.elo_snapshots to anon, authenticated;
grant insert, update, delete on public.elo_runs, public.elo_run_participants, public.elo_snapshots to authenticated;

create policy elo_runs_read on public.elo_runs
  for select to anon, authenticated using (published or (select public.is_admin()));
create policy elo_runs_admin_write on public.elo_runs
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy elo_participants_read on public.elo_run_participants
  for select to anon, authenticated
  using (exists (select 1 from public.elo_runs r where r.id = run_id and (r.published or (select public.is_admin()))));
create policy elo_participants_admin_write on public.elo_run_participants
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy elo_snapshots_read on public.elo_snapshots
  for select to anon, authenticated
  using (
    exists (select 1 from public.players p where p.faceit_player_id = elo_snapshots.faceit_player_id)
    or (select public.is_member())
  );
create policy elo_snapshots_admin_write on public.elo_snapshots
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Calculs internes
-- ---------------------------------------------------------------------------
create function public._run_phase(r public.elo_runs) returns text
language sql stable
as $$
  select case
    when now() < r.starts_at then 'upcoming'
    when r.ends_at is not null and now() >= r.ends_at then 'finished'
    else 'active'
  end
$$;

-- Renseigne l'ELO de départ des participants qui n'en ont pas encore, à partir du
-- premier relevé enregistré après max(début du run, arrivée du joueur).
create function public._fill_starting_elos() returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with firsts as (
    select e.run_id, e.player_id, s.elo, s.measured_at
      from public.elo_run_participants e
      join public.elo_runs r on r.id = e.run_id
      join public.players p on p.id = e.player_id
      cross join lateral (
        select es.elo, es.measured_at
          from public.elo_snapshots es
         where es.faceit_player_id = p.faceit_player_id
           and es.measured_at >= greatest(r.starts_at, e.joined_at)
           and (r.ends_at is null or es.measured_at <= r.ends_at)
         order by es.measured_at asc
         limit 1
      ) s
     where e.starting_elo is null
  )
  update public.elo_run_participants erp
     set starting_elo = f.elo, starting_measured_at = f.measured_at
    from firsts f
   where erp.run_id = f.run_id and erp.player_id = f.player_id;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Enregistre un profil FACEIT et, si FACEIT fournit un ELO CS2, un relevé daté.
create function public._save_profile_with_snapshot(p_profile jsonb, p_run_id uuid, p_source text) returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := public._upsert_faceit_profile(p_profile);
  if (p_profile ->> 'cs2Elo') is not null
     and exists (select 1 from public.players where faceit_player_id = v_id) then
    insert into public.elo_snapshots (faceit_player_id, elo, skill_level, measured_at, source, sync_run_id)
    values (
      v_id,
      (p_profile ->> 'cs2Elo')::integer,
      (p_profile ->> 'cs2Level')::smallint,
      coalesce((p_profile ->> 'fetchedAt')::timestamptz, now()),
      p_source,
      p_run_id
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Lecture publique
-- ---------------------------------------------------------------------------
create function public.list_elo_runs() returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'name', r.name,
    'startsAt', r.starts_at, 'endsAt', r.ends_at,
    'published', r.published, 'isDemo', r.is_demo,
    'phase', public._run_phase(r),
    'participantCount', (select count(*) from public.elo_run_participants e where e.run_id = r.id)
  ) order by (public._run_phase(r) = 'active') desc, r.starts_at desc), '[]'::jsonb)
  from public.elo_runs r
$$;

create function public.get_elo_run(p_slug text) returns jsonb
language plpgsql stable
as $$
declare
  r public.elo_runs;
  v_until timestamptz;
begin
  select * into r from public.elo_runs where slug = p_slug;
  if r.id is null then
    return null;
  end if;
  v_until := least(now(), coalesce(r.ends_at, now()));

  return jsonb_build_object(
    'run', jsonb_build_object(
      'id', r.id, 'slug', r.slug, 'name', r.name, 'startsAt', r.starts_at, 'endsAt', r.ends_at,
      'published', r.published, 'isDemo', r.is_demo, 'phase', public._run_phase(r)
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', p.id,
        'group', p.roster_group,
        'active', p.active,
        'joinedAt', e.joined_at,
        'startingElo', e.starting_elo,
        'startingMeasuredAt', e.starting_measured_at,
        'profile', public._profile_json(fp),
        'current', (
          select jsonb_build_object('elo', s.elo, 'level', s.skill_level, 'measuredAt', s.measured_at, 'source', s.source)
            from public.elo_snapshots s
           where s.faceit_player_id = p.faceit_player_id
             and s.measured_at >= greatest(r.starts_at, e.joined_at)
             and s.measured_at <= v_until
           order by s.measured_at desc
           limit 1
        )
      ) order by lower(fp.nickname))
      from public.elo_run_participants e
      join public.players p on p.id = e.player_id
      join public.faceit_profiles fp on fp.faceit_player_id = p.faceit_player_id
      where e.run_id = r.id
    ), '[]'::jsonb),
    -- Dernier relevé de chaque journée (heure de Paris), après l'arrivée du joueur.
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('playerId', d.player_id, 'day', d.day, 'elo', d.elo, 'measuredAt', d.measured_at)
                       order by d.player_id, d.day)
      from (
        select distinct on (p.id, (s.measured_at at time zone 'Europe/Paris')::date)
               p.id as player_id,
               (s.measured_at at time zone 'Europe/Paris')::date as day,
               s.elo, s.measured_at
          from public.elo_run_participants e
          join public.players p on p.id = e.player_id
          join public.elo_snapshots s on s.faceit_player_id = p.faceit_player_id
         where e.run_id = r.id
           and s.measured_at >= greatest(r.starts_at, e.joined_at)
           and s.measured_at <= v_until
         order by p.id, (s.measured_at at time zone 'Europe/Paris')::date, s.measured_at desc
      ) d
    ), '[]'::jsonb),
    -- Passages de synchro par jour : sert à expliquer un jour sans relevé.
    'syncDays', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.day, 'runs', x.runs, 'okRuns', x.ok_runs) order by x.day)
      from (
        select (sr.started_at at time zone 'Europe/Paris')::date as day,
               count(*) as runs,
               count(*) filter (where sr.status in ('ok', 'partial')) as ok_runs
          from public.sync_runs sr
         where sr.job = 'profiles' and sr.started_at >= r.starts_at and sr.started_at <= v_until
         group by 1
      ) x
    ), '[]'::jsonb),
    'failDays', coalesce((
      select jsonb_agg(jsonb_build_object('playerId', x.player_id, 'day', x.day, 'failures', x.failures) order by x.day)
      from (
        select p.id as player_id,
               (f.created_at at time zone 'Europe/Paris')::date as day,
               count(*) as failures
          from public.elo_run_participants e
          join public.players p on p.id = e.player_id
          join public.sync_failures f on f.faceit_player_id = p.faceit_player_id
          join public.sync_runs sr on sr.id = f.sync_run_id and sr.job = 'profiles'
         where e.run_id = r.id and f.created_at >= r.starts_at and f.created_at <= v_until
         group by 1, 2
      ) x
    ), '[]'::jsonb),
    'generatedAt', now()
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------
create function public.admin_save_run(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public._require_admin();
  if v_id is null then
    insert into public.elo_runs (slug, name, starts_at, ends_at, published)
    values (p ->> 'slug', btrim(p ->> 'name'), (p ->> 'startsAt')::timestamptz,
            nullif(p ->> 'endsAt', '')::timestamptz, coalesce((p ->> 'published')::boolean, false))
    returning id into v_id;
  else
    update public.elo_runs
       set slug = p ->> 'slug', name = btrim(p ->> 'name'),
           starts_at = (p ->> 'startsAt')::timestamptz,
           ends_at = nullif(p ->> 'endsAt', '')::timestamptz,
           published = coalesce((p ->> 'published')::boolean, false)
     where id = v_id;
    if not found then
      perform public._raise('LFE_NOT_FOUND');
    end if;
    -- Les bornes ont pu changer : on recalcule les départs encore vides.
    perform public._fill_starting_elos();
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

create function public.admin_delete_run(p_run_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  delete from public.elo_runs where id = p_run_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;

create function public.admin_add_participant(p_run_id uuid, p_player_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  if exists (select 1 from public.elo_run_participants where run_id = p_run_id and player_id = p_player_id) then
    perform public._raise('LFE_DUPLICATE');
  end if;
  insert into public.elo_run_participants (run_id, player_id) values (p_run_id, p_player_id);
  perform public._fill_starting_elos();
end
$$;

create function public.admin_remove_participant(p_run_id uuid, p_player_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  delete from public.elo_run_participants where run_id = p_run_id and player_id = p_player_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;

-- Relevé immédiat demandé par un admin (ajout à un run, rafraîchissement manuel).
create function public.admin_record_profile(p_profile jsonb) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  perform public._save_profile_with_snapshot(p_profile, null, 'faceit_data_api');
  perform public._fill_starting_elos();
end
$$;

-- Synchronisation planifiée (rôle service).
create function public.sync_save_profile(p_run_id uuid, p_profile jsonb) returns void
language plpgsql
as $$
begin
  perform public._save_profile_with_snapshot(p_profile, p_run_id, 'faceit_data_api');
end
$$;

create function public.sync_fill_starting_elos() returns integer
language sql
as $$ select public._fill_starting_elos() $$;

revoke all on function public._fill_starting_elos(), public._save_profile_with_snapshot(jsonb, uuid, text)
  from public, anon;
grant execute on function public._fill_starting_elos(), public._save_profile_with_snapshot(jsonb, uuid, text)
  to authenticated, service_role;
revoke all on function
  public.admin_save_run(jsonb), public.admin_delete_run(uuid), public.admin_add_participant(uuid, uuid),
  public.admin_remove_participant(uuid, uuid), public.admin_record_profile(jsonb)
  from public, anon;
grant execute on function
  public.admin_save_run(jsonb), public.admin_delete_run(uuid), public.admin_add_participant(uuid, uuid),
  public.admin_remove_participant(uuid, uuid), public.admin_record_profile(jsonb)
  to authenticated;
revoke all on function public.sync_save_profile(uuid, jsonb), public.sync_fill_starting_elos()
  from public, anon, authenticated;
grant execute on function public.sync_save_profile(uuid, jsonb), public.sync_fill_starting_elos() to service_role;
