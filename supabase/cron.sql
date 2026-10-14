-- =============================================================================
-- Planification de la synchronisation FACEIT avec Supabase Cron.
-- À exécuter UNE FOIS dans Supabase › SQL Editor, APRÈS la mise en ligne du site.
-- Ne colle jamais ce fichier rempli dans un chat ni dans git : les valeurs restent dans Vault.
-- =============================================================================

-- 1. Extensions (également activables dans Database › Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Adresse du site et secret partagé, stockés chiffrés dans Supabase Vault (relançable :
--    met à jour un secret existant). Remplace les deux valeurs ENTRE APOSTROPHES, puis exécute.
--    CRON_SECRET = exactement la même valeur que la variable CRON_SECRET du site (Netlify).
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'lfe_site_url';
  if v_id is null then perform vault.create_secret('https://fineequipe.com', 'lfe_site_url');
  else perform vault.update_secret(v_id, 'https://fineequipe.com'); end if;
  select id into v_id from vault.secrets where name = 'lfe_cron_secret';
  if v_id is null then perform vault.create_secret('REMPLACE-PAR-TON-CRON_SECRET', 'lfe_cron_secret');
  else perform vault.update_secret(v_id, 'REMPLACE-PAR-TON-CRON_SECRET'); end if;
end $$;

-- 3. Deux tâches toutes les 5 minutes (re-planifier un même nom le remplace), chacune dans sa propre requête : Netlify coupe une requête
--    après ~30 s (constaté le 14/10/2026). Profils + ELO d'un côté, matchs + stats de l'autre.
select cron.schedule(
  'lfe-sync-profiles',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lfe_site_url') || '/api/cron/sync?job=profiles',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lfe_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
select cron.schedule(
  'lfe-sync-matches',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lfe_site_url') || '/api/cron/sync?job=matches',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lfe_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- Vérifier : select * from cron.job;  ·  Historique : select * from cron.job_run_details order by start_time desc limit 20;
-- Arrêter : select cron.unschedule('lfe-sync-profiles'); select cron.unschedule('lfe-sync-matches');
