-- =============================================================================
-- 1500 · Compte d'administration unique (décision du 14/10/2026)
-- Plus de comptes membres : seul le rôle « admin » existe. La connexion se fait avec
-- l'identifiant « admin » (traduit côté serveur en e-mail Supabase, cf. LFE_ADMIN_EMAIL).
-- Un compte authentifié sans ligne dans `profiles` reste traité comme un visiteur.
-- =============================================================================

delete from public.profiles where role <> 'admin';

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = 'admin');

-- Conservée pour les politiques et fonctions existantes qui l'appellent : désormais,
-- « membre » = administrateur. Le Mur public (étape suivante) remplacera ces usages.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
$$;
