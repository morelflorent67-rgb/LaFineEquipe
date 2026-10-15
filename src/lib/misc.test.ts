import { describe, expect, it } from 'vitest';
import { toDbError } from './db/errors';
import { deriveLiveState } from './domain/live';
import { isoToParisLocal, parisLocalToIso } from './paris-time';
import { sniffImage } from './storage';
import { applyFilters, filtersToQuery, parseFilters, slugify, tacticalGroups, verification, youtubeId } from './stuffs';
import type { LiveStateRow, Utility } from './domain/schemas';

describe('état « match en cours »', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const base: LiveStateRow = { source: 'none', verifiedAt: null, lastMatchesSyncOkAt: null, lastMatchesSyncStatus: null, ongoing: [] };
  it('« Statut indisponible » tant qu’aucune source n’est validée', () => {
    expect(deriveLiveState(base, now).kind).toBe('unavailable');
    expect(deriveLiveState(null, now).kind).toBe('unavailable');
  });
  it('une erreur ou un contrôle trop ancien ne devient jamais « personne en game »', () => {
    const src = { ...base, source: 'history_polling' as const, verifiedAt: '2026-10-01T00:00:00Z' };
    expect(deriveLiveState({ ...src, lastMatchesSyncOkAt: '2026-10-12T11:58:00Z', lastMatchesSyncStatus: 'error' }, now).kind).toBe('uncertain');
    expect(deriveLiveState({ ...src, lastMatchesSyncOkAt: '2026-10-12T10:00:00Z', lastMatchesSyncStatus: 'ok' }, now).kind).toBe('uncertain');
    expect(deriveLiveState({ ...src, lastMatchesSyncOkAt: null }, now).kind).toBe('uncertain');
  });
  it('« personne en game » seulement après un contrôle récent et réussi', () => {
    const src = { ...base, source: 'webhook' as const, verifiedAt: '2026-10-01T00:00:00Z', lastMatchesSyncOkAt: '2026-10-12T11:58:00Z', lastMatchesSyncStatus: 'ok' };
    expect(deriveLiveState(src, now).kind).toBe('none');
  });
});

describe('heure de Paris', () => {
  it('convertit l’heure d’été et l’heure d’hiver', () => {
    expect(parisLocalToIso('2026-07-01T20:00')).toBe('2026-07-01T18:00:00.000Z');
    expect(parisLocalToIso('2026-12-01T20:00')).toBe('2026-12-01T19:00:00.000Z');
    expect(parisLocalToIso('pas une date')).toBeNull();
  });
  it('fait l’aller-retour', () => {
    expect(isoToParisLocal(parisLocalToIso('2026-10-25T10:30'))).toBe('2026-10-25T10:30');
    expect(isoToParisLocal(null)).toBe('');
  });
});

describe('stuffs', () => {
  const u = (over: Partial<Utility>): Utility => ({
    id: 'x', slug: 's', mapSlug: 'mirage', mapName: 'Mirage', title: 'Smoke fenêtre', side: 'T', grenade: 'smoke', zone: 'Mid',
    originName: 'Spawn', targetName: 'Fenêtre', purpose: null, description: null, steps: [], technique: 'static', difficulty: 'easy',
    tags: [], placementImage: null, aimImage: null, videoUrl: null, verifiedAt: null, status: 'published', isDemo: false,
    updatedAt: '2026-10-01T00:00:00Z', openReports: 0, throwPositionId: null, landing: null, stepTimes: [], throw: null, bounces: [],
    movement: null, click: null, jump: null, precision: null, media: null, consoleCmd: null, airTime: null, source: 'lfe',
    sourceUrl: null, sourceUpdatedAt: null, credit: null, ...over,
  });
  it('lit et réécrit les filtres de l’URL', () => {
    const f = parseFilters({ camp: 'CT', type: 'flash', zone: 'Site A', q: 'porte' });
    expect(f).toEqual({ side: 'CT', type: 'flash', zone: 'Site A', q: 'porte' });
    expect(filtersToQuery(f)).toBe('?camp=CT&type=flash&zone=Site+A&q=porte');
    expect(parseFilters({ camp: 'X', type: 'nuke' })).toEqual({ side: null, type: null, zone: null, q: '' });
    expect(filtersToQuery(parseFilters({}))).toBe('');
  });
  it('filtre par camp (les fiches T + CT restent visibles), type, zone et texte sans accents', () => {
    const items = [u({ id: '1', side: 'T' }), u({ id: '2', side: 'CT', grenade: 'flash' }), u({ id: '3', side: 'BOTH', zone: 'Site B' })];
    expect(applyFilters(items, { side: 'T', type: null, zone: null, q: '' }).map((x) => x.id)).toEqual(['1', '3']);
    expect(applyFilters(items, { side: null, type: 'flash', zone: null, q: '' }).map((x) => x.id)).toEqual(['2']);
    expect(applyFilters(items, { side: null, type: null, zone: 'Site B', q: '' }).map((x) => x.id)).toEqual(['3']);
    expect(applyFilters(items, { side: null, type: null, zone: null, q: 'FENETRE' })).toHaveLength(3);
  });
  it('état de vérification', () => {
    expect(verification({ verifiedAt: null, openReports: 0 }).kind).toBe('never');
    expect(verification({ verifiedAt: '2026-10-01T00:00:00Z', openReports: 2 })).toEqual({ kind: 'reported', reports: 2 });
    expect(verification({ verifiedAt: '2026-10-01T00:00:00Z', openReports: 0 }).kind).toBe('ok');
  });
  it('n’accepte que les vidéos YouTube', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://vimeo.com/123')).toBeNull();
    expect(youtubeId('javascript:alert(1)')).toBeNull();
  });
  it('crée des identifiants d’URL propres', () => {
    expect(slugify('Smoke Fenêtre (T) !')).toBe('smoke-fenetre-t');
  });
  it('carte tactique : un marqueur par position × grenade, seulement pour les fiches placées par l’admin', () => {
    const positions = [
      { id: 'p1', name: 'Spawn T', x: 10, y: 80 },
      { id: 'p2', name: 'Escaliers', x: 50, y: 40 },
    ];
    const items = [
      u({ id: '1', throwPositionId: 'p1', grenade: 'smoke' }),
      u({ id: '2', throwPositionId: 'p1', grenade: 'smoke' }),
      u({ id: '3', throwPositionId: 'p1', grenade: 'flash' }),
      u({ id: '4', throwPositionId: 'p2', grenade: 'he' }),
      u({ id: '5', throwPositionId: null }),
      u({ id: '6', throwPositionId: 'supprimee' }),
    ];
    const groups = tacticalGroups(items, positions);
    expect(groups.map((g) => [g.position.name, g.grenade, g.items.map((x) => x.id)])).toEqual([
      ['Escaliers', 'he', ['4']],
      ['Spawn T', 'smoke', ['1', '2']],
      ['Spawn T', 'flash', ['3']],
    ]);
  });
});

describe('erreurs de base de données', () => {
  it('traduit les erreurs métier et SQL', () => {
    expect(toDbError({ code: 'P0001', message: 'LFE_DUPLICATE', detail: '{"entryId":"x"}' })).toMatchObject({ code: 'duplicate', detail: { entryId: 'x' } });
    expect(toDbError({ code: 'P0001', message: 'LFE_FORBIDDEN', details: '' }).code).toBe('forbidden');
    expect(toDbError({ code: '23505', message: 'dup' }).code).toBe('duplicate');
    expect(toDbError({ code: '42501', message: 'permission denied' }).code).toBe('forbidden');
    expect(toDbError({ message: 'fetch failed' }).code).toBe('unavailable');
    expect(toDbError('???').code).toBe('unknown');
  });
});

describe('contrôle du type réel des images', () => {
  it('reconnaît PNG, JPEG et WebP par leur contenu', () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe('png');
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))?.ext).toBe('jpg');
    const webp = new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ');
    expect(sniffImage(webp)?.ext).toBe('webp');
  });
  it('refuse un autre contenu, même renommé en .png', () => {
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});

describe('missingMapLabel', () => {
  it('distingue une map pas encore récupérée d’une map réellement inconnue', async () => {
    const { missingMapLabel } = await import('./format');
    expect(missingMapLabel({ status: 'finished', source: 'faceit_history' })).toBe('Map en attente');
    expect(missingMapLabel({ status: 'finished', source: 'faceit_match' })).toBe('Map inconnue');
    expect(missingMapLabel({ status: 'cancelled', source: 'faceit_history' })).toBe('Annulé');
  });
});
