/* Données de démonstration Forge V2 : TOUT est fictif.
   Les pseudos « demo_* » n'existent pas ; aucun lien FACEIT réel n'est utilisé. */
window.LFE_DATA = (function () {
  // Résultats du plus récent au plus ancien. V = victoire, D = défaite, C = annulé.
  var players = [
    { id: 'alpha',   nick: 'demo_alpha',   elo: 2214, start: 2176, lvl: 10, roster: 'Team',  joined: '01/10', last: ['V', 'D', 'V', 'V', 'D'], twitch: true },
    { id: 'bravo',   nick: 'demo_bravo',   elo: 1987, start: 2008, lvl: 9,  roster: 'Team',  joined: '01/10', last: ['V', 'C', 'D', 'D', 'V'] },
    { id: 'charlie', nick: 'demo_charlie', elo: 1842, start: 1756, lvl: 9,  roster: 'Team',  joined: '01/10', last: ['V', 'V', 'V', 'D', 'V'] },
    { id: 'delta',   nick: 'demo_delta',   elo: 1655, start: 1643, lvl: 8,  roster: 'Guest', joined: '01/10', last: ['V', 'D', 'V', 'D', 'V'] },
    { id: 'echo',    nick: 'demo_echo',    elo: 1503, start: 1547, lvl: 7,  roster: 'Team',  joined: '01/10', last: ['D', 'D', 'V', 'D', 'D'] },
    { id: 'foxtrot', nick: 'demo_foxtrot', elo: 2051, start: 1990, lvl: 10, roster: 'Team',  joined: '01/10', last: ['V', 'V', 'D', 'V', 'V'] },
    { id: 'golf',    nick: 'demo_golf',    elo: 1398, start: 1404, lvl: 7,  roster: 'Guest', joined: '05/10', last: ['D', 'V', 'D', 'D', 'V'] },
    { id: 'hotel',   nick: 'demo_hotel',   elo: 1720, start: 1695, lvl: 8,  roster: 'Team',  joined: '01/10', last: ['V', 'D', 'V', 'V', 'D'] }
  ];

  // Relevés journaliers fictifs (01/10 → 12/10), déterministes, qui finissent sur l'ELO actuel.
  function series(p, seed) {
    var days = 12, out = [], firstDay = p.joined === '05/10' ? 4 : 0, x = seed;
    for (var d = 0; d < days; d++) {
      if (d < firstDay) { out.push(null); continue; }
      var t = (d - firstDay) / (days - 1 - firstDay);
      x = (x * 53 + 17) % 101;
      var noise = d === firstDay || d === days - 1 ? 0 : Math.round((x / 101 - 0.5) * 34);
      out.push(Math.round(p.start + (p.elo - p.start) * t + noise));
    }
    return out;
  }
  players.forEach(function (p, i) { p.snapshots = series(p, 7 + i * 11); });

  var matches = [
    { res: 'V', map: 'Inferno', slug: 'inferno', score: [13, 9],  who: ['demo_charlie', 'demo_hotel'], when: "Aujourd'hui 13:12" },
    { res: 'D', map: 'Ancient', slug: 'ancient', score: [10, 13], who: ['demo_echo'], when: "Aujourd'hui 11:40" },
    { res: 'V', map: 'Mirage',  slug: 'mirage',  score: [13, 6],  who: ['demo_alpha', 'demo_bravo', 'demo_foxtrot'], when: 'Hier 22:31' },
    { res: 'V', map: 'Nuke',    slug: 'nuke',    score: [16, 14], who: ['demo_delta'], when: 'Hier 21:02' },
    { res: 'D', map: 'Dust II', slug: 'dust2',   score: [7, 13],  who: ['demo_golf', 'demo_hotel'], when: 'Hier 19:47' },
    { res: 'C', map: 'Anubis',  slug: 'anubis',  score: null,     who: ['demo_bravo'], when: 'Hier 18:10' }
  ];

  var maps = [
    { slug: 'mirage', name: 'Mirage', s: 9, f: 7, m: 5, h: 3 },
    { slug: 'inferno', name: 'Inferno', s: 7, f: 5, m: 4, h: 2 },
    { slug: 'dust2', name: 'Dust II', s: 6, f: 4, m: 3, h: 2 },
    { slug: 'nuke', name: 'Nuke', s: 4, f: 3, m: 1, h: 1 },
    { slug: 'ancient', name: 'Ancient', s: 3, f: 2, m: 1, h: 1 },
    { slug: 'anubis', name: 'Anubis', s: 3, f: 1, m: 1, h: 1 },
    { slug: 'train', name: 'Train', s: 2, f: 1, m: 1, h: 0 }
  ];

  // Mur des lamentations : profils fictifs. La raison n'est jamais affichée côté public.
  var wall = [
    { nick: 'demo_kilo',     id: 'a1f3…9c20', lvl: 8,  elo: 1688, added: '2026-10-11', by: 'admin_demo', status: 'active',   reason: "Exemple de note interne : communication difficile en partie." },
    { nick: 'demo_lima',     id: 'b72e…41d8', lvl: 6,  elo: 1262, added: '2026-10-09', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_mike',     id: 'c0d9…7e11', lvl: 10, elo: 2305, added: '2026-10-07', by: 'admin_demo', status: 'active',   reason: 'Exemple : plusieurs abandons constatés par la team.' },
    { nick: 'demo_november', id: 'd5a2…03bf', lvl: 4,  elo: 968,  added: '2026-10-04', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_oscar',    id: 'e8c1…5a77', lvl: 9,  elo: 1874, added: '2026-10-02', by: 'admin_demo', status: 'active',   reason: 'Exemple de note interne.' },
    { nick: 'demo_papa',     id: 'f419…c2e0', lvl: 7,  elo: 1410, added: '2026-09-28', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_quebec',   id: '0b6e…88a4', lvl: 5,  elo: 1133, added: '2026-09-25', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_romeo',    id: '1c27…f9d3', lvl: 8,  elo: 1592, added: '2026-09-21', by: 'admin_demo', status: 'active',   reason: 'Exemple de note interne.' },
    { nick: 'demo_sierra',   id: '2d90…6b15', lvl: null, elo: null, added: '2026-09-18', by: 'admin_demo', status: 'active', reason: '' },
    { nick: 'demo_tango',    id: '3e44…0c6a', lvl: 9,  elo: 1955, added: '2026-09-14', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_uniform',  id: '4f81…d270', lvl: 6,  elo: 1301, added: '2026-09-10', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_victor',   id: '5a3c…19ef', lvl: 3,  elo: 842,  added: '2026-09-06', by: 'admin_demo', status: 'active',   reason: '' },
    { nick: 'demo_whiskey',  id: '6b05…7731', lvl: 7,  elo: 1455, added: '2026-08-30', by: 'admin_demo', status: 'archived', reason: 'Exemple : archivé, on lui laisse une seconde chance.' },
    { nick: 'demo_xray',     id: '7c6d…2f48', lvl: 5,  elo: 1180, added: '2026-08-22', by: 'admin_demo', status: 'archived', reason: '' }
  ];

  function fmt(n) { return new Intl.NumberFormat('fr-FR').format(n).replace(/ /g, ' '); }
  function frDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function delta(p) { return p.elo - p.start; }
  function deltaHtml(n) {
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
    var ar = n > 0 ? '▲' : n < 0 ? '▼' : '=';
    var txt = n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0';
    var label = n > 0 ? 'gagne ' + n + ' ELO' : n < 0 ? 'perd ' + Math.abs(n) + ' ELO' : 'ELO inchangé';
    return '<span class="dl ' + cls + '" aria-label="' + label + '"><span class="ar" aria-hidden="true">' + ar + '</span>' + txt + '</span>';
  }
  var RB = { V: ['v', 'V', 'Victoire'], D: ['d', 'D', 'Défaite'], C: ['c', '–', 'Match annulé'], U: ['u', '?', 'Résultat inconnu'] };
  function badge(r, lg) { var b = RB[r] || RB.U; return '<span class="rb ' + b[0] + (lg ? ' lg' : '') + '" title="' + b[2] + '" aria-label="' + b[2] + '">' + b[1] + '</span>'; }
  function seriesHtml(arr) { return '<span class="series" aria-label="5 derniers résultats">' + arr.map(function (r) { return badge(r); }).join('') + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ava(p, s) { return '<span class="ava" style="--lvl:' + (p.lvl || 0) + (s ? ';--s:' + s + 'px' : '') + '"><img src="assets/player.svg" alt=""></span>'; }
  function lvl(n) { return n ? '<span class="lvl' + (n === 10 ? ' top' : '') + '" aria-label="Niveau FACEIT ' + n + '">' + n + '</span>' : '<span class="lvl" aria-label="Niveau inconnu">–</span>'; }

  return { players: players, matches: matches, maps: maps, wall: wall, run: { name: 'Automne 2026', day: 12, days: 31, from: '01/10', to: '31/10', snapshotAt: '12/10 à 14:32' },
    fmt: fmt, frDate: frDate, delta: delta, deltaHtml: deltaHtml, badge: badge, seriesHtml: seriesHtml, esc: esc, ava: ava, lvl: lvl };
})();
