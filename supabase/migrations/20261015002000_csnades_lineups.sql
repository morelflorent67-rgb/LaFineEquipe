-- =============================================================================
-- 2000 · Stuffs importés de csnades.gg (accord écrit de csnades, voir docs/csnades-import.md)
-- Valeurs constatées sur leurs données le 15/10/2026. Les vidéos et images restent hébergées
-- par csnades (assets.csnades.gg) : seule cette origine est acceptée pour les médias externes.
-- Coordonnées sur la vue aérienne en % (0–100), comme le reste de la carte tactique.
-- =============================================================================

-- Médias externes : chaque chaîne du document doit être une URL assets.csnades.gg.
create function public._external_media_ok(p jsonb) returns boolean
language sql immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object' and not exists (
      select 1 from jsonb_path_query(p, 'lax $.**') v
      where jsonb_typeof(v) = 'string'
        and (v #>> '{}') !~ '^https://assets\.csnades\.gg/[A-Za-z0-9/_.-]+\.(mp4|webm|webp|png|jpg)$'
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- 1. Vues aériennes par niveau (Nuke a deux niveaux)
-- ---------------------------------------------------------------------------
create table public.map_radars (
  map_id uuid not null references public.maps (id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  image_url text not null check (image_url ~ '^https://assets\.csnades\.gg/[A-Za-z0-9/_.-]+\.(webp|png|jpg)$'),
  callouts_url text check (callouts_url ~ '^https://assets\.csnades\.gg/[A-Za-z0-9/_.-]+\.svg$'),
  width integer not null check (width between 100 and 5000),
  height integer not null check (height between 100 and 5000),
  primary key (map_id, level)
);
alter table public.map_radars enable row level security;
revoke all on public.map_radars from anon, authenticated;
grant select on public.map_radars to anon, authenticated;
grant insert, update, delete on public.map_radars to authenticated;
create policy map_radars_read on public.map_radars for select to anon, authenticated using (true);
create policy map_radars_admin_write on public.map_radars
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. Nouveaux champs des stuffs
-- ---------------------------------------------------------------------------
alter table public.utilities drop constraint utilities_technique_check;
alter table public.utilities
  add constraint utilities_technique_check
    check (technique in ('static', 'jumpthrow', 'runthrow', 'run_jumpthrow', 'walkthrow', 'crouch', 'jump_crouch', 'other')),
  alter column difficulty drop not null,
  add column source text not null default 'lfe' check (source in ('lfe', 'csnades')),
  add column source_id text check (source_id ~ '^nade_[0-9a-f]{6,32}$'),
  add column source_url text
    check (source_url ~ '^https://csnades\.gg/[a-z0-9-]+/(smokes|molotovs|flashbangs|hegrenades)/[a-z0-9-]+$'),
  add column source_updated_at timestamptz,
  add column credit text check (char_length(credit) <= 80),
  add column movement text
    check (movement in ('stationary', 'walking', 'running', 'crouched_stationary', 'crouched_walking')),
  add column throw_click text check (throw_click in ('left', 'right', 'both')),
  add column jump boolean,
  add column precision text check (precision in ('loose', 'precise', 'very_precise')),
  add column throw_x numeric(5, 2) check (throw_x between 0 and 100),
  add column throw_y numeric(5, 2) check (throw_y between 0 and 100),
  add column throw_level smallint not null default 1 check (throw_level between 1 and 3),
  add column landing_level smallint not null default 1 check (landing_level between 1 and 3),
  add column bounces jsonb not null default '[]' check (jsonb_typeof(bounces) = 'array'),
  add column media jsonb check (public._external_media_ok(media)),
  add column console_cmd text check (char_length(console_cmd) <= 160 and console_cmd ~ '^setpos [-0-9. ]+; ?setang [-0-9. ]+$'),
  add column air_time numeric(5, 2) check (air_time between 0 and 60),
  add column step_times numeric[] not null default '{}' check (cardinality(step_times) <= 12),
  add constraint utilities_throw_pair check ((throw_x is null) = (throw_y is null)),
  add constraint utilities_source_id_pair check ((source = 'lfe') = (source_id is null));
create unique index utilities_source_unique on public.utilities (source, source_id) where source_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Sérialisation
-- ---------------------------------------------------------------------------
create or replace function public._utility_json(u public.utilities, m public.maps) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', u.id, 'slug', u.slug, 'mapSlug', m.slug, 'mapName', m.name,
    'title', u.title, 'side', u.side, 'grenade', u.grenade, 'zone', u.zone,
    'originName', u.origin_name, 'targetName', u.target_name, 'purpose', u.purpose,
    'description', u.description, 'steps', to_jsonb(u.steps), 'stepTimes', to_jsonb(u.step_times),
    'technique', u.technique, 'difficulty', u.difficulty, 'tags', to_jsonb(u.tags),
    'placementImage', u.placement_image, 'aimImage', u.aim_image, 'videoUrl', u.video_url,
    'verifiedAt', u.verified_at, 'status', u.status, 'isDemo', u.is_demo,
    'updatedAt', u.updated_at, 'openReports', public._open_reports(u.id),
    'throwPositionId', u.throw_position_id,
    'landing', case when u.landing_x is null then null
                    else jsonb_build_object('x', u.landing_x, 'y', u.landing_y, 'level', u.landing_level) end,
    'throw', case when u.throw_x is null then null
                  else jsonb_build_object('x', u.throw_x, 'y', u.throw_y, 'level', u.throw_level) end,
    'bounces', u.bounces,
    'movement', u.movement, 'click', u.throw_click, 'jump', u.jump, 'precision', u.precision,
    'media', u.media, 'consoleCmd', u.console_cmd, 'airTime', u.air_time,
    'source', u.source, 'sourceUrl', u.source_url, 'sourceUpdatedAt', u.source_updated_at, 'credit', u.credit
  )
$$;

create or replace function public._map_json(m public.maps, p_include_drafts boolean) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'slug', m.slug, 'name', m.name, 'faceitKey', m.faceit_key, 'imagePath', m.image_path,
    'coverPath', m.cover_path, 'aerialPath', m.aerial_path,
    'active', m.active, 'sortOrder', m.sort_order,
    'counts', public._map_counts(m.id, p_include_drafts),
    'positionCount', (select count(*) from public.map_positions mp where mp.map_id = m.id),
    'radars', coalesce((
      select jsonb_agg(jsonb_build_object('level', r.level, 'imageUrl', r.image_url, 'calloutsUrl', r.callouts_url,
                                          'width', r.width, 'height', r.height) order by r.level)
      from public.map_radars r where r.map_id = m.id
    ), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Import (script local `npm run csnades`, accès service uniquement)
-- Relançable : un stuff déjà importé est mis à jour (son état publié/brouillon est conservé) ;
-- un stuff csnades absent du nouvel import repasse en brouillon (retiré chez csnades).
-- ---------------------------------------------------------------------------
create function public.import_csnades_map(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_map uuid;
  v_item jsonb;
  v_ids text[] := '{}';
  v_inserted integer := 0;
  v_updated integer := 0;
  v_retired integer;
  v_is_new boolean;
begin
  select id into v_map from public.maps where slug = p ->> 'mapSlug';
  if v_map is null then
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'mapSlug'));
  end if;

  delete from public.map_radars where map_id = v_map;
  insert into public.map_radars (map_id, level, image_url, callouts_url, width, height)
  select v_map, (r ->> 'level')::smallint, r ->> 'imageUrl', r ->> 'calloutsUrl', (r ->> 'width')::integer, (r ->> 'height')::integer
    from jsonb_array_elements(p -> 'radars') r;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_ids := v_ids || (v_item ->> 'sourceId');
    insert into public.utilities as u (
      map_id, slug, title, side, grenade, origin_name, target_name, description, steps, step_times,
      technique, difficulty, tags, status, source, source_id, source_url, source_updated_at, credit,
      movement, throw_click, jump, precision, throw_x, throw_y, throw_level, landing_x, landing_y, landing_level,
      bounces, media, console_cmd, air_time
    ) values (
      v_map, v_item ->> 'slug', v_item ->> 'title', v_item ->> 'side', v_item ->> 'grenade',
      v_item ->> 'originName', v_item ->> 'targetName', v_item ->> 'description',
      array(select jsonb_array_elements_text(v_item -> 'steps')),
      array(select (jsonb_array_elements_text(v_item -> 'stepTimes'))::numeric),
      v_item ->> 'technique', v_item ->> 'difficulty',
      array(select jsonb_array_elements_text(v_item -> 'tags')),
      'published', 'csnades', v_item ->> 'sourceId', v_item ->> 'sourceUrl', (v_item ->> 'sourceUpdatedAt')::timestamptz,
      v_item ->> 'credit', v_item ->> 'movement', v_item ->> 'click', (v_item ->> 'jump')::boolean, v_item ->> 'precision',
      (v_item #>> '{throw,x}')::numeric, (v_item #>> '{throw,y}')::numeric, (v_item #>> '{throw,level}')::smallint,
      (v_item #>> '{landing,x}')::numeric, (v_item #>> '{landing,y}')::numeric, (v_item #>> '{landing,level}')::smallint,
      v_item -> 'bounces', v_item -> 'media', v_item ->> 'consoleCmd', (v_item ->> 'airTime')::numeric
    )
    on conflict (source, source_id) where source_id is not null do update set
      map_id = excluded.map_id, slug = excluded.slug, title = excluded.title, side = excluded.side,
      grenade = excluded.grenade, origin_name = excluded.origin_name, target_name = excluded.target_name,
      description = excluded.description, steps = excluded.steps, step_times = excluded.step_times,
      technique = excluded.technique, difficulty = excluded.difficulty, tags = excluded.tags,
      source_url = excluded.source_url, source_updated_at = excluded.source_updated_at, credit = excluded.credit,
      movement = excluded.movement, throw_click = excluded.throw_click, jump = excluded.jump,
      precision = excluded.precision, throw_x = excluded.throw_x, throw_y = excluded.throw_y,
      throw_level = excluded.throw_level, landing_x = excluded.landing_x, landing_y = excluded.landing_y,
      landing_level = excluded.landing_level, bounces = excluded.bounces, media = excluded.media,
      console_cmd = excluded.console_cmd, air_time = excluded.air_time
    returning (xmax = 0) into v_is_new;
    if v_is_new then
      v_inserted := v_inserted + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  update public.utilities set status = 'draft'
   where map_id = v_map and source = 'csnades' and status = 'published' and not (source_id = any (v_ids));
  get diagnostics v_retired = row_count;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'retired', v_retired);
end
$$;

revoke all on function public.import_csnades_map(jsonb) from public, anon, authenticated;
grant execute on function public.import_csnades_map(jsonb) to service_role;
