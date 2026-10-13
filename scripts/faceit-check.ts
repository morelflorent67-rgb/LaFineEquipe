/**
 * Vérifie la connexion réelle à la FACEIT Data API avec TA clé (lue dans .env.local).
 *   npm run faceit:check -- <pseudo | lien de profil | identifiant>
 * Affiche le profil analysé, les 5 derniers matchs (statuts bruts) et ce que contiennent
 * réellement les détails du dernier match (map, score) : base de docs/faceit-feasibility.md.
 * La clé n'est jamais affichée.
 */
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const { createFaceitClient } = await import('../src/lib/faceit/client');
  const { parseFaceitInput } = await import('../src/lib/faceit/input');
  const { resolveFaceitPlayer } = await import('../src/lib/faceit/resolve');
  const { FaceitError, FACEIT_ERROR_LABELS } = await import('../src/lib/faceit/errors');
  const { mapFromVoting, mapMatchStatus, roundScoreFromStats } = await import('../src/lib/faceit/match-mapping');

  const arg = process.argv.slice(2).join(' ').trim();
  if (!arg) {
    console.log('Usage : npm run faceit:check -- <pseudo | lien FACEIT | identifiant>');
    process.exit(1);
  }
  const client = createFaceitClient();
  console.log(`Mode FACEIT : ${client.mode}${client.mode === 'fixtures' ? ' (profils fictifs, aucun appel réseau)' : ''}`);
  const parsed = parseFaceitInput(arg);
  if (!parsed.ok) throw new Error(parsed.reason);

  try {
    const res = await resolveFaceitPlayer(parsed.input);
    if (res.status === 'not_found') {
      console.log(`Profil introuvable. Suggestions : ${res.suggestions.map((s) => s.nickname).join(', ') || 'aucune'}`);
      return;
    }
    const p = res.profile;
    console.log('\nProfil');
    console.log(`  pseudo         ${p.nickname}  (trouvé via ${res.via})`);
    console.log(`  identifiant    ${p.faceitPlayerId}`);
    console.log(`  avatar         ${p.avatarUrl ? 'oui (CDN FACEIT)' : p.avatarRejected ? 'refusé (hôte non autorisé)' : 'absent'}`);
    console.log(`  CS2            ${p.hasCs2 ? `niveau ${p.cs2Level ?? '—'}, ELO ${p.cs2Elo ?? '—'}` : 'pas de données CS2'}`);

    const history = await client.playerHistory(p.faceitPlayerId, { limit: 5 });
    console.log(`\nHistorique CS2 (${history.items.length} matchs)`);
    for (const m of history.items) {
      console.log(
        `  ${m.match_id}  statut brut=${m.status ?? '∅'} → ${mapMatchStatus(m.status)}  début=${m.started_at ?? '∅'} fin=${m.finished_at ?? '∅'} vainqueur=${m.results?.winner ?? '∅'}`,
      );
    }
    const last = history.items[0];
    if (last) {
      const match = await client.match(last.match_id);
      const map = mapFromVoting(match.voting);
      console.log('\nDétails du dernier match');
      console.log(`  statut brut    ${match.status ?? '∅'}`);
      console.log(`  map            ${map ? `${map.mapKey} (${map.mapName ?? 'nom absent'})` : 'introuvable dans « voting »'}`);
      try {
        const stats = await client.matchStats(last.match_id);
        const score = roundScoreFromStats(stats, {
          faction1: match.teams?.faction1?.faction_id ?? null,
          faction2: match.teams?.faction2?.faction_id ?? null,
        });
        console.log(`  score manches  ${score ? `${score.faction1} - ${score.faction2}` : 'non lisible (champ « Final Score » absent ?)'}`);
      } catch (err) {
        console.log(`  score manches  indisponible (${err instanceof FaceitError ? err.kind : 'erreur'})`);
      }
    }
  } catch (err) {
    if (err instanceof FaceitError) {
      console.error(`Échec FACEIT : ${FACEIT_ERROR_LABELS[err.kind]}`);
      process.exit(2);
    }
    throw err;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
