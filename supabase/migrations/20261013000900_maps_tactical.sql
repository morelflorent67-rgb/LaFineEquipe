-- =============================================================================
-- 0900 · Maps avec vraies images + carte tactique (décision du 13/10/2026)
-- Chaque map a une vraie capture (vignette) et une vue aérienne, téléversées par un admin
-- (captures de la team ou ressources utilisables légalement). Les positions de lancer
-- sont placées à la main par l'admin sur la vue aérienne, en % : rien n'est inventé.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Images des maps (stockage « stuff-media », dossier maps/)
-- ---------------------------------------------------------------------------
alter table public.maps
  add column cover_path text check (cover_path ~ '^maps/[a-z0-9-]+/[a-z0-9-]+\.(webp|png|jpg|jpeg)$'),
  add column aerial_path text check (aerial_path ~ '^maps/[a-z0-9-]+/[a-z0-9-]+\.(webp|png|jpg|jpeg)$');

-- Overpass fait partie des maps prévues (sans illustration maison : la vraie capture viendra de l'admin).
insert into public.maps (slug, name, faceit_key, image_path, sort_order)
values ('overpass', 'Overpass', 'de_overpass', null, 65)
on conflict (slug) do nothing;
update public.maps set sort_order = 40 where slug = 'ancient';
update public.maps set sort_order = 50 where slug = 'nuke';

create policy stuff_media_admin_insert_maps on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stuff-media' and (select public.is_admin()) and (storage.foldername(name))[1] = 'maps');

-- ---------------------------------------------------------------------------
-- 2. Positions de lancer et rattachement des stuffs
-- ---------------------------------------------------------------------------
create table public.map_positions (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  x numeric(5, 2) not null check (x between 0 and 100),
  y numeric(5, 2) not null check (y between 0 and 100),
  created_at timestamptz not null default now()
);
create index map_positions_map on public.map_positions (map_id);

alter table public.map_positions enable row level security;
revoke all on public.map_positions from anon, authenticated;
grant select on public.map_positions to anon, authenticated;
grant insert, update, delete on public.map_positions to authenticated;
create policy map_positions_read on public.map_positions for select to anon, authenticated using (true);
create policy map_positions_admin_write on public.map_positions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.utilities
  add column throw_position_id uuid references public.map_positions (id) on delete set null,
  add column landing_x numeric(5, 2) check (landing_x between 0 and 100),
  add column landing_y numeric(5, 2) check (landing_y between 0 and 100),
  add constraint utilities_landing_pair check ((landing_x is null) = (landing_y is null));

-- ---------------------------------------------------------------------------
-- 3. Sérialisation
-- ---------------------------------------------------------------------------
create function public._position_json(p public.map_positions) returns jsonb
language sql stable
as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'x', p.x, 'y', p.y)
$$;

create or replace function public._utility_json(u public.utilities, m public.maps) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', u.id, 'slug', u.slug, 'mapSlug', m.slug, 'mapName', m.name,
    'title', u.title, 'side', u.side, 'grenade', u.grenade, 'zone', u.zone,
    'originName', u.origin_name, 'targetName', u.target_name, 'purpose', u.purpose,
    'description', u.description, 'steps', to_jsonb(u.steps), 'technique', u.technique,
    'difficulty', u.difficulty, 'tags', to_jsonb(u.tags),
    'placementImage', u.placement_image, 'aimImage', u.aim_image, 'videoUrl', u.video_url,
    'verifiedAt', u.verified_at, 'status', u.status, 'isDemo', u.is_demo,
    'updatedAt', u.updated_at, 'openReports', public._open_reports(u.id),
    'throwPositionId', u.throw_position_id,
    'landing', case when u.landing_x is null then null else jsonb_build_object('x', u.landing_x, 'y', u.landing_y) end
  )
$$;

create function public._map_json(m public.maps, p_include_drafts boolean) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'slug', m.slug, 'name', m.name, 'faceitKey', m.faceit_key, 'imagePath', m.image_path,
    'coverPath', m.cover_path, 'aerialPath', m.aerial_path,
    'active', m.active, 'sortOrder', m.sort_order,
    'counts', public._map_counts(m.id, p_include_drafts),
    'positionCount', (select count(*) from public.map_positions mp where mp.map_id = m.id)
  )
$$;

create or replace function public.list_maps(p_include_drafts boolean default false) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(public._map_json(m, p_include_drafts and public.is_admin()) order by m.sort_order, m.name), '[]'::jsonb)
  from public.maps m
  where m.active or public.is_admin()
$$;

create or replace function public.list_utilities(p_map_slug text, p_include_drafts boolean default false) returns jsonb
language sql stable
as $$
  select case when m.id is null then null else jsonb_build_object(
    'map', public._map_json(m, p_include_drafts and public.is_admin()),
    'positions', coalesce((
      select jsonb_agg(public._position_json(p) order by p.name) from public.map_positions p where p.map_id = m.id
    ), '[]'::jsonb),
    'utilities', coalesce((
      select jsonb_agg(public._utility_json(u, m) order by coalesce(u.zone, ''), u.title)
      from public.utilities u
      where u.map_id = m.id and (u.status = 'published' or (p_include_drafts and public.is_admin()))
    ), '[]'::jsonb)
  ) end
  from (select 1) one
  left join public.maps m on m.slug = p_map_slug and (m.active or public.is_admin())
$$;

-- La fiche renvoie aussi la position de lancer et l'image aérienne (mini-radar).
create or replace function public.get_utility(p_map_slug text, p_slug text) returns jsonb
language plpgsql stable
as $$
declare
  m public.maps;
  u public.utilities;
  v_order jsonb;
begin
  select * into m from public.maps where slug = p_map_slug;
  if m.id is null then return null; end if;
  select * into u from public.utilities where map_id = m.id and slug = p_slug;
  if u.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'title', x.title) order by coalesce(x.zone, ''), x.title), '[]'::jsonb)
    into v_order
    from public.utilities x where x.map_id = m.id and x.status = 'published';
  return jsonb_build_object(
    'utility', public._utility_json(u, m),
    'siblings', v_order,
    'related', coalesce((
      select jsonb_agg(public._utility_json(r, m) order by r.title)
      from (
        select * from public.utilities r
        where r.map_id = m.id and r.id <> u.id and r.status = 'published'
          and (r.target_name = u.target_name or r.zone is not distinct from u.zone
               or (u.throw_position_id is not null and r.throw_position_id = u.throw_position_id))
        order by r.title limit 4
      ) r
    ), '[]'::jsonb),
    'myOpenReport', public._my_open_report(u.id),
    'aerialPath', m.aerial_path,
    'position', (select public._position_json(p) from public.map_positions p where p.id = u.throw_position_id)
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Administration
-- ---------------------------------------------------------------------------
-- Création ou modification d'une map (le slug est fixé à la création).
create function public.admin_save_map(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_slug text := p ->> 'slug';
begin
  perform public._require_admin();
  if coalesce((p ->> 'create')::boolean, false) then
    insert into public.maps (slug, name, active, sort_order)
    values (v_slug, btrim(p ->> 'name'), coalesce((p ->> 'active')::boolean, false),
            coalesce((p ->> 'sortOrder')::integer, (select coalesce(max(sort_order), 0) + 10 from public.maps)));
  else
    update public.maps
       set name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
           active = coalesce((p ->> 'active')::boolean, active),
           sort_order = coalesce((p ->> 'sortOrder')::integer, sort_order)
     where slug = v_slug;
    if not found then
      perform public._raise('LFE_NOT_FOUND');
    end if;
  end if;
  return jsonb_build_object('slug', v_slug);
end
$$;

-- Remplace la vignette ou la vue aérienne ; renvoie l'ancien chemin à supprimer du stockage.
create function public.admin_set_map_image(p_slug text, p_kind text, p_path text) returns jsonb
language plpgsql
as $$
declare
  v_old text;
begin
  perform public._require_admin();
  if p_kind = 'cover' then
    select cover_path into v_old from public.maps where slug = p_slug;
    update public.maps set cover_path = p_path where slug = p_slug;
  elsif p_kind = 'aerial' then
    select aerial_path into v_old from public.maps where slug = p_slug;
    update public.maps set aerial_path = p_path where slug = p_slug;
  else
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'kind'));
  end if;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  return jsonb_build_object('oldPath', v_old);
end
$$;

-- Échange l'ordre d'affichage de deux maps voisines (ordre renuméroté 10, 20, 30… au passage).
create function public.admin_move_map(p_slug text, p_direction integer) returns void
language plpgsql
as $$
declare
  v_pos integer;
  v_other uuid;
  v_self uuid;
begin
  perform public._require_admin();
  with ordered as (
    select id, (row_number() over (order by sort_order, name) * 10)::integer as rn from public.maps
  )
  update public.maps m set sort_order = o.rn from ordered o where m.id = o.id;
  select id, sort_order into v_self, v_pos from public.maps where slug = p_slug;
  if v_self is null then perform public._raise('LFE_NOT_FOUND'); end if;
  select id into v_other from public.maps where sort_order = v_pos + 10 * sign(p_direction)::integer;
  if v_other is null then return; end if;
  update public.maps set sort_order = v_pos where id = v_other;
  update public.maps set sort_order = v_pos + 10 * sign(p_direction)::integer where id = v_self;
end
$$;

-- Suppression : seulement sans stuff. Renvoie les images à supprimer du stockage.
create function public.admin_delete_map(p_slug text) returns jsonb
language plpgsql
as $$
declare
  m public.maps;
begin
  perform public._require_admin();
  select * into m from public.maps where slug = p_slug;
  if m.id is null then perform public._raise('LFE_NOT_FOUND'); end if;
  if exists (select 1 from public.utilities where map_id = m.id) then
    perform public._raise('LFE_IN_USE');
  end if;
  delete from public.maps where id = m.id;
  return jsonb_build_object('paths', to_jsonb(array_remove(array[m.cover_path, m.aerial_path], null)));
end
$$;

create function public.admin_save_position(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_map uuid;
begin
  perform public._require_admin();
  if v_id is null then
    select id into v_map from public.maps where slug = p ->> 'mapSlug';
    if v_map is null then perform public._raise('LFE_INVALID', jsonb_build_object('field', 'mapSlug')); end if;
    insert into public.map_positions (map_id, name, x, y)
    values (v_map, btrim(p ->> 'name'), (p ->> 'x')::numeric, (p ->> 'y')::numeric)
    returning id into v_id;
  else
    update public.map_positions
       set name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
           x = coalesce((p ->> 'x')::numeric, x),
           y = coalesce((p ->> 'y')::numeric, y)
     where id = v_id;
    if not found then perform public._raise('LFE_NOT_FOUND'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

create function public.admin_delete_position(p_position_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  delete from public.map_positions where id = p_position_id;
  if not found then perform public._raise('LFE_NOT_FOUND'); end if;
end
$$;

-- Rattache un stuff à une position de lancer (de la même map) et place son point d'impact.
create function public.admin_link_utility(p_utility_id uuid, p_position_id uuid, p_landing_x numeric, p_landing_y numeric) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  if p_position_id is not null and not exists (
    select 1 from public.map_positions mp join public.utilities u on u.map_id = mp.map_id
     where mp.id = p_position_id and u.id = p_utility_id
  ) then
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'position'));
  end if;
  update public.utilities
     set throw_position_id = p_position_id, landing_x = p_landing_x, landing_y = p_landing_y
   where id = p_utility_id;
  if not found then perform public._raise('LFE_NOT_FOUND'); end if;
end
$$;

revoke all on function
  public.admin_save_map(jsonb), public.admin_set_map_image(text, text, text), public.admin_move_map(text, integer),
  public.admin_delete_map(text), public.admin_save_position(jsonb), public.admin_delete_position(uuid),
  public.admin_link_utility(uuid, uuid, numeric, numeric)
  from public, anon;
grant execute on function
  public.admin_save_map(jsonb), public.admin_set_map_image(text, text, text), public.admin_move_map(text, integer),
  public.admin_delete_map(text), public.admin_save_position(jsonb), public.admin_delete_position(uuid),
  public.admin_link_utility(uuid, uuid, numeric, numeric)
  to authenticated;
