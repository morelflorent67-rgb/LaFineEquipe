# Projet : Hub communautaire pour une team Counter-Strike 2

> Ce fichier est la source de vérité fonctionnelle et technique du projet. Lis-le intégralement avant de proposer des changements. Discute les choix non résolus et avance par étapes testables. Le site https://zogma.club/ est une **inspiration fonctionnelle uniquement**, pas une maquette à copier ni du code à reprendre.

## 1. Vision

Construire un site web en français, moderne et responsive, destiné à une team CS2, qui regroupe :
1. Accueil / tableau de bord de la team.
2. ELO Run FACEIT : classement permanent des joueurs ajoutés par l'admin, progression depuis leur ajout et historique des relevés.
3. Matchs FACEIT en cours des joueurs suivis et derniers matchs.
4. Clips / highlights des membres.
5. Bibliothèque de crosshairs CS2.
6. Bibliothèque de stuffs (smokes, flashes, molotovs, HE) map par map.
7. Administration privée sans modification manuelle du code.
8. Mur des lamentations : page publique avec la Banlist (joueurs FACEIT à éviter, gérée par l'admin) et le Wall of Shame (stats « honteuses » automatiques des joueurs de la team, pour rire entre amis).

Public : membres de la team, amis, visiteurs. Navigation et textes en français. Le site doit fonctionner sans connexion pour les visiteurs ; seule l'administration nécessite une authentification (décision du 14/10/2026 : plus de comptes membres).

## 2. Expérience visuelle / UX

Direction : univers esport CS2 haut de gamme mais lisible : fonds anthracite, surfaces contrastées, accent coloré unique configurable, typographie claire, micro-interactions sobres, badges de statut et cartes de joueurs. Responsive desktop/tablette/mobile ; navigation clavier ; états chargement, absence de données, erreur et données périmées. Ne copie ni la charte ni les assets du site de référence.

Direction artistique validée : **Forge** (noir profond, rouge LaFineEquipe, touches métalliques, formes anguleuses issues des logos, grands titres sans italique systématique). Référence navigable : `design/forge-v2-final/`. Logo détaillé pour le hero, logo rond pour la navigation et le favicon.

Victoire / défaite : V vert, D rouge, toujours avec la lettre ou un libellé (jamais la couleur seule) ; le rouge LFE reste la couleur d'identité, indépendamment des résultats.

Animations : CSS, View Transitions et Web Animations du navigateur, transformations GPU légères, aucune animation continue inutile, `prefers-reduced-motion` respecté, aucune fonction dépendante du seul survol, interactions tactiles prévues. Une animation ne modifie jamais artificiellement une valeur affichée. Pas de bibliothèque d'animation supplémentaire sans besoin démontré.

Menu proposé : Accueil | ELO Run | Matchs LIVE | Clips | Crosshairs | Stuffs | Team | Mur. Bouton administration pour l'admin authentifié uniquement.

L'accueil affiche : accès prioritaires (matchs en cours, ELO Run, stuffs) visibles dès le premier écran sur mobile, résumé du classement permanent, nombre de matchs en cours **seulement si leur statut est vérifié**, derniers matchs, derniers clips publiés, raccourcis vers maps/stuffs, et lien vers le profil FACEIT des joueurs. Hero réduit sur mobile.

## 3. Stack recommandée

- Next.js App Router (version stable compatible, vérifier avant installation), TypeScript strict.
- Tailwind CSS et shadcn/ui ; composants accessibles, responsive.
- Supabase : PostgreSQL, Auth, Storage. Utiliser un client serveur sécurisé ; activer les politiques RLS.
- Validation Zod sur entrées et réponses API externes ; contrats de types.
- Intégration FACEIT exclusivement côté serveur via la Data API v4 officielle.
- Tâches planifiées fiables (Supabase scheduled functions ou cron de l'hébergeur), pas un `setInterval` dans le navigateur comme unique source de synchronisation.
- Vitest pour logique métier, Playwright pour scénarios critiques, ESLint/formatage/typecheck.
- Déploiement décidé le 14/10/2026 : site sur **Netlify**, base/auth/stockage sur **Supabase**, domaine **fineequipe.com** chez OVH (DNS à pointer vers Netlify). Dépôt GitHub public : https://github.com/morelflorent67-rgb/LaFineEquipe.

Ne multiplie pas inutilement les frameworks. Propose une alternative seulement s'il y a une incompatibilité prouvée.

## 4. Étape zéro obligatoire : faisabilité FACEIT

Avant de développer les fonctions LIVE et CLIPS, créer une courte note `docs/faceit-feasibility.md` :
- Endpoints officiels réellement disponibles, champs constatés, conditions d'accès, permissions, éventuelles limites de taux.
- Contrôle avec une vraie clé de test fournie **via variable d'environnement locale**, jamais en dur, jamais côté client, jamais dans les logs.
- Joueurs : `GET /players?nickname=...`, `GET /players/{player_id}`, et données CS2 `games.cs2.faceit_elo` lorsqu'elles sont effectivement présentes.
- Historique : `GET /players/{player_id}/history?game=cs2` ; stats : `/players/{player_id}/stats/cs2`, `/players/{player_id}/games/cs2/stats` selon besoin ; détails : `/matches/{match_id}`, `/matches/{match_id}/stats`.
- Statut d'un match d'un joueur précis : démontrer par un test réel si l'historique et/ou les webhooks utilisateur permettent de le savoir suffisamment tôt. Les webhooks FACEIT exposent des événements de match (ready/finished/aborted/cancelled) et des scopes utilisateurs, mais la disponibilité concrète doit être testée sur l'app du propriétaire.
- Ne pas prétendre connaître le score en temps réel s'il n'est pas renvoyé par une source officiellement accessible et fiable.
- Si l'accès aux matchs actifs n'est pas démontré : afficher `Statut non disponible`, et maintenir une section derniers matchs fonctionnelle. Aucun scraping des pages privées ni endpoint interne non documenté.
- Clips : vérifier l'absence ou la disponibilité d'un endpoint public officiel FACEIT avant d'annoncer une synchronisation ; Allstar.gg a une API partenaire soumise à accès/approbation. Prévoir un import de liens géré par l'admin comme solution initiale.

Documentation :
- https://docs.faceit.com/docs/data-api/
- https://docs.faceit.com/docs/data-api/data/
- https://docs.faceit.com/docs/webhooks/
- https://developer.allstar.gg/

## 5. Modules et règles métier

### 5.1 Joueurs et team

Dans /admin/players, saisir pseudo ou URL FACEIT. Résoudre l'identifiant stable FACEIT, confirmer le profil trouvé (avatar, nickname, lien), puis enregistrer. Détection des doublons ; champs groupe/team/guest, actif/inactif, ordre d'affichage, liens Twitch/YouTube/Allstar optionnels. Les joueurs sont **sélectionnés par l'administrateur**, pas découverts automatiquement dans une liste de contacts.

### 5.2 ELO Run (classement permanent)

Décision du 13/10/2026, qui remplace l'ancien modèle par runs : l'ELO Run est un **classement permanent**. Pas de compétition mensuelle, pas de date de début ou de fin, pas de bouton « nouveau run », pas de remise à zéro, aucune session à créer pour ajouter un joueur.

Ajout par l'admin (pseudo ou URL FACEIT) : résoudre l'identifiant FACEIT unique, récupérer **immédiatement** l'ELO CS2 actuel, enregistrer le joueur et ce premier relevé, puis l'afficher aussitôt au classement à son vrai ELO, sans attendre la synchronisation planifiée. Ce premier relevé est son **ELO d'ajout** (valeur et date affichées).

Pour chaque joueur : rang, avatar FACEIT, pseudo, niveau, ELO actuel (source + date du dernier relevé), ELO d'ajout, progression = ELO actuel − ELO d'ajout (0 à l'entrée), derniers résultats V/D, lien vers le profil FACEIT, relevés successifs et graphique depuis l'ajout. Tri principal : ELO actuel décroissant ; tri alternatif : progression depuis l'ajout. Filtres Tous / Team / Guests.

**Ne pas inventer** d'ELO antérieur à l'ajout ni interpoler les relevés manquants. Ne pas confondre ELO gagné et somme des résultats de matchs. Ne pas afficher de « rating officiel 2.0 » calculé maison ; une métrique dérivée est nommée « estimation » et sa formule documentée.

Fraîcheur : synchronisation serveur planifiée, avec un objectif de quelques minutes (point de départ 5 min, à ajuster selon les quotas ; débit constaté le 13/10/2026 : 20 appels/s). Cache en base, heure de dernière synchronisation affichée, classement recalculé après chaque passage. Actualisation manuelle limitée en fréquence (point de départ : une fois toutes les 2 min pour tout le site). Ne jamais annoncer de temps réel. Une erreur FACEIT n'écrase jamais les dernières valeurs valides ; afficher `Dernière mise à jour`. Les changements de rang peuvent être animés, sans valeurs intermédiaires inventées.

Retirer un joueur le sort du classement sans effacer ses relevés ; s'il revient, son ELO d'ajout est repris à son retour.

### 5.3 Matchs LIVE

Créer un adaptateur FACEIT séparé, des tables locales de matchs et participations, dédoublonner par `faceit_match_id` (plusieurs membres peuvent jouer le même match). Priorité à une source validée (webhook utilisateur FACEIT si accessible, puis polling d'endpoints documentés et confirmés). Statuts métier `unknown`, `scheduled`, `ready`, `ongoing`, `finished`, `cancelled`, `aborted` ; mapper les statuts externes seulement après vérification des valeurs. Une carte de match peut présenter joueurs suivis, map si disponible, équipes, score s'il est réellement fourni, heure, source, dernier contrôle, et lien vers FACEIT. Ne jamais montrer « LIVE » sur la seule hypothèse qu'un joueur n'a pas fini un match.

Mettre un TTL/configurable intervalle de polling (point de départ 60 à 120 secondes à valider avec les quotas), traitement d'erreurs et backoff, expiration des états incertains ; webhook authentifié et traitement idempotent si accessible. Une section « Derniers matchs » reste utilisable indépendamment du LIVE.

### 5.4 Clips

V1 : administration des clips par URL de source autorisée (YouTube, Twitch, Allstar, FACEIT **uniquement si liens et intégration valides**), titre, joueur, date, map, miniature et match associé optionnel ; affichage vidéo embedded si les conditions du fournisseur le permettent, sinon carte/lien externe. Filtres joueur/map/date et tri du plus récent. Consentement des joueurs pour l'utilisation de leurs clips ; pas de réhébergement de vidéos de tiers sans autorisation.

V2 conditionnelle : architecture par provider/adaptateur (FACEIT/Allstar/Twitch/YouTube) + `external_id` unique + last synced at. Import automatique seulement avec API officielle/documentée et droits vérifiés. Déduplication, contenu non publiable en quarantaine, job synchronisation, logs. **Ne pas coder un faux import automatique à partir d'un endpoint inventé.**

### 5.5 Crosshairs CS2

V1 : catalogue de presets avec propriétaire (joueur), nom, code de partage original, image/aperçu, notes, bouton copier et instructions d'import. Possibilité de plusieurs crosshairs par joueur. Valider syntaxiquement les codes sans prétendre que l'import est garanti sur toute version du jeu. Les mises à jour des 22–30 septembre 2026 ont modifié les réglages et les codes de partage CS2 ; gérer un champ version/validé_le, indiquer les presets à revérifier.

V2 : aperçu interactif, personnalisation et conversion des anciens codes **seulement après validation du format actuel** ; ne pas implémenter d'encodage de code de partage au hasard. Tests de non-régression et note de compatibilité avec la version du jeu. L'aperçu est indicatif et distinct du rendu exact du moteur CS2.

### 5.6 Bibliothèque de stuffs

Pages /stuffs et /stuffs/[mapSlug]. Chaque stuff contient : map, camp T/CT/BOTH, type SMOKE/FLASH/MOLOTOV/HE, position de départ, point de visée, destination, usage, titre, description courte, étapes, lancer (statique/jumpthrow/runthrow/etc.), difficulté, tags, captures et/ou vidéo, créateur, date de dernière vérification, état publié/brouillon, et, si l'admin les a placés, sa position de lancer et son point d'impact sur la carte tactique. Les utilitaires peuvent être regroupés par map, zone, site, attaque/défense.

Maps : gérées depuis l'admin (ajout, retrait ou masquage, ordre). Chacune a une **vraie capture de CS2**, réalisée par la team ou issue d'une ressource utilisable légalement, avec son nom, le nombre de stuffs et une **vue aérienne** pour la carte tactique. Ne pas copier les médias de sites tiers (csnades.gg, etc.) sans autorisation. Maps prévues : Mirage, Inferno, Dust2, Ancient, Nuke, Anubis, Overpass, Train.

UX : choix de la map avec sa vraie image, son nom et son nombre de stuffs, effet de survol léger et transition fluide vers la page de la map. Deux modes par map :
- **bibliothèque** : grille de captures, filtres Smoke/Flash/Molotov/HE et T/CT, recherche par destination ou position, filtres conservés dans l'URL ;
- **carte tactique** : vue aérienne zoomable et déplaçable (souris, tactile, clavier), marqueurs de positions de lancer différenciés par type de grenade (couleur + pictogramme), clic sur un marqueur → stuffs associés et point d'impact.

Ne jamais inventer de trajectoire ni de position précise : les positions sont placées par l'admin et rattachées aux stuffs. Fiche détaillée : image de départ + image du point de visée, technique, étapes pas à pas, vidéo si disponible, date de vérification, lien partageable, et mode entraînement plein écran pour une consultation rapide.

Gestion éditoriale : ajout/modification/suppression/publication depuis admin, upload autorisé dans Supabase Storage avec contrôles type/taille, option de lien vidéo et protection contre les URL dangereuses, placement des positions de lancer et des points d'impact sur la vue aérienne. Afficher la dernière date de vérification pour détecter les stuffs obsolètes après patch. Ne pas copier massivement des médias externes sans droits.

### 5.7 Administration

Supabase Auth avec un **compte unique** d'identifiant `admin` (décision du 14/10/2026) : aucune inscription, mot de passe défini par le propriétaire lui-même (jamais dans un chat ni dans le code). Vérification serveur de session/rôle sur chaque route d'écriture et RLS ; service role jamais exposé au navigateur. Panel : joueurs (classement permanent), Mur des lamentations, clips, crosshairs, maps (images, ordre, visibilité), positions de la carte tactique, stuffs, jobs/état synchronisation. Formulaires validés côté serveur ; toasts/états explicites ; confirmation suppression ; journal minimal des erreurs d'import.

### 5.8 Mur des lamentations

Page `/mur-des-lamentations`, **publique** (décision du 14/10/2026), en deux parties :
- **Banlist** (à gauche) : joueurs FACEIT avec lesquels la team ne souhaite plus jouer, présentés en affiches « WANTED / Recherché » (pseudo, avatar, lien FACEIT, niveau et ELO s'ils sont disponibles, date d'ajout), recherche et compteur. Ce n'est pas une sanction FACEIT et cela ne doit jamais être présenté ainsi.
- **Wall of Shame** (à droite) : classement automatique, sur les **30 derniers jours**, de statistiques « honteuses » des seuls joueurs **Team** du roster (au plus 5 catégories aux surnoms drôles), calculé à partir des statistiques de match FACEIT réellement renvoyées. Les joueurs concernés sont d'accord ; ton de chambrage amical, jamais d'insulte.

Visibilité : publique ; seules les notes internes restent réservées à l'admin (serveur + RLS). Administration de la Banlist : ajout par pseudo ou URL avec vérification du profil avant confirmation, doublons refusés par identifiant FACEIT, archivage et retrait, note interne facultative visible des **seuls admins**. Jamais de motif ni d'accusation nominative publiés. L'ajout au Mur ne donne aucun accès et n'ajoute le joueur ni au classement ni au roster.

## 6. Modèle de données minimal proposé

- `players` : id, faceit_id unique, nickname, avatar_url, faceit_url, group, active, added_elo, added_at (ELO et date d'ajout au classement), twitch_url, youtube_url, allstar_url, created_at.
- Pas de tables `elo_runs` ni `elo_run_participants` : le classement est permanent (décision du 13/10/2026).
- `elo_snapshots` : id, player_id, elo, measured_at, source ; index(player_id, measured_at).
- `matches` : id, faceit_match_id unique, status, map, started_at, finished_at, score_json nullable, faceit_url, last_checked_at, source.
- `match_players` : match_id, player_id ; unique(match_id, player_id).
- `clips` : id, player_id, match_id nullable, provider, external_id nullable, source_url, thumbnail_url, title, map_id nullable, published_at, moderation_status, created_at ; unique(provider, external_id) when external_id exists.
- `crosshairs` : id, player_id nullable, label, share_code, preview_url nullable, game_version nullable, verified_at nullable, is_published, created_at.
- `maps` : id, slug unique, name, cover_url (vraie capture), aerial_url (vue aérienne), active, sort_order.
- `map_positions` : id, map_id, name, x, y (en % de la vue aérienne), created_at.
- `utilities` : id, map_id, title, side, grenade_type, origin_name, target_name, purpose, description, technique, difficulty, tags, image_urls, video_url, verified_at, published, throw_position_id nullable, landing_x/landing_y nullables, created_at, updated_at.
- `avoid_list_entries` : id, faceit_player_id unique, status actif/archivé, added_by, created_at ; `avoid_list_private_notes` : entry_id, note (admins uniquement).
- `admin_profiles` : user_id, role ; ne pas utiliser un booléen fourni par le client pour authentifier l'admin.

Adapter le SQL au vrai besoin sans sur-ingénierie ; prévoir migrations, contraintes, index, politiques RLS, données de démo clairement marquées.

## 7. Architecture et routes

Pages publiques : `/`, `/elo-run`, `/matches`, `/clips`, `/crosshairs`, `/stuffs`, `/stuffs/[mapSlug]`, `/team`, `/players/[playerId]`.

Le Mur `/mur-des-lamentations` est public depuis le 14/10/2026.

Privées : `/admin`, `/admin/players`, `/admin/mur`, `/admin/clips`, `/admin/crosshairs`, `/admin/maps`, `/admin/stuffs`, `/admin/sync`.

Code : `src/lib/faceit/` (client API, schémas, adaptateurs, mapping statut), `src/lib/elo/` (calculs), `src/lib/clips/providers/`, `src/lib/supabase/`, `src/components/`, `src/app/`, `src/jobs/` ou Edge Functions documentées. Séparer UI, logique métier, accès aux données et tâches de synchronisation.

Secrets `.env.local` ; créer `.env.example` SANS secrets (par exemple `FACEIT_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, etc.). Supabase service key côté serveur exclusivement. Bloquer les URL internes/localhost si récupération de miniatures côté serveur ; utiliser une allowlist provider pour les embeds.

## 8. Découpage de livraison : une étape à la fois

### Phase A — Fondations + maquette navigable

Créer le projet, layout responsive, design system, navigation, pages cohérentes et composants réutilisables. Données de démonstration **clairement étiquetées**. Validation lint/typecheck. Ne pas faire semblant d'avoir des données live.

### Phase B — Supabase, auth et joueurs

Schéma + migrations + RLS + admin/login. CRUD joueurs avec résolution vraie FACEIT. Tests et `.env.example`. Confirmer que le panel permet d'ajouter/supprimer un joueur et que le public voit les changements.

### Phase C — Classement ELO permanent

Synchronisation FACEIT serveur, relevé à l'ajout puis snapshots, classement (ELO actuel / progression depuis l'ajout) et graphique, date de mise à jour, actualisation manuelle limitée, états d'erreur. Tests mathématiques du delta (actuel − ajout) et déduplication des joueurs.

### Phase D — Matchs FACEIT

Faire le **spike de faisabilité LIVE** puis implémenter seulement la source vérifiée ; webhooks si réellement accessibles. Construire aussi les derniers matchs. Tests mapping de statut, déduplication de match commun, gestion d'indisponibilité API.

### Phase E — Stuffs puis crosshairs

Bibliothèque éditoriale par map avec vraies images, carte tactique (positions placées par l'admin), upload/embeds et recherche, CRUD admin. Crosshair presets + copie, compatibilité avec la version actuelle. Ne passer au générateur avancé qu'après validation réelle.

### Phase F — Clips puis finitions

V1 clips par liens admin, tri et filtres, embeds sûrs. Ajouter la synchronisation automatique uniquement après preuve d'accès API/partenariat. SEO, accessibilité, optimisation images, suivi d'erreurs, tests e2e et instructions déploiement.

## 9. Critères d'acceptation

- Le visiteur consulte toutes les pages sans compte ; mobile utilisable et aucun overflow horizontal.
- L'admin ajoute un joueur FACEIT, voit un profil correctement résolu, et le joueur apparaît immédiatement au classement à son ELO actuel avec une progression de 0.
- Le Mur des lamentations est public, mais les notes internes ne sortent jamais pour un non-admin ; le Wall of Shame ne montre que des stats FACEIT réelles des joueurs Team sur 30 jours.
- L'ELO Run affiche **source, horodatage et delta exact** à partir d'une base stockée.
- Les matchs en cours reflètent un statut vérifié, sinon une incertitude explicite ; plusieurs membres dans une même game = une seule carte de match.
- L'admin ajoute un stuff à une map, lui associe un type et un média, le publie ; la recherche/filtres et la page map le retrouvent ; s'il est rattaché à une position, la carte tactique l'affiche.
- L'admin peut ajouter un crosshair et copier son code ; la compatibilité actuelle du code est mentionnée.
- Les clips s'affichent avec leur source, leur auteur et leurs droits d'embed respectés. Aucun import prétendument automatique non prouvé.
- Tests unitaires de règles métier + un test e2e pour ajout joueur/admin/filtre stuff ; pas d'erreur de typecheck/lint ; clés absentes du bundle client ; README avec instructions locales et déploiement.

## 10. Règles de collaboration avec Claude Code

1. **Au départ, NE CODE PAS IMMÉDIATEMENT.** Résume le besoin, identifie 3 à 5 risques, vérifie dépendances et versions, propose une arborescence, schéma des données et un plan par phases ; pose seulement les questions bloquantes.
2. Après mon feu vert, implémente **une phase à la fois** avec fichiers réellement créés et exécutables.
3. À chaque phase : expliquer les modifications, commandes exécutées, résultats (ou blocage), tests et prochaines étapes. Ne déclare pas « terminé » sans exécuter les contrôles disponibles.
4. Ne contourne pas une API en inventant des endpoints ou en scrapant des sessions authentifiées. Précise les inconnues et fournis un fallback honnête.
5. Évite les TODO masqués, les placeholders présentés comme fonctionnels et les données artificielles en production.
6. Avant toute opération destructrice, modification de sécurité ou déploiement public, demande confirmation.
7. Ne demande jamais que je colle une clé secrète dans le chat ; explique comment la placer dans les variables d'environnement et vérifier son fonctionnement localement.
8. Favorise du code maintenable, petites fonctions testables et documentation à jour plutôt qu'une démonstration spectaculaire mais fragile.

## 11. Questions à poser au propriétaire au début

- Nom du site / de la team et préférence visuelle (couleur principale, logo existant ou non).
- Première liste de pseudos/URLs FACEIT et nombre de joueurs à suivre.
- Site public ou réservé à quelques personnes ?
- ELO Run : tranché le 13/10/2026, classement permanent trié par ELO actuel, avec tri alternatif par progression depuis l'ajout.
- Stuffs : médias déjà disponibles ou faudra-t-il commencer avec du contenu créé par la team ?
- Hébergement et budget mensuel approximatif ; accès ou non à des API/partenariats clips.

Ces questions ne doivent pas empêcher de commencer le cadrage et la maquette tant que les choix provisoires sont clairement indiqués.
