-- =============================================================================
-- 1100 · Crosshairs V1 : presets de la team (code de partage, aperçu indicatif, vérification)
-- Le code de partage est saisi par un admin et seulement contrôlé dans sa forme
-- (CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx) : rien ne garantit son import dans le jeu.
-- L'aperçu est dessiné à partir de réglages saisis à la main, jamais décodé du code.
-- =============================================================================

-- Réglages de l'aperçu indicatif : {len, gap, thickness, outline, dot, color}.
create function public._valid_crosshair_preview(p jsonb) returns boolean
language sql immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p) k where k not in ('len', 'gap', 'thickness', 'outline', 'dot', 'color')) = 0
    and jsonb_typeof(p -> 'len') = 'number' and (p ->> 'len')::numeric between 0 and 12
    and jsonb_typeof(p -> 'gap') = 'number' and (p ->> 'gap')::numeric between -5 and 10
    and jsonb_typeof(p -> 'thickness') = 'number' and (p ->> 'thickness')::numeric between 0.5 and 5
    and jsonb_typeof(p -> 'outline') = 'number' and (p ->> 'outline')::numeric between 0 and 3
    and jsonb_typeof(p -> 'dot') = 'boolean'
    and coalesce(p ->> 'color', '') ~ '^#[0-9A-Fa-f]{6}$'
  )
$$;

create table public.crosshairs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete set null,
  label text not null check (char_length(btrim(label)) between 2 and 40),
  share_code text not null check (
    share_code ~ '^CSGO(-[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789]{5}){5}$'
  ),
  notes text check (char_length(notes) <= 280),
  preview jsonb check (public._valid_crosshair_preview(preview)),
  preview_map_id uuid references public.maps (id) on delete set null,
  game_version text check (char_length(game_version) <= 40),
  verified_at date,
  is_published boolean not null default false,
  is_demo boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crosshairs_player on public.crosshairs (player_id);
create trigger crosshairs_touch before update on public.crosshairs
  for each row execute function public._touch_updated_at();

alter table public.crosshairs enable row level security;
revoke all on public.crosshairs from anon, authenticated;
grant select on public.crosshairs to anon, authenticated;
grant insert, update, delete on public.crosshairs to authenticated;
create policy crosshairs_read on public.crosshairs
  for select to anon, authenticated using (is_published or (select public.is_admin()));
create policy crosshairs_admin_write on public.crosshairs
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------
create function public._crosshair_json(c public.crosshairs) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', c.id, 'label', c.label, 'shareCode', c.share_code, 'notes', c.notes, 'preview', c.preview,
    'gameVersion', c.game_version, 'verifiedAt', c.verified_at, 'published', c.is_published,
    'isDemo', c.is_demo, 'sortOrder', c.sort_order, 'updatedAt', c.updated_at,
    'player', (
      select jsonb_build_object('id', p.id, 'nickname', fp.nickname, 'avatarUrl', fp.avatar_url, 'isDemo', p.is_demo)
      from public.players p join public.faceit_profiles fp on fp.faceit_player_id = p.faceit_player_id
      where p.id = c.player_id
    ),
    'map', (
      select jsonb_build_object('slug', m.slug, 'name', m.name, 'coverPath', m.cover_path, 'imagePath', m.image_path)
      from public.maps m where m.id = c.preview_map_id and (m.active or public.is_admin())
    )
  )
$$;

-- Publiés pour tous ; brouillons en plus pour un admin qui les demande.
create function public.list_crosshairs(p_include_drafts boolean default false) returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(public._crosshair_json(c) order by c.sort_order, c.label), '[]'::jsonb)
  from public.crosshairs c
  where c.is_published or (p_include_drafts and public.is_admin())
$$;

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------
create function public.admin_save_crosshair(p jsonb) returns jsonb
language plpgsql
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_player uuid := nullif(p ->> 'playerId', '')::uuid;
  v_map uuid;
begin
  perform public._require_admin();
  if v_player is not null and not exists (select 1 from public.players where id = v_player) then
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'playerId'));
  end if;
  if nullif(p ->> 'mapSlug', '') is not null then
    select id into v_map from public.maps where slug = p ->> 'mapSlug';
    if v_map is null then perform public._raise('LFE_INVALID', jsonb_build_object('field', 'mapSlug')); end if;
  end if;
  if v_id is null then
    insert into public.crosshairs (player_id, label, share_code, notes, preview, preview_map_id, game_version, verified_at, is_published, sort_order)
    values (
      v_player, btrim(p ->> 'label'), btrim(p ->> 'shareCode'), nullif(btrim(coalesce(p ->> 'notes', '')), ''),
      case when jsonb_typeof(p -> 'preview') = 'object' then p -> 'preview' end, v_map,
      nullif(btrim(coalesce(p ->> 'gameVersion', '')), ''), nullif(p ->> 'verifiedAt', '')::date,
      coalesce((p ->> 'published')::boolean, false), coalesce((p ->> 'sortOrder')::integer, 100)
    )
    returning id into v_id;
  else
    update public.crosshairs set
      player_id = v_player, label = btrim(p ->> 'label'), share_code = btrim(p ->> 'shareCode'),
      notes = nullif(btrim(coalesce(p ->> 'notes', '')), ''),
      preview = case when jsonb_typeof(p -> 'preview') = 'object' then p -> 'preview' end,
      preview_map_id = v_map, game_version = nullif(btrim(coalesce(p ->> 'gameVersion', '')), ''),
      verified_at = nullif(p ->> 'verifiedAt', '')::date,
      is_published = coalesce((p ->> 'published')::boolean, is_published),
      sort_order = coalesce((p ->> 'sortOrder')::integer, sort_order)
    where id = v_id;
    if not found then perform public._raise('LFE_NOT_FOUND'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

-- « Testé en jeu aujourd'hui » : date du jour (heure de Paris) et version du jeu notée par l'admin.
create function public.admin_verify_crosshair(p_id uuid, p_game_version text) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  update public.crosshairs
     set verified_at = (now() at time zone 'Europe/Paris')::date,
         game_version = coalesce(nullif(btrim(p_game_version), ''), game_version)
   where id = p_id;
  if not found then perform public._raise('LFE_NOT_FOUND'); end if;
end
$$;

create function public.admin_delete_crosshair(p_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  delete from public.crosshairs where id = p_id;
  if not found then perform public._raise('LFE_NOT_FOUND'); end if;
end
$$;

revoke all on function public.admin_save_crosshair(jsonb), public.admin_verify_crosshair(uuid, text), public.admin_delete_crosshair(uuid)
  from public, anon;
grant execute on function public.admin_save_crosshair(jsonb), public.admin_verify_crosshair(uuid, text), public.admin_delete_crosshair(uuid)
  to authenticated;
