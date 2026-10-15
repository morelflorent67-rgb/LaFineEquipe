# Import des stuffs csnades.gg

## Autorisation

Le propriétaire du site (Florent) a obtenu de csnades.gg une **autorisation écrite** de reprendre l'intégralité de leurs stuffs, vidéos et images comprises, et de les afficher depuis leurs serveurs (décision du 15/10/2026). Garder une copie de cet accord hors du dépôt. Chaque fiche importée affiche sa source et un lien vers la page d'origine.

## Ce qui est importé

Pour les 8 maps du site (Mirage, Inferno, Dust II, Ancient, Nuke, Anubis, Overpass, Train), uniquement les stuffs **officiels** de csnades (les « community nades », masquées par défaut chez eux, ne sont pas reprises) :

| csnades | Chez nous |
|---|---|
| `throwFrom` / `throwTo` / `bounces` (grille 0–1000 de leur vue aérienne, + étage) | `throw_x/y`, `landing_x/y`, `bounces` en % de la vue aérienne, `throw_level` / `landing_level` |
| `radars` (type `game`, un par étage) | table `map_radars` (image + calque des noms de zones) |
| `titleTo` / `titleFrom` | `target_name` / `origin_name` (noms en anglais, comme en jeu), titre « B Short depuis Back Alley » |
| `team` t / ct / any | `side` T / CT / BOTH |
| `type` smoke / molotov / flashbang / he | `grenade` smoke / molotov / flash / he |
| `technique` left, right, both (+ `_jump`) | `throw_click` + `jump` |
| `movement` stationary, walking, running, crouched_stationary, crouched_walking | `movement` (+ `technique` simplifiée pour les filtres) |
| `precision` loose / precise / very_precise | `precision` |
| `beginner` | `difficulty = easy` ; sinon difficulté non précisée (jamais devinée) |
| sous-titres de la vidéo (WebVTT) | `steps` **traduites en français** + `step_times` (début de chaque étape dans la vidéo) |
| `console` (setpos/setang) | `console_cmd` (ignorée si ce n'est pas une vraie commande) |
| `timings.airTime` | `air_time` (secondes) |
| vidéos HQ/LQ, miniature, capture de visée | `media` (URL `assets.csnades.gg` uniquement, contrôlé en base) |
| `attribution`, `updatedAt` | `credit`, `source_updated_at` |

Une valeur inconnue (nouvelle technique, nouveau camp…) **fait échouer l'import** au lieu d'être devinée : il faut alors l'ajouter consciemment dans `src/lib/csnades/normalize.ts` et dans la migration.

Les traductions sont dans `src/lib/csnades/steps.fr.json` (anglais → français). Une étape sans traduction reste en anglais et est listée dans `.data/csnades/missing-translations.json`.

## Commandes

```bash
npm run csnades -- fetch      # télécharge les pages (1 par seconde) dans .data/csnades (cache)
npm run csnades -- analyze    # valeurs rencontrées, étapes à traduire
npm run csnades -- import     # essai à blanc : vérifie tout, n'écrit rien
npm run csnades -- import --apply   # écrit dans la base de .env.local
```

- `--maps mirage,nuke` limite à certaines maps ; `fetch --refresh` ignore le cache.
- Relançable : un stuff déjà importé est mis à jour (son état publié/brouillon est conservé) ; un stuff qui a disparu de csnades repasse en brouillon.
- Tester sur une base locale séparée, sans toucher à Supabase :
  `LFE_DATA_BACKEND=local LFE_LOCAL_DATA_DIR=.data/pglite-csnades npm run csnades -- import --apply`

## Mise en ligne

1. Coller la migration `20261015002000_csnades_lineups.sql` dans l'éditeur SQL de Supabase.
2. `npm run csnades -- import --apply` (avec `.env.local` sur Supabase).
3. Pour une mise à jour plus tard : `fetch --refresh` puis `import --apply`.
