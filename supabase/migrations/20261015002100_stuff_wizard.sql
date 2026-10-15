-- =============================================================================
-- 2100 · Fiche et assistant d'ajout des stuffs
-- 1. « À voir aussi » : même arrivée ou même départ, avec le même type de grenade. Avant, deux
--    fiches sans zone (cas des stuffs importés) étaient toujours « proches » (null = null).
-- 2. admin_save_utility enregistre aussi les points placés sur la vue aérienne et le détail du
--    lancer (mouvement, clic, saut, précision) saisis dans l'assistant en 4 étapes.
-- =============================================================================

create or replace function public.get_utility(p_map_slug text, p_slug text) returns jsonb
language plpgsql stable
as $$
declare
  m public.maps;
  u public.utilities;
  v_order jsonb;
begin
  select * into m from public.maps where slug = p_map_slug and (active or public.is_admin());
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
      select jsonb_agg(public._utility_json(r, m) order by (r.target_name = u.target_name) desc, r.title)
      from (
        select r.*
        from public.utilities r
        where r.map_id = m.id and r.id <> u.id and r.status = 'published'
          and (
            (r.grenade = u.grenade and (r.target_name = u.target_name or r.origin_name = u.origin_name))
            or (u.zone is not null and r.zone = u.zone)
            or (u.throw_position_id is not null and r.throw_position_id = u.throw_position_id)
          )
        order by (r.target_name = u.target_name) desc, r.title
        limit 6
      ) r
    ), '[]'::jsonb),
    'myOpenReport', public._my_open_report(u.id),
    'aerialPath', m.aerial_path,
    'position', (select public._position_json(p) from public.map_positions p where p.id = u.throw_position_id)
  );
end
$$;

create or replace function public.admin_save_utility(p jsonb) returns jsonb
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
      steps, technique, difficulty, tags, video_url, status, created_by,
      movement, throw_click, jump, precision, throw_x, throw_y, throw_level, landing_x, landing_y, landing_level
    ) values (
      v_map, p ->> 'slug', btrim(p ->> 'title'), p ->> 'side', p ->> 'grenade', nullif(btrim(coalesce(p ->> 'zone', '')), ''),
      btrim(p ->> 'originName'), btrim(p ->> 'targetName'), nullif(btrim(coalesce(p ->> 'purpose', '')), ''),
      nullif(btrim(coalesce(p ->> 'description', '')), ''),
      coalesce(array(select jsonb_array_elements_text(p -> 'steps')), '{}'),
      p ->> 'technique', nullif(p ->> 'difficulty', ''),
      coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      nullif(p ->> 'videoUrl', ''), coalesce(p ->> 'status', 'draft'), auth.uid(),
      nullif(p ->> 'movement', ''), nullif(p ->> 'click', ''), (p ->> 'jump')::boolean, nullif(p ->> 'precision', ''),
      (p #>> '{throw,x}')::numeric, (p #>> '{throw,y}')::numeric, coalesce((p #>> '{throw,level}')::smallint, 1),
      (p #>> '{landing,x}')::numeric, (p #>> '{landing,y}')::numeric, coalesce((p #>> '{landing,level}')::smallint, 1)
    )
    returning id, slug into v_id, v_slug;
  else
    update public.utilities set
      map_id = v_map, slug = p ->> 'slug', title = btrim(p ->> 'title'), side = p ->> 'side', grenade = p ->> 'grenade',
      zone = nullif(btrim(coalesce(p ->> 'zone', '')), ''), origin_name = btrim(p ->> 'originName'),
      target_name = btrim(p ->> 'targetName'), purpose = nullif(btrim(coalesce(p ->> 'purpose', '')), ''),
      description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
      steps = coalesce(array(select jsonb_array_elements_text(p -> 'steps')), '{}'),
      -- Les repères de temps des étapes n'ont de sens que pour les étapes importées inchangées.
      step_times = case when steps = coalesce(array(select jsonb_array_elements_text(p -> 'steps')), '{}')
                        then step_times else '{}' end,
      technique = p ->> 'technique', difficulty = nullif(p ->> 'difficulty', ''),
      tags = coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      video_url = nullif(p ->> 'videoUrl', ''), status = coalesce(p ->> 'status', status),
      movement = nullif(p ->> 'movement', ''), throw_click = nullif(p ->> 'click', ''), jump = (p ->> 'jump')::boolean,
      precision = nullif(p ->> 'precision', ''),
      throw_x = (p #>> '{throw,x}')::numeric, throw_y = (p #>> '{throw,y}')::numeric,
      throw_level = coalesce((p #>> '{throw,level}')::smallint, 1),
      landing_x = (p #>> '{landing,x}')::numeric, landing_y = (p #>> '{landing,y}')::numeric,
      landing_level = coalesce((p #>> '{landing,level}')::smallint, 1)
    where id = v_id
    returning slug into v_slug;
    if not found then
      perform public._raise('LFE_NOT_FOUND');
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end
$$;
