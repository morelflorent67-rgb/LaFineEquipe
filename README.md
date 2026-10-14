# LaFineEquipe

Site communautaire de la team CS2 LaFineEquipe : ELO Run FACEIT, matchs, joueurs, clips, crosshairs, stuffs par map et Mur des lamentations, avec une administration privée (compte unique « admin »).

- **Stack** : Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4, Radix (base accessible des composants), Supabase (Postgres, Auth, Storage, RLS), Zod, Vitest, Playwright.
- **Identité visuelle** : Forge. Référence à valider : `design/forge-v2-final/` (voir [docs/forge-v2-final.md](docs/forge-v2-final.md)) ; l'ancienne maquette `design/forge-v2/` est figée.
- **Source de vérité fonctionnelle** : `CLAUDE.md`.

## Démarrer

Le guide complet est dans [docs/setup.md](docs/setup.md). Pour lancer le site en local avec des données de démonstration :

```bash
npm install
```

```bash
npm run local:reset -- --demo
```

```bash
npm run dev
```

## Architecture

```
src/app/              pages (Accueil, ELO Run, Matchs, Joueurs, Stuffs, Mur, Admin…) et actions serveur
src/components/       composants Forge (Avatar unique, badges V/D, navigation, ELO, stuffs, admin)
src/lib/faceit/       client FACEIT serveur, validation des réponses, import de profils, jeu d'essai
src/lib/clips/        validation des liens vidéo et adaptateurs YouTube / Twitch / Allstar
src/lib/db/           accès aux données : Supabase en ligne, PostgreSQL embarqué (PGlite) en local
src/lib/elo/          classement, progression, historique journalier (testés)
src/lib/sync/         synchronisation FACEIT mutualisée (profils, ELO, matchs)
supabase/migrations/  schéma, règles d'accès RLS et fonctions SQL (identiques en local et en ligne)
tests/, e2e/          tests base de données + unitaires (Vitest), parcours navigateur (Playwright)
docs/                 mise en route, faisabilité FACEIT, livraisons
```

Toutes les lectures et écritures passent par des fonctions SQL soumises à la RLS, avec les droits de la personne connectée. Le rôle admin (compte unique) est lu en base et vérifié côté serveur à chaque action. Les clés FACEIT et Supabase « secret » ne sont jamais envoyées au navigateur.

## Contrôles

```bash
npm run check
```

```bash
npm run test:e2e
```
