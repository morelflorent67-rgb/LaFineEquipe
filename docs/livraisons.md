# Livraisons

## Livraison 12 — 14/10/2026 : Mur des lamentations public (Banlist + Wall of Shame)

- **Page publique** `/mur-des-lamentations`, sans connexion. Banlist à gauche, Wall of Shame à droite ; colonnes empilées sous 1 100 px. La page reste non indexée par les moteurs de recherche, car elle affiche des pseudos de joueurs extérieurs.
- **Banlist** : affiches « WANTED / Recherché » (avatar, pseudo, niveau, ELO, date d'ajout, lien FACEIT), recherche, tri et compteur. Seules les entrées actives sont publiques ; les archives et les notes internes restent réservées à l'admin, en base (RLS, migration 1600) comme dans l'application. Le texte rappelle que ce n'est pas une sanction FACEIT.
- **Wall of Shame** : calculé en base (`wall_of_shame`) sur les 30 derniers jours, joueurs **Team** actifs uniquement, 3 lauréats maximum par catégorie : Le Touriste (moins de kills sur un match), La Passoire (plus de morts sur un match), Le Myope (pire moyenne de HS %), Le Pacifiste (plus faible ADR moyen), Le Chat noir (pire taux de victoire). Il faut au moins 3 matchs pour les moyennes. Les valeurs sont reprises telles quelles de `/matches/{id}/stats`, sans estimation.
- **Synchro** : l'historique couvre désormais 30 jours (30 matchs par joueur et par passe). Les stats individuelles des matchs terminés sont enregistrées dans `match_player_stats`, 30 matchs au plus par passe. Un match sans stats est marqué « lu » pour ne pas être redemandé.
- **Vérifications** : TypeScript, lint, **138 tests unitaires/base**, **35 parcours navigateur**. Captures inspectées à 390 et 1 440 px, sans débordement horizontal.

## Livraison 11 — 14/10/2026 : compte d'administration unique

- Connexion avec l'identifiant « admin » (traduit côté serveur en `LFE_ADMIN_EMAIL`) ; seul le rôle `admin` existe (migration 1500) ; plus de bouton de connexion dans l'en-tête pour les visiteurs.

## Livraison 10 — 13/10/2026 : maps en couleur au survol, cartes joueurs et presets pros

- **Stuffs** : images grisées au repos, couleurs et luminosité d'origine au survol/focus clavier, transition courte. Équivalent au toucher pendant l'appui ; animations réduites respectées.
- **Joueurs** : nouvelle composition des cartes du roster, pseudo en filigrane, cadre anguleux autour de l'avatar, reflet au survol, lien de profil plus visible. Statistiques réelles inchangées, V/D et badges officiels conservés ; version compacte mobile.
- **Crosshairs** : ZywOo, donk et NiKo ajoutés dans la vraie base locale via l'administration, avec code source intact et aperçu SVG indicatif. Sources et dates dans les notes ; aucun compte pro ajouté au roster. Aucune validation en jeu prétendue. Détails et limites : [crosshairs-pro.md](crosshairs-pro.md).
- **Compatibilité** : migration 1400 pour accepter les codes récents opaques CS… en plus des anciens CSGO ; contrôles de saisie identiques serveur/SQL, sans décodage ou conversion, sans changement de droits. Le site ne prétend pas valider le contenu binaire des codes.
- **Vérifications** : TypeScript, lint, **126 tests unitaires/base**, **18 parcours navigateur**, compilation de production réussis. Inspection de captures desktop/mobile ; survol, focus clavier, mouvement réduit et débordements contrôlés sur les trois pages à 360/390/768/1440 px. Import dans CS2 restant à tester par la team.

## Livraison 9 — 13/10/2026 : référencement et partage des pages

- **Pages publiques** : titres, descriptions et métadonnées de partage propres à chaque page, profil joueur et fiche de stuff. Le logo original sert d'image de partage lorsque le domaine public est configuré. URL canonique sans les filtres du catalogue.
- **Indexation** : `robots.txt` et sitemap des sept pages publiques principales. Le mode local, les démonstrations et les previews restent en `noindex` ; activation uniquement en production Supabase avec une origine HTTPS valide dans `SITE_URL`. Le Mur, la connexion et l'administration ne publient ni aperçu personnalisé ni URL canonique et restent exclus de l'indexation. Les protections serveur et RLS restent indispensables et inchangées.
- **Configuration** : procédure dans [setup.md](setup.md) et exemples sans secrets dans `.env.example`. Aucun déploiement effectué ; le rendu des aperçus sur les réseaux sociaux sera à vérifier après mise en ligne. Le sitemap ne liste pas encore les pages individuelles de joueurs, maps et stuffs, accessibles par les liens du site.
- **Vérifications** : `npm run check` réussi (TypeScript, ESLint, **124 tests**) ; **8 parcours navigateur ciblés** réussis (référencement, accès privés, profils) ; compilation de production réussie. Tests couvrant notamment les domaines invalides, le sitemap local vide et l'absence de métadonnées privées.

## Livraison 8 — 13/10/2026 : badges de niveau FACEIT et écrans de secours

- **Niveaux** : les dix PNG originaux du support officiel FACEIT remplacent les rectangles numérotés dans le composant partagé `Level`. Ronds et chiffres conservés, nom accessible « Niveau FACEIT X ». Valeur absente ou invalide : indicateur neutre, jamais de niveau inventé. Sources conservées dans `public/faceit/levels/SOURCES.md` ; fichiers locaux, environ 14 Ko au total.
- **ELO Run** : badges ajoutés au podium ; niveau désormais visible dans les lignes du classement mobile, sans débordement. Les indicateurs V/D gardent leurs couleurs sémantiques.
- **Finitions** : page 404 française avec retours accueil/classement et écran d'erreur de page avec bouton Réessayer (API `retry` de Next.js 16.3). Pas de message d'erreur technique affiché au visiteur. Cet écran couvre les erreurs sous le layout racine, pas les erreurs du layout lui-même.
- **Vérifications** : TypeScript, ESLint et compilation de production réussis ; 29 parcours navigateur réussis. Chargement des PNG, visibilité des niveaux desktop/mobile, absence de débordement et navigation depuis la page 404 contrôlés. L'écran d'erreur générique est compilé mais aucune panne réelle n'a été provoquée sur la base de la team.

## Livraison 7 — 13/10/2026 : fiches joueurs enrichies

- **Profil joueur** : accès rapides Progression ELO / Matchs / Clips / Crosshairs, avatar réduit sur mobile, retour vers le roster.
- **ELO** : valeur et date d'ajout, dernier ELO connu avec source et horodatage, delta exact, courbe existante réutilisée avec les relevés enregistrés. Aucun historique inventé ; états explicites si le joueur n'a pas de données CS2 ou si une lecture échoue.
- **Contenus** : trois derniers clips publiés du joueur, lien vers la bibliothèque filtrée, crosshairs publiés et bouton de copie. Aucun brouillon affiché sur la fiche, même à un administrateur. Ces sections se rempliront automatiquement après les ajouts éditoriaux.
- **Navigation** : badge « bientôt » retiré pour Crosshairs. Profil inexistant traité par `notFound()` avec page française et retour vers les joueurs. Titre et description de page propres au pseudo ; lecture du profil mutualisée entre métadonnées et page dans une même requête.
- **Vérifications** : TypeScript et ESLint propres, compilation de production réussie ; quatre parcours ciblés Playwright réussis (Clips et Profils), dont séparation des contenus entre joueurs, absence de données CS2, profil inconnu, navigation clavier et mobile à 360/390/1440 px. Aucune modification de schéma ou des données de la team.

## Livraison 6 — 13/10/2026 : bibliothèque de clips V1

- **Page `/clips`** : présentation Forge, clip mis en avant, filtres joueur/map/titre/période et tri par date, conservés dans l'URL. Trois derniers clips publiés sur l'accueil.
- **Admin → Clips** : ajout par lien YouTube, Twitch ou Allstar, joueur et map facultatifs, date, description, brouillon/publication, modification et suppression confirmée. Accord du joueur requis avant publication. Doublons refusés par identifiant de vidéo canonique.
- **Lecture** : YouTube/Twitch à la demande si l'admin a vérifié l'intégration ; lien externe disponible. Twitch utilise le domaine courant et reste externe en HTTP local ou sur petit écran. Allstar reste externe. Aucun import automatique FACEIT ou Allstar.
- **Base** : migration additive `20261013001300_clips.sql`, contraintes et RLS testées. Aucun brouillon accessible aux visiteurs ou aux membres. Données réelles conservées ; exemples de clips uniquement dans le jeu de démonstration.
- **Vérifications** : TypeScript et ESLint sans erreur ; **109 tests Vitest**, **25 parcours Playwright** ; `npm run build` réussi. Captures galerie desktop/mobile et formulaire mobile. Le lecteur tiers est intercepté dans le test : aucune lecture réelle de vidéo n'est prétendue validée.
- **Documentation** : [utilisation et limites des clips](clips.md). Prochaine étape pratique : publier les premiers liens de la team et vérifier leur lecture sur leurs plateformes. Pas de nouveau secret à configurer.

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
