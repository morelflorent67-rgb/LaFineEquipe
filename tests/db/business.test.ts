import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbError } from '@/lib/db/errors';
import { as, errorCode, freshDb, profile, rpc, sqlAs } from '../helpers/pg';

/** Règles métier en base : doublons, renommage, classement permanent, matchs, compteurs, pannes. */
let pg: PGlite;
beforeEach(async () => {
  pg = await freshDb();
});

describe('Mur : cycle de vie complet', () => {
  it('ajout → doublon refusé (même identifiant, autre pseudo) → archive → réactivation → suppression', async () => {
    const p = profile({ nickname: 'cible' });
    const { id } = await rpc(pg, as.admin, 'admin_add_avoid_entry', { p_profile: p, p_reason: 'Raison', p_status: 'active' });
    // Même identifiant FACEIT, pseudo différent : refusé (pas seulement par pseudo).
    expect(await errorCode(rpc(pg, as.admin, 'admin_add_avoid_entry', { p_profile: { ...p, nickname: 'cible_renommee' } }))).toBe('duplicate');

    await rpc(pg, as.admin, 'admin_update_avoid_entry', { p_entry_id: id, p_reason: 'Raison', p_status: 'archived' });
    expect(await rpc(pg, as.admin, 'list_avoid_entries', { p_status: 'active' })).toHaveLength(0);
    expect(await rpc(pg, as.admin, 'list_avoid_entries', { p_status: 'archived' })).toHaveLength(1);

    await rpc(pg, as.admin, 'admin_update_avoid_entry', { p_entry_id: id, p_reason: '', p_status: 'active' });
    const [entry] = await rpc(pg, as.admin, 'admin_list_avoid_entries', { p_status: 'all' });
    expect(entry.status).toBe('active');
    expect(entry.archivedAt).toBeNull();
    expect(entry.reason).toBeNull(); // motif vidé = note supprimée

    await rpc(pg, as.admin, 'admin_delete_avoid_entry', { p_entry_id: id });
    expect(await rpc(pg, as.admin, 'admin_list_avoid_entries', { p_status: 'all' })).toHaveLength(0);
    // Plus aucune copie du profil quand il n'est ni au roster ni sur le Mur.
    expect(await sqlAs(pg, as.service, 'select 1 from faceit_profiles where faceit_player_id = $1', [p.faceitPlayerId])).toHaveLength(0);
  });

  it('ajouter au Mur ne crée ni joueur du classement, ni relevé ELO, ni compte', async () => {
    await rpc(pg, as.admin, 'admin_add_avoid_entry', { p_profile: profile() });
    expect(await sqlAs(pg, as.service, 'select * from players')).toHaveLength(0);
    expect(await sqlAs(pg, as.service, 'select * from elo_snapshots')).toHaveLength(0);
    expect(await sqlAs(pg, as.service, 'select * from profiles')).toHaveLength(1); // seul le compte admin local de test
  });

  it('supprimer du Mur un joueur aussi présent au roster conserve son profil', async () => {
    const p = profile();
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'guest' });
    const { id } = await rpc(pg, as.admin, 'admin_add_avoid_entry', { p_profile: p });
    await rpc(pg, as.admin, 'admin_delete_avoid_entry', { p_entry_id: id });
    expect(await sqlAs(pg, as.service, 'select 1 from faceit_profiles where faceit_player_id = $1', [p.faceitPlayerId])).toHaveLength(1);
  });
});

describe('Profils FACEIT partagés', () => {
  it('un changement de pseudo ou d’avatar met à jour le MÊME joueur', async () => {
    const p = profile({ nickname: 'ancien' });
    const { id } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    await rpc(pg, as.service, 'sync_save_profile', {
      p_run_id: null,
      p_profile: { ...p, nickname: 'nouveau', avatarUrl: 'https://assets.faceit-cdn.net/avatars/neuf.jpg', fetchedAt: new Date().toISOString() },
    });
    const roster = await rpc(pg, as.anon, 'list_roster');
    expect(roster).toHaveLength(1);
    expect(roster[0].id).toBe(id);
    expect(roster[0].profile.nickname).toBe('nouveau');
    expect(roster[0].profile.avatarUrl).toBe('https://assets.faceit-cdn.net/avatars/neuf.jpg');
  });

  it('une panne FACEIT garde les dernières données valides et note l’échec', async () => {
    const p = profile({ cs2Elo: 1650 });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    const runId = await rpc(pg, as.service, 'sync_begin', { p_job: 'profiles', p_trigger: 'cron' });
    await rpc(pg, as.service, 'sync_fail', { p_run_id: runId, p_faceit_player_id: p.faceitPlayerId, p_code: 'unavailable' });
    const [player] = await rpc(pg, as.anon, 'list_roster');
    expect(player.profile.cs2Elo).toBe(1650);
    expect(Date.parse(player.profile.fetchedAt)).toBe(Date.parse(p.fetchedAt as string));
    expect(player.profile.lastError).toBe('unavailable');
  });

  it('un profil sans données CS2 reste sans niveau ni ELO', async () => {
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: profile({ cs2Level: null, cs2Elo: null }), p_group: 'guest' });
    const [player] = await rpc(pg, as.anon, 'list_roster');
    expect(player.profile.cs2Level).toBeNull();
    expect(player.profile.cs2Elo).toBeNull();
    expect(await sqlAs(pg, as.service, 'select * from elo_snapshots')).toHaveLength(0);
  });

  it('un joueur avec des matchs ne peut pas être supprimé (désactivation à la place) ; sans match, si', async () => {
    const p = profile();
    const { id: playerId } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    await rpc(pg, as.service, 'sync_upsert_match', {
      p: {
        faceitMatchId: '1-bbbbbbbb-0000-4000-8000-000000000001',
        status: 'finished',
        faceitUrl: 'https://www.faceit.com/fr/cs2/room/1-bbbbbbbb-0000-4000-8000-000000000001',
        source: 'faceit_history',
        players: [{ faceit_player_id: p.faceitPlayerId, faction: 'faction1' }],
      },
    });
    expect(await errorCode(rpc(pg, as.admin, 'admin_delete_player', { p_player_id: playerId }))).toBe('in_use');
    const { id: other } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: profile(), p_group: 'guest' });
    await rpc(pg, as.admin, 'admin_delete_player', { p_player_id: other });
    expect(await rpc(pg, as.anon, 'list_roster')).toHaveLength(1);
  });
});

describe('Classement permanent', () => {
  const save = (p: Record<string, unknown>, elo: number | null, at: string) =>
    rpc(pg, as.service, 'sync_save_profile', { p_run_id: null, p_profile: { ...p, cs2Elo: elo, fetchedAt: at } });
  const snapshots = async (p: { faceitPlayerId: unknown }) =>
    (await sqlAs<{ elo: number }>(pg, as.service, 'select elo from elo_snapshots where faceit_player_id = $1 order by measured_at', [p.faceitPlayerId])).map((r) => r.elo);

  it('l’ajout enregistre tout de suite le premier relevé : ELO d’ajout = ELO actuel, progression 0', async () => {
    const p = profile({ cs2Elo: 2312, fetchedAt: '2026-10-13T10:00:00Z' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    const [player] = await rpc(pg, as.anon, 'list_roster');
    expect(player.addedElo).toBe(2312);
    expect(Date.parse(player.addedAt)).toBe(Date.parse('2026-10-13T10:00:00Z'));
    expect(player.profile.cs2Elo - player.addedElo).toBe(0);
    expect(await snapshots(p)).toEqual([2312]);
  });

  it('un relevé identique n’est pas dupliqué ; un changement d’ELO ou 6 h écoulées en créent un', async () => {
    const p = profile({ cs2Elo: 2000, fetchedAt: '2026-10-13T10:00:00Z' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    await save(p, 2000, '2026-10-13T10:05:00Z');
    expect(await snapshots(p)).toEqual([2000]);
    await save(p, 2024, '2026-10-13T10:40:00Z');
    await save(p, 2024, '2026-10-13T17:00:00Z');
    expect(await snapshots(p)).toEqual([2000, 2024, 2024]);
    // La fraîcheur, elle, suit chaque réponse FACEIT.
    const [player] = await rpc(pg, as.anon, 'list_roster');
    expect(Date.parse(player.profile.fetchedAt)).toBe(Date.parse('2026-10-13T17:00:00Z'));
  });

  it('sans ELO CS2 à l’ajout, l’ELO d’ajout est le premier relevé réel ensuite (aucune valeur inventée)', async () => {
    const p = profile({ cs2Level: null, cs2Elo: null, fetchedAt: '2026-10-13T10:00:00Z' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'guest' });
    expect((await rpc(pg, as.anon, 'list_roster'))[0].addedElo).toBeNull();
    await save({ ...p, cs2Level: 4 }, 1100, '2026-10-14T10:00:00Z');
    await rpc(pg, as.service, 'sync_fill_baselines');
    expect((await rpc(pg, as.anon, 'list_roster'))[0].addedElo).toBe(1100);
  });

  it('réactiver un joueur le remet au classement avec un nouvel ELO d’ajout', async () => {
    const p = profile({ cs2Elo: 2000, fetchedAt: '2026-10-01T10:00:00Z' });
    const { id } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    const off = await rpc(pg, as.admin, 'admin_update_player', { p_player_id: id, p_group: 'team', p_active: false, p_display_order: 10 });
    expect(off.reactivated).toBe(false);
    const on = await rpc(pg, as.admin, 'admin_update_player', { p_player_id: id, p_group: 'team', p_active: true, p_display_order: 10 });
    expect(on.reactivated).toBe(true);
    expect((await rpc(pg, as.anon, 'get_player', { p_player_id: id })).addedElo).toBeNull();
    await rpc(pg, as.admin, 'admin_record_profile', { p_profile: { ...p, cs2Elo: 2150, fetchedAt: new Date(Date.now() + 1000).toISOString() } });
    const back = await rpc(pg, as.anon, 'get_player', { p_player_id: id });
    expect(back.addedElo).toBe(2150);
    expect(Date.parse(back.addedAt)).toBeGreaterThan(Date.parse('2026-10-02T00:00:00Z'));
  });

  it('l’historique commence à l’ajout ; au-delà de 400 relevés, un point par jour', async () => {
    const p = profile({ cs2Elo: 1500, fetchedAt: '2026-06-01T10:00:00Z' });
    const { id } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: p, p_group: 'team' });
    await sqlAs(pg, as.service, `insert into elo_snapshots (faceit_player_id, elo, measured_at) values ($1, 1400, '2026-05-20T10:00:00Z')`, [p.faceitPlayerId]);
    let h = await rpc(pg, as.anon, 'get_elo_history', { p_player_id: id });
    expect(h.points.map((x: { elo: number }) => x.elo)).toEqual([1500]);
    expect(h.compacted).toBe(false);
    await sqlAs(
      pg,
      as.service,
      `insert into elo_snapshots (faceit_player_id, elo, measured_at)
       select $1, 1500 + g, '2026-06-02T00:00:00Z'::timestamptz + (g * interval '4 hours') from generate_series(1, 450) g`,
      [p.faceitPlayerId],
    );
    h = await rpc(pg, as.anon, 'get_elo_history', { p_player_id: id });
    expect(h.total).toBe(451);
    expect(h.compacted).toBe(true);
    const days = h.points.map((x: { measuredAt: string }) => x.measuredAt.slice(0, 10));
    expect(new Set(days).size).toBe(days.length);
    expect(await rpc(pg, as.anon, 'get_elo_history', { p_player_id: '00000000-0000-4000-8000-0000000000ff' })).toBeNull();
  });

  it('actualisation publique : au plus une fois toutes les 2 minutes pour tout le site', async () => {
    const first = await rpc(pg, as.service, 'sync_begin', { p_job: 'profiles', p_trigger: 'public' });
    await rpc(pg, as.service, 'sync_end', { p_run_id: first, p_status: 'ok' });
    let err: unknown = null;
    try {
      await rpc(pg, as.service, 'sync_begin', { p_job: 'profiles', p_trigger: 'public' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).code).toBe('too_soon');
    expect(typeof (err as DbError).detail?.retryAt).toBe('string');
    // La synchro planifiée n'est pas concernée par cette limite.
    const cron = await rpc(pg, as.service, 'sync_begin', { p_job: 'profiles', p_trigger: 'cron' });
    await rpc(pg, as.service, 'sync_end', { p_run_id: cron, p_status: 'ok' });
    const status = await rpc(pg, as.anon, 'refresh_status');
    expect(status.running).toBe(false);
    expect(Date.parse(status.availableAt) - Date.parse(status.lastStartedAt)).toBe(120_000);
    // Le déclenchement reste réservé au rôle service (passé par l'action serveur).
    expect(await errorCode(rpc(pg, as.anon, 'sync_begin', { p_job: 'profiles', p_trigger: 'public' }))).toBe('forbidden');
  });
});

describe('Matchs', () => {
  it('un match partagé par deux joueurs suivis = une seule ligne', async () => {
    const a = profile();
    const b = profile();
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: a, p_group: 'team' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: b, p_group: 'team' });
    const match = (players: unknown[]) => ({
      p: {
        faceitMatchId: '1-aaaaaaaa-0000-4000-8000-000000000001',
        status: 'finished',
        statusRaw: 'FINISHED',
        startedAt: '2026-10-10T18:00:00Z',
        finishedAt: '2026-10-10T18:40:00Z',
        winnerFaction: 'faction1',
        factions: { faction1: { name: 'x' }, faction2: { name: 'y' } },
        faceitUrl: 'https://www.faceit.com/fr/cs2/room/1-aaaaaaaa-0000-4000-8000-000000000001',
        source: 'faceit_history',
        players,
      },
    });
    await rpc(pg, as.service, 'sync_upsert_match', match([{ faceit_player_id: a.faceitPlayerId, faction: 'faction1' }]));
    await rpc(pg, as.service, 'sync_upsert_match', match([{ faceit_player_id: b.faceitPlayerId, faction: 'faction2' }]));
    const list = await rpc(pg, as.anon, 'list_recent_matches', { p_limit: 10 });
    expect(list).toHaveLength(1);
    expect(list[0].players.map((p: { result: string }) => p.result).sort()).toEqual(['loss', 'win']);
    expect(list[0].score).toBeNull(); // aucun score inventé
  });

  it('aucune source validée : pas de match « en cours » exposé', async () => {
    const live = await rpc(pg, as.anon, 'get_live_state');
    expect(live.source).toBe('none');
    expect(live.ongoing).toEqual([]);
  });
});

describe('Stuffs', () => {
  it('les compteurs par map viennent des fiches publiées', async () => {
    const save = (slug: string, grenade: string, status: string) =>
      rpc(pg, as.admin, 'admin_save_utility', {
        p: { mapSlug: 'mirage', slug, title: `Titre ${slug}`, side: 'T', grenade, originName: 'A', targetName: 'B', technique: 'static', difficulty: 'easy', status, steps: [], tags: [] },
      });
    await save('a', 'smoke', 'published');
    await save('b', 'smoke', 'published');
    await save('c', 'flash', 'published');
    await save('d', 'he', 'draft');
    const maps = await rpc(pg, as.anon, 'list_maps');
    const mirage = maps.find((m: { slug: string }) => m.slug === 'mirage');
    expect(mirage.counts).toMatchObject({ total: 3, smoke: 2, flash: 1, he: 0 });
    const catalog = await rpc(pg, as.anon, 'list_utilities', { p_map_slug: 'mirage' });
    expect(catalog.utilities).toHaveLength(mirage.counts.total);
    expect(await rpc(pg, as.anon, 'get_utility', { p_map_slug: 'mirage', p_slug: 'd' })).toBeNull(); // brouillon caché
    expect(await rpc(pg, as.anon, 'list_utilities', { p_map_slug: 'inconnue' })).toBeNull();
  });

  it('signalement : admin seulement, un seul ouvert à la fois, clôturé par la vérification', async () => {
    const { id } = await rpc(pg, as.admin, 'admin_save_utility', {
      p: { mapSlug: 'mirage', slug: 's', title: 'Smoke S', side: 'T', grenade: 'smoke', originName: 'A', targetName: 'B', technique: 'static', difficulty: 'easy', status: 'published', steps: [], tags: [] },
    });
    expect(await errorCode(rpc(pg, as.anon, 'report_utility', { p_utility_id: id }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.noRole, 'report_utility', { p_utility_id: id }))).toBe('forbidden');
    await rpc(pg, as.admin, 'report_utility', { p_utility_id: id, p_note: 'ne passe plus' });
    expect(await errorCode(rpc(pg, as.admin, 'report_utility', { p_utility_id: id }))).toBe('duplicate');
    expect((await rpc(pg, as.anon, 'get_utility', { p_map_slug: 'mirage', p_slug: 's' })).utility.openReports).toBe(1);
    await rpc(pg, as.admin, 'admin_mark_utility_verified', { p_utility_id: id });
    const after = await rpc(pg, as.anon, 'get_utility', { p_map_slug: 'mirage', p_slug: 's' });
    expect(after.utility.openReports).toBe(0);
    expect(after.utility.verifiedAt).not.toBeNull();
  });

  it('refuse une vidéo hors YouTube et un chemin d’image arbitraire', async () => {
    expect(
      await errorCode(
        rpc(pg, as.admin, 'admin_save_utility', {
          p: { mapSlug: 'mirage', slug: 'v', title: 'Video V', side: 'T', grenade: 'smoke', originName: 'A', targetName: 'B', technique: 'static', difficulty: 'easy', status: 'draft', videoUrl: 'https://evil.example/v', steps: [], tags: [] },
        }),
      ),
    ).toBe('invalid');
    const { id } = await rpc(pg, as.admin, 'admin_save_utility', {
      p: { mapSlug: 'mirage', slug: 'w', title: 'Fiche W', side: 'T', grenade: 'smoke', originName: 'A', targetName: 'B', technique: 'static', difficulty: 'easy', status: 'draft', steps: [], tags: [] },
    });
    expect(await errorCode(rpc(pg, as.admin, 'admin_set_utility_image', { p_utility_id: id, p_kind: 'aim', p_path: '../../etc/passwd' }))).toBe('invalid');
  });
});

describe('Maps et carte tactique', () => {
  const utility = (mapSlug: string, slug: string) =>
    rpc(pg, as.admin, 'admin_save_utility', {
      p: { mapSlug, slug, title: `Fiche ${slug}`, side: 'T', grenade: 'smoke', originName: 'A', targetName: 'B', technique: 'static', difficulty: 'easy', status: 'published', steps: [], tags: [] },
    });
  const slugs = async (who: (typeof as)[keyof typeof as]) => (await rpc(pg, who, 'list_maps')).map((m: { slug: string }) => m.slug);

  it('une map ajoutée est masquée tant que l’admin ne la rend pas visible ; ordre et suppression', async () => {
    await rpc(pg, as.admin, 'admin_save_map', { p: { slug: 'vertigo', name: 'Vertigo', active: false, create: true } });
    expect(await slugs(as.anon)).not.toContain('vertigo');
    expect(await slugs(as.admin)).toContain('vertigo');
    expect(await errorCode(rpc(pg, as.admin, 'admin_save_map', { p: { slug: 'vertigo', name: 'Bis', create: true } }))).toBe('duplicate');

    await rpc(pg, as.admin, 'admin_save_map', { p: { slug: 'vertigo', active: true } });
    const visible = await slugs(as.anon);
    expect(visible.at(-1)).toBe('vertigo');
    // L'ordre se règle dans l'admin, qui voit aussi les maps masquées (ex. Cache).
    const before = await slugs(as.admin);
    await rpc(pg, as.admin, 'admin_move_map', { p_slug: 'vertigo', p_direction: -1 });
    const moved = await slugs(as.admin);
    expect(moved.indexOf('vertigo')).toBe(before.indexOf('vertigo') - 1);
    expect(moved).toHaveLength(before.length);

    await rpc(pg, as.admin, 'admin_set_map_image', { p_slug: 'vertigo', p_kind: 'cover', p_path: 'maps/vertigo/cover-1.webp' });
    const replaced = await rpc(pg, as.admin, 'admin_set_map_image', { p_slug: 'vertigo', p_kind: 'cover', p_path: 'maps/vertigo/cover-2.webp' });
    expect(replaced.oldPath).toBe('maps/vertigo/cover-1.webp');
    expect(await errorCode(rpc(pg, as.admin, 'admin_set_map_image', { p_slug: 'vertigo', p_kind: 'aerial', p_path: 'utilities/x/../../a.webp' }))).toBe('invalid');

    await utility('vertigo', 'v1');
    expect(await errorCode(rpc(pg, as.admin, 'admin_delete_map', { p_slug: 'vertigo' }))).toBe('in_use');
    await rpc(pg, as.admin, 'admin_delete_utility', { p_utility_id: (await rpc(pg, as.admin, 'admin_list_utilities'))[0].id });
    expect((await rpc(pg, as.admin, 'admin_delete_map', { p_slug: 'vertigo' })).paths).toEqual(['maps/vertigo/cover-2.webp']);
    expect(await slugs(as.admin)).not.toContain('vertigo');
  });

  it('positions : placées par l’admin, rattachées à une fiche de la même map, détachées à la suppression', async () => {
    const { id: fiche } = await utility('mirage', 'm1');
    const { id: pos } = await rpc(pg, as.admin, 'admin_save_position', { p: { mapSlug: 'mirage', name: 'Spawn T', x: 12.5, y: 80 } });
    const { id: other } = await rpc(pg, as.admin, 'admin_save_position', { p: { mapSlug: 'dust2', name: 'Long', x: 50, y: 50 } });
    expect(await errorCode(rpc(pg, as.admin, 'admin_save_position', { p: { mapSlug: 'mirage', name: 'Hors carte', x: 120, y: 5 } }))).toBe('invalid');
    expect(await errorCode(rpc(pg, as.noRole, 'admin_save_position', { p: { mapSlug: 'mirage', name: 'Pirate', x: 1, y: 1 } }))).toBe('forbidden');

    // Position d'une autre map refusée ; impact sans l'une des coordonnées refusé.
    expect(await errorCode(rpc(pg, as.admin, 'admin_link_utility', { p_utility_id: fiche, p_position_id: other, p_landing_x: null, p_landing_y: null }))).toBe('invalid');
    expect(await errorCode(rpc(pg, as.admin, 'admin_link_utility', { p_utility_id: fiche, p_position_id: pos, p_landing_x: 40, p_landing_y: null }))).toBe('invalid');
    await rpc(pg, as.admin, 'admin_link_utility', { p_utility_id: fiche, p_position_id: pos, p_landing_x: 40, p_landing_y: 33.25 });

    const catalog = await rpc(pg, as.anon, 'list_utilities', { p_map_slug: 'mirage' });
    expect(catalog.positions).toEqual([{ id: pos, name: 'Spawn T', x: 12.5, y: 80 }]);
    expect(catalog.utilities[0]).toMatchObject({ throwPositionId: pos, landing: { x: 40, y: 33.25 } });
    expect(catalog.map.positionCount).toBe(1);
    const detail = await rpc(pg, as.anon, 'get_utility', { p_map_slug: 'mirage', p_slug: 'm1' });
    expect(detail.position).toEqual({ id: pos, name: 'Spawn T', x: 12.5, y: 80 });

    await rpc(pg, as.admin, 'admin_save_position', { p: { id: pos, mapSlug: 'mirage', x: 20 } });
    expect((await rpc(pg, as.anon, 'list_utilities', { p_map_slug: 'mirage' })).positions[0]).toMatchObject({ name: 'Spawn T', x: 20, y: 80 });

    await rpc(pg, as.admin, 'admin_delete_position', { p_position_id: pos });
    const after = await rpc(pg, as.anon, 'list_utilities', { p_map_slug: 'mirage' });
    expect(after.positions).toEqual([]);
    expect(after.utilities[0].throwPositionId).toBeNull();
    expect(after.utilities).toHaveLength(1); // la fiche reste publiée
  });

  it('une map masquée et ses fiches disparaissent du site public', async () => {
    await utility('nuke', 'n1');
    await rpc(pg, as.admin, 'admin_save_map', { p: { slug: 'nuke', active: false } });
    expect(await rpc(pg, as.anon, 'list_utilities', { p_map_slug: 'nuke' })).toBeNull();
    expect(await rpc(pg, as.anon, 'get_utility', { p_map_slug: 'nuke', p_slug: 'n1' })).toBeNull();
    expect(await rpc(pg, as.admin, 'get_utility', { p_map_slug: 'nuke', p_slug: 'n1' })).not.toBeNull();
    expect((await rpc(pg, as.admin, 'list_utilities', { p_map_slug: 'nuke', p_include_drafts: true })).utilities).toHaveLength(1);
  });
});
