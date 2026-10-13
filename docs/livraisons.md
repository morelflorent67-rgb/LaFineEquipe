# Livraisons

## Livraison 5 — 13/10/2026 : accueil sans « En ce moment », crosshairs V1

- **Accueil** : la scène « En ce moment » est retirée (aucune source FACEIT fiable pour les matchs en cours). La première tuile affiche le dernier match terminé ; elle redeviendra « Matchs en cours » seulement si une source est validée un jour.
- **Synchro locale** : le serveur de dev relit FACEIT toutes les 5 min (`src/instrumentation.ts`), comme le fera Supabase Cron en ligne.
- **Crosshairs V1** (migration 1100) :
  - page publique `/crosshairs` : presets publiés, joueur, réglages, aperçu **indicatif**, état de vérification, bouton « Copier », marche à suivre pour l'import ;
  - code de partage contrôlé dans sa **forme** seulement (`CSGO-` + 5 blocs de 5 caractères), en base et pendant la saisie ; l'import en jeu n'est jamais présenté comme garanti ;
  - « À revérifier » si le preset a été validé avant les mises à jour CS2 du 30/09/2026, « Jamais vérifié en jeu » sans date ;
  - aperçu dessiné à partir de réglages recopiés à la main (longueur, écart, épaisseur, contour, point, couleur, fond de map) : le code n'est pas décodé (V2 seulement après validation du format) ;
  - Admin › Crosshairs : liste, création, modification, brouillon/publication, « Testé en jeu aujourd'hui » avec la version, suppression confirmée.
- **Vérifications** : `tsc` et ESLint propres, 89 tests Vitest (dont 4 en base et 4 unitaires pour les crosshairs), 23 parcours Playwright (dont `e2e/crosshairs.spec.ts`), captures 1440 et 390 px.
- **À faire de ton côté** : ajouter les presets réels des joueurs (code exporté depuis CS2) et les tester en jeu avant publication.

## Livraison 4 — 13/10/2026 : phase 1 Forge V2 dans le vrai site

Prototype validé (« je valide ») puis porté dans l'application, sur la vraie base locale.

- **ELO Run permanent** (migration 0800) : plus de runs ; ajout = ELO réel immédiat, progression depuis l'ajout, tri ELO ou progression, filtres Team/Guests, podium, tableau, courbe depuis l'ajout, rangs animés sans valeur inventée. Actualisation publique limitée à une fois toutes les 2 min pour tout le site.
- **Synchro planifiée** : toutes les 5 min en ligne (`supabase/cron.sql`) et, en local, par le serveur de dev lui-même (`src/instrumentation.ts`).
- **Maps et carte tactique** (migrations 0900 et 1000) :
  - Admin › Maps : vraie capture, vue aérienne, ordre, visibilité, ajout et suppression ;
  - Admin › Maps › Carte tactique : positions placées à la main (clic, glisser, flèches), fiches rattachées, points d'impact ;
  - page de map : modes Bibliothèque et Carte tactique (zoom Ctrl + molette, pincement, clavier), filtres et mode conservés dans l'URL ;
  - fiche : mini-radar (lancer + impact), mode entraînement plein écran (← → pour passer au lineup voisin), retour vers la carte.
- **Images des 8 maps** chargées dans la base locale par l'admin (écrans de chargement et radars extraits du jeu, usage local uniquement). Aucune position réelle n'est placée : c'est à faire par l'admin.
- **Accueil** refait d'après le prototype : intro animée, accès prioritaires, scène « En ce moment » (n'affiche « en cours » que si le statut est vérifié), top 5, maps avec vraies images. **Mur** : mise en page en briques du prototype, ruban « Nouveau », tri animé. Apparitions au défilement ; tout reste visible avec « réduire les animations ».
- **Vérifications** : `tsc` et ESLint propres, 81 tests Vitest (dont 3 nouveaux sur les maps et positions, et `tacticalGroups`), 21 parcours Playwright (dont `e2e/maps.spec.ts`), `next build` OK, captures 1440 et 390 px.
- **Encore à faire** : placer les vraies positions et fiches de stuffs ; source des matchs en cours ; Supabase et mise en ligne ; clips et crosshairs.

## Livraison 3 — 13/10/2026 : prototype Forge V2 final (en attente de validation)

Le cahier des charges « Forge V2 : améliorations finales » est traité sous forme de **prototype navigable** dans `design/forge-v2-final/`, comme demandé. Le backend définitif n'est pas encore modifié. Détail et plan de la phase 1 : [forge-v2-final.md](forge-v2-final.md).

- **Spécifications mises à jour** (`CLAUDE.md` et `AGENTS.md`) : ELO Run devenu classement permanent, maps avec vraies images et carte tactique, nouvelle section Mur des lamentations, modèle de données, routes, phases et critères d'acceptation.
- **9 livrables** : accueil desktop et mobile, ELO Run permanent avec ajout immédiat simulé, Stuffs avec vraies images de maps, carte tactique, fiche détaillée, Mur, aperçu admin, animations et crosshairs.
- **Images** : écrans de chargement et radars officiels extraits du jeu installé, avec l'accord du propriétaire, plus 7 captures Steam de la team recadrées. Dossier exclu de git, usage local.
- **Vérifications** :
  - captures à 1440 et 390 px des 9 pages : aucune erreur console, aucun débordement horizontal ;
  - parcours testés dans Chrome :
    - synchro avec changements de rang ;
    - ajout et doublon ;
    - filtres conservés dans l'URL et au retour ;
    - zoom de la carte tactique (marqueurs de taille constante) ;
    - position placée dans l'admin puis retrouvée sur la carte ;
    - Échap et retour du focus ;
    - mouvement réduit (tout le contenu visible).

## Livraison 2 — 13/10/2026 : connexion à la vraie API FACEIT

### Fait
- **Clé FACEIT** configurée dans `.env.local` (`FACEIT_MODE=live`), qui reste sur le PC et hors du code.
- **Test réel** des 6 endpoints sur les 10 profils fournis. Constats dans [faceit-feasibility.md](faceit-feasibility.md) : avatars sur `distribution.faceit-cdn.net`, recherche sensible à la casse, 20 appels par seconde autorisés, score de l'historique en manches.
- **Roster réel** : db_, MonstoRRR, Le-D-, OxGn-, FlayK_On, Art98s, Z0WRy, ekip, spK_S et its_J0E, tous en « Team ». Ils ont été importés par l'écran Admin › Joueurs (recherche, aperçu, confirmation) ; les doublons ont été refusés lors d'une seconde passe.
- **Synchro réelle** : 10 profils et 43 matchs distincts, avec map et score réels.
- La base de démonstration est mise de côté dans `.data/pglite-demo`, et `.data/pglite` contient les vrais joueurs.

### Corrections issues du test réel
- Les scripts `npm run faceit:check` et `npm run sync` ne démarraient pas (import de `@next/env`) : corrigé dans `scripts/faceit-check.ts` et `scripts/sync.ts`.
- Le score de l'historique est en manches : il est maintenant enregistré dès la première synchro pour les matchs terminés (`roundScoreFromHistory`). Le jeu d'essai a été aligné sur la réalité.
- Seul `games.cs2` est validé dans un profil, pour qu'un autre jeu au format inattendu ne bloque pas l'import (`src/lib/faceit/schemas.ts`).
- Détails de match : 30 par passage au lieu de 10 (`src/lib/sync/run-sync.ts`).

### Vérifications
- `npm run check` : 74 tests (+3 : pseudos réels finissant par « - » ou « _ », score de l'historique, autres jeux ignorés).
- `npm run test:e2e` : 19 sur 19. `next build` : OK. La clé et `open.faceit.com` sont absents de `.next/static` (0 fichier).
- Captures à 390 et 1440 px de l'accueil, des joueurs, des matchs et de l'ELO Run, avec les vrais avatars. Les 84 avatars de la page Matchs se chargent au défilement.

### Encore à faire
- **ELO Run** : aucun run créé. La date de départ et les participants sont au choix de l'admin.
- **Matchs en cours** : test à faire pendant une partie (procédure dans faceit-feasibility.md).
- **Supabase et mise en ligne** : non faits ([setup.md](setup.md), sections 3 et 4).
- Les avatars FACEIT sont servis en pleine résolution. Une optimisation (redimensionnement) est possible une fois en ligne.

## Livraison 1 — 12/10/2026 : application fonctionnelle (de Forge V2 au vrai site)

### Point de départ
Avant cette livraison, **rien n'était développé** : `design/forge-v2/` ne contenait que des maquettes HTML statiques aux données inventées (avatars `player.svg`, compteurs écrits à la main, « Live · 1 » fixe, Mur dans un fichier public). Elles restent une référence visuelle figée. Le vrai site est désormais dans `src/`, branché sur une base de données réelle.

### Ce qui fonctionne
| Demande | Réalisation |
|---|---|
| 1. Avatar FACEIT importé | Pseudo, lien ou identifiant → profil vérifié côté serveur (identifiant complet, pseudo, avatar, pays, niveau et ELO CS2 s'ils existent) → aperçu → confirmation. L'identifiant complet sert aux doublons et aux synchros. Un changement de pseudo ou d'avatar met à jour le même joueur. Un composant `Avatar` unique, avec silhouette si l'image manque ou ne charge pas, est utilisé partout. En cas de panne, les dernières données sont gardées et leur date affichée. Appels FACEIT serveur uniquement, mutualisés par la synchro. |
| 2. Cartes joueurs | Nouvelles plaques pour avatar carré ou rond : anneau de niveau, couleurs d'origine, pseudo sur 2 lignes, niveau, ELO, progression du run, 5 derniers résultats V/D/–/?. Tout est visible sans survol ; version horizontale compacte sur téléphone. |
| 3. Mur fonctionnel | Ajout, modification, archive, réactivation et suppression enregistrés en base. Doublon refusé par identifiant FACEIT (testé par lien `/en/…/stats`). Réservé aux membres côté serveur et par RLS : un visiteur ne reçoit aucune donnée. Motifs dans une table lisible par les seuls admins. L'ajout au Mur ne touche ni au roster, ni aux runs, ni aux rôles. |
| 4. ELO Run | États vides (aucun run, run sans participant, filtre vide). Barres sans division par zéro. Filtre Tous/Team/Guests qui met à jour podium, tableau, joueur sélectionné et graphique en même temps. Sélecteur qui charge le run choisi. Progression = actuel − départ. Pour une arrivée en cours de run, le départ est le premier relevé réel. Le graphique distingue « pas encore inscrit », « panne FACEIT » et « pas de synchro », sans rien interpoler. |
| 5. Stuffs | Compteurs calculés en base à partir des fiches publiées. Chaque map ouvre son catalogue et chaque carte sa fiche. Filtres dans l'URL, conservés au retour. Lien de partage canonique. Signalement « à revérifier » pour les membres. Création, modification, publication, captures (PNG/JPEG/WebP vérifiés, 5 Mo maximum), vidéo YouTube et « vérifiée aujourd'hui » pour les admins. Les exemples sont marqués fictifs. |
| 6. Matchs et navigation | Plus aucune valeur fixe. Sans source validée, le site affiche « Statut indisponible ». Une erreur ou un contrôle trop ancien donne « Statut incertain », jamais « Personne en game ». Les matchs sont dédoublonnés par identifiant ; les liens mènent au bon profil ou à la bonne salle. Clips et Crosshairs sont présentés « Pas encore disponible ». |
| 7. Mobile et accessibilité | Pseudos sur 2 lignes dans les accès rapides. Bandeau des stuffs réduit. Aucun débordement horizontal à 360, 390, 768, 1024 et 1440 px (testé). Focus visible ; Échap ferme menus et boîtes de dialogue et rend le focus au déclencheur ; focus confiné dans les boîtes de dialogue (testé). Les raccourcis clavier 1–8 de la maquette sont supprimés, car les raccourcis à une touche gênent les lecteurs d'écran. |

### Lancer cette version
Voir [setup.md](setup.md). En local, sans aucun compte :

```bash
npm install
```

```bash
npm run local:reset -- --demo
```

```bash
npm run dev
```

### Vérifications réalisées
- `npm run check` : TypeScript strict, ESLint et **71 tests**. Ils couvrent la RLS sur les vraies migrations (visiteur, compte sans rôle, membre, admin), le cycle complet du Mur, le renommage, l'ELO de départ, les doublons de matchs, les compteurs de stuffs, les signalements et une synchro complète avec panne simulée.
- `npm run test:e2e` : **19 parcours dans Chrome**. Ils couvrent l'accès au Mur par rôle, l'import FACEIT (casse, lien, doublon, pannes 503 et 429, profil introuvable, profil sans avatar ou sans CS2), la persistance après rechargement, le filtre ELO, les stuffs, le clavier et l'absence de débordement aux 5 largeurs.
- `next build` : sans erreur ni avertissement. Aucune clé ni appel FACEIT dans le code envoyé au navigateur.
- Relecture visuelle de captures à 360, 390 et 1440 px ; trois défauts de mise en page ont été corrigés.

### Encore simulé ou non branché
- **FACEIT réel** : non testé. La clé n'est pas configurée, et tout a été vérifié avec le jeu d'essai `FACEIT_MODE=fixtures`. Pour le test réel : `npm run faceit:check -- TonPseudo` (voir [faceit-feasibility.md](faceit-feasibility.md)).
- **Supabase** : non branché, aucun projet configuré. Les migrations sont prêtes et testées sur PostgreSQL 18 en local ; la procédure est dans [setup.md](setup.md).
- **Matchs en cours** : aucune source validée, donc « Statut indisponible ». Le spike FACEIT doit trancher.
- **Données de démonstration** : uniquement en local (profils `demo_…`, matchs, runs, stuffs fictifs, tous marqués).
- **Logo rond** : toujours le recadrage provisoire `public/brand/lfe-round-temp.webp`, en attente du fichier original.
- **Non développés** : clips et crosshairs (phases E/F), gestion des membres depuis l'interface (aujourd'hui en SQL), réception des webhooks FACEIT.
