# Faisabilité FACEIT : ce qui est vérifié, ce qui reste à tester

**Statut au 13/10/2026 :** premier test réel fait avec la clé du propriétaire (lue dans `.env.local`, jamais affichée), sur les 10 profils du roster. Au total, 43 appels de test, puis deux synchronisations complètes, sans aucune erreur. La spécification officielle (https://open.faceit.com/data/v4/docs/swagger.json) reste la référence. Ce document distingue ce qui a été **constaté** de ce qui reste **supposé**.

## Endpoints utilisés par le site (tous côté serveur)

| Endpoint | Usage | Champs lus | Constaté le 13/10 |
|---|---|---|---|
| `GET /players?nickname=` | ajout par pseudo ou lien | `player_id`, `nickname`, `avatar`, `country`, `games.cs2.skill_level`, `games.cs2.faceit_elo` | 10/10 profils trouvés, tous avec avatar et données CS2 |
| `GET /players/{player_id}` | synchro des profils et de l'ELO | idem | OK (synchro : 10/10) |
| `GET /search/players?nickname=&game=cs2` | secours si la casse du pseudo diffère | `player_id`, `nickname`, `avatar` | « monstorrr » → MonstoRRR |
| `GET /players/{id}/history?game=cs2` | derniers matchs | `match_id`, `status`, `started_at`, `finished_at`, `results.winner`, `results.score`, `teams.*.players[].player_id` | OK, 100 matchs par appel au maximum |
| `GET /matches/{id}` | map jouée | `voting.map.pick`, `voting.map.entities[].name` | OK (ex. `de_anubis` / « Anubis ») |
| `GET /matches/{id}/stats` | score en manches (contrôle) | `rounds[0].teams[].team_stats["Final Score"]` | OK, cohérent avec l'historique |

## Constats réels

- **Avatars** : tous servis par `distribution.faceit-cdn.net` en HTTPS. Ils sont acceptés par la liste d'hôtes autorisés (`*.faceit-cdn.net`). Les images sont en pleine résolution (jusqu'à environ 1 250 px de large).
- **Casse** : `/players?nickname=` **respecte la casse** (`DB_`, `monstorrr` et `ART98S` renvoient 404). Le site passe alors par `/search/players` et retrouve le bon profil.
- **Autres jeux** : certains profils contiennent `valorant`, `clash_royale`, `brawl_stars`… Le site ne valide plus que `games.cs2` ; les autres jeux sont ignorés.
- **Liens** : `faceit_url` contient `{lang}` (ex. `https://www.faceit.com/{lang}/players/db_`). Le site construit ses propres liens en `/fr/`.
- **Limite de débit** : chaque réponse contient `ratelimit-limit: 20, 20;w=1`, soit **20 appels par seconde**, avec `ratelimit-remaining` et `ratelimit-reset`. Aucun 429 n'a été observé. La synchro espace ses appels de 150 ms, environ 6 par seconde.
- **Statuts** : dans l'historique, tous les matchs ont `status = "finished"` en minuscules (1 000 sur 1 000). Dans `/matches/{id}`, la valeur est `"FINISHED"` en majuscules (15 sur 15). La conversion ignore la casse.
- **Score** : contrairement à ce que laissait penser la spécification, `results.score` de l'historique est **en manches**, par exemple `{"faction1": 6, "faction2": 13}`. Sur 1 000 matchs, 999 ont un score normal et 1 est à 11–0, probablement un abandon. Le site l'utilise directement pour les matchs terminés, puis le contrôle avec « Final Score » de `/stats`.
- **Type de matchs** : les 1 000 matchs observés sont tous `matchmaking`, « Europe 5v5 Queue ».
- **Rythme de jeu** : les 100 derniers matchs couvrent de 2 à 4 semaines selon le joueur. Sur 1 000 entrées, il y a 473 matchs distincts, car les joueurs jouent souvent ensemble. La déduplication par identifiant de match fonctionne : 43 lignes pour les 10 derniers matchs de chacun des 10 joueurs.
- **Synchro complète** : 20 s pour la première passe (10 profils, 10 historiques, 30 détails de match), 12 s pour la suivante.

## Choix faits par prudence (inchangés)

- Un avatar n'est accepté que s'il est servi en HTTPS par `*.faceit-cdn.net`. Sinon, une silhouette est affichée.
- Un profil sans `games.cs2` n'a ni niveau ni ELO affichés.
- Une erreur ne remplace jamais les dernières données valides : la date des données et la date de l'échec sont affichées.
- Toute valeur de statut inconnue devient `unknown`.

## Matchs en cours : toujours non validé, donc « Statut indisponible »

La Data API n'a pas d'endpoint « match en cours d'un joueur ». Le test du 13/10 ne trouve **aucun match non terminé** dans l'historique, mais personne ne jouait à ce moment-là. Ce n'est donc pas encore une preuve. Deux pistes :

1. **Historique** : vérifier si un match en cours apparaît dans `/players/{id}/history`, avec quel `status` et après quel délai.
   Test : **pendant qu'un membre joue**, lance plusieurs fois :
   ```bash
   npm run faceit:check -- SonPseudo
   ```
   Si la première ligne de l'historique affiche un statut autre que `finished` (par ex. `ONGOING`, `READY`) pendant la partie, la piste est validée. Note le délai et le statut, puis choisis cette source dans Admin › Synchronisation.
   Si seul le match terminé apparaît, à la fin, cette piste est écartée.
2. **Webhooks** (App Studio › Webhooks, abonnement « User » sur une liste de joueurs, événements `match_status_ready`, `match_status_finished`…). FACEIT doit pouvoir joindre une **adresse publique** : cette piste ne peut être testée qu'après la mise en ligne. Elle n'est pas encore implémentée ; un point de réception authentifié sera ajouté si elle est retenue.

Tant qu'une piste n'est pas validée par un test réel, `live_detection.source = 'none'` et le site affiche « Statut indisponible ».

## Clips

FACEIT n'a pas d'endpoint public de clips, et l'API Allstar exige un accès partenaire. La V1 prévue est l'ajout de liens par un admin : rien n'est importé automatiquement.

## Suivi

- [x] `faceit:check` sur de vrais pseudos : avatar présent, hôte `distribution.faceit-cdn.net`, `games.cs2` présent
- [x] La recherche exacte respecte la casse ; la recherche de secours fonctionne
- [x] Statuts réels : `finished` (historique) / `FINISHED` (match)
- [x] Forme de `voting.map` et présence de « Final Score » ; score de l'historique en manches
- [x] Limite de débit : 20 appels par seconde, en-têtes `ratelimit-*`, aucun 429 sur deux synchros
- [ ] Un match en cours apparaît-il dans l'historique ? À tester pendant une partie
- [ ] Webhooks : à tester après la mise en ligne
- [ ] Statuts `CANCELLED` / `ABORTED` : jamais observés pour l'instant
