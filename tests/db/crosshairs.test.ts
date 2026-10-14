import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { as, errorCode, freshDb, profile, rpc, sqlAs } from '../helpers/pg';

/** Crosshairs : forme du code, aperçu contrôlé, publication, droits et vérification. */
let pg: PGlite;
beforeEach(async () => {
  pg = await freshDb();
});

const CODE = 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ';
const PREVIEW = { len: 3, gap: -1, thickness: 1, outline: 1, dot: false, color: '#3CFF6E' };
const save = (p: Record<string, unknown>) =>
  rpc(pg, as.admin, 'admin_save_crosshair', { p: { label: 'Classique', shareCode: CODE, preview: PREVIEW, published: true, ...p } });

describe('Crosshairs', () => {
  it('enregistre le code récent intact sans le déclarer vérifié en jeu', async () => {
    const code = 'CSH2Rx7cGRU5apQ4VSnZwjsr9RyLEiOrCAaVYWYvW6dz7H';
    await save({ shareCode: code });
    expect((await rpc(pg, as.anon, 'list_crosshairs'))[0]).toMatchObject({ shareCode: code, verifiedAt: null });
    expect(await errorCode(save({ shareCode: `CS${'a'.repeat(127)}` }))).toBe('invalid');
  });
  it('publié visible de tous, brouillon réservé aux admins, avec joueur et map', async () => {
    const { id: playerId } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: profile({ nickname: 'tireur' }), p_group: 'team' });
    await save({ playerId, mapSlug: 'mirage', verifiedAt: '2026-10-04', gameVersion: 'build 30/09' });
    await save({ label: 'Brouillon', published: false });

    const pub = await rpc(pg, as.anon, 'list_crosshairs');
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({
      label: 'Classique',
      shareCode: CODE,
      preview: PREVIEW,
      verifiedAt: '2026-10-04',
      gameVersion: 'build 30/09',
      player: { id: playerId, nickname: 'tireur' },
      map: { slug: 'mirage' },
    });
    expect(await rpc(pg, as.anon, 'list_crosshairs', { p_include_drafts: true })).toHaveLength(1);
    expect(await rpc(pg, as.admin, 'list_crosshairs', { p_include_drafts: true })).toHaveLength(2);
    expect(await sqlAs(pg, as.anon, 'select * from crosshairs')).toHaveLength(1);
  });

  it('refuse un code mal formé et un aperçu hors bornes', async () => {
    for (const shareCode of ['CSGO-ABCDE-FGHJK', 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXY0', 'csgo-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ', 'javascript:alert(1)']) {
      expect(await errorCode(save({ shareCode }))).toBe('invalid');
    }
    expect(await errorCode(save({ preview: { ...PREVIEW, len: 40 } }))).toBe('invalid');
    expect(await errorCode(save({ preview: { ...PREVIEW, color: 'red' } }))).toBe('invalid');
    expect(await errorCode(save({ preview: { ...PREVIEW, extra: 1 } }))).toBe('invalid');
    expect(await errorCode(save({ mapSlug: 'inconnue' }))).toBe('invalid');
    expect(await rpc(pg, as.admin, 'list_crosshairs', { p_include_drafts: true })).toHaveLength(0);
  });

  it('un membre ne peut ni créer, ni vérifier, ni supprimer ; l’admin peut', async () => {
    const { id } = await save({});
    expect(await errorCode(rpc(pg, as.member, 'admin_save_crosshair', { p: { label: 'Pirate', shareCode: CODE, published: true } }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.member, 'admin_verify_crosshair', { p_id: id, p_game_version: 'x' }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.anon, 'admin_delete_crosshair', { p_id: id }))).toBe('forbidden');
    await sqlAs(pg, as.member, `update crosshairs set label = 'pirate'`);
    expect((await rpc(pg, as.anon, 'list_crosshairs'))[0].label).toBe('Classique');

    await rpc(pg, as.admin, 'admin_verify_crosshair', { p_id: id, p_game_version: 'build test' });
    const [c] = await rpc(pg, as.anon, 'list_crosshairs');
    expect(c.gameVersion).toBe('build test');
    expect(c.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await rpc(pg, as.admin, 'admin_delete_crosshair', { p_id: id });
    expect(await rpc(pg, as.anon, 'list_crosshairs')).toHaveLength(0);
  });

  it('retirer le joueur du roster garde le preset, sans propriétaire', async () => {
    const { id: playerId } = await rpc(pg, as.admin, 'admin_add_player', { p_profile: profile(), p_group: 'guest' });
    await save({ playerId });
    await rpc(pg, as.admin, 'admin_delete_player', { p_player_id: playerId });
    const [c] = await rpc(pg, as.anon, 'list_crosshairs');
    expect(c.player).toBeNull();
  });
});
