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
2. **Créer les tables et les règles d'accès.** Dans **SQL Editor**, exécute un par un, dans l'ordre, les fichiers de `supabase/migrations/` (0100 → 1100). N'exécute ni `supabase/local/*`, ni `cron.sql` à cette étape.
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
4. **Créer les comptes.** Dans **Authentication › Users › Add user › Create new user**, saisis l'e-mail et le mot de passe, et coche *Auto Confirm User*.
5. **Attribuer les rôles** dans SQL Editor, en remplaçant l'e-mail :
   ```sql
   insert into public.profiles (user_id, role, display_name)
   select id, 'admin', 'Flo' from auth.users where email = 'ton-email@exemple.fr';
   ```
   Utilise `'member'` à la place de `'admin'` pour un membre : il voit le Mur, mais ni l'administration ni les motifs.
6. **Récupérer les clés** dans **Project Settings › API Keys** et les reporter dans `.env.local` :
   ```
   LFE_DATA_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   SUPABASE_SECRET_KEY=sb_secret_…
   ```
   La clé publishable est publique par nature. La clé **secret** reste côté serveur : elle ne sert qu'à la synchronisation.
7. Relance `npm run dev`, connecte-toi sur `/connexion`, puis ajoute un joueur et une entrée au Mur.

## 4. Mise en ligne (Vercel)

Une mise en ligne rend le site public. Fais-la toi-même quand tu es prêt :

1. Importe le projet sur Vercel.
2. Renseigne les variables d'environnement : les mêmes que `.env.local` en mode `supabase`, plus `CRON_SECRET` et `SITE_URL`. Ne mets jamais `LFE_DATA_BACKEND=local`.
3. Génère `CRON_SECRET` sur ton PC, puis copie la valeur directement dans Vercel :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Après le premier déploiement, exécute `supabase/cron.sql` dans SQL Editor, avec ton adresse et le même `CRON_SECRET`.
5. Vérifie dans Admin › Synchronisation que les passages apparaissent toutes les 5 minutes.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run check` | types, lint et tests unitaires/base de données |
| `npm run test:e2e` | parcours complets dans Chrome (base `.data/e2e` dédiée) |
| `npm run sync` | synchronisation FACEIT manuelle (arrête `npm run dev` en mode local) |
| `npm run faceit:check -- <pseudo>` | test réel de ta clé FACEIT |
| `npm run local:reset [-- --demo]` | réinitialise la base locale |
