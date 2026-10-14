-- =============================================================================
-- 1800 · Liens Allstar au format actuel « https://allstar.gg/clip/<id> »
-- Le site enregistre désormais ce format (constaté le 14/10/2026, y compris pour les vidéos
-- FACEIT, qui sont des clips Allstar). La règle de la table n'acceptait que l'ancien
-- « /clip?clip=<id> » : un clip Allstar était refusé (« Données invalides »).
-- L'ancien format reste accepté pour d'éventuelles lignes existantes.
-- =============================================================================
do $$
declare v_name text;
begin
  select c.conname into v_name
    from pg_constraint c
   where c.conrelid = 'public.clips'::regclass and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%allstar.gg%';
  if v_name is not null then
    execute format('alter table public.clips drop constraint %I', v_name);
  end if;
end $$;

alter table public.clips add constraint clips_source_check check (
  (provider = 'youtube' and external_id ~ '^[A-Za-z0-9_-]{11}$' and source_url = 'https://www.youtube.com/watch?v=' || external_id)
  or (provider = 'twitch' and external_id ~ '^[A-Za-z0-9_-]{1,100}$' and external_id <> 'embed' and source_url = 'https://clips.twitch.tv/' || external_id)
  or (provider = 'twitch' and external_id ~ '^video:[0-9]{1,20}$' and source_url = 'https://www.twitch.tv/videos/' || substring(external_id from 7))
  or (provider = 'allstar' and external_id ~ '^[a-f0-9]{24}$'
      and source_url in ('https://allstar.gg/clip/' || external_id, 'https://allstar.gg/clip?clip=' || external_id))
);
