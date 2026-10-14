-- Conserver les anciens codes et accepter les chaînes opaques CS… observées en octobre 2026.
-- Contrôle borné de saisie seulement : ni décodage, ni checksum, ni garantie d'import en jeu.
-- Aucun changement de droits, de RLS ou de données existantes.
alter table public.crosshairs drop constraint crosshairs_share_code_check;
alter table public.crosshairs add constraint crosshairs_share_code_check check (
  share_code ~ '^CSGO(-[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789]{5}){5}$'
  or share_code ~ '^CS[A-Za-z0-9]{38,126}$'
);
