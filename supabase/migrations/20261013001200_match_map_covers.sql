-- =============================================================================
-- 1200 · Images des maps pour illustrer les matchs FACEIT
-- Une map jouée sur FACEIT (ex. Cache) peut avoir sa capture sans apparaître dans Stuffs :
-- elle reste masquée, et list_map_covers renvoie les images de TOUTES les maps.
-- =============================================================================

insert into public.maps (slug, name, faceit_key, image_path, active, sort_order)
values ('cache', 'Cache', 'de_cache', null, false, 80)
on conflict (slug) do nothing;

-- Images seulement (aucune donnée sensible), y compris des maps masquées.
create function public.list_map_covers() returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object('faceitKey', m.faceit_key, 'coverPath', m.cover_path, 'imagePath', m.image_path)), '[]'::jsonb)
  from public.maps m
  where m.faceit_key is not null
$$;

-- Une map ajoutée par l'admin reçoit sa clé FACEIT (de_<slug>) pour illustrer les matchs.
create or replace function public.admin_save_map(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_slug text := p ->> 'slug';
begin
  perform public._require_admin();
  if coalesce((p ->> 'create')::boolean, false) then
    insert into public.maps (slug, name, faceit_key, active, sort_order)
    values (v_slug, btrim(p ->> 'name'),
            case when exists (select 1 from public.maps where faceit_key = 'de_' || replace(v_slug, '-', '_')) then null
                 else 'de_' || replace(v_slug, '-', '_') end,
            coalesce((p ->> 'active')::boolean, false),
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
