-- =============================================================================
-- 0200 · Profils FACEIT partagés + roster
-- `faceit_profiles` est la copie locale (cache) des profils FACEIT, clé = identifiant
-- FACEIT complet (UUID). Le roster et le Mur y font référence : un changement de
-- pseudo ou d'avatar met à jour la même ligne, et l'affichage n'appelle jamais FACEIT.
-- =============================================================================

create table public.faceit_profiles (
  faceit_player_id uuid primary key,
  nickname text not null check (char_length(nickname) between 1 and 64),
  -- Seules les images du CDN FACEIT (ou les avatars fictifs locaux de test) sont acceptées.
  avatar_url text check (
    avatar_url is null
    or avatar_url ~ '^https://([a-z0-9-]+\.)*faceit-cdn\.net/[^[:space:]"<>]+$'
    or avatar_url ~ '^/dev-fixtures/[a-z0-9-]+\.svg$'
  ),
  country text check (country ~ '^[a-z]{2}$'),
  -- Données CS2 : NULL si FACEIT ne les fournit pas. Jamais de valeur inventée.
  cs2_skill_level smallint check (cs2_skill_level between 1 and 10),
  cs2_elo integer check (cs2_elo between 0 and 10000),
  -- Date de la dernière réponse FACEIT valide.
  fetched_at timestamptz not null,
  -- Dernière tentative (réussie ou non) et code d'erreur éventuel. Une erreur ne modifie
  -- jamais les colonnes ci-dessus : on garde les dernières informations valides.
  last_attempt_at timestamptz,
  last_error text check (last_error in (
    'timeout', 'network', 'rate_limited', 'unauthorized', 'not_found',
    'unavailable', 'invalid_response', 'config_missing', 'bad_request'
  )),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger faceit_profiles_touch before update on public.faceit_profiles
  for each row execute function public._touch_updated_at();

create table public.players (
  id uuid primary key default gen_random_uuid(),
  faceit_player_id uuid not null unique references public.faceit_profiles (faceit_player_id),
  roster_group text not null default 'team' check (roster_group in ('team', 'guest')),
  active boolean not null default true,
  display_order integer not null default 100,
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger players_touch before update on public.players
  for each row execute function public._touch_updated_at();

-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------
alter table public.faceit_profiles enable row level security;
alter table public.players enable row level security;

revoke all on public.faceit_profiles, public.players from anon, authenticated;
grant select on public.faceit_profiles, public.players to anon, authenticated;
grant insert, update, delete on public.faceit_profiles, public.players to authenticated;

-- Roster : public en lecture, écriture réservée aux admins.
create policy players_read on public.players
  for select to anon, authenticated using (true);
create policy players_admin_insert on public.players
  for insert to authenticated with check ((select public.is_admin()));
create policy players_admin_update on public.players
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy players_admin_delete on public.players
  for delete to authenticated using ((select public.is_admin()));

-- Profils : publics seulement s'ils appartiennent au roster ; les membres voient tout
-- (nécessaire au Mur). Un profil présent uniquement sur le Mur reste donc invisible
-- pour un visiteur, même en interrogeant directement l'API.
create policy faceit_profiles_read_roster on public.faceit_profiles
  for select to anon, authenticated
  using (exists (select 1 from public.players p where p.faceit_player_id = faceit_profiles.faceit_player_id));
create policy faceit_profiles_read_members on public.faceit_profiles
  for select to authenticated using ((select public.is_member()));
create policy faceit_profiles_admin_insert on public.faceit_profiles
  for insert to authenticated with check ((select public.is_admin()));
create policy faceit_profiles_admin_update on public.faceit_profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faceit_profiles_admin_delete on public.faceit_profiles
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Sérialisation JSON (clés camelCase lues par l'application)
-- ---------------------------------------------------------------------------
create function public._profile_json(fp public.faceit_profiles) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'faceitPlayerId', fp.faceit_player_id,
    'nickname', fp.nickname,
    'avatarUrl', fp.avatar_url,
    'country', fp.country,
    'cs2Level', fp.cs2_skill_level,
    'cs2Elo', fp.cs2_elo,
    'fetchedAt', fp.fetched_at,
    'lastAttemptAt', fp.last_attempt_at,
    'lastError', fp.last_error,
    'isDemo', fp.is_demo
  )
$$;

create function public._player_json(p public.players, fp public.faceit_profiles) returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'group', p.roster_group,
    'active', p.active,
    'displayOrder', p.display_order,
    'isDemo', p.is_demo,
    'createdAt', p.created_at,
    'profile', public._profile_json(fp)
  )
$$;

-- Écrit (ou met à jour) un profil à partir d'une réponse FACEIT validée côté serveur.
-- Appelé par les fonctions admin (droits admin requis par la RLS) et par la synchro.
create function public._upsert_faceit_profile(p jsonb) returns uuid
language plpgsql
as $$
declare
  v_id uuid := (p ->> 'faceitPlayerId')::uuid;
begin
  if v_id is null or coalesce(p ->> 'nickname', '') = '' then
    perform public._raise('LFE_INVALID', jsonb_build_object('field', 'profile'));
  end if;
  insert into public.faceit_profiles as fp (
    faceit_player_id, nickname, avatar_url, country, cs2_skill_level, cs2_elo,
    fetched_at, last_attempt_at, last_error, is_demo
  ) values (
    v_id,
    p ->> 'nickname',
    nullif(p ->> 'avatarUrl', ''),
    nullif(lower(p ->> 'country'), ''),
    (p ->> 'cs2Level')::smallint,
    (p ->> 'cs2Elo')::integer,
    coalesce((p ->> 'fetchedAt')::timestamptz, now()),
    now(),
    null,
    coalesce((p ->> 'isDemo')::boolean, false)
  )
  on conflict (faceit_player_id) do update set
    nickname = excluded.nickname,
    avatar_url = excluded.avatar_url,
    country = excluded.country,
    cs2_skill_level = excluded.cs2_skill_level,
    cs2_elo = excluded.cs2_elo,
    fetched_at = excluded.fetched_at,
    last_attempt_at = excluded.last_attempt_at,
    last_error = null;
  return v_id;
end
$$;

create function public._mark_faceit_profile_error(p_faceit_player_id uuid, p_code text) returns void
language sql
as $$
  update public.faceit_profiles
     set last_attempt_at = now(), last_error = p_code
   where faceit_player_id = p_faceit_player_id
$$;

-- ---------------------------------------------------------------------------
-- Lecture publique
-- ---------------------------------------------------------------------------
create function public.list_roster(p_include_inactive boolean default false) returns jsonb
language sql stable
as $$
  select coalesce(
    jsonb_agg(public._player_json(p, fp) order by (p.roster_group = 'guest'), p.display_order, lower(fp.nickname)),
    '[]'::jsonb
  )
  from public.players p
  join public.faceit_profiles fp using (faceit_player_id)
  where p.active or p_include_inactive
$$;

create function public.get_player(p_player_id uuid) returns jsonb
language sql stable
as $$
  select public._player_json(p, fp)
  from public.players p
  join public.faceit_profiles fp using (faceit_player_id)
  where p.id = p_player_id
$$;

-- ---------------------------------------------------------------------------
-- Administration du roster
-- ---------------------------------------------------------------------------
-- Où ce profil FACEIT est-il déjà utilisé ? (doublons roster / Mur)
create function public.admin_faceit_usage(p_faceit_player_id uuid) returns jsonb
language plpgsql stable
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'player', (select jsonb_build_object('id', p.id, 'active', p.active, 'group', p.roster_group)
                 from public.players p where p.faceit_player_id = p_faceit_player_id),
    'avoid', null
  );
end
$$;

create function public.admin_add_player(p_profile jsonb, p_group text default 'team') returns jsonb
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
  insert into public.players (faceit_player_id, roster_group, created_by, display_order)
  values (
    v_faceit,
    p_group,
    auth.uid(),
    (select coalesce(max(display_order), 0) + 10 from public.players)
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end
$$;

create function public.admin_update_player(
  p_player_id uuid, p_group text, p_active boolean, p_display_order integer
) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  update public.players
     set roster_group = p_group, active = p_active, display_order = p_display_order
   where id = p_player_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;

-- Rafraîchit manuellement un profil déjà suivi (roster ou Mur).
create function public.admin_save_profile(p_profile jsonb) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  if not exists (select 1 from public.faceit_profiles where faceit_player_id = (p_profile ->> 'faceitPlayerId')::uuid) then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  perform public._upsert_faceit_profile(p_profile);
end
$$;

create function public.admin_mark_profile_error(p_faceit_player_id uuid, p_code text) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  perform public._mark_faceit_profile_error(p_faceit_player_id, p_code);
end
$$;

-- Fonctions internes : pas d'appel direct depuis l'API publique.
revoke all on function public._upsert_faceit_profile(jsonb), public._mark_faceit_profile_error(uuid, text)
  from public, anon;
grant execute on function public._upsert_faceit_profile(jsonb), public._mark_faceit_profile_error(uuid, text)
  to authenticated, service_role;
revoke all on function
  public.admin_faceit_usage(uuid), public.admin_add_player(jsonb, text),
  public.admin_update_player(uuid, text, boolean, integer), public.admin_save_profile(jsonb),
  public.admin_mark_profile_error(uuid, text)
  from public, anon;
grant execute on function
  public.admin_faceit_usage(uuid), public.admin_add_player(jsonb, text),
  public.admin_update_player(uuid, text, boolean, integer), public.admin_save_profile(jsonb),
  public.admin_mark_profile_error(uuid, text)
  to authenticated;
