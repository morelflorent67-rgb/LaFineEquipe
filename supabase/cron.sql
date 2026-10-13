-- =============================================================================
-- Planification de la synchronisation FACEIT avec Supabase Cron.
-- À exécuter UNE FOIS dans Supabase › SQL Editor, APRÈS la mise en ligne du site.
-- Ne colle jamais ce fichier rempli dans un chat ni dans git : les valeurs restent dans Vault.
-- =============================================================================

-- 1. Extensions (également activables dans Database › Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Adresse du site et secret partagé, stockés chiffrés dans Supabase Vault.
--    Remplace les deux valeurs ENTRE APOSTROPHES dans l'éditeur SQL, puis exécute.
--    CRON_SECRET = exactement la même valeur que la variable CRON_SECRET du site (Vercel).
select vault.create_secret('https://REMPLACE-PAR-TON-SITE.vercel.app', 'lfe_site_url');
select vault.create_secret('REMPLACE-PAR-TON-CRON_SECRET', 'lfe_cron_secret');

-- 3. Profils + ELO + matchs toutes les 5 minutes (classement permanent ; ~20 appels FACEIT par passage
--    pour 10 joueurs, très en dessous du débit constaté de 20 appels/s).
select cron.schedule(
  'lfe-sync',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lfe_site_url') || '/api/cron/sync',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lfe_cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Vérifier : select * from cron.job;  ·  Historique : select * from cron.job_run_details order by start_time desc limit 20;
-- Arrêter : select cron.unschedule('lfe-sync');
