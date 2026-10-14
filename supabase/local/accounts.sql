-- Comptes de la base LOCALE de développement (jamais utilisés sur Supabase).
-- Connexion locale sans mot de passe depuis /connexion, uniquement en mode « local ».
-- « sans-role » sert à vérifier qu'un compte connecté sans rôle reste un visiteur.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'admin@local.test'),
  ('00000000-0000-4000-8000-00000000a003', 'sans-role@local.test')
on conflict do nothing;

insert into public.profiles (user_id, role, display_name) values
  ('00000000-0000-4000-8000-00000000a001', 'admin', 'Admin local')
on conflict do nothing;
