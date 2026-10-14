import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, errorCode, freshDb, profile, rpc, sqlAs } from '../helpers/pg';

/**
 * Règles d'accès (RLS + contrôles des fonctions), testées sur les migrations réelles.
 * Mêmes rôles que Supabase : anon (visiteur), authenticated (compte connecté), service_role.
 */
let pg: PGlite;
const mur = profile({ nickname: 'sur_le_mur' });
const rosterPlayer = profile({ nickname: 'dans_le_roster' });
let entryId: string;

beforeAll(async () => {
  pg = await freshDb();
  entryId = (await rpc(pg, as.admin, 'admin_add_avoid_entry', { p_profile: mur, p_reason: 'Motif interne', p_status: 'active' })).id;
  await rpc(pg, as.admin, 'admin_add_player', { p_profile: rosterPlayer, p_group: 'team' });
});

describe('Mur des lamentations', () => {
  it('un visiteur ne peut ni lister le Mur ni lire ses tables', async () => {
    expect(await errorCode(rpc(pg, as.anon, 'list_avoid_entries'))).toBe('forbidden');
    await expect(sqlAs(pg, as.anon, 'select * from avoid_list_entries')).rejects.toThrow(/permission denied/);
    await expect(sqlAs(pg, as.anon, 'select * from avoid_list_private_notes')).rejects.toThrow(/permission denied/);
    // Profil présent uniquement sur le Mur : invisible pour un visiteur.
    const rows = await sqlAs(pg, as.anon, 'select nickname from faceit_profiles');
    expect(rows.map((r) => r.nickname)).toEqual(['dans_le_roster']);
  });
  it('un compte connecté SANS rôle est traité comme un visiteur', async () => {
    expect(await errorCode(rpc(pg, as.noRole, 'list_avoid_entries'))).toBe('forbidden');
    expect(await sqlAs(pg, as.noRole, 'select * from avoid_list_entries')).toHaveLength(0);
  });
  it('un compte sans rôle ne lit jamais les motifs', async () => {
    expect(await sqlAs(pg, as.noRole, 'select * from avoid_list_private_notes')).toHaveLength(0);
    expect(await errorCode(rpc(pg, as.noRole, 'admin_list_avoid_entries'))).toBe('forbidden');
  });
  it('la liste publique ne contient jamais les motifs', async () => {
    const list = await rpc(pg, as.admin, 'list_avoid_entries');
    expect(list).toHaveLength(1);
    expect(list[0].profile.nickname).toBe('sur_le_mur');
    expect(JSON.stringify(list)).not.toContain('Motif interne');
  });
  it('un compte sans rôle ne peut ni ajouter, ni modifier, ni supprimer', async () => {
    expect(await errorCode(rpc(pg, as.noRole, 'admin_add_avoid_entry', { p_profile: profile() }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.noRole, 'admin_update_avoid_entry', { p_entry_id: entryId, p_reason: null, p_status: 'archived' }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.noRole, 'admin_delete_avoid_entry', { p_entry_id: entryId }))).toBe('forbidden');
    // Même en contournant les fonctions : la RLS bloque l'écriture directe.
    await sqlAs(pg, as.noRole, `update avoid_list_entries set status = 'archived'`);
    const [row] = await sqlAs(pg, as.admin, 'select status from avoid_list_entries where id = $1', [entryId]);
    expect(row!.status).toBe('active');
  });
  it('un visiteur ne peut appeler aucune fonction d’administration ou de synchro', async () => {
    expect(await errorCode(rpc(pg, as.anon, 'admin_add_player', { p_profile: profile(), p_group: 'team' }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.anon, 'sync_begin', { p_job: 'profiles', p_trigger: 'cron' }))).toBe('forbidden');
    expect(await errorCode(rpc(pg, as.noRole, 'sync_save_profile', { p_run_id: null, p_profile: profile() }))).toBe('forbidden');
  });
  it('l’admin lit les motifs', async () => {
    const list = await rpc(pg, as.admin, 'admin_list_avoid_entries', { p_status: 'all' });
    expect(list[0].reason).toBe('Motif interne');
    expect(list[0].addedBy).toBe('Admin local');
  });
});

describe('Roster et profils', () => {
  it('le roster est public', async () => {
    const roster = await rpc(pg, as.anon, 'list_roster');
    expect(roster.map((p: { profile: { nickname: string } }) => p.profile.nickname)).toEqual(['dans_le_roster']);
  });
  it('un visiteur ne peut pas modifier un profil', async () => {
    await sqlAs(pg, as.anon, `update faceit_profiles set nickname = 'pirate'`).catch(() => null);
    const [row] = await sqlAs(pg, as.admin, 'select nickname from faceit_profiles where faceit_player_id = $1', [rosterPlayer.faceitPlayerId]);
    expect(row!.nickname).toBe('dans_le_roster');
  });
  it('la base refuse une adresse d’avatar hors du CDN FACEIT', async () => {
    expect(
      await errorCode(rpc(pg, as.admin, 'admin_add_player', { p_profile: profile({ avatarUrl: 'https://evil.example/x.png' }), p_group: 'team' })),
    ).toBe('invalid');
  });
});

describe('Compte admin unique', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshDb();
  });
  it('seul le rôle admin existe : aucun rôle « member » ne peut être attribué', async () => {
    await expect(
      sqlAs(db, as.service, `insert into profiles (user_id, role) values ('00000000-0000-4000-8000-00000000a003', 'member')`),
    ).rejects.toThrow();
    expect(await sqlAs(db, as.service, 'select role from profiles')).toEqual([{ role: 'admin' }]);
  });
  it('un compte connecté ne peut pas s’attribuer le rôle admin', async () => {
    await sqlAs(db, as.noRole, `insert into profiles (user_id, role) values ('00000000-0000-4000-8000-00000000a003', 'admin')`).catch(() => null);
    expect(await sqlAs(db, as.service, 'select count(*)::int as n from profiles')).toEqual([{ n: 1 }]);
  });
});
