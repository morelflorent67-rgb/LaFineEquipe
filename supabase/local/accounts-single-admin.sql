-- Base LOCALE uniquement : retire l'ancien compte de test « membre » (compte admin unique depuis le 14/10/2026).
delete from auth.users where id = '00000000-0000-4000-8000-00000000a002';
