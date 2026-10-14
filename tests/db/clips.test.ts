import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { as, errorCode, freshDb, profile, rpc, sqlAs } from '../helpers/pg';
import { clipSchema } from '@/lib/clips/schemas';

let pg: PGlite;
beforeEach(async () => {
  pg = await freshDb();
});
afterEach(async () => {
  await pg?.close();
});
const base = {
  title: 'Le clutch',
  provider: 'youtube',
  externalId: 'M7lc1UVf-VE',
  sourceUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
  recordedOn: '2026-10-13',
  description: '',
  consentConfirmed: true,
  embedAllowed: true,
  published: true,
};
const save = (p: Record<string, unknown> = {}) =>
  rpc(pg, as.admin, 'admin_save_clip', { p: { ...base, ...p } });
describe('Clips : persistance et droits', () => {
  it('publie, modifie, dépublie et supprime un clip avec ses relations', async () => {
    const { id: playerId } = await rpc(pg, as.admin, 'admin_add_player', {
      p_profile: profile(),
      p_group: 'team',
    });
    const { id } = await save({ playerId, mapSlug: 'mirage' });
    const [c] = await rpc(pg, as.anon, 'list_clips');
    expect(clipSchema.safeParse(c).success).toBe(true);
    expect(c).toMatchObject({ id, player: { id: playerId }, map: { slug: 'mirage' } });
    await save({ id, title: 'Modifié', published: false });
    expect(await rpc(pg, as.anon, 'list_clips', { p_include_drafts: true })).toEqual([]);
    expect(await sqlAs(pg, as.member, 'select * from clips')).toEqual([]);
    expect(await rpc(pg, as.admin, 'list_clips', { p_include_drafts: true })).toHaveLength(1);
    await rpc(pg, as.admin, 'admin_delete_clip', { p_id: id });
    expect(await rpc(pg, as.admin, 'list_clips', { p_include_drafts: true })).toEqual([]);
  });
  it('bloque les doublons, liens malveillants et publications sans accord en base', async () => {
    await save();
    expect(await errorCode(save())).toBe('duplicate');
    for (const patch of [
      { sourceUrl: 'javascript:alert(1)' },
      { externalId: 'abcdefghijk', sourceUrl: 'https://evil.test/abc' },
      { consentConfirmed: false },
      { mapSlug: 'inconnue' },
    ]) {
      expect(await errorCode(save(patch))).toBe('invalid');
    }
  });
  it('refuse les mutations aux visiteurs et membres, même via SQL direct', async () => {
    const { id } = await save();
    for (const who of [as.anon, as.member, as.noRole]) {
      expect(await errorCode(rpc(pg, who, 'admin_save_clip', { p: base }))).toBe('forbidden');
      expect(await errorCode(rpc(pg, who, 'admin_delete_clip', { p_id: id }))).toBe('forbidden');
    }
    await sqlAs(pg, as.member, "update clips set title='Pirate'");
    await sqlAs(pg, as.member, 'delete from clips');
    expect((await rpc(pg, as.anon, 'list_clips'))[0].title).toBe(base.title);
    await expect(
      sqlAs(
        pg,
        as.member,
        "insert into clips (title,provider,external_id,source_url,recorded_on) values ('Pirate','youtube','abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk','2026-10-13')",
      ),
    ).rejects.toThrow();
  });
  it('classe par date et préserve le clip quand le joueur est retiré', async () => {
    const { id: playerId } = await rpc(pg, as.admin, 'admin_add_player', {
      p_profile: profile(),
      p_group: 'guest',
    });
    await save({ playerId, recordedOn: '2026-10-01' });
    await save({
      externalId: 'abcdefghijk',
      sourceUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      recordedOn: '2026-10-12',
    });
    await rpc(pg, as.admin, 'admin_delete_player', { p_player_id: playerId });
    const clips = await rpc(pg, as.anon, 'list_clips');
    expect(clips[0].recordedOn).toBe('2026-10-12');
    expect(clips[1].player).toBeNull();
  });
});
