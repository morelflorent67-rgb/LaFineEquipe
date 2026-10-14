-- Clips éditoriaux : liens canoniques, pas d'import automatique ni de vidéo réhébergée.
create table public.clips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 100),
  provider text not null check (provider in ('youtube', 'twitch', 'allstar')),
  external_id text not null,
  source_url text not null,
  player_id uuid references public.players(id) on delete set null,
  map_id uuid references public.maps(id) on delete set null,
  recorded_on date not null,
  description text not null default '' check (char_length(description) <= 500),
  consent_confirmed boolean not null default false,
  embed_allowed boolean not null default false,
  is_published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_id),
  check (not is_published or consent_confirmed),
  check (
    (provider = 'youtube' and external_id ~ '^[A-Za-z0-9_-]{11}$' and source_url = 'https://www.youtube.com/watch?v=' || external_id)
    or (provider = 'twitch' and external_id ~ '^[A-Za-z0-9_-]{1,100}$' and external_id <> 'embed' and source_url = 'https://clips.twitch.tv/' || external_id)
    or (provider = 'twitch' and external_id ~ '^video:[0-9]{1,20}$' and source_url = 'https://www.twitch.tv/videos/' || substring(external_id from 7))
    or (provider = 'allstar' and external_id ~ '^[a-f0-9]{24}$' and source_url = 'https://allstar.gg/clip?clip=' || external_id)
  )
);
create index clips_date on public.clips (recorded_on desc, created_at desc);
create index clips_player on public.clips (player_id);
create index clips_map on public.clips (map_id);
create trigger clips_touch before update on public.clips for each row execute function public._touch_updated_at();
alter table public.clips enable row level security;
revoke all on public.clips from anon, authenticated;
grant select on public.clips to anon, authenticated;
grant insert, update, delete on public.clips to authenticated;
create policy clips_read on public.clips for select to anon, authenticated using (is_published or (select public.is_admin()));
create policy clips_admin_write on public.clips for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.list_clips(p_include_drafts boolean default false) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'provider', c.provider, 'externalId', c.external_id,
    'sourceUrl', c.source_url, 'recordedOn', c.recorded_on, 'description', c.description,
    'consentConfirmed', c.consent_confirmed, 'embedAllowed', c.embed_allowed,
    'published', c.is_published, 'isDemo', c.is_demo, 'createdAt', c.created_at,
    'player', (select jsonb_build_object('id', p.id, 'nickname', fp.nickname, 'avatarUrl', fp.avatar_url)
      from public.players p join public.faceit_profiles fp on fp.faceit_player_id = p.faceit_player_id where p.id = c.player_id),
    'map', (select jsonb_build_object('slug', m.slug, 'name', m.name, 'coverPath', m.cover_path, 'imagePath', m.image_path)
      from public.maps m where m.id = c.map_id and (m.active or public.is_admin()))
  ) order by c.recorded_on desc, c.created_at desc, c.id), '[]'::jsonb)
  from public.clips c where c.is_published or (p_include_drafts and public.is_admin())
$$;

create function public.admin_save_clip(p jsonb) returns jsonb language plpgsql as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_map uuid;
begin
  perform public._require_admin();
  if nullif(p ->> 'mapSlug', '') is not null then
    select id into v_map from public.maps where slug = p ->> 'mapSlug';
    if v_map is null then perform public._raise('LFE_INVALID'); end if;
  end if;
  if v_id is null then
    insert into public.clips (title, provider, external_id, source_url, player_id, map_id, recorded_on, description, consent_confirmed, embed_allowed, is_published)
    values (btrim(p ->> 'title'), p ->> 'provider', p ->> 'externalId', p ->> 'sourceUrl', nullif(p ->> 'playerId', '')::uuid,
      v_map, (p ->> 'recordedOn')::date, coalesce(p ->> 'description', ''), coalesce((p ->> 'consentConfirmed')::boolean, false),
      coalesce((p ->> 'embedAllowed')::boolean, false), coalesce((p ->> 'published')::boolean, false)) returning id into v_id;
  else
    update public.clips set title = btrim(p ->> 'title'), provider = p ->> 'provider', external_id = p ->> 'externalId',
      source_url = p ->> 'sourceUrl', player_id = nullif(p ->> 'playerId', '')::uuid, map_id = v_map, recorded_on = (p ->> 'recordedOn')::date,
      description = coalesce(p ->> 'description', ''), consent_confirmed = coalesce((p ->> 'consentConfirmed')::boolean, false),
      embed_allowed = coalesce((p ->> 'embedAllowed')::boolean, false), is_published = coalesce((p ->> 'published')::boolean, false)
    where id = v_id;
    if not found then perform public._raise('LFE_NOT_FOUND'); end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create function public.admin_delete_clip(p_id uuid) returns void language plpgsql as $$
begin
  perform public._require_admin();
  delete from public.clips where id = p_id;
  if not found then perform public._raise('LFE_NOT_FOUND'); end if;
end $$;
revoke all on function public.admin_save_clip(jsonb), public.admin_delete_clip(uuid) from public, anon;
grant execute on function public.admin_save_clip(jsonb), public.admin_delete_clip(uuid) to authenticated;
