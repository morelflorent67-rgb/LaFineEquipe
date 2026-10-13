# Forge V2 final : prototype à valider avant la phase 1

Prototype navigable dans `design/forge-v2-final/`. C'est du HTML/CSS/JS statique : aucun backend, et toutes les données sont fictives et marquées comme telles. Il sert à valider l'expérience avant de modifier l'application.

## L'ouvrir

```bash
python -m http.server 4175 --bind 127.0.0.1 --directory design/forge-v2-final
```

Puis ouvre http://localhost:4175. Le sommaire liste les 9 livrables. Sur chaque page, un panneau en bas à gauche permet de :
- changer de vue (desktop ou cadre mobile 390 px) ;
- changer de rôle (visiteur, membre, admin) ;
- réduire les animations ;
- lancer les simulations propres à la page (synchro, ajout de joueur, statut de match).

## Livrables

| # | Page | Ce qu'on y valide |
|---|---|---|
| 1-2 | `home.html` (`#mobile` pour le cadre téléphone) | Hero animé (logo, éclats, parallaxe discrète), accès prioritaires visibles dès le premier écran mobile, scène « En ce moment » façon overlay (Indisponible / Aucun / En cours / Terminé), sans score en direct |
| 3 | `elo-run.html` | Classement permanent : tri ELO / progression, filtres, podium, graphique depuis l'ajout, ajout immédiat (`demo_juliet`…), doublon refusé, synchro simulée avec changements de rang animés, actualisation manuelle limitée, état « FACEIT en panne » |
| 4 | `stuffs.html` | 8 maps avec de vraies images, compteurs calculés, recherche sur toutes les maps, transition vers la page de la map |
| 5 | `map.html?m=mirage#carte` | Carte tactique : radar officiel, zoom et déplacement (molette, pincement, clavier), marqueurs par type de grenade, lineups et points d'impact |
| 6 | `fiche.html?id=…` | Fiche : départ et visée, étapes, vidéo, mini-radar, partage, mode entraînement plein écran (← → Échap) |
| 7 | `mur.html` | Mur des lamentations : identité « mur », compteur, recherche, écran verrouillé pour les visiteurs |
| 8 | `admin.html` | Ajout immédiat au classement, Mur avec note privée, maps (ordre, visibilité, images avec contrôle du type et de la taille), positions de la carte tactique, qui se retrouvent ensuite sur `map.html` |
| 9 | toutes les pages + `crosshairs.html` | Animations, mouvement réduit, crosshairs V1 (copie du code) et atelier V2 (aperçu seulement) |

## Images

- **Maps** : écrans de chargement (1080p) et radars officiels de CS2. Ils ont été extraits du jeu installé sur le PC du propriétaire avec Source 2 Viewer CLI (projet open source ValveResourceFormat), avec son accord. Ce sont des fichiers Valve : l'usage fan non commercial est toléré, mais il n'existe **pas de licence explicite**.
- **7 captures Steam de la team**, recadrées pour retirer le chat, les pseudos, le radar, l'argent et le killfeed.
- Ces images sont dans `design/forge-v2-final/assets/media/`, **exclu de git** (`.gitignore`). Elles ne doivent pas être publiées en l'état. Le choix des images de production (visuels Valve ou captures de la team) est à trancher avant la mise en ligne.
- Aucun média de csnades.gg ni d'un autre site n'a été utilisé.

## Animations : principes retenus

- CSS (transitions, keyframes, `@property`), **View Transitions** entre pages (vignette de map → bandeau de la map) et **Web Animations** pour les reclassements (technique FLIP). La bibliothèque Motion n'est pas nécessaire pour ces effets.
- Uniquement `transform` et `opacity`, sans animation continue. Seul le point LIVE pulse, et seulement quand un match est réellement en cours.
- `prefers-reduced-motion` est respecté, et un bouton « Animations réduites » permet de le tester.
- Une valeur qui change s'affiche directement à sa nouvelle valeur (pas de compteur qui défile), puis elle est brièvement surlignée.
- Rien ne dépend du seul survol : sur mobile, les types de grenades sont toujours visibles, et la carte tactique se pilote au toucher et au clavier.

## Phase 1, après validation : ce qui changera dans l'application

Le prototype ne modifie pas l'application. Le plan prévu :

1. **Classement permanent** :
   - migration qui supprime `elo_runs` et `elo_run_participants` et ajoute `players.added_elo` et `players.added_at` ;
   - les relevés `elo_snapshots` sont conservés ;
   - l'ajout d'un joueur appelle FACEIT puis enregistre en une seule transaction le joueur et son premier relevé ;
   - la page `/elo-run`, le podium, le tableau et le graphique sont réécrits en conséquence, ainsi que les tests.
2. **Fraîcheur** :
   - synchro planifiée toutes les 5 minutes pour le roster (Supabase Cron) ;
   - actualisation manuelle publique, limitée côté serveur à une fois toutes les 2 minutes pour tout le site, d'après le journal `sync_runs` existant. Le verrou de `sync_begin`, qui empêche deux synchros simultanées, reste en place.
3. **Maps** :
   - nouvelles colonnes `maps.aerial_url` et `maps.active` ;
   - nouvelle table `map_positions` ;
   - nouvelles colonnes `utilities.throw_position_id`, `utilities.landing_x` et `utilities.landing_y` ;
   - pages admin Maps et Positions, et carte tactique sur `/stuffs/[mapSlug]`.
4. **Animations** : port des effets du prototype dans les composants existants.
5. **Mur** : déjà fonctionnel (membres uniquement, notes réservées aux admins) ; seule la mise en page sera alignée sur le prototype.

## Encore ouvert

- Logo rond original : on utilise toujours le recadrage provisoire.
- Source fiable pour les « matchs en cours » : pas encore validée (voir [faceit-feasibility.md](faceit-feasibility.md)).
- Images de production des maps : à décider.
