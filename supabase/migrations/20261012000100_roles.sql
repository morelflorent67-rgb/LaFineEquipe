-- =============================================================================
-- 0100 · Rôles applicatifs
-- Un compte Supabase Auth sans ligne dans `profiles` n'a AUCUN accès particulier :
-- il est traité comme un visiteur. Seul un admin (ou l'éditeur SQL) attribue un rôle.
-- =============================================================================

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  display_name text check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Fonctions d'aide utilisées par les politiques RLS.
-- SECURITY DEFINER : elles lisent `profiles` sans dépendre des droits de l'appelant.
create function public.app_role() returns text
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.user_id = auth.uid()), false)
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.role in ('admin', 'member') from public.profiles p where p.user_id = auth.uid()), false)
$$;

revoke all on function public.app_role(), public.is_admin(), public.is_member() from public;
grant execute on function public.app_role(), public.is_admin(), public.is_member()
  to anon, authenticated, service_role;

-- Chacun lit sa propre ligne ; un admin lit toutes les lignes.
-- Aucune politique d'écriture : impossible de s'attribuer un rôle depuis l'API.
create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Erreurs métier : code SQLSTATE P0001 + message LFE_* + détail JSON éventuel.
create function public._raise(p_code text, p_detail jsonb default null) returns void
language plpgsql
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail::text, '');
end
$$;

create function public._require_admin() returns void
language plpgsql
as $$
begin
  if not public.is_admin() then
    perform public._raise('LFE_FORBIDDEN');
  end if;
end
$$;

create function public._require_member() returns void
language plpgsql
as $$
begin
  if not public.is_member() then
    perform public._raise('LFE_FORBIDDEN');
  end if;
end
$$;

create function public._touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;
