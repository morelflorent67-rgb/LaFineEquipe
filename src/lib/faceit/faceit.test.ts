import { describe, expect, it } from 'vitest';
import { acceptAvatarUrl } from './avatar';
import { FaceitError } from './errors';
import { faceitProfileUrl, parseFaceitInput, shortFaceitId } from './input';
import {
  mapFromVoting,
  mapMatchStatus,
  matchRoomUrl,
  playerStatsFromMatchStats,
  roundScoreFromHistory,
  roundScoreFromStats,
  unixToIso,
} from './match-mapping';
import { toProfileInput } from './profile';
import { playerSchema } from './schemas';

const ID = '5ea07280-2399-4c7e-88ab-f2f7db0c449f';

describe('parseFaceitInput', () => {
  it('accepte un pseudo simple', () => {
    expect(parseFaceitInput('  s1mple_fan ')).toEqual({ ok: true, input: { kind: 'nickname', value: 's1mple_fan' } });
  });
  it('extrait le pseudo des liens de profil (langue, sous-pages, sans https)', () => {
    for (const url of [
      'https://www.faceit.com/fr/players/Pseudo-1',
      'https://www.faceit.com/en/players/Pseudo-1/stats/cs2',
      'faceit.com/players/Pseudo-1',
      'https://www.faceit.com/fr/players-modal/Pseudo-1',
    ]) {
      expect(parseFaceitInput(url)).toEqual({ ok: true, input: { kind: 'nickname', value: 'Pseudo-1' } });
    }
  });
  it('accepte les pseudos réels se terminant par « - » ou « _ »', () => {
    for (const nick of ['Le-D-', 'OxGn-', 'db_', 'its_J0E']) {
      expect(parseFaceitInput(`https://www.faceit.com/fr/players/${nick}`)).toEqual({ ok: true, input: { kind: 'nickname', value: nick } });
    }
  });
  it('reconnaît un identifiant FACEIT complet', () => {
    expect(parseFaceitInput(ID.toUpperCase())).toEqual({ ok: true, input: { kind: 'id', value: ID } });
  });
  it('refuse les autres sites, les liens sans profil et les saisies invalides', () => {
    expect(parseFaceitInput('https://evil.example/players/x').ok).toBe(false);
    expect(parseFaceitInput('https://www.faceit.com/fr/cs2/room/1-abc').ok).toBe(false);
    expect(parseFaceitInput('').ok).toBe(false);
    expect(parseFaceitInput('a').ok).toBe(false);
    expect(parseFaceitInput('pseudo avec espace').ok).toBe(false);
    expect(parseFaceitInput('x'.repeat(201)).ok).toBe(false);
  });
  it('raccourcit un identifiant pour l’affichage seulement', () => {
    expect(shortFaceitId(ID)).toBe('5ea07280');
    expect(faceitProfileUrl('a b')).toBe('https://www.faceit.com/fr/players/a%20b');
  });
});

describe('acceptAvatarUrl', () => {
  it('accepte uniquement le CDN FACEIT en HTTPS', () => {
    expect(acceptAvatarUrl('https://distribution.faceit-cdn.net/images/abc.jpeg')).toBe(
      'https://distribution.faceit-cdn.net/images/abc.jpeg',
    );
    expect(acceptAvatarUrl('https://assets.faceit-cdn.net/avatars/x.jpg')).not.toBeNull();
    expect(acceptAvatarUrl('http://assets.faceit-cdn.net/avatars/x.jpg')).toBeNull();
    expect(acceptAvatarUrl('https://faceit-cdn.net.evil.com/x.jpg')).toBeNull();
    expect(acceptAvatarUrl('https://user:pw@assets.faceit-cdn.net/x.jpg')).toBeNull();
    expect(acceptAvatarUrl('javascript:alert(1)')).toBeNull();
    expect(acceptAvatarUrl('')).toBeNull();
    expect(acceptAvatarUrl(null)).toBeNull();
  });
  it('n’accepte les avatars fictifs locaux qu’en mode fixtures', () => {
    expect(acceptAvatarUrl('/dev-fixtures/avatar-01.svg')).toBeNull();
    expect(acceptAvatarUrl('/dev-fixtures/avatar-01.svg', true)).toBe('/dev-fixtures/avatar-01.svg');
    expect(acceptAvatarUrl('/dev-fixtures/../secret.svg', true)).toBeNull();
  });
});

describe('toProfileInput', () => {
  const now = new Date('2026-10-12T10:00:00Z');
  it('reprend identifiant, pseudo, avatar, niveau et ELO CS2', () => {
    const p = toProfileInput(
      {
        player_id: ID.toUpperCase(),
        nickname: 'Pseudo',
        avatar: 'https://assets.faceit-cdn.net/avatars/a.jpg',
        country: 'FR',
        games: { cs2: { skill_level: 8, faceit_elo: 1788 } },
      },
      now,
    );
    expect(p).toMatchObject({
      faceitPlayerId: ID,
      nickname: 'Pseudo',
      avatarUrl: 'https://assets.faceit-cdn.net/avatars/a.jpg',
      country: 'fr',
      cs2Level: 8,
      cs2Elo: 1788,
      hasCs2: true,
      avatarRejected: false,
      fetchedAt: now.toISOString(),
    });
  });
  it('n’invente ni niveau ni ELO pour un profil sans CS2', () => {
    const raw = playerSchema.parse({ player_id: ID, nickname: 'x', avatar: '', games: { csgo: { skill_level: 10, faceit_elo: 3000 } } });
    const p = toProfileInput(raw, now);
    expect(p.cs2Level).toBeNull();
    expect(p.cs2Elo).toBeNull();
    expect(p.hasCs2).toBe(false);
    expect(p.avatarUrl).toBeNull();
    expect(p.avatarRejected).toBe(false);
  });
  it('ignore les valeurs CS2 hors limites et signale un avatar refusé', () => {
    const p = toProfileInput(
      { player_id: ID, nickname: 'x', avatar: 'https://evil.example/a.png', games: { cs2: { skill_level: 42, faceit_elo: -5 } } },
      now,
    );
    expect(p.cs2Level).toBeNull();
    expect(p.cs2Elo).toBeNull();
    expect(p.avatarRejected).toBe(true);
  });
  it('rejette un identifiant qui n’est pas un UUID', () => {
    expect(() => toProfileInput({ player_id: 'pas-un-uuid', nickname: 'x' }, now)).toThrow(FaceitError);
  });
});

describe('correspondance des matchs', () => {
  it('convertit les statuts connus et classe le reste en « unknown »', () => {
    expect(mapMatchStatus('FINISHED')).toBe('finished');
    expect(mapMatchStatus('finished')).toBe('finished');
    expect(mapMatchStatus('CANCELLED')).toBe('cancelled');
    expect(mapMatchStatus('ONGOING')).toBe('ongoing');
    expect(mapMatchStatus('SOMETHING_NEW')).toBe('unknown');
    expect(mapMatchStatus(null)).toBe('unknown');
  });
  it('construit un lien de salle FACEIT sûr', () => {
    expect(matchRoomUrl('https://www.faceit.com/{lang}/cs2/room/1-abc', '1-abc')).toBe('https://www.faceit.com/fr/cs2/room/1-abc');
    expect(matchRoomUrl('https://evil.example/room', '1-abc')).toBe('https://www.faceit.com/fr/cs2/room/1-abc');
    expect(matchRoomUrl(null, '1-abc')).toBe('https://www.faceit.com/fr/cs2/room/1-abc');
  });
  it('lit la map choisie dans « voting » de façon défensive', () => {
    expect(mapFromVoting({ map: { pick: ['de_mirage'], entities: [{ game_map_id: 'de_mirage', name: 'Mirage' }] } })).toEqual({
      mapKey: 'de_mirage',
      mapName: 'Mirage',
    });
    expect(mapFromVoting({ map: { pick: ['de_nuke'] } })).toEqual({ mapKey: 'de_nuke', mapName: null });
    expect(mapFromVoting({ map: { pick: ['<script>'] } })).toBeNull();
    expect(mapFromVoting('n’importe quoi')).toBeNull();
  });
  it('ne lit le score en manches que si la forme est reconnue', () => {
    const stats = { rounds: [{ teams: [{ team_id: 'a', team_stats: { 'Final Score': '13' } }, { team_id: 'b', team_stats: { 'Final Score': '9' } }] }] };
    expect(roundScoreFromStats(stats, { faction1: 'a', faction2: 'b' })).toEqual({ faction1: 13, faction2: 9 });
    expect(roundScoreFromStats(stats, { faction1: 'b', faction2: 'a' })).toEqual({ faction1: 9, faction2: 13 });
    expect(roundScoreFromStats(stats, { faction1: 'a', faction2: 'z' })).toBeNull();
    expect(roundScoreFromStats({ rounds: [] }, { faction1: 'a', faction2: 'b' })).toBeNull();
    expect(roundScoreFromStats(null, { faction1: 'a', faction2: 'b' })).toBeNull();
  });
  it('lit le score en manches de l’historique (forme constatée le 13/10/2026)', () => {
    expect(roundScoreFromHistory({ faction2: 13, faction1: 6 })).toEqual({ faction1: 6, faction2: 13 });
    expect(roundScoreFromHistory({ faction1: 11, faction2: 0 })).toEqual({ faction1: 11, faction2: 0 });
    expect(roundScoreFromHistory({ faction1: 13 })).toBeNull();
    expect(roundScoreFromHistory({ faction1: 1.5, faction2: 0 })).toBeNull();
    expect(roundScoreFromHistory(null)).toBeNull();
  });
  it('convertit les horodatages UNIX', () => {
    expect(unixToIso(1760000000)).toBe(new Date(1760000000 * 1000).toISOString());
    expect(unixToIso(0)).toBeNull();
    expect(unixToIso(undefined)).toBeNull();
  });
});

describe('playerSchema', () => {
  it('ignore les autres jeux du profil, même mal formés', () => {
    const parsed = playerSchema.parse({
      player_id: ID,
      nickname: 'x',
      games: { cs2: { skill_level: 10, faceit_elo: 2600, region: 'EU' }, clash_royale: { skill_level: 'n/a', faceit_elo: 1.5 } },
    });
    expect(parsed.games?.cs2?.faceit_elo).toBe(2600);
  });
});

describe('playerStatsFromMatchStats (forme constatée le 14/10/2026)', () => {
  const A = 'aaaaaaaa-0000-4000-8000-000000000001';
  const B = 'bbbbbbbb-0000-4000-8000-000000000002';
  const stats = {
    rounds: [
      {
        teams: [
          {
            players: [
              { player_id: A.toUpperCase(), player_stats: { Kills: '9', Deaths: '11', 'Headshots %': '44', ADR: '65.1', Result: '1' } },
              { player_id: 'inconnu', player_stats: { Kills: '30', Deaths: '5', 'Headshots %': '60', ADR: '120', Result: '1' } },
            ],
          },
          { players: [{ player_id: B, player_stats: { Kills: '3', Deaths: '18', 'Headshots %': '0', Result: '0' } }] },
        ],
      },
    ],
  };
  it('extrait seulement les joueurs suivis, avec les valeurs telles quelles', () => {
    expect(playerStatsFromMatchStats(stats, new Set([A, B]))).toEqual([
      { faceitPlayerId: A, kills: 9, deaths: 11, headshotsPct: 44, adr: 65.1, won: true },
      { faceitPlayerId: B, kills: 3, deaths: 18, headshotsPct: 0, adr: null, won: false },
    ]);
  });
  it('ignore un joueur aux stats incomplètes ou absurdes, et toute forme inattendue', () => {
    const broken = { rounds: [{ teams: [{ players: [{ player_id: A, player_stats: { Kills: 'x', Deaths: '2', 'Headshots %': '10' } }] }] }] };
    expect(playerStatsFromMatchStats(broken, new Set([A]))).toEqual([]);
    const absurd = { rounds: [{ teams: [{ players: [{ player_id: A, player_stats: { Kills: '5', Deaths: '2', 'Headshots %': '140' } }] }] }] };
    expect(playerStatsFromMatchStats(absurd, new Set([A]))).toEqual([]);
    expect(playerStatsFromMatchStats({ rounds: [] }, new Set([A]))).toEqual([]);
    expect(playerStatsFromMatchStats(null, new Set([A]))).toEqual([]);
  });
});
