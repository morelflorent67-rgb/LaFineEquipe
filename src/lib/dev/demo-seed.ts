/**
 * JEU DE DÉMONSTRATION — base LOCALE uniquement (jamais Supabase).
 * Tout est marqué is_demo = true et affiché « Exemple fictif ». Les profils « demo_… » n'existent
 * pas sur FACEIT ; aucune trajectoire de grenade réelle n'est décrite.
 * Il couvre volontairement les cas limites : pseudo long, avatar absent ou cassé, profil sans CS2,
 * panne FACEIT (07/10), journée sans synchro (09/10), quota dépassé pour un joueur (10/10),
 * joueur ajouté plus tard au classement (demo_golf), match annulé, résultat inconnu.
 */

const ADMIN = '00000000-0000-4000-8000-00000000a001';
const fid = (n: number) => `d0000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const av = (n: number) => `/dev-fixtures/avatar-${n.toString().padStart(2, '0')}.svg`;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const q = (v: string | null | undefined) => (v === null || v === undefined ? 'null' : `'${v.replace(/'/g, "''")}'`);
const ts = (d: Date) => q(d.toISOString());
const arr = (items: string[]) => `array[${items.map(q).join(',')}]::text[]`;

/** Paliers de niveau CS2 FACEIT (utilisés seulement pour rendre la démo cohérente). */
export function levelForElo(elo: number): number {
  const steps = [500, 750, 900, 1050, 1200, 1350, 1530, 1750, 2000];
  const i = steps.findIndex((s) => elo <= s);
  return i === -1 ? 10 : i + 1;
}

type DemoPlayer = {
  n: number;
  nick: string;
  avatar: string | null;
  base: number | null;
  group: 'team' | 'guest';
  addedAt?: string;
};

const ROSTER: DemoPlayer[] = [
  { n: 1, nick: 'demo_alpha', avatar: av(1), base: 2380, group: 'team' },
  { n: 2, nick: 'demo_bravo', avatar: av(2), base: 1960, group: 'team' },
  { n: 3, nick: 'demo_charlie', avatar: av(3), base: 1760, group: 'team' },
  { n: 4, nick: 'demo_delta', avatar: av(4), base: 1590, group: 'team' },
  { n: 5, nick: 'demo_echo', avatar: av(5), base: 1440, group: 'team' },
  { n: 6, nick: 'demo_foxtrot_longpseudo', avatar: av(6), base: 1300, group: 'team' },
  { n: 7, nick: 'demo_golf', avatar: av(7), base: 1690, group: 'guest', addedAt: '2026-10-05T11:00:00Z' },
  { n: 8, nick: 'demo_hotel', avatar: av(8), base: 1170, group: 'guest' },
  { n: 22, nick: 'demo_sansavatar', avatar: null, base: 1101, group: 'guest' },
  { n: 23, nick: 'demo_sanscs2', avatar: av(20), base: null, group: 'guest' },
];

const WALL: { n: number; nick: string; avatar: string; elo: number; added: string; status: 'active' | 'archived'; reason: string | null }[] = [
  { n: 11, nick: 'demo_kilo', avatar: av(11), elo: 1420, added: '2026-09-02T19:20:00Z', status: 'active', reason: 'Exemple fictif : quitte la partie en cours de match.' },
  { n: 12, nick: 'demo_lima', avatar: av(12), elo: 905, added: '2026-09-14T21:05:00Z', status: 'active', reason: null },
  { n: 13, nick: 'demo_mike', avatar: av(13), elo: 2010, added: '2026-09-20T18:40:00Z', status: 'active', reason: 'Exemple fictif : communication difficile.' },
  { n: 14, nick: 'demo_november', avatar: av(14), elo: 1560, added: '2026-09-28T20:10:00Z', status: 'active', reason: null },
  { n: 15, nick: 'demo_oscar', avatar: av(15), elo: 1260, added: '2026-10-03T22:00:00Z', status: 'active', reason: 'Exemple fictif : ne joue pas les rôles demandés.' },
  { n: 16, nick: 'demo_papa', avatar: av(16), elo: 2205, added: '2026-10-08T17:30:00Z', status: 'active', reason: null },
  { n: 17, nick: 'demo_quebec', avatar: av(17), elo: 780, added: '2026-10-10T16:45:00Z', status: 'active', reason: null },
  { n: 24, nick: 'demo_avatarcasse', avatar: 'https://distribution.faceit-cdn.net/images/lfe-fixture-image-inexistante.jpeg', elo: 1250, added: '2026-10-11T09:00:00Z', status: 'active', reason: null },
  { n: 18, nick: 'demo_romeo', avatar: av(18), elo: 1398, added: '2026-08-12T20:00:00Z', status: 'archived', reason: 'Exemple fictif : archivé après discussion.' },
];

const MAPS = ['de_mirage', 'de_inferno', 'de_ancient', 'de_nuke', 'de_anubis', 'de_dust2', 'de_train'];
const MAP_NAMES: Record<string, string> = {
  de_mirage: 'Mirage', de_inferno: 'Inferno', de_ancient: 'Ancient', de_nuke: 'Nuke',
  de_anubis: 'Anubis', de_dust2: 'Dust II', de_train: 'Train',
};

/** SQL à exécuter en super-utilisateur sur la base LOCALE (contourne la RLS, comme un import). */
export function buildDemoSql(now: Date = new Date()): string {
  const r = rng(20261012);
  const out: string[] = [];
  const nowTs = now.getTime();

  // ---------- Synchronisations : 2 passages par jour (08:00 et 20:00, heure de Paris) ----------
  type SyncSlot = { id: string; at: Date; status: 'ok' | 'partial' | 'error'; failing: Set<number> };
  const slots: SyncSlot[] = [];
  let k = 0;
  for (let t = Date.parse('2026-10-01T06:00:00Z'); t <= nowTs; t += 12 * 3600_000) {
    const at = new Date(t);
    const day = at.toISOString().slice(0, 10);
    if (day === '2026-10-09') continue; // journée sans synchro
    const id = `5e000000-0000-4000-8000-${(++k).toString().padStart(12, '0')}`;
    if (day === '2026-10-07') {
      slots.push({ id, at, status: 'error', failing: new Set(ROSTER.map((p) => p.n)) }); // panne FACEIT
    } else if (day === '2026-10-10') {
      slots.push({ id, at, status: 'partial', failing: new Set([5]) }); // quota pour demo_echo
    } else {
      slots.push({ id, at, status: 'ok', failing: new Set() });
    }
  }

  // ---------- Relevés ELO (marche aléatoire déterministe) ----------
  const latest = new Map<number, { elo: number; at: Date }>();
  const snapshots: string[] = [];
  for (const p of ROSTER) {
    if (p.base === null) continue;
    let elo = p.base;
    const addedTs = p.addedAt ? Date.parse(p.addedAt) : 0;
    for (const s of slots) {
      if (s.at.getTime() < addedTs || s.failing.has(p.n)) continue;
      elo = Math.max(100, elo + Math.round((r() - 0.47) * 34));
      snapshots.push(`(${q(fid(p.n))}, ${elo}, ${levelForElo(elo)}, ${ts(s.at)}, 'demo', ${q(s.id)})`);
      latest.set(p.n, { elo, at: s.at });
    }
  }

  // ---------- Profils ----------
  for (const p of ROSTER) {
    const l = latest.get(p.n);
    const fetchedAt = l ? l.at : slots.at(-1)?.at ?? now;
    out.push(
      `insert into public.faceit_profiles (faceit_player_id, nickname, avatar_url, country, cs2_skill_level, cs2_elo, fetched_at, last_attempt_at, is_demo)
       values (${q(fid(p.n))}, ${q(p.nick)}, ${q(p.avatar)}, 'fr', ${l ? levelForElo(l.elo) : 'null'}, ${l ? l.elo : 'null'}, ${ts(fetchedAt)}, ${ts(fetchedAt)}, true);`,
    );
  }
  // demo_echo : dernière tentative en échec (on garde ses anciennes données).
  out.push(`update public.faceit_profiles set last_attempt_at = ${ts(new Date(nowTs - 20 * 60_000))}, last_error = 'rate_limited' where faceit_player_id = ${q(fid(5))};`);
  for (const w of WALL) {
    out.push(
      `insert into public.faceit_profiles (faceit_player_id, nickname, avatar_url, country, cs2_skill_level, cs2_elo, fetched_at, last_attempt_at, is_demo)
       values (${q(fid(w.n))}, ${q(w.nick)}, ${q(w.avatar)}, 'fr', ${levelForElo(w.elo)}, ${w.elo}, ${ts(new Date(nowTs - 5 * 3600_000))}, ${ts(new Date(nowTs - 5 * 3600_000))}, true);`,
    );
  }

  // ---------- Roster ----------
  const playerId = (n: number) => `a0000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
  ROSTER.forEach((p, i) => {
    out.push(
      `insert into public.players (id, faceit_player_id, roster_group, display_order, is_demo, created_by, created_at, added_at)
       values (${q(playerId(p.n))}, ${q(fid(p.n))}, ${q(p.group)}, ${(i + 1) * 10}, true, ${q(ADMIN)}, ${ts(new Date(p.addedAt ?? '2026-09-30T12:00:00Z'))}, ${ts(new Date(p.addedAt ?? '2026-09-30T12:00:00Z'))});`,
    );
  });

  // ---------- Synchros + échecs + relevés ----------
  for (const s of slots) {
    out.push(
      `insert into public.sync_runs (id, job, trigger, started_at, finished_at, status, error_code, stats)
       values (${q(s.id)}, 'profiles', 'cron', ${ts(s.at)}, ${ts(new Date(s.at.getTime() + 40_000))}, ${q(s.status)}, ${s.status === 'error' ? q('unavailable') : 'null'}, '{"demo":true}');`,
    );
    for (const n of s.failing) {
      if (ROSTER.find((p) => p.n === n)?.addedAt && s.at.getTime() < Date.parse(ROSTER.find((p) => p.n === n)!.addedAt!)) continue;
      out.push(
        `insert into public.sync_failures (sync_run_id, faceit_player_id, error_code, created_at)
         values (${q(s.id)}, ${q(fid(n))}, ${q(s.status === 'error' ? 'unavailable' : 'rate_limited')}, ${ts(s.at)});`,
      );
    }
  }
  if (snapshots.length) {
    out.push(`insert into public.elo_snapshots (faceit_player_id, elo, skill_level, measured_at, source, sync_run_id) values ${snapshots.join(',\n')};`);
  }

  // ---------- Classement permanent : ELO d'ajout = premier relevé après l'ajout ----------
  out.push('select public._fill_baselines();');

  // ---------- Matchs (plusieurs joueurs suivis dans la même partie = un seul match) ----------
  const team = ROSTER.filter((p) => p.group === 'team');
  for (let i = 0; i < 16; i++) {
    const finished = new Date(nowTs - (i * 13 + 2) * 3600_000 - Math.floor(r() * 3600_000));
    const started = new Date(finished.getTime() - (35 + Math.floor(r() * 15)) * 60_000);
    const map = MAPS[Math.floor(r() * MAPS.length)]!;
    const cancelled = i === 5;
    const unknown = i === 9;
    const win = r() > 0.42;
    const a = 13;
    const b = Math.floor(r() * 12);
    const score = cancelled || unknown ? 'null' : `'{"faction1": ${win ? a : b}, "faction2": ${win ? b : a}}'::jsonb`;
    const id = `c0000000-0000-4000-8000-${(i + 1).toString().padStart(12, '0')}`;
    const fmid = `1-d0000000-0000-4000-8000-${(500 + i).toString().padStart(12, '0')}`;
    out.push(
      `insert into public.matches (id, faceit_match_id, status, status_raw, map_key, map_name, started_at, finished_at, score, winner_faction, factions, competition_name, faceit_url, source, details_fetched_at, last_checked_at, is_demo)
       values (${q(id)}, ${q(fmid)}, ${cancelled ? "'cancelled'" : "'finished'"}, ${cancelled ? "'CANCELLED'" : "'FINISHED'"}, ${cancelled ? 'null' : q(map)}, ${cancelled ? 'null' : q(MAP_NAMES[map])},
               ${ts(started)}, ${cancelled ? 'null' : ts(finished)}, ${score}, ${cancelled || unknown ? 'null' : win ? "'faction1'" : "'faction2'"},
               '{"faction1": {"name": "team_lfe"}, "faction2": {"name": "team_adverse"}}'::jsonb, '5v5 RANKED',
               ${q(`https://www.faceit.com/fr/cs2/room/${fmid}`)}, 'demo', ${ts(finished)}, ${ts(finished)}, true);`,
    );
    const count = 1 + Math.floor(r() * 3);
    const start = Math.floor(r() * team.length);
    for (let j = 0; j < count; j++) {
      const p = team[(start + j) % team.length]!;
      out.push(`insert into public.match_players (match_id, player_id, faction) values (${q(id)}, ${q(playerId(p.n))}, 'faction1') on conflict do nothing;`);
      // Stats individuelles FICTIVES (Wall of Shame), déterministes et indépendantes de r().
      if (!cancelled && !unknown) {
        const h = (i + 1) * 7919 + p.n * 104729;
        out.push(
          `insert into public.match_player_stats (match_id, player_id, kills, deaths, headshots_pct, adr, won)
           values (${q(id)}, ${q(playerId(p.n))}, ${4 + (h % 23)}, ${7 + ((h >> 3) % 17)}, ${18 + ((h >> 5) % 48)}, ${45 + ((h >> 7) % 70)}.${h % 10}, ${win})
           on conflict do nothing;`,
        );
      }
    }
  }
  out.push(
    `insert into public.sync_runs (job, trigger, started_at, finished_at, status, stats)
     values ('matches', 'cron', ${ts(new Date(nowTs - 4 * 60_000))}, ${ts(new Date(nowTs - 4 * 60_000 + 20_000))}, 'ok', '{"demo":true}');`,
  );

  // ---------- Mur ----------
  for (const w of WALL) {
    const entryId = `e0000000-0000-4000-8000-${w.n.toString().padStart(12, '0')}`;
    out.push(
      `insert into public.avoid_list_entries (id, faceit_player_id, status, added_at, added_by, archived_at, is_demo)
       values (${q(entryId)}, ${q(fid(w.n))}, ${q(w.status)}, ${ts(new Date(w.added))}, ${q(ADMIN)}, ${w.status === 'archived' ? ts(new Date('2026-09-30T10:00:00Z')) : 'null'}, true);`,
    );
    if (w.reason) {
      out.push(`insert into public.avoid_list_private_notes (entry_id, reason, updated_by) values (${q(entryId)}, ${q(w.reason)}, ${q(ADMIN)});`);
    }
  }

  // ---------- Stuffs (structure de catalogue ; contenu de jeu NON décrit) ----------
  const steps = arr([
    'Exemple fictif : décris ici la position de départ exacte.',
    'Exemple fictif : décris le point de visée (repère visuel).',
    'Exemple fictif : précise le type de lancer et le timing.',
  ]);
  const stuffs: { map: string; slug: string; title: string; side: string; grenade: string; zone: string; from: string; to: string; tech: string; diff: string; verified: string | null; video?: string }[] = [
    { map: 'mirage', slug: 'exemple-smoke-mid-1', title: 'Exemple · Smoke mid', side: 'T', grenade: 'smoke', zone: 'Mid', from: 'Départ (exemple)', to: 'Arrivée mid (exemple)', tech: 'jumpthrow', diff: 'easy', verified: '2026-10-02T12:00:00Z' },
    { map: 'mirage', slug: 'exemple-flash-mid-1', title: 'Exemple · Flash mid', side: 'T', grenade: 'flash', zone: 'Mid', from: 'Départ (exemple)', to: 'Arrivée mid (exemple)', tech: 'static', diff: 'medium', verified: '2026-09-15T12:00:00Z' },
    { map: 'mirage', slug: 'exemple-smoke-site-a', title: 'Exemple · Smoke site A', side: 'T', grenade: 'smoke', zone: 'Site A', from: 'Départ (exemple)', to: 'Arrivée site A (exemple)', tech: 'jumpthrow', diff: 'hard', verified: null },
    { map: 'mirage', slug: 'exemple-molotov-site-a', title: 'Exemple · Molotov site A', side: 'CT', grenade: 'molotov', zone: 'Site A', from: 'Départ (exemple)', to: 'Arrivée site A (exemple)', tech: 'runthrow', diff: 'medium', verified: '2026-10-05T12:00:00Z' },
    { map: 'mirage', slug: 'exemple-he-site-b', title: 'Exemple · HE site B', side: 'CT', grenade: 'he', zone: 'Site B', from: 'Départ (exemple)', to: 'Arrivée site B (exemple)', tech: 'static', diff: 'easy', verified: '2026-10-05T12:00:00Z' },
    { map: 'mirage', slug: 'exemple-smoke-site-b', title: 'Exemple · Smoke site B', side: 'BOTH', grenade: 'smoke', zone: 'Site B', from: 'Départ (exemple)', to: 'Arrivée site B (exemple)', tech: 'walkthrow', diff: 'medium', verified: '2026-09-28T12:00:00Z' },
    { map: 'inferno', slug: 'exemple-smoke-banane', title: 'Exemple · Smoke banane', side: 'T', grenade: 'smoke', zone: 'Banane', from: 'Départ (exemple)', to: 'Arrivée banane (exemple)', tech: 'jumpthrow', diff: 'medium', verified: '2026-10-01T12:00:00Z' },
    { map: 'inferno', slug: 'exemple-molotov-banane', title: 'Exemple · Molotov banane', side: 'CT', grenade: 'molotov', zone: 'Banane', from: 'Départ (exemple)', to: 'Arrivée banane (exemple)', tech: 'static', diff: 'easy', verified: '2026-10-01T12:00:00Z' },
    { map: 'inferno', slug: 'exemple-flash-site-a', title: 'Exemple · Flash site A', side: 'T', grenade: 'flash', zone: 'Site A', from: 'Départ (exemple)', to: 'Arrivée site A (exemple)', tech: 'jump_crouch', diff: 'hard', verified: null },
    { map: 'dust2', slug: 'exemple-smoke-xbox', title: 'Exemple · Smoke mid', side: 'T', grenade: 'smoke', zone: 'Mid', from: 'Départ (exemple)', to: 'Arrivée mid (exemple)', tech: 'static', diff: 'easy', verified: '2026-09-20T12:00:00Z' },
    { map: 'dust2', slug: 'exemple-flash-long', title: 'Exemple · Flash long', side: 'T', grenade: 'flash', zone: 'Long A', from: 'Départ (exemple)', to: 'Arrivée long (exemple)', tech: 'runthrow', diff: 'medium', verified: '2026-09-20T12:00:00Z' },
  ];
  const stuffIds: string[] = [];
  stuffs.forEach((s, i) => {
    const id = `f0000000-0000-4000-8000-${(i + 1).toString().padStart(12, '0')}`;
    stuffIds.push(id);
    out.push(
      `insert into public.utilities (id, map_id, slug, title, side, grenade, zone, origin_name, target_name, purpose, description, steps, technique, difficulty, tags, verified_at, status, is_demo, created_by)
       select ${q(id)}, m.id, ${q(s.slug)}, ${q(s.title)}, ${q(s.side)}, ${q(s.grenade)}, ${q(s.zone)}, ${q(s.from)}, ${q(s.to)},
              'Exemple fictif : à quoi sert ce stuff.', 'Fiche de démonstration : structure de la page uniquement, aucun lineup réel.',
              ${steps}, ${q(s.tech)}, ${q(s.diff)}, ${arr(['exemple'])}, ${s.verified ? ts(new Date(s.verified)) : 'null'}, 'published', true, ${q(ADMIN)}
       from public.maps m where m.slug = ${q(s.map)};`,
    );
  });
  out.push(
    `insert into public.utilities (map_id, slug, title, side, grenade, zone, origin_name, target_name, steps, technique, difficulty, status, is_demo, created_by)
     select m.id, 'exemple-brouillon', 'Exemple · Brouillon non publié', 'T', 'smoke', 'Mid', 'Départ (exemple)', 'Arrivée (exemple)', '{}', 'static', 'easy', 'draft', true, ${q(ADMIN)}
     from public.maps m where m.slug = 'mirage';`,
  );
  out.push(
    `insert into public.utility_reports (utility_id, reported_by, note) values (${q(stuffIds[1]!)}, ${q(ADMIN)}, 'Exemple fictif : ne passe plus depuis la mise à jour.');`,
  );

  // ---------- Crosshairs (codes de démonstration : forme valide, contenu inventé) ----------
  const crosshairs: { n: number | null; label: string; code: string; preview: string; map: string | null; verified: string | null; published: boolean }[] = [
    { n: 1, label: 'Exemple · Classique fin', code: 'CSGO-EXEMP-LEFAK-EAAAA-AAAAA-AAAAB', preview: '{"len":3,"gap":-1,"thickness":1,"outline":1,"dot":false,"color":"#3CFF6E"}', map: 'dust2', verified: '2026-10-04', published: true },
    { n: 2, label: 'Exemple · Point cyan', code: 'CSGO-EXEMP-LEFAK-EAAAA-AAAAA-AAAAC', preview: '{"len":0,"gap":0,"thickness":2,"outline":1,"dot":true,"color":"#41E5FF"}', map: 'mirage', verified: '2026-09-12', published: true },
    { n: 3, label: 'Exemple · Gros contraste', code: 'CSGO-EXEMP-LEFAK-EAAAA-AAAAA-AAAAD', preview: '{"len":5,"gap":2,"thickness":2,"outline":2,"dot":false,"color":"#FFE04A"}', map: null, verified: null, published: true },
    { n: null, label: 'Exemple · Brouillon', code: 'CSGO-EXEMP-LEFAK-EAAAA-AAAAA-AAAAE', preview: '{"len":2,"gap":0,"thickness":1,"outline":0,"dot":true,"color":"#FF3EDB"}', map: null, verified: null, published: false },
  ];
  crosshairs.forEach((c, i) => {
    out.push(
      `insert into public.crosshairs (player_id, label, share_code, notes, preview, preview_map_id, verified_at, is_published, is_demo, sort_order)
       values (${c.n ? q(playerId(c.n)) : 'null'}, ${q(c.label)}, ${q(c.code)}, 'Exemple fictif : code de démonstration, ne pas importer.', ${q(c.preview)}::jsonb,
               ${c.map ? `(select id from public.maps where slug = ${q(c.map)})` : 'null'}, ${c.verified ? q(c.verified) : 'null'}, ${c.published}, true, ${(i + 1) * 10});`,
    );
  });

  // Clips fictifs : aucun lecteur ni lien externe activé pour ces exemples.
  ['Exemple · Le clutch impossible', 'Exemple · Trois ouvertures', 'Exemple · Le dernier round'].forEach(
    (title, i) => {
      const videoId = `DEMOclip00${i}`;
      out.push(`insert into public.clips (title, provider, external_id, source_url, player_id, map_id, recorded_on, description, consent_confirmed, is_published, is_demo)
      values (${q(title)}, 'youtube', ${q(videoId)}, ${q(`https://www.youtube.com/watch?v=${videoId}`)}, ${q(playerId(i + 1))},
      (select id from public.maps where slug = ${q(i === 1 ? 'inferno' : 'mirage')}), ${q(`2026-10-${12 - i}`)}, 'Exemple fictif de présentation, aucune vidéo réelle associée.', true, true, true);`);
    },
  );
  return out.join('\n');
}

/** Tables vidées par une réinitialisation locale (les comptes locaux sont conservés). */
export const RESET_SQL = `
  truncate table public.clips, public.crosshairs, public.utility_reports, public.utilities, public.map_positions, public.match_players, public.matches,
    public.elo_snapshots, public.sync_failures, public.sync_runs,
    public.avoid_list_private_notes, public.avoid_list_entries, public.players, public.faceit_profiles restart identity cascade;
  update public.live_detection set source = 'none', verified_at = null, verification_note = null where id = 1;
  -- Maps de référence : visibles, ordre d'origine, sans images téléversées ; maps ajoutées retirées.
  delete from public.maps where slug not in ('mirage', 'inferno', 'dust2', 'ancient', 'nuke', 'anubis', 'overpass', 'train');
  update public.maps m
     set name = r.name, active = true, sort_order = r.sort_order, cover_path = null, aerial_path = null
    from (values ('mirage', 'Mirage', 10), ('inferno', 'Inferno', 20), ('dust2', 'Dust II', 30), ('ancient', 'Ancient', 40),
                 ('nuke', 'Nuke', 50), ('anubis', 'Anubis', 60), ('overpass', 'Overpass', 65), ('train', 'Train', 70)) as r(slug, name, sort_order)
   where m.slug = r.slug;
`;
