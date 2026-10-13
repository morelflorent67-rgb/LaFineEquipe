/* Forge V2 final · données du prototype.
   - Joueurs, matchs, Mur, stuffs et positions : FICTIFS (pseudos « demo_* », inexistants sur FACEIT).
   - Images de maps : écrans de chargement et radars officiels de CS2 (Valve), extraits du jeu installé,
     et captures Steam de la team recadrées. Usage local du prototype uniquement.
   Toutes les pages lisent ces mêmes données : compteurs, classements et cartes restent cohérents. */
window.LFE_DATA = (function () {
  'use strict';

  /* Horloge du prototype : on garde la vraie heure pour que « il y a 2 min » vive pendant la démo. */
  var NOW = new Date();
  var DAY = 864e5;
  function daysAgo(n) { return new Date(NOW.getTime() - n * DAY); }

  /* ---------- Joueurs (classement permanent) ----------
     addedElo = ELO relevé au moment de l'ajout par l'admin ; elo = dernier relevé.
     Aucun relevé n'existe avant addedAt : le graphique commence à l'ajout. */
  var PLAYERS = [
    { id: 'p1',  nick: 'demo_kestrel', group: 'team',  lvl: 10, elo: 2481, addedElo: 2390, addedDays: 41, ava: 1,  last: 'VVDVV' },
    { id: 'p2',  nick: 'demo_vandal',  group: 'team',  lvl: 10, elo: 2402, addedElo: 2455, addedDays: 41, ava: 2,  last: 'DDVDV' },
    { id: 'p3',  nick: 'demo_nova',    group: 'team',  lvl: 10, elo: 2338, addedElo: 2191, addedDays: 41, ava: 3,  last: 'VVVDV' },
    { id: 'p4',  nick: 'demo_brasier', group: 'team',  lvl: 10, elo: 2322, addedElo: 2232, addedDays: 34, ava: 4,  last: 'VDVVD' },
    { id: 'p5',  nick: 'demo_axel',    group: 'guest', lvl: 10, elo: 2190, addedElo: 2214, addedDays: 27, ava: 5,  last: 'DVDDV' },
    { id: 'p6',  nick: 'demo_ombre',   group: 'team',  lvl: 10, elo: 2171, addedElo: 2046, addedDays: 41, ava: 6,  last: 'VVVVD' },
    { id: 'p7',  nick: 'demo_silex',   group: 'team',  lvl: 9,  elo: 1978, addedElo: 1960, addedDays: 19, ava: 7,  last: 'VDCDV' },
    { id: 'p8',  nick: 'demo_rafale',  group: 'guest', lvl: 9,  elo: 1964, addedElo: 1995, addedDays: 12, ava: 8,  last: 'DDVDD' },
    { id: 'p9',  nick: 'demo_titan',   group: 'team',  lvl: 9,  elo: 1847, addedElo: 1803, addedDays: 41, ava: 9,  last: 'VVDVU' },
    { id: 'p10', nick: 'demo_lynx',    group: 'guest', lvl: 8,  elo: 1702, addedElo: 1702, addedDays: 0,  ava: 10, last: 'DV' }
  ];

  /* Profils « trouvables » par la simulation d'ajout (aucun n'existe réellement). */
  var POOL = [
    { nick: 'demo_juliet', lvl: 10, elo: 2312, ava: 11, country: 'FR', id: '7a1c0f42-3b9e-4d1a-9c55-0e2f6d8b1a77', last: 'VDV' },
    { nick: 'demo_mistral', lvl: 9, elo: 1934, ava: 12, country: 'BE', id: 'c51e9a08-6d24-4f1b-a8e3-92b47f0d3c19', last: 'DD' },
    { nick: 'demo_zephyr', lvl: 10, elo: 2577, ava: 13, country: 'FR', id: '0f8d2b6e-91c4-4a7e-b3d1-5e6a7c9f2048', last: 'VVV' },
    { nick: 'demo_onyx', lvl: 7, elo: 1418, ava: 14, country: 'CH', id: '9b3e7d10-2a5f-4c8b-9e61-d4f0a2c7b835', last: 'D' }
  ];

  /* Relevés : un par jour depuis l'ajout (en vrai : toutes les 5 min, puis compactés par jour). */
  function snapshots(p, seed) {
    var n = p.addedDays, out = [], x = seed;
    if (n === 0) return [{ at: new Date(NOW.getTime() - 3 * 36e5), elo: p.addedElo }];
    for (var d = n; d >= 0; d--) {
      var t = (n - d) / n;
      x = (x * 53 + 17) % 101;
      var noise = d === n || d === 0 ? 0 : Math.round((x / 101 - 0.5) * 46);
      out.push({ at: daysAgo(d), elo: Math.round(p.addedElo + (p.elo - p.addedElo) * Math.pow(t, 0.9) + noise) });
    }
    return out;
  }
  PLAYERS.forEach(function (p, i) {
    p.addedAt = p.addedDays === 0 ? new Date(NOW.getTime() - 3 * 36e5) : daysAgo(p.addedDays);
    p.snaps = snapshots(p, 7 + i * 11);
  });

  /* ---------- Matchs récents (accueil) ---------- */
  var MATCHES = [
    { res: 'V', map: 'mirage',  score: [13, 9],  who: ['demo_nova', 'demo_ombre', 'demo_kestrel'], ago: 52 },
    { res: 'D', map: 'ancient', score: [10, 13], who: ['demo_vandal'], ago: 130 },
    { res: 'V', map: 'inferno', score: [13, 6],  who: ['demo_brasier', 'demo_silex'], ago: 290 },
    { res: 'C', map: 'anubis',  score: null,     who: ['demo_rafale'], ago: 410 },
    { res: 'V', map: 'nuke',    score: [16, 14], who: ['demo_titan', 'demo_kestrel'], ago: 1340 },
    { res: 'D', map: 'dust2',   score: [8, 13],  who: ['demo_axel', 'demo_lynx'], ago: 1500 }
  ];

  /* ---------- Mur des lamentations (fictif) ---------- */
  var WALL = [
    { nick: 'demo_kilo', lvl: 8, elo: 1688, ava: 15, days: 2 },
    { nick: 'demo_lima', lvl: 6, elo: 1262, ava: 16, days: 4 },
    { nick: 'demo_mike', lvl: 10, elo: 2305, ava: 17, days: 6 },
    { nick: 'demo_november', lvl: 4, elo: 968, ava: 18, days: 9 },
    { nick: 'demo_oscar', lvl: 9, elo: 1874, ava: 19, days: 11 },
    { nick: 'demo_papa', lvl: 7, elo: 1410, ava: 20, days: 15 },
    { nick: 'demo_quebec', lvl: 5, elo: 1133, ava: 3, days: 18 },
    { nick: 'demo_romeo', lvl: 8, elo: 1592, ava: 6, days: 22 },
    { nick: 'demo_sierra', lvl: null, elo: null, ava: 0, days: 25 },
    { nick: 'demo_tango', lvl: 9, elo: 1955, ava: 9, days: 29 },
    { nick: 'demo_uniform', lvl: 6, elo: 1301, ava: 12, days: 33 },
    { nick: 'demo_victor', lvl: 3, elo: 842, ava: 14, days: 37 }
  ];
  WALL.forEach(function (w) { w.addedAt = daysAgo(w.days); });

  /* ---------- Maps (gérées en admin : ajout, retrait, ordre, images) ---------- */
  var MAPS = [
    { slug: 'mirage', name: 'Mirage' }, { slug: 'inferno', name: 'Inferno' }, { slug: 'dust2', name: 'Dust II' },
    { slug: 'ancient', name: 'Ancient' }, { slug: 'nuke', name: 'Nuke' }, { slug: 'anubis', name: 'Anubis' },
    { slug: 'overpass', name: 'Overpass' }, { slug: 'train', name: 'Train' }
  ];
  MAPS.forEach(function (m) {
    var base = 'assets/media/maps/' + m.slug + '/';
    m.cover = base + 'cover.webp'; m.hero = base + 'hero.webp'; m.radar = base + 'radar.webp';
    m.shots = [base + 'shot-1.webp', base + 'shot-2.webp'];
  });

  /* ---------- Positions de lancer (x, y en % du radar) : EXEMPLES placés à la main ---------- */
  var POSITIONS = {
    mirage: [
      { id: 'mi-tspawn', name: 'Départ T', x: 86, y: 40 },
      { id: 'mi-ramp', name: 'Rampe A', x: 79, y: 60 },
      { id: 'mi-palace', name: 'Palais', x: 72, y: 76 },
      { id: 'mi-topmid', name: 'Haut de mid', x: 70, y: 45 },
      { id: 'mi-apps', name: 'Appartements B', x: 42, y: 20 }
    ],
    dust2: [
      { id: 'd2-tspawn', name: 'Départ T', x: 39, y: 88 },
      { id: 'd2-longdoors', name: 'Portes long', x: 84, y: 62 },
      { id: 'd2-uppertun', name: 'Tunnels hauts', x: 17, y: 44 }
    ],
    inferno: [
      { id: 'in-banana', name: 'Bas de banane', x: 45, y: 56 },
      { id: 'in-tramp', name: 'Rampe T', x: 33, y: 64 },
      { id: 'in-mid', name: 'Milieu', x: 62, y: 80 }
    ],
    ancient: [], nuke: [], anubis: [], overpass: [], train: []
  };

  /* ---------- Stuffs (fictifs) ----------
     img : [départ, visée] ; src 'team' = capture de la team, 'valve' = image officielle du jeu. */
  var T = 'assets/media/team/';
  function mshot(slug, n) { return 'assets/media/maps/' + slug + '/shot-' + n + '.webp'; }
  var STUFFS = [
    { id: 'mirage-smoke-window', map: 'mirage', type: 'smoke', side: 'T', title: 'Smoke Fenêtre', from: 'mi-tspawn', to: 'Fenêtre CT (mid)', land: [43, 41], tech: 'Jumpthrow', diff: 'Facile', verified: 6, img: [T + 'mirage-team-2.webp', mshot('mirage', 1)], src: ['team', 'valve'], tags: ['mid', 'exécution'] },
    { id: 'mirage-smoke-ct', map: 'mirage', type: 'smoke', side: 'T', title: 'Smoke CT', from: 'mi-ramp', to: 'Entrée CT (A)', land: [40, 72], tech: 'Lancer debout', diff: 'Moyen', verified: 6, img: [mshot('mirage', 2), T + 'mirage-team-1.webp'], src: ['valve', 'team'], tags: ['site A'] },
    { id: 'mirage-smoke-jungle', map: 'mirage', type: 'smoke', side: 'T', title: 'Smoke Jungle', from: 'mi-ramp', to: 'Jungle', land: [49, 62], tech: 'Jumpthrow', diff: 'Moyen', verified: 21, img: [T + 'mirage-team-1.webp', mshot('mirage', 3)], src: ['team', 'valve'], tags: ['site A'] },
    { id: 'mirage-smoke-stairs', map: 'mirage', type: 'smoke', side: 'T', title: 'Smoke Escaliers', from: 'mi-ramp', to: 'Escaliers A', land: [66, 64], tech: 'Lancer debout', diff: 'Facile', verified: 21, img: [mshot('mirage', 1), mshot('mirage', 2)], src: ['valve', 'valve'], tags: ['site A'] },
    { id: 'mirage-flash-a', map: 'mirage', type: 'flash', side: 'T', title: 'Flash pop A', from: 'mi-palace', to: 'Site A', land: [55, 75], tech: 'Clic droit', diff: 'Facile', verified: 3, img: [mshot('mirage', 3), T + 'mirage-team-2.webp'], src: ['valve', 'team'], tags: ['site A', 'entrée'] },
    { id: 'mirage-molo-firebox', map: 'mirage', type: 'molo', side: 'T', title: 'Molotov Firebox', from: 'mi-palace', to: 'Firebox (A)', land: [60, 79], tech: 'Lancer debout', diff: 'Moyen', verified: 74, img: [mshot('mirage', 2), mshot('mirage', 3)], src: ['valve', 'valve'], tags: ['site A'] },
    { id: 'mirage-he-topmid', map: 'mirage', type: 'he', side: 'T', title: 'HE Haut de mid', from: 'mi-tspawn', to: 'Haut de mid', land: [66, 44], tech: 'Runthrow', diff: 'Facile', verified: 12, img: [T + 'mirage-team-2.webp', mshot('mirage', 1)], src: ['team', 'valve'], tags: ['mid'] },
    { id: 'mirage-smoke-market', map: 'mirage', type: 'smoke', side: 'T', title: 'Smoke Fenêtre marché', from: 'mi-apps', to: 'Fenêtre marché (B)', land: [27, 41], tech: 'Jumpthrow', diff: 'Difficile', verified: 30, img: [mshot('mirage', 3), mshot('mirage', 1)], src: ['valve', 'valve'], tags: ['site B'] },
    { id: 'mirage-molo-bench', map: 'mirage', type: 'molo', side: 'T', title: 'Molotov Banc B', from: 'mi-apps', to: 'Banc (B)', land: [18, 31], tech: 'Lancer debout', diff: 'Facile', verified: 30, img: [mshot('mirage', 1), mshot('mirage', 2)], src: ['valve', 'valve'], tags: ['site B'] },
    { id: 'mirage-flash-topmid-ct', map: 'mirage', type: 'flash', side: 'CT', title: 'Flash retake haut de mid', from: 'mi-topmid', to: 'Haut de mid', land: [72, 42], tech: 'Clic gauche + droit', diff: 'Moyen', verified: 9, img: [mshot('mirage', 2), T + 'mirage-team-1.webp'], src: ['valve', 'team'], tags: ['mid', 'retake'] },

    { id: 'dust2-smoke-xbox', map: 'dust2', type: 'smoke', side: 'T', title: 'Smoke Xbox', from: 'd2-tspawn', to: 'Xbox (mid)', land: [45, 60], tech: 'Jumpthrow', diff: 'Facile', verified: 5, img: [T + 'dust2-team-2.webp', mshot('dust2', 1)], src: ['team', 'valve'], tags: ['mid'] },
    { id: 'dust2-smoke-ctmid', map: 'dust2', type: 'smoke', side: 'T', title: 'Smoke CT mid', from: 'd2-tspawn', to: 'Portes mid', land: [49, 36], tech: 'Jumpthrow', diff: 'Moyen', verified: 5, img: [T + 'dust2-team-3.webp', mshot('dust2', 2)], src: ['team', 'valve'], tags: ['mid', 'site B'] },
    { id: 'dust2-flash-long', map: 'dust2', type: 'flash', side: 'T', title: 'Flash Long A', from: 'd2-longdoors', to: 'Long A', land: [88, 44], tech: 'Clic droit', diff: 'Facile', verified: 15, img: [mshot('dust2', 1), T + 'dust2-team-4.webp'], src: ['valve', 'team'], tags: ['site A'] },
    { id: 'dust2-smoke-bwindow', map: 'dust2', type: 'smoke', side: 'T', title: 'Smoke Fenêtre B', from: 'd2-uppertun', to: 'Fenêtre B', land: [23, 24], tech: 'Lancer debout', diff: 'Moyen', verified: 40, img: [T + 'dust2-team-4.webp', mshot('dust2', 2)], src: ['team', 'valve'], tags: ['site B'] },
    { id: 'dust2-molo-car', map: 'dust2', type: 'molo', side: 'CT', title: 'Molotov Voiture', from: 'd2-longdoors', to: 'Voiture (long)', land: [86, 52], tech: 'Lancer debout', diff: 'Facile', verified: 15, img: [mshot('dust2', 2), mshot('dust2', 1)], src: ['valve', 'valve'], tags: ['site A', 'défense'] },

    { id: 'inferno-smoke-ct', map: 'inferno', type: 'smoke', side: 'T', title: 'Smoke CT B', from: 'in-banana', to: 'CT (B)', land: [60, 22], tech: 'Jumpthrow', diff: 'Moyen', verified: 8, img: [T + 'inferno-team-1.webp', mshot('inferno', 1)], src: ['team', 'valve'], tags: ['site B'] },
    { id: 'inferno-molo-coffin', map: 'inferno', type: 'molo', side: 'T', title: 'Molotov Cercueil', from: 'in-banana', to: 'Cercueil (B)', land: [50, 17], tech: 'Lancer debout', diff: 'Facile', verified: 8, img: [mshot('inferno', 2), T + 'inferno-team-1.webp'], src: ['valve', 'team'], tags: ['site B'] },
    { id: 'inferno-flash-banana', map: 'inferno', type: 'flash', side: 'T', title: 'Flash Banane', from: 'in-tramp', to: 'Banane', land: [47, 44], tech: 'Clic droit', diff: 'Facile', verified: 27, img: [mshot('inferno', 1), mshot('inferno', 2)], src: ['valve', 'valve'], tags: ['site B'] },
    { id: 'inferno-smoke-moto', map: 'inferno', type: 'smoke', side: 'T', title: 'Smoke Moto', from: 'in-mid', to: 'Moto (A)', land: [76, 59], tech: 'Jumpthrow', diff: 'Difficile', verified: 27, img: [mshot('inferno', 2), mshot('inferno', 1)], src: ['valve', 'valve'], tags: ['site A'] },

    { id: 'ancient-smoke-cave', map: 'ancient', type: 'smoke', side: 'T', title: 'Smoke Cave', from: null, to: 'Cave (mid)', land: null, tech: 'Jumpthrow', diff: 'Moyen', verified: 52, img: [mshot('ancient', 1), mshot('ancient', 2)], src: ['valve', 'valve'], tags: ['mid'] },
    { id: 'ancient-flash-a', map: 'ancient', type: 'flash', side: 'T', title: 'Flash Main A', from: null, to: 'Site A', land: null, tech: 'Clic droit', diff: 'Facile', verified: 52, img: [mshot('ancient', 2), mshot('ancient', 1)], src: ['valve', 'valve'], tags: ['site A'] },
    { id: 'nuke-smoke-outside', map: 'nuke', type: 'smoke', side: 'T', title: 'Smoke Extérieur', from: null, to: 'Extérieur', land: null, tech: 'Jumpthrow', diff: 'Difficile', verified: 88, img: [mshot('nuke', 1), mshot('nuke', 2)], src: ['valve', 'valve'], tags: ['extérieur'] },
    { id: 'anubis-molo-b', map: 'anubis', type: 'molo', side: 'CT', title: 'Molotov Entrée B', from: null, to: 'Entrée B', land: null, tech: 'Lancer debout', diff: 'Facile', verified: 14, img: [mshot('anubis', 1), mshot('anubis', 2)], src: ['valve', 'valve'], tags: ['site B', 'défense'] },
    { id: 'train-smoke-ivy', map: 'train', type: 'smoke', side: 'T', title: 'Smoke Ivy', from: null, to: 'Ivy (A)', land: null, tech: 'Jumpthrow', diff: 'Moyen', verified: 19, img: [T + 'train-team-1.webp', mshot('train', 1)], src: ['team', 'valve'], tags: ['site A'] }
  ];
  STUFFS.forEach(function (s) { s.verifiedAt = daysAgo(s.verified); s.stale = s.verified > 60; });

  /* Modifications faites dans l'aperçu d'administration (positions, rattachements, impacts) :
     gardées pour la session du navigateur, pour les retrouver sur la carte tactique. */
  var EDITS_KEY = 'lfe-proto-edits';
  try {
    var edits = JSON.parse(sessionStorage.getItem(EDITS_KEY) || 'null');
    if (edits && edits.positions) Object.keys(edits.positions).forEach(function (k) { POSITIONS[k] = edits.positions[k]; });
    if (edits && edits.links) STUFFS.forEach(function (s) { var l = edits.links[s.id]; if (l) { s.from = l.from; s.land = l.land; } });
  } catch (e) { /* stockage indisponible : on garde les exemples */ }
  function saveEdits() {
    try {
      var links = {};
      STUFFS.forEach(function (s) { links[s.id] = { from: s.from, land: s.land }; });
      sessionStorage.setItem(EDITS_KEY, JSON.stringify({ positions: POSITIONS, links: links }));
      return true;
    } catch (e) { return false; }
  }
  function resetEdits() { try { sessionStorage.removeItem(EDITS_KEY); } catch (e) { /* rien */ } }

  var TYPES = {
    smoke: { label: 'Smoke', icon: 'g-smoke' }, flash: { label: 'Flash', icon: 'g-flash' },
    molo: { label: 'Molotov', icon: 'g-molo' }, he: { label: 'HE', icon: 'g-he' }
  };
  var DIFF = { Facile: 1, Moyen: 2, Difficile: 3 };

  /* ---------- Outils de rendu partagés ---------- */
  var nf = new Intl.NumberFormat('fr-FR');
  function fmt(n) { return nf.format(n).replace(/ | /g, ' '); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateFr(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function dateShort(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function timeFr(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ago(d) {
    var s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
    if (s < 45) return 'à l’instant';
    var m = Math.round(s / 60);
    if (m < 60) return 'il y a ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    var j = Math.round(h / 24);
    return j === 1 ? 'hier' : 'il y a ' + j + ' jours';
  }
  function delta(p) { return p.elo - p.addedElo; }
  function deltaHtml(n) {
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
    var ar = n > 0 ? '▲' : n < 0 ? '▼' : '=';
    var txt = n > 0 ? '+' + fmt(n) : n < 0 ? '−' + fmt(Math.abs(n)) : '±0';
    var label = n > 0 ? 'progression de ' + n + ' ELO' : n < 0 ? 'baisse de ' + Math.abs(n) + ' ELO' : 'ELO inchangé depuis l’ajout';
    return '<span class="dl ' + cls + '" aria-label="' + label + '"><span class="ar" aria-hidden="true">' + ar + '</span>' + txt + '</span>';
  }
  var RB = { V: ['v', 'V', 'Victoire'], D: ['d', 'D', 'Défaite'], C: ['c', '–', 'Match annulé'], U: ['u', '?', 'Résultat inconnu'] };
  function badge(r, cls) { var b = RB[r] || RB.U; return '<span class="rb ' + b[0] + (cls ? ' ' + cls : '') + '" title="' + b[2] + '" aria-label="' + b[2] + '">' + b[1] + '</span>'; }
  function seriesHtml(str, n) {
    var arr = String(str || '').split('').slice(0, n || 5);
    if (!arr.length) return '<span class="muted small">Aucun match</span>';
    return '<span class="series" aria-label="' + arr.length + ' derniers résultats, du plus récent au plus ancien">' + arr.map(function (r) { return badge(r); }).join('') + '</span>';
  }
  function avatarSrc(i) { return i ? 'assets/avatars/avatar-' + pad(i) + '.svg' : null; }
  function ava(p, size, cls) {
    var src = avatarSrc(p.ava);
    return '<span class="ava' + (cls ? ' ' + cls : '') + '" style="--lvl:' + (p.lvl || 0) + ';--s:' + (size || 44) + 'px">'
      + (src ? '<img src="' + src + '" alt="" loading="lazy" decoding="async">' : '<svg class="sil" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="25" r="11"/><path d="M12 60c0-11 9-19 20-19s20 8 20 19z"/></svg>')
      + '</span>';
  }
  function lvl(n) { return n ? '<span class="lvl' + (n === 10 ? ' top' : '') + '" aria-label="Niveau FACEIT ' + n + '">' + n + '</span>' : '<span class="lvl" aria-label="Niveau inconnu">–</span>'; }
  function mapBy(slug) { return MAPS.filter(function (m) { return m.slug === slug; })[0]; }
  function stuffsOf(slug) { return STUFFS.filter(function (s) { return s.map === slug; }); }
  function counts(slug) {
    var c = { total: 0, smoke: 0, flash: 0, molo: 0, he: 0 };
    stuffsOf(slug).forEach(function (s) { c.total++; c[s.type]++; });
    return c;
  }
  function position(slug, id) { return (POSITIONS[slug] || []).filter(function (p) { return p.id === id; })[0] || null; }

  return {
    NOW: NOW, players: PLAYERS, pool: POOL, matches: MATCHES, wall: WALL, maps: MAPS, positions: POSITIONS, stuffs: STUFFS,
    types: TYPES, diff: DIFF, saveEdits: saveEdits, resetEdits: resetEdits,
    fmt: fmt, esc: esc, dateFr: dateFr, dateShort: dateShort, timeFr: timeFr, ago: ago, delta: delta, deltaHtml: deltaHtml,
    badge: badge, seriesHtml: seriesHtml, ava: ava, avatarSrc: avatarSrc, lvl: lvl, mapBy: mapBy, stuffsOf: stuffsOf, counts: counts, position: position
  };
})();
