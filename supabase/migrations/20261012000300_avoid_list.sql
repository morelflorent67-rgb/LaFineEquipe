-- =============================================================================
-- 0300 · Mur des lamentations
-- Liste interne de profils FACEIT que la team préfère éviter. Ce n'est PAS une
-- sanction FACEIT. Lecture : membres connectés. Écriture : admins.
-- Les motifs sont dans une table séparée, lisible uniquement par les admins.
-- Ajouter un profil ici ne l'ajoute ni au roster, ni à un ELO Run, ni aux membres.
-- =============================================================================

create table public.avoid_list_entries (
  id uuid primary key default gen_random_uuid(),
  faceit_player_id uuid not null unique references public.faceit_profiles (faceit_player_id),
  status text not null default 'active' check (status in ('active', 'archived')),
  added_at timestamptz not null default now(),
  added_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null))
);

create trigger avoid_list_entries_touch before update on public.avoid_list_entries
  for each row execute function public._touch_updated_at();

create table public.avoid_list_private_notes (
  entry_id uuid primary key references public.avoid_list_entries (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 280),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger avoid_list_private_notes_touch before update on public.avoid_list_private_notes
  for each row execute function public._touch_updated_at();

alter table public.avoid_list_entries enable row level security;
alter table public.avoid_list_private_notes enable row level security;

-- Aucun droit pour les visiteurs, même pas en lecture.
revoke all on public.avoid_list_entries, public.avoid_list_private_notes from anon, authenticated;
grant select, insert, update, delete on public.avoid_list_entries, public.avoid_list_private_notes to authenticated;

create policy avoid_entries_read_members on public.avoid_list_entries
  for select to authenticated using ((select public.is_member()));
create policy avoid_entries_admin_insert on public.avoid_list_entries
  for insert to authenticated with check ((select public.is_admin()));
create policy avoid_entries_admin_update on public.avoid_list_entries
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy avoid_entries_admin_delete on public.avoid_list_entries
  for delete to authenticated using ((select public.is_admin()));

create policy avoid_notes_admin_all on public.avoid_list_private_notes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Suppression d'un profil devenu inutile (ni roster, ni Mur) : on n'en garde aucune copie.
create function public._cleanup_faceit_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.faceit_profiles fp
   where fp.faceit_player_id = old.faceit_player_id
     and not exists (select 1 from public.players p where p.faceit_player_id = old.faceit_player_id)
     and not exists (select 1 from public.avoid_list_entries a where a.faceit_player_id = old.faceit_player_id);
  return null;
end
$$;
revoke all on function public._cleanup_faceit_profile() from public, anon, authenticated;

create trigger avoid_list_entries_cleanup after delete on public.avoid_list_entries
  for each row execute function public._cleanup_faceit_profile();
create trigger players_cleanup after delete on public.players
  for each row execute function public._cleanup_faceit_profile();

-- ---------------------------------------------------------------------------
-- Lecture (membres) — sans aucun motif
-- ---------------------------------------------------------------------------
create function public.list_avoid_entries(p_status text default 'active') returns jsonb
language plpgsql stable
as $$
begin
  perform public._require_member();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'status', a.status,
        'addedAt', a.added_at,
        'archivedAt', a.archived_at,
        'isDemo', a.is_demo,
        'profile', public._profile_json(fp)
      ) order by a.added_at desc
    )
    from public.avoid_list_entries a
    join public.faceit_profiles fp using (faceit_player_id)
    where p_status = 'all' or a.status = p_status
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------------------
-- Administration — avec motif privé
-- ---------------------------------------------------------------------------
create function public.admin_list_avoid_entries(p_status text default 'all') returns jsonb
language plpgsql stable
as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'status', a.status,
        'addedAt', a.added_at,
        'archivedAt', a.archived_at,
        'updatedAt', a.updated_at,
        'isDemo', a.is_demo,
        'addedBy', coalesce(pr.display_name, case when a.added_by is null then null else 'Admin' end),
        'reason', n.reason,
        'inRoster', exists (select 1 from public.players p where p.faceit_player_id = a.faceit_player_id),
        'profile', public._profile_json(fp)
      ) order by a.added_at desc
    )
    from public.avoid_list_entries a
    join public.faceit_profiles fp using (faceit_player_id)
    left join public.avoid_list_private_notes n on n.entry_id = a.id
    left join public.profiles pr on pr.user_id = a.added_by
    where p_status = 'all' or a.status = p_status
  ), '[]'::jsonb);
end
$$;

create function public.admin_add_avoid_entry(
  p_profile jsonb, p_reason text default null, p_status text default 'active'
) returns jsonb
language plpgsql
as $$
declare
  v_faceit uuid := (p_profile ->> 'faceitPlayerId')::uuid;
  v_existing public.avoid_list_entries;
  v_id uuid;
begin
  perform public._require_admin();
  select * into v_existing from public.avoid_list_entries where faceit_player_id = v_faceit;
  if v_existing.id is not null then
    perform public._raise('LFE_DUPLICATE', jsonb_build_object('entryId', v_existing.id, 'status', v_existing.status));
  end if;
  perform public._upsert_faceit_profile(p_profile);
  insert into public.avoid_list_entries (faceit_player_id, status, added_by, archived_at)
  values (v_faceit, p_status, auth.uid(), case when p_status = 'archived' then now() end)
  returning id into v_id;
  if nullif(btrim(coalesce(p_reason, '')), '') is not null then
    insert into public.avoid_list_private_notes (entry_id, reason, updated_by)
    values (v_id, btrim(p_reason), auth.uid());
  end if;
  return jsonb_build_object('id', v_id);
end
$$;

create function public.admin_update_avoid_entry(
  p_entry_id uuid, p_reason text, p_status text
) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  update public.avoid_list_entries
     set status = p_status,
         archived_at = case
           when p_status = 'archived' then coalesce(archived_at, now())
           else null
         end
   where id = p_entry_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    delete from public.avoid_list_private_notes where entry_id = p_entry_id;
  else
    insert into public.avoid_list_private_notes (entry_id, reason, updated_by)
    values (p_entry_id, btrim(p_reason), auth.uid())
    on conflict (entry_id) do update set reason = excluded.reason, updated_by = excluded.updated_by;
  end if;
end
$$;

create function public.admin_delete_avoid_entry(p_entry_id uuid) returns void
language plpgsql
as $$
begin
  perform public._require_admin();
  delete from public.avoid_list_entries where id = p_entry_id;
  if not found then
    perform public._raise('LFE_NOT_FOUND');
  end if;
end
$$;

-- Version complète : roster + Mur.
create or replace function public.admin_faceit_usage(p_faceit_player_id uuid) returns jsonb
language plpgsql stable
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'player', (select jsonb_build_object('id', p.id, 'active', p.active, 'group', p.roster_group)
                 from public.players p where p.faceit_player_id = p_faceit_player_id),
    'avoid', (select jsonb_build_object('id', a.id, 'status', a.status)
                from public.avoid_list_entries a where a.faceit_player_id = p_faceit_player_id)
  );
end
$$;

revoke all on function
  public.list_avoid_entries(text), public.admin_list_avoid_entries(text),
  public.admin_add_avoid_entry(jsonb, text, text), public.admin_update_avoid_entry(uuid, text, text),
  public.admin_delete_avoid_entry(uuid)
  from public, anon;
grant execute on function
  public.list_avoid_entries(text), public.admin_list_avoid_entries(text),
  public.admin_add_avoid_entry(jsonb, text, text), public.admin_update_avoid_entry(uuid, text, text),
  public.admin_delete_avoid_entry(uuid)
  to authenticated;
