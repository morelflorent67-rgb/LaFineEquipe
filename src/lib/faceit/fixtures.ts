/**
 * JEU D'ESSAI FICTIF — utilisé seulement avec FACEIT_MODE=fixtures (dev local et tests).
 * Ces profils n'existent pas sur FACEIT : pseudos préfixés « demo_ », identifiants
 * d00000…, avatars dessinés localement. Le format imite les réponses documentées de la
 * Data API v4 pour tester le parcours sans clé ni réseau. Jamais utilisé en production.
 */

type FixturePlayer = {
  id: string;
  nickname: string;
  avatar: string;
  country: string;
  cs2: { level: number; elo: number } | null;
  /** Simule une panne FACEIT pour ce profil. */
  fails?: 503 | 429;
};

const id = (n: number) => `d0000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const av = (n: number) => `/dev-fixtures/avatar-${n.toString().padStart(2, '0')}.svg`;

export const FIXTURE_PLAYERS: FixturePlayer[] = [
  { id: id(1), nickname: 'demo_alpha', avatar: av(1), country: 'fr', cs2: { level: 10, elo: 2412 } },
  { id: id(2), nickname: 'demo_bravo', avatar: av(2), country: 'fr', cs2: { level: 9, elo: 1987 } },
  { id: id(3), nickname: 'demo_charlie', avatar: av(3), country: 'be', cs2: { level: 8, elo: 1788 } },
  { id: id(4), nickname: 'demo_delta', avatar: av(4), country: 'fr', cs2: { level: 7, elo: 1605 } },
  { id: id(5), nickname: 'demo_echo', avatar: av(5), country: 'ch', cs2: { level: 6, elo: 1452 } },
  { id: id(6), nickname: 'demo_foxtrot_longpseudo', avatar: av(6), country: 'fr', cs2: { level: 5, elo: 1311 } },
  { id: id(7), nickname: 'demo_golf', avatar: av(7), country: 'fr', cs2: { level: 8, elo: 1702 } },
  { id: id(8), nickname: 'demo_hotel', avatar: av(8), country: 'ca', cs2: { level: 4, elo: 1188 } },
  // Profils pour le Mur
  { id: id(11), nickname: 'demo_kilo', avatar: av(11), country: 'fr', cs2: { level: 6, elo: 1420 } },
  { id: id(12), nickname: 'demo_lima', avatar: av(12), country: 'de', cs2: { level: 3, elo: 905 } },
  { id: id(13), nickname: 'demo_mike', avatar: av(13), country: 'fr', cs2: { level: 9, elo: 2010 } },
  { id: id(14), nickname: 'demo_november', avatar: av(14), country: 'es', cs2: { level: 7, elo: 1560 } },
  { id: id(15), nickname: 'demo_oscar', avatar: av(15), country: 'fr', cs2: { level: 5, elo: 1260 } },
  { id: id(16), nickname: 'demo_papa', avatar: av(16), country: 'pl', cs2: { level: 10, elo: 2205 } },
  { id: id(17), nickname: 'demo_quebec', avatar: av(17), country: 'ca', cs2: { level: 2, elo: 780 } },
  { id: id(18), nickname: 'demo_romeo', avatar: av(18), country: 'fr', cs2: { level: 6, elo: 1398 } },
  // Cas particuliers
  { id: id(21), nickname: 'demo_yankee', avatar: av(19), country: 'fr', cs2: { level: 7, elo: 1633 } },
  { id: id(22), nickname: 'demo_sansavatar', avatar: '', country: 'fr', cs2: { level: 4, elo: 1101 } },
  { id: id(23), nickname: 'demo_sanscs2', avatar: av(20), country: 'fr', cs2: null },
  {
    id: id(24),
    nickname: 'demo_avatarcasse',
    avatar: 'https://distribution.faceit-cdn.net/images/lfe-fixture-image-inexistante.jpeg',
    country: 'fr',
    cs2: { level: 5, elo: 1250 },
  },
  { id: id(25), nickname: 'demo_panne', avatar: av(10), country: 'fr', cs2: { level: 6, elo: 1400 }, fails: 503 },
  { id: id(26), nickname: 'demo_quota', avatar: av(9), country: 'fr', cs2: { level: 6, elo: 1400 }, fails: 429 },
];

function playerBody(p: FixturePlayer, now: Date) {
  // Petite variation déterministe par heure pour tester les relevés successifs.
  const drift = p.cs2 ? ((now.getUTCHours() * 7 + Number(p.id.slice(-2)) * 13) % 31) - 15 : 0;
  return {
    player_id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    country: p.country,
    faceit_url: `https://www.faceit.com/{lang}/players/${p.nickname}`,
    games: p.cs2 ? { cs2: { skill_level: p.cs2.level, faceit_elo: p.cs2.elo + drift, region: 'EU' } } : {},
  };
}

const MAPS = ['de_mirage', 'de_inferno', 'de_ancient', 'de_nuke', 'de_anubis', 'de_dust2', 'de_train'];

/** Matchs fictifs partagés entre plusieurs joueurs (pour tester la déduplication). */
function fixtureMatches(now: Date) {
  const roster = FIXTURE_PLAYERS.slice(0, 8);
  const out = [];
  for (let i = 0; i < 6; i++) {
    const finished = Math.floor(now.getTime() / 1000) - (i + 1) * 5400;
    const a = roster[i % 8]!;
    const b = roster[(i + 3) % 8]!;
    const winner = i % 3 === 1 ? 'faction2' : 'faction1';
    out.push({
      match_id: `1-d0000000-0000-4000-8000-${(900 + i).toString().padStart(12, '0')}`,
      status: i === 4 ? 'CANCELLED' : 'FINISHED',
      started_at: finished - 2400,
      finished_at: i === 4 ? null : finished,
      competition_name: '5v5 RANKED',
      faceit_url: `https://www.faceit.com/{lang}/cs2/room/1-d0000000-0000-4000-8000-${(900 + i).toString().padStart(12, '0')}`,
      // Comme l'API réelle (constaté le 13/10/2026) : score de l'historique en manches.
      results: i === 4 ? null : { winner, score: winner === 'faction1' ? { faction1: 13, faction2: 8 } : { faction1: 9, faction2: 13 } },
      teams: {
        faction1: { team_id: 'f1', nickname: `team_${a.nickname}`, players: [{ player_id: a.id, nickname: a.nickname }, { player_id: b.id, nickname: b.nickname }] },
        faction2: { team_id: 'f2', nickname: 'team_adverse', players: [{ player_id: id(99), nickname: 'adversaire' }] },
      },
      _map: MAPS[i % MAPS.length] ?? 'de_mirage',
    });
  }
  return out;
}

export type FixtureResponse = { status: number; body: unknown; retryAfter: number | null };

/** Imite les routes de la Data API v4 utilisées par le site. */
/** Stats individuelles FICTIVES et déterministes (même forme texte que la vraie API). */
function fixtureStats(players: { player_id: string; nickname?: string }[], matchId: string, won: boolean) {
  return players.map((pl) => {
    let h = 0;
    for (const c of pl.player_id + matchId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const kills = 4 + (h % 24);
    return {
      player_id: pl.player_id,
      nickname: pl.nickname,
      player_stats: {
        Kills: String(kills),
        Deaths: String(6 + ((h >> 5) % 20)),
        'Headshots %': String(15 + ((h >> 9) % 55)),
        ADR: (40 + ((h >> 13) % 80) + ((h >> 3) % 10) / 10).toFixed(1),
        Result: won ? '1' : '0',
      },
    };
  });
}

export function fixtureRequest(path: string, query: Record<string, string>, now = new Date()): FixtureResponse {
  const ok = (body: unknown): FixtureResponse => ({ status: 200, body, retryAfter: null });
  const notFound: FixtureResponse = { status: 404, body: { errors: [{ message: 'not found' }] }, retryAfter: null };
  const failOf = (p: FixturePlayer): FixtureResponse | null =>
    p.fails ? { status: p.fails, body: {}, retryAfter: p.fails === 429 ? 60 : null } : null;

  if (path === '/players') {
    // Recherche exacte, sensible à la casse comme l'API réelle.
    const p = FIXTURE_PLAYERS.find((x) => x.nickname === query.nickname);
    if (!p) return notFound;
    return failOf(p) ?? ok(playerBody(p, now));
  }
  let m = path.match(/^\/players\/([^/]+)$/);
  if (m) {
    const p = FIXTURE_PLAYERS.find((x) => x.id === m![1]);
    if (!p) return notFound;
    return failOf(p) ?? ok(playerBody(p, now));
  }
  if (path === '/search/players') {
    const q = (query.nickname ?? '').toLowerCase();
    const items = FIXTURE_PLAYERS.filter((x) => x.nickname.includes(q))
      .slice(0, Number(query.limit ?? 5))
      .map((p) => ({
        player_id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        country: p.country,
        games: p.cs2 ? [{ name: 'cs2', skill_level: String(p.cs2.level) }] : [],
      }));
    return ok({ items, start: 0, end: items.length });
  }
  m = path.match(/^\/players\/([^/]+)\/history$/);
  if (m) {
    const p = FIXTURE_PLAYERS.find((x) => x.id === m![1]);
    if (!p) return notFound;
    if (p.fails) return failOf(p)!;
    const items = fixtureMatches(now)
      .filter((x) => Object.values(x.teams).some((t) => t.players.some((pl) => pl.player_id === p.id)))
      .map(({ _map, ...rest }) => (void _map, rest));
    return ok({ items, start: 0, end: items.length });
  }
  m = path.match(/^\/matches\/([^/]+)$/);
  if (m) {
    const match = fixtureMatches(now).find((x) => x.match_id === m![1]);
    if (!match) return notFound;
    const { _map, teams, ...rest } = match;
    return ok({
      ...rest,
      teams: {
        faction1: { faction_id: 'f1', name: teams.faction1.nickname, roster: teams.faction1.players },
        faction2: { faction_id: 'f2', name: teams.faction2.nickname, roster: teams.faction2.players },
      },
      voting: { map: { pick: [_map], entities: [{ game_map_id: _map, name: _map.replace('de_', '').replace(/^./, (c) => c.toUpperCase()) }] } },
    });
  }
  m = path.match(/^\/matches\/([^/]+)\/stats$/);
  if (m) {
    const match = fixtureMatches(now).find((x) => x.match_id === m![1]);
    if (!match || !match.results) return notFound;
    const w = match.results.winner === 'faction1';
    return ok({
      rounds: [
        {
          match_id: match.match_id,
          round_stats: { Map: match._map, Score: w ? '13 / 8' : '9 / 13' },
          teams: [
            { team_id: 'f1', team_stats: { 'Final Score': w ? '13' : '9' }, players: fixtureStats(match.teams.faction1.players, match.match_id, w) },
            { team_id: 'f2', team_stats: { 'Final Score': w ? '8' : '13' }, players: fixtureStats(match.teams.faction2.players, match.match_id, !w) },
          ],
        },
      ],
    });
  }
  return notFound;
}
