-- =============================================================================
-- 0700 · Stuffs (lineups de grenades) par map
-- Les compteurs affichés (par map, par type, par camp) sont TOUJOURS calculés ici,
-- depuis les fiches publiées : aucune valeur saisie à la main.
-- =============================================================================

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 30),
  name text not null check (char_length(name) between 2 and 40),
  faceit_key text unique check (faceit_key ~ '^[a-z0-9_]{2,40}$'),
  image_path text check (image_path ~ '^/maps/[a-z0-9-]+\.(svg|webp|png|jpg)$'),
  active boolean not null default true,
  sort_order integer not null default 100
);

-- Maps de référence (illustrations maison, pas des visuels officiels). Modifiables par un admin.
insert into public.maps (slug, name, faceit_key, image_path, sort_order) values
  ('mirage', 'Mirage', 'de_mirage', '/maps/mirage.svg', 10),
  ('inferno', 'Inferno', 'de_inferno', '/maps/inferno.svg', 20),
  ('dust2', 'Dust II', 'de_dust2', '/maps/dust2.svg', 30),
  ('nuke', 'Nuke', 'de_nuke', '/maps/nuke.svg', 40),
  ('ancient', 'Ancient', 'de_ancient', '/maps/ancient.svg', 50),
  ('anubis', 'Anubis', 'de_anubis', '/maps/anubis.svg', 60),
  ('train', 'Train', 'de_train', '/maps/train.svg', 70);

create table public.utilities (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  side text not null check (side in ('T', 'CT', 'BOTH')),
  grenade text not null check (grenade in ('smoke', 'flash', 'molotov', 'he')),
  zone text check (char_length(zone) <= 40),
  origin_name text not null check (char_length(btrim(origin_name)) between 1 and 80),
  target_name text not null check (char_length(btrim(target_name)) between 1 and 80),
  purpose text check (char_length(purpose) <= 160),
  description text check (char_length(description) <= 600),
  steps text[] not null default '{}' check (cardinality(steps) <= 12),
  technique text not null default 'static'
    check (technique in ('static', 'jumpthrow', 'runthrow', 'walkthrow', 'crouch', 'jump_crouch', 'other')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  -- Chemins dans le stockage (bucket « stuff-media »), jamais une URL externe arbitraire.
  placement_image text check (placement_image ~ '^utilities/[0-9a-f-]{36}/[a-z0-9-]+\.(webp|png|jpg|jpeg)$'),
  aim_image text check (aim_image ~ '^utilities/[0-9a-f-]{36}/[a-z0-9-]+\.(webp|png|jpg|jpeg)$'),
  -- Vidéo : uniquement YouTube (lecture via youtube-nocookie, chargée au clic).
  video_url text check (video_url ~ '^https://(www\.youtube\.com/watch\?v=|youtu\.be/|www\.youtube\.com/shorts/)[A-Za-z0-9_-]{6,20}'),
  verified_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (map_id, slug)
);
create index utilities_map on public.utilities (map_id, status);
create trigger utilities_touch before update on public.utilities
  for each row execute function public._touch_updated_at();

create table public.utility_reports (
  id uuid primary key default gen_random_uuid(),
  utility_id uuid not null references public.utilities (id) on delete cascade,
  reported_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- Un seul signalement ouvert par membre et par fiche.
create unique index utility_reports_open_unique on public.utility_reports (utility_id, reported_by)
  where resolved_at is null;

alter table public.maps enable row level security;
alter table public.utilities enable row level security;
alter table public.utility_reports enable row level security;
revoke all on public.maps, public.utilities, public.utility_reports from anon, authenticated;
grant select on public.maps, public.utilities to anon, authenticated;
grant insert, update, delete on public.maps, public.utilities to authenticated;
grant select, insert, update on public.utility_reports to authenticated;

create policy maps_read on public.maps for select to anon, authenticated using (true);
create policy maps_admin_write on public.maps
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy utilities_read on public.utilities
  for select to anon, authenticated using (status = 'published' or (select public.is_admin()));
create policy utilities_admin_write on public.utilities
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy utility_reports_insert_members on public.utility_reports
  for insert to authenticated
  with check ((select public.is_member()) and reported_by = (select auth.uid()) and resolved_at is null);
create policy utility_reports_read on public.utility_reports
  for select to authenticated using ((select public.is_admin()) or reported_by = (select auth.uid()));
create policy utility_reports_admin_update on public.utility_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Stockage des captures (Supabase Storage)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stuff-media', 'stuff-media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy stuff_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stuff-media' and (select public.is_admin()) and (storage.foldername(name))[1] = 'utilities');
create policy stuff_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'stuff-media' and (select public.is_admin()))
  with check (bucket_id = 'stuff-media' and (select public.is_admin()));
create policy stuff_media_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'stuff-media' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Sérialisation
-- ---------------------------------------------------------------------------
create function public._open_reports(p_utility_id uuid) returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.utility_reports r where r.utility_id = p_utility_id and r.resolved_at is null
$$;
revoke all on function public._open_reports(uuid) from public;
grant execute on function public._open_reports(uuid) to anon, authenticated, service_role;

-- La personne connectée a-t-elle déjà un signalement ouvert sur cette fiche ? (faux pour un visiteur)
create function public._my_open_report(p_utility_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.utility_reports r
     where r.utility_id = p_utility_id and r.reported_by = auth.uid() and r.resolved_at is null
  )
$$;
revoke all on function public._my_open_report(uuid) from public;
grant execute on function public._my_open_report(uuid) to anon, authenticated, service_role;

create function public._utility_json(u public.utilities, m public.maps) returns jsonb
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
    'updatedAt', u.updated_at, 'openReports', public._open_reports(u.id)
  )
$$;

create function public._map_counts(p_map_id uuid, p_include_drafts boolean) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'total', count(*),
    'smoke', count(*) filter (where grenade = 'smoke'),
    'flash', count(*) filter (where grenade = 'flash'),
    'molotov', count(*) filter (where grenade = 'molotov'),
    'he', count(*) filter (where grenade = 'he'),
    'T', count(*) filter (where side in ('T', 'BOTH')),
    'CT', count(*) filter (where side in ('CT', 'BOTH'))
  )
  from public.utilities
  where map_id = p_map_id and (status = 'published' or p_include_drafts)
$$;

create function public.list_maps(p_include_drafts boolean default false) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', m.slug, 'name', m.name, 'faceitKey', m.faceit_key, 'imagePath', m.image_path,
    'active', m.active, 'sortOrder', m.sort_order,
    'counts', public._map_counts(m.id, p_include_drafts and public.is_admin())
  ) order by m.sort_order, m.name), '[]'::jsonb)
  from public.maps m
  where m.active or public.is_admin()
$$;

create function public.list_utilities(p_map_slug text, p_include_drafts boolean default false) returns jsonb
language sql stable
as $$
  select case when m.id is null then null else jsonb_build_object(
    'map', jsonb_build_object('slug', m.slug, 'name', m.name, 'imagePath', m.image_path, 'active', m.active,
                              'counts', public._map_counts(m.id, p_include_drafts and public.is_admin())),
    'utilities', coalesce((
      select jsonb_agg(public._utility_json(u, m) order by coalesce(u.zone, ''), u.title)
      from public.utilities u
      where u.map_id = m.id and (u.status = 'published' or (p_include_drafts and public.is_admin()))
    ), '[]'::jsonb)
  ) end
  from (select 1) one
  left join public.maps m on m.slug = p_map_slug
$$;

create function public.get_utility(p_map_slug text, p_slug text) returns jsonb
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
          and (r.target_name = u.target_name or r.zone is not distinct from u.zone)
        order by r.title limit 4
      ) r
    ), '[]'::jsonb),
    'myOpenReport', public._my_open_report(u.id)
  );
end
$$;

-- Signalement « à revérifier » par un membre (après un patch, une fiche qui ne marche plus…).
create function public.report_utility(p_utility_id uuid, p_note text default null) returns void
language plpgsql
as $$
begin
  perform public._require_member();
  if not exists (select 1 from public.utilities where id = p_utility_id and status = 'published') then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  if exists (select 1 from public.utility_reports where utility_id = p_utility_id
             and reported_by = auth.uid() and resolved_at is null) then
    perform public._raise('LFE_DUPLICATE');
  end if;
  insert into public.utility_reports (utility_id, reported_by, note)
  values (p_utility_id, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));
end
$$;

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------
create function public.admin_save_utility(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_map uuid;
  v_slug text;
begin
  perform public._require_admin();
  select id into v_map from public.maps where slug = p ->> 'mapSlug';
  if v_map is null then
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'mapSlug'));
  end if;
  if v_id is null then
    insert into public.utilities (
      map_id, slug, title, side, grenade, zone, origin_name, target_name, purpose, description,
      steps, technique, difficulty, tags, video_url, status, created_by
    ) values (
      v_map, p ->> 'slug', btrim(p ->> 'title'), p ->> 'side', p ->> 'grenade', nullif(btrim(coalesce(p ->> 'zone', '')), ''),
      btrim(p ->> 'originName'), btrim(p ->> 'targetName'), nullif(btrim(coalesce(p ->> 'purpose', '')), ''),
      nullif(btrim(coalesce(p ->> 'description', '')), ''),
      coalesce(array(select jsonb_array_elements_text(p -> 'steps')), '{}'),
      p ->> 'technique', p ->> 'difficulty',
      coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      nullif(p ->> 'videoUrl', ''), coalesce(p ->> 'status', 'draft'), auth.uid()
    )
    returning id, slug into v_id, v_slug;
  else
    update public.utilities set
      map_id = v_map, slug = p ->> 'slug', title = btrim(p ->> 'title'), side = p ->> 'side', grenade = p ->> 'grenade',
      zone = nullif(btrim(coalesce(p ->> 'zone', '')), ''), origin_name = btrim(p ->> 'originName'),
      target_name = btrim(p ->> 'targetName'), purpose = nullif(btrim(coalesce(p ->> 'purpose', '')), ''),
      description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
      steps = coalesce(array(select jsonb_array_elements_text(p -> 'steps')), '{}'),
      technique = p ->> 'technique', difficulty = p ->> 'difficulty',
      tags = coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      video_url = nullif(p ->> 'videoUrl', ''), status = coalesce(p ->> 'status', status)
    where id = v_id
    returning slug into v_slug;
    if not found then
      perform public._raise('LFE_NOT_FOUND');
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end
$$;

create function public.admin_set_utility_image(p_utility_id uuid, p_kind text, p_path text) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  if p_kind = 'placement' then
    update public.utilities set placement_image = p_path where id = p_utility_id;
  elsif p_kind = 'aim' then
    update public.utilities set aim_image = p_path where id = p_utility_id;
  else
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'kind'));
  end if;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;

-- « Vérifiée aujourd'hui » : met à jour la date et clôt les signalements ouverts.
create function public.admin_mark_utility_verified(p_utility_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  update public.utilities set verified_at = now() where id = p_utility_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  update public.utility_reports set resolved_at = now() where utility_id = p_utility_id and resolved_at is null;
end
$$;

create function public.admin_delete_utility(p_utility_id uuid) returns jsonb
language plpgsql
as $$
declare
  v public.utilities;
begin
  perform public._require_admin();
  delete from public.utilities where id = p_utility_id returning * into v;
  if v.id is null then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  -- Chemins des images à supprimer du stockage par l'application.
  return jsonb_build_object('paths', to_jsonb(array_remove(array[v.placement_image, v.aim_image], null)));
end
$$;

create function public.admin_list_utilities() returns jsonb
language plpgsql stable
as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(public._utility_json(u, m) order by m.sort_order, coalesce(u.zone, ''), u.title)
    from public.utilities u join public.maps m on m.id = u.map_id
  ), '[]'::jsonb);
end
$$;

revoke all on function
  public.report_utility(uuid, text), public.admin_save_utility(jsonb), public.admin_set_utility_image(uuid, text, text),
  public.admin_mark_utility_verified(uuid), public.admin_delete_utility(uuid), public.admin_list_utilities()
  from public, anon;
grant execute on function
  public.report_utility(uuid, text), public.admin_save_utility(jsonb), public.admin_set_utility_image(uuid, text, text),
  public.admin_mark_utility_verified(uuid), public.admin_delete_utility(uuid), public.admin_list_utilities()
  to authenticated;
