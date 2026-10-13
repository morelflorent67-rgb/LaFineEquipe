-- =============================================================================
-- 0400 · Journal de synchronisation FACEIT + source de détection des matchs en cours
-- Chaque passage de synchro est tracé. Une erreur par joueur est notée dans
-- `sync_failures` : c'est ce qui permet de distinguer « relevé manquant (panne) »
-- de « pas encore inscrit » dans l'historique ELO.
-- =============================================================================

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('profiles', 'matches')),
  trigger text not null check (trigger in ('cron', 'admin', 'script')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'error')),
  error_code text check (char_length(error_code) <= 40),
  stats jsonb not null default '{}'::jsonb
);
create index sync_runs_job_started on public.sync_runs (job, started_at desc);

create table public.sync_failures (
  sync_run_id uuid not null references public.sync_runs (id) on delete cascade,
  faceit_player_id uuid not null,
  error_code text not null check (char_length(error_code) <= 40),
  created_at timestamptz not null default now(),
  primary key (sync_run_id, faceit_player_id)
);
create index sync_failures_player on public.sync_failures (faceit_player_id, created_at desc);

-- Source utilisée pour afficher un match « en cours ». Tant que `source = 'none'`,
-- le site affiche « Statut indisponible » : aucune source n'a été validée par un test réel.
create table public.live_detection (
  id smallint primary key default 1 check (id = 1),
  source text not null default 'none' check (source in ('none', 'history_polling', 'webhook')),
  verified_at timestamptz,
  verification_note text check (char_length(verification_note) <= 500),
  updated_at timestamptz not null default now(),
  check ((source = 'none') or (verified_at is not null))
);
insert into public.live_detection (id) values (1);

create trigger live_detection_touch before update on public.live_detection
  for each row execute function public._touch_updated_at();

alter table public.sync_runs enable row level security;
alter table public.sync_failures enable row level security;
alter table public.live_detection enable row level security;

revoke all on public.sync_runs, public.sync_failures, public.live_detection from anon, authenticated;
grant select on public.sync_runs, public.sync_failures, public.live_detection to anon, authenticated;
grant update on public.live_detection to authenticated;

-- Les dates et statuts de synchro sont publics (fraîcheur des données).
create policy sync_runs_read on public.sync_runs for select to anon, authenticated using (true);
-- Les échecs par joueur : publics pour le roster, membres pour le reste (Mur).
create policy sync_failures_read on public.sync_failures
  for select to anon, authenticated
  using (
    exists (select 1 from public.players p where p.faceit_player_id = sync_failures.faceit_player_id)
    or (select public.is_member())
  );
create policy live_detection_read on public.live_detection for select to anon, authenticated using (true);
create policy live_detection_admin_update on public.live_detection
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Lecture publique
-- ---------------------------------------------------------------------------
create function public.get_sync_status() returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'jobs', coalesce(jsonb_object_agg(j.job, jsonb_build_object(
      'lastRun', (select jsonb_build_object('status', r.status, 'startedAt', r.started_at,
                                            'finishedAt', r.finished_at, 'errorCode', r.error_code)
                    from public.sync_runs r where r.job = j.job and r.status <> 'running'
                    order by r.started_at desc limit 1),
      'lastOkAt', (select max(r.finished_at) from public.sync_runs r
                    where r.job = j.job and r.status in ('ok', 'partial'))
    )), '{}'::jsonb),
    'live', (select jsonb_build_object('source', l.source, 'verifiedAt', l.verified_at,
                                       'note', l.verification_note)
               from public.live_detection l where l.id = 1)
  )
  from (values ('profiles'), ('matches')) as j(job)
$$;

-- ---------------------------------------------------------------------------
-- Synchronisation (rôle service uniquement, jamais appelable depuis le navigateur)
-- ---------------------------------------------------------------------------
create function public.sync_begin(p_job text, p_trigger text) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- Un passage resté « running » plus de 15 minutes est considéré comme abandonné.
  update public.sync_runs
     set status = 'error', finished_at = now(), error_code = 'abandoned'
   where job = p_job and status = 'running' and started_at < now() - interval '15 minutes';
  if exists (select 1 from public.sync_runs where job = p_job and status = 'running') then
    perform public._raise('LFE_BUSY');
  end if;
  insert into public.sync_runs (job, trigger) values (p_job, p_trigger) returning id into v_id;
  return v_id;
end
$$;

create function public.sync_end(
  p_run_id uuid, p_status text, p_stats jsonb default '{}'::jsonb, p_error_code text default null
) returns void
language sql
as $$
  update public.sync_runs
     set status = p_status, finished_at = now(), stats = coalesce(p_stats, '{}'::jsonb), error_code = p_error_code
   where id = p_run_id
$$;

create function public.sync_fail(p_run_id uuid, p_faceit_player_id uuid, p_code text) returns void
language plpgsql
as $$
begin
  insert into public.sync_failures (sync_run_id, faceit_player_id, error_code)
  values (p_run_id, p_faceit_player_id, p_code)
  on conflict do nothing;
  perform public._mark_faceit_profile_error(p_faceit_player_id, p_code);
end
$$;

-- Profils à rafraîchir : roster (actif) à chaque passage, Mur au plus une fois par 20 h.
create function public.sync_profile_targets() returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'faceitPlayerId', fp.faceit_player_id,
    'nickname', fp.nickname,
    'inRoster', p.id is not null,
    'rosterActive', coalesce(p.active, false),
    'inAvoid', a.id is not null,
    'fetchedAt', fp.fetched_at,
    'isDemo', fp.is_demo
  ) order by fp.fetched_at asc), '[]'::jsonb)
  from public.faceit_profiles fp
  left join public.players p using (faceit_player_id)
  left join public.avoid_list_entries a using (faceit_player_id)
  where not fp.is_demo
    and (coalesce(p.active, false)
         or (a.id is not null and fp.fetched_at < now() - interval '20 hours'))
$$;

create function public.admin_list_sync_runs(p_limit integer default 30) returns jsonb
language plpgsql stable
as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(x order by (x ->> 'startedAt') desc)
    from (
      select jsonb_build_object(
        'id', r.id, 'job', r.job, 'trigger', r.trigger, 'status', r.status,
        'startedAt', r.started_at, 'finishedAt', r.finished_at, 'errorCode', r.error_code,
        'stats', r.stats,
        'failures', (select count(*) from public.sync_failures f where f.sync_run_id = r.id)
      ) as x
      from public.sync_runs r
      order by r.started_at desc
      limit greatest(1, least(p_limit, 200))
    ) t
  ), '[]'::jsonb);
end
$$;

revoke all on function
  public.sync_begin(text, text), public.sync_end(uuid, text, jsonb, text),
  public.sync_fail(uuid, uuid, text), public.sync_profile_targets()
  from public, anon, authenticated;
grant execute on function
  public.sync_begin(text, text), public.sync_end(uuid, text, jsonb, text),
  public.sync_fail(uuid, uuid, text), public.sync_profile_targets()
  to service_role;
revoke all on function public.admin_list_sync_runs(integer) from public, anon;
grant execute on function public.admin_list_sync_runs(integer) to authenticated;
