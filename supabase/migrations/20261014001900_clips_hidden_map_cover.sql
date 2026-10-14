-- =============================================================================
-- 1900 · Clips : image et nom de la map même si elle est masquée dans Stuffs
-- Une map masquée (ex. Cache, Vertigo) n'apparaît pas dans Stuffs mais illustre déjà les
-- matchs (list_map_covers). Les clips joués dessus affichaient « LaFineEquipe » à la place.
-- =============================================================================
create or replace function public.list_clips(p_include_drafts boolean default false) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'provider', c.provider, 'externalId', c.external_id,
    'sourceUrl', c.source_url, 'recordedOn', c.recorded_on, 'description', c.description,
    'consentConfirmed', c.consent_confirmed, 'embedAllowed', c.embed_allowed,
    'published', c.is_published, 'isDemo', c.is_demo, 'createdAt', c.created_at,
    'player', (select jsonb_build_object('id', p.id, 'nickname', fp.nickname, 'avatarUrl', fp.avatar_url)
      from public.players p join public.faceit_profiles fp on fp.faceit_player_id = p.faceit_player_id where p.id = c.player_id),
    'map', (select jsonb_build_object('slug', m.slug, 'name', m.name, 'coverPath', m.cover_path, 'imagePath', m.image_path)
      from public.maps m where m.id = c.map_id)
  ) order by c.recorded_on desc, c.created_at desc, c.id), '[]'::jsonb)
  from public.clips c where c.is_published or (p_include_drafts and public.is_admin())
$$;
