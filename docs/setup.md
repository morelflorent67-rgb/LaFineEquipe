# Mise en route

Deux façons de faire tourner le site :

| Mode | Pour quoi | Données | FACEIT |
|---|---|---|---|
| `LFE_DATA_BACKEND=local` | développer et tester sur ton PC | base PostgreSQL embarquée dans `.data/` (mêmes migrations et mêmes règles d'accès que Supabase) | `FACEIT_MODE=fixtures` (profils fictifs « demo_… ») ou `live` (vraie API avec ta clé) |
| `LFE_DATA_BACKEND=supabase` | le vrai site | ton projet Supabase | `FACEIT_MODE=live` obligatoire |

Le mode local est refusé en production, et les profils fictifs sont refusés avec Supabase.

## 1. Lancer en local (aucun compte requis)

```bash
npm install
```

`.env.local` existe déjà : mode local avec la **vraie API FACEIT** depuis le 13/10/2026. Sinon, copie `.env.example` en `.env.local`.

```bash
npm run dev
```

Ouvre http://localhost:3000. Sur `/connexion`, choisis un compte local : Admin, Membre, ou un compte sans rôle pour tester le cas « connecté mais non autorisé ».

- La base locale `.data/pglite` contient les **vrais joueurs** importés depuis FACEIT. Tant que `npm run dev` tourne avec `FACEIT_MODE=live`, le serveur relit FACEIT **toutes les 5 minutes** (profils puis matchs ; voir `src/instrumentation.ts`, désactivable avec `LFE_LOCAL_CRON=off`). Le bouton **Actualiser** de l'ELO Run et **Admin › Synchronisation** restent disponibles. Site arrêté = pas de synchro : la page affiche alors l'heure du dernier relevé.
- Les images des maps (capture et vue aérienne) et les positions de la carte tactique se gèrent dans **Admin › Maps**. En local, les fichiers sont rangés dans `.data/media` (non versionné).
- L'ancienne base de démonstration, avec ses profils fictifs « demo_… », est conservée dans `.data/pglite-demo`. Pour la consulter, arrête `npm run dev`, puis lance-le dans PowerShell avec :
  ```powershell
  $env:LFE_LOCAL_DATA_DIR='.data/pglite-demo'; $env:FACEIT_MODE='fixtures'; npm run dev
  ```
- `npm run local:reset` vide la base locale, et `npm run local:reset -- --demo` la remplace par la démonstration. **Les deux effacent les joueurs importés.** Arrête `npm run dev` avant.

## 2. Brancher la vraie API FACEIT

*Fait le 13/10/2026 : clé configurée, 10 joueurs importés, synchro réussie. Constats dans [faceit-feasibility.md](faceit-feasibility.md). Les étapes restent utiles pour changer de clé.*

1. Va sur https://developers.faceit.com et connecte-toi avec ton compte FACEIT.
2. Ouvre **App Studio**, crée une application, puis **API Keys › Create** avec le type **Server side**.
3. Ouvre `.env.local` dans ton éditeur et renseigne :
   ```
   FACEIT_API_KEY=ta-cle
   FACEIT_MODE=live
   ```
   Ne colle jamais la clé dans un chat, un ticket ou un fichier versionné.
4. Vérifie la connexion avec ton pseudo. La commande affiche ton profil, tes 5 derniers matchs et ce que FACEIT renvoie réellement (map, score) :
   ```bash
   npm run faceit:check -- TonPseudo
   ```
5. Relance `npm run dev`. Dans Admin › Joueurs, ajoute ton vrai profil, puis recharge la page pour vérifier qu'il est bien enregistré.

En mode local avec `FACEIT_MODE=live`, les profils réels sont enregistrés dans la base locale, sur ton PC uniquement.

## 3. Créer le projet Supabase

1. Crée un projet sur https://supabase.com, région Europe (Paris ou Francfort).
2. **Créer les tables et les règles d'accès.** Dans **SQL Editor**, exécute un par un, dans l'ordre, les fichiers de `supabase/migrations/` (0100 → 1600). N'exécute ni `supabase/local/*`, ni `cron.sql` à cette étape.
   Alternative en ligne de commande :
   ```bash
   npx supabase link --project-ref TON_REF
   ```
   ```bash
   npx supabase db push
   ```
3. **Fermer les inscriptions.** Dans **Authentication › Sign In / Providers › Email** :
   - laisse **Email** activé ;
   - **désactive** « Allow new users to sign up ».
   Même si les inscriptions restaient ouvertes, un compte sans rôle n'a aucun accès. Les fermer évite tout de même les comptes parasites.
4. **Créer le compte admin unique.** Dans **Authentication › Users › Add user › Create new user** : saisis une adresse e-mail que tu contrôles (elle sert aussi à réinitialiser le mot de passe), choisis toi-même le mot de passe (long, unique, jamais écrit dans un chat ni dans le code) et coche *Auto Confirm User*. Il n'y a qu'un seul compte : pas de comptes membres.
5. **Lui donner le rôle admin** dans SQL Editor, en remplaçant l'e-mail :
   ```sql
   insert into public.profiles (user_id, role, display_name)
   select id, 'admin', 'Admin' from auth.users where email = 'ton-email@exemple.fr';
   ```
   Seul le rôle `admin` existe (la base refuse toute autre valeur).
6. **Récupérer les clés** dans **Project Settings › API Keys** et les reporter dans `.env.local` :
   ```
   LFE_DATA_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   SUPABASE_SECRET_KEY=sb_secret_…
   LFE_ADMIN_EMAIL=ton-email@exemple.fr
   ```
   `LFE_ADMIN_EMAIL` est l'e-mail du compte créé à l'étape 4 : sur `/connexion`, tu tapes l'identifiant **admin** et ton mot de passe, le serveur fait la correspondance. Supabase limite d'office les tentatives de connexion répétées.
   La clé publishable est publique par nature. La clé **secret** reste côté serveur : elle ne sert qu'à la synchronisation.
7. Relance `npm run dev`, connecte-toi sur `/connexion`, puis ajoute un joueur et une entrée au Mur.

## 4. Mise en ligne (Netlify + fineequipe.com)

Mise en place réelle du 14/10/2026 : site sur Netlify (`super-brioche-43dc75.netlify.app`), base Supabase (Paris), domaine **fineequipe.com** chez OVH.

1. **Transférer les vraies données locales** (une fois, après les migrations) : arrête `npm run dev`, puis
   ```bash
   npm run transfer
   ```
   affiche ce qui serait copié sans rien écrire ;
   ```bash
   npm run transfer -- --apply
   ```
   copie réellement (relançable sans doublon). Les données de démo, les comptes et l'historique de synchro ne sont jamais copiés.
2. **Netlify** : Add new project › Import an existing project › GitHub › dépôt LaFineEquipe. `netlify.toml` fixe la compilation et Node 22. Chaque `git push` sur `main` redéploie.
3. **Variables d'environnement** (Site configuration › Environment variables › Import from a .env file) : `LFE_DATA_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `LFE_ADMIN_EMAIL`, `FACEIT_API_KEY`, `FACEIT_MODE=live`, `CRON_SECRET`, `SITE_URL=https://fineequipe.com`. Ne mets jamais `LFE_DATA_BACKEND=local`. Génère `CRON_SECRET` sur ton PC :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. **Synchro planifiée** : exécute `supabase/cron.sql` dans SQL Editor avec ton `CRON_SECRET` (relançable). Deux tâches toutes les 5 minutes, chacune dans sa propre requête : **Netlify coupe une requête après ~30 s** (constaté le 14/10/2026), la synchro des matchs s'arrête donc d'elle-même après 18 s et reprend au passage suivant. Vérifie dans Admin › Synchronisation que les passages arrivent.
5. **Domaine (DNS externe chez OVH)** : Netlify › Domain management › Add a domain › `fineequipe.com` (garder le domaine **sans www** comme principal : liens canoniques et synchro l'utilisent). Chez OVH › Zone DNS : un seul **A** `fineequipe.com` → `75.2.60.5`, **CNAME** `www` → `super-brioche-43dc75.netlify.app.`, **aucun AAAA** (Netlify ne gère pas l'IPv6), enregistrements MX/SPF des e-mails inchangés. Le certificat HTTPS est créé automatiquement par Netlify une fois la zone propagée. Référence : [DNS externe Netlify](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

### Référencement et partage des liens

`SITE_URL` doit être l'origine publique HTTPS, par exemple `https://ton-vrai-domaine.fr`, sans chemin ni paramètres. Les pages publiques l'utilisent pour leur lien canonique et le logo original dans les aperçus de partage. Sans origine publique valide, aucune URL absolue n'est inventée.

L'indexation est activée seulement en compilation/exécution de production, avec Supabase, sans profils fictifs, et hors aperçus de déploiement (Netlify `CONTEXT` ≠ `production`, ou Vercel). En local et sur les aperçus, les pages indiquent `noindex`, `robots.txt` interdit l'exploration et le sitemap est vide. Redéploie après une modification de la configuration : certaines métadonnées sont calculées au chargement des modules.

Le sitemap contient les sept entrées publiques principales : accueil, ELO Run, matchs, clips, crosshairs, stuffs et joueurs. Les fiches détaillées restent découvrables via leurs liens publics ; elles ne sont pas encore listées individuellement dans le sitemap. Le Mur, la connexion et l'administration restent non indexables et ne publient pas d'aperçu nominatif. Les règles robots ne remplacent pas l'authentification et la RLS déjà en place.

Après la mise en ligne, contrôler `/robots.txt`, `/sitemap.xml` et l'aperçu d'un lien sur la plateforme de partage souhaitée. Les plateformes peuvent conserver leur propre cache : les métadonnées du site ne garantissent pas un rafraîchissement immédiat de l'aperçu.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run check` | types, lint et tests unitaires/base de données |
| `npm run test:e2e` | parcours complets dans Chrome (base `.data/e2e` dédiée) |
| `npm run sync` | synchronisation FACEIT manuelle (arrête `npm run dev` en mode local) |
| `npm run faceit:check -- <pseudo>` | test réel de ta clé FACEIT |
| `npm run local:reset [-- --demo]` | réinitialise la base locale |
| `npm run transfer [-- --apply]` | copie unique des vraies données locales vers Supabase |
