/* Forge V2 · éléments communs (navigation, barre mobile, pied de page, panneau de démo). */
(function () {
  var html = document.documentElement;
  if (/[?&]shot=1/.test(location.search)) html.classList.add('capture-mode');
  if (location.search.indexOf('narrow=1') > -1) html.classList.add('capture-narrow');

  var ICONS = {
    spk: '<symbol id="i-spk" viewBox="0 0 20 40"><path d="M10 0 L15 24 L10 40 L5 24 Z"/></symbol>',
    arrow: '<symbol id="i-arrow" viewBox="0 0 44 20"><path d="M0 8 H30 L26 0 L44 10 L26 20 L30 12 H0 Z"/></symbol>',
    play: '<symbol id="i-play" viewBox="0 0 24 24"><path d="M5 2 L22 12 L5 22 L9 12 Z"/></symbol>',
    ext: '<symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"/></symbol>',
    lock: '<symbol id="i-lock" viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10H7zm2 0h6V7a3 3 0 0 0-6 0v3z"/></symbol>',
    search: '<symbol id="i-search" viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></symbol>',
    home: '<symbol id="i-home" viewBox="0 0 24 24"><path d="M12 2.5 22 11h-3v10h-5.5v-6h-3v6H5V11H2l10-8.5z"/></symbol>',
    trophy: '<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M6 3h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 16v3h4v2H7v-2h4v-3a6 6 0 0 1-3.4-3A5 5 0 0 1 3 8V5h3V3zm0 4H5v1a3 3 0 0 0 1.4 2.5A6 6 0 0 1 6 9V7zm12 0v2a6 6 0 0 1-.4 1.5A3 3 0 0 0 19 8V7h-1z"/></symbol>',
    target: '<symbol id="i-target" viewBox="0 0 24 24"><path d="M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1V2zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></symbol>',
    nade: '<symbol id="i-nade" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M10 1h4v3h-4zM12 5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/></symbol>',
    menu: '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M5 6h15l-1 2H4zM4 11h15l-1 2H3zM3 16h15l-1 2H2z"/></symbol>',
    wall: '<symbol id="i-wall" viewBox="0 0 24 24"><path d="M2 4h20v16H2V4zm2 2v3h7V6H4zm9 0v3h7V6h-7zM4 11v3h3v-3H4zm5 0v3h7v-3H9zm9 0v3h2v-3h-2zM4 16v2h7v-2H4zm9 0v2h7v-2h-7z"/></symbol>',
    users: '<symbol id="i-users" viewBox="0 0 24 24"><path d="M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1zm15.5-5.9c2.6.4 4.5 2.4 4.5 4.9v1h-4.2v-1c0-1.9-.8-3.6-2.1-4.9z"/></symbol>',
    smoke: '<symbol id="g-smoke" viewBox="0 0 24 24"><path d="M7 19a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.6 8.6 5 5 0 0 1 17.5 19H7z"/></symbol>',
    flash: '<symbol id="g-flash" viewBox="0 0 24 24"><path d="M12 1 L14 9 L22 6 L16 12 L22 18 L14 15 L12 23 L10 15 L2 18 L8 12 L2 6 L10 9 Z"/></symbol>',
    molo: '<symbol id="g-molo" viewBox="0 0 24 24"><path d="M12 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></symbol>',
    he: '<symbol id="g-he" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M10 1h4v3h-4z M12 5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17z M12 9a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9z"/></symbol>',
    plus: '<symbol id="i-plus" viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/></symbol>',
    edit: '<symbol id="i-edit" viewBox="0 0 24 24"><path d="M15.5 3.5l5 5L9 20H4v-5L15.5 3.5zm0 2.8L6 15.8V18h2.2l9.5-9.5-2.2-2.2z"/></symbol>',
    archive: '<symbol id="i-archive" viewBox="0 0 24 24"><path d="M3 3h18v5H3V3zm1 6h16v12H4V9zm5 3v2h6v-2H9z"/></symbol>',
    trash: '<symbol id="i-trash" viewBox="0 0 24 24"><path d="M9 2h6l1 2h5v2H3V4h5l1-2zM5 8h14l-1 14H6L5 8z"/></symbol>',
    check: '<symbol id="i-check" viewBox="0 0 24 24"><path d="M9.5 16.2 4.8 11.5l-1.4 1.4 6.1 6.1L21 7.5l-1.4-1.4z"/></symbol>',
    link: '<symbol id="i-link" viewBox="0 0 24 24"><path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2-1.4-1.4 2-2a1 1 0 1 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0zM13.4 10.6a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2 1.4 1.4-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0z"/></symbol>'
  };
  var sprite = document.createElement('div');
  sprite.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + Object.keys(ICONS).map(function (k) { return ICONS[k]; }).join('') + '</svg>';
  document.body.insertBefore(sprite.firstChild, document.body.firstChild);

  var NAV = [
    { id: 'home', label: 'Accueil', href: 'home.html', icon: 'home' },
    { id: 'elo', label: 'ELO Run', href: 'elo-run.html', icon: 'trophy' },
    { id: 'matchs', label: 'Matchs', href: 'home.html#now', icon: 'target' },
    { id: 'clips', label: 'Clips', href: 'home.html#clips', prio: 2 },
    { id: 'xh', label: 'Crosshairs', href: 'home.html#top', prio: 2, soon: true },
    { id: 'stuffs', label: 'Stuffs', href: 'stuffs.html', icon: 'nade' },
    { id: 'team', label: 'Joueurs', href: 'home.html#team' },
    { id: 'mur', label: 'Mur', full: 'Mur des lamentations', href: 'mur.html', prio: 2, restricted: true }
  ];
  function icon(id, cls) { return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  function mount(cfg) {
    var site = document.getElementById('site');
    var active = cfg.active;
    // Navigation desktop
    var navSlot = document.getElementById('nav-slot');
    if (navSlot) {
      var links = NAV.map(function (n, i) {
        return '<a href="' + n.href + '"' + (n.prio === 2 ? ' data-prio="2"' : '') + (n.id === active ? ' aria-current="page"' : '') + ' title="' + (n.full || n.label) + ' · touche ' + (i + 1) + (n.soon ? ' · page non maquettée' : '') + '">'
          + n.label + (n.restricted ? '<span class="only-visitor">' + icon('i-lock', 'lock') + '</span>' : '') + '</a>';
      }).join('');
      var more = NAV.filter(function (n) { return n.prio === 2; }).map(function (n) {
        return '<a href="' + n.href + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' + (n.full || n.label) + (n.restricted ? '<span class="only-visitor">' + icon('i-lock', 'lock') + '</span>' : '') + '</a>';
      }).join('');
      navSlot.outerHTML = '<header class="nav" id="nav">'
        + '<a class="brand" href="home.html" aria-label="LaFineEquipe, accueil"><img src="assets/brand/lfe-round-temp.webp" alt="" width="42" height="42"><span class="brand-word">La<b>Fine</b>Equipe</span></a>'
        + '<nav class="menu" aria-label="Menu principal">' + links + '</nav>'
        + '<div class="more" id="more"><button type="button" aria-expanded="false" aria-controls="more-pop">Plus <span aria-hidden="true">▾</span></button><div class="more-pop" id="more-pop">' + more + '</div></div>'
        + '<div class="nav-tools">'
        + '<a class="live only-live" href="home.html#now" title="Match en cours vérifié par FACEIT"><span class="dot"></span>Live · 1</a>'
        + '<a class="login-btn only-visitor" href="#" data-demo-login>' + icon('i-lock') + 'Connexion team</a>'
        + '<a class="admin-btn only-admin" href="admin-mur.html">' + icon('i-lock') + 'Admin</a>'
        + '</div></header>';
      var moreEl = document.getElementById('more');
      var moreBtn = moreEl.querySelector('button');
      moreBtn.addEventListener('click', function () { var o = moreEl.classList.toggle('open'); moreBtn.setAttribute('aria-expanded', String(o)); });
      document.addEventListener('click', function (e) { if (!moreEl.contains(e.target)) { moreEl.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); } });
    }

    // Barre d'onglets mobile + feuille « Menu »
    var tabSlot = document.getElementById('tab-slot');
    if (tabSlot) {
      var tabs = [NAV[0], NAV[1], NAV[2], NAV[5]];
      var sheetLinks = NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' + (n.full || n.label)
          + (n.restricted ? '<small class="only-visitor">' + icon('i-lock', 'lock') + ' réservé à la team</small>' : '') + (n.soon ? '<small>non maquettée</small>' : '') + '</a>';
      }).join('');
      tabSlot.outerHTML = '<div class="sheet" id="sheet" role="dialog" aria-label="Toutes les pages">' + sheetLinks
        + '<hr><a class="only-visitor" href="#" data-demo-login>Connexion team <small>membres et admin</small></a>'
        + '<a class="only-admin" href="admin-mur.html">Espace admin <small>' + icon('i-lock', 'lock') + '</small></a></div>'
        + '<nav class="tabbar" aria-label="Navigation rapide">'
        + tabs.map(function (n) {
          var cur = n.id === active || (active === 'stuff-fiche' && n.id === 'stuffs');
          return '<a href="' + n.href + '"' + (cur ? ' aria-current="page"' : '') + '>' + icon('i-' + n.icon) + (n.id === 'matchs' ? '<span class="tdot only-live"></span>' : '') + n.label + '</a>';
        }).join('')
        + '<button type="button" id="sheet-btn" aria-expanded="false" aria-controls="sheet">' + icon('i-menu') + 'Menu</button></nav>';
      var sheet = document.getElementById('sheet');
      var sbtn = document.getElementById('sheet-btn');
      sbtn.addEventListener('click', function () { var o = sheet.classList.toggle('open'); sbtn.setAttribute('aria-expanded', String(o)); });
      sheet.addEventListener('click', function (e) { if (e.target.closest('a')) { sheet.classList.remove('open'); sbtn.setAttribute('aria-expanded', 'false'); } });
    }

    // Pied de page
    var footSlot = document.getElementById('foot-slot');
    if (footSlot) {
      footSlot.outerHTML = '<footer class="foot"><p class="foot-word" aria-hidden="true">La<b>Fine</b>Equipe</p><div class="foot-row">'
        + '<span class="foot-brand"><img src="assets/brand/lfe-round-temp.webp" alt="" width="34" height="34">Site communautaire, non affilié à FACEIT ni à Valve.</span>'
        + '<nav aria-label="Pied de page"><a href="elo-run.html">ELO Run</a><a href="stuffs.html">Stuffs</a><a href="mur.html">Mur des lamentations</a><a class="only-visitor" href="#" data-demo-login>Connexion team</a><a class="only-admin" href="admin-mur.html">Espace admin</a></nav>'
        + '<span class="kbd-hint">Raccourcis : <kbd>1</kbd>…<kbd>8</kbd> pour changer de page</span></div></footer>';
    }

    // Raccourcis clavier 1 à 8 (desktop)
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= NAV.length) { toast(NAV[n - 1].full || NAV[n - 1].label); location.href = NAV[n - 1].href; }
    });

    // « Connexion team » simulée dans le prototype
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-demo-login]');
      if (!a) return;
      e.preventDefault();
      setState('role', 'member');
      toast('Connexion simulée : rôle « membre »');
    });

    buildDemo(cfg);
  }

  // ---- Panneau de démo ----
  var GROUPS = {
    view: ['Vue', [['desktop', 'Desktop'], ['mobile', 'Mobile 390']]],
    role: ['Rôle', [['visitor', 'Visiteur'], ['member', 'Membre'], ['admin', 'Admin']]],
    live: ['Match', [['live', 'En cours'], ['none', 'Aucun'], ['na', 'Indispo']]],
    fresh: ['Données', [['ok', 'À jour'], ['stale', 'Périmées']]]
  };
  function setState(key, val) {
    var site = document.getElementById('site');
    if (key === 'view') document.getElementById('stage').classList.toggle('mobile', val === 'mobile');
    else site.setAttribute('data-' + key, val);
    document.querySelectorAll('.demo [data-k="' + key + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === val)); });
    document.dispatchEvent(new CustomEvent('lfe:state', { detail: { key: key, value: val } }));
  }
  function buildDemo(cfg) {
    var site = document.getElementById('site');
    var groups = cfg.demo || ['view'];
    var box = document.createElement('aside');
    box.className = 'demo';
    box.setAttribute('aria-label', 'Contrôles du prototype');
    box.innerHTML = '<b>Forge V2</b>' + groups.map(function (g) {
      var def = g === 'view' ? 'desktop' : site.getAttribute('data-' + g);
      return '<div class="grp"><span>' + GROUPS[g][0] + '</span>' + GROUPS[g][1].map(function (o) {
        return '<button type="button" data-k="' + g + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === def) + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    }).join('') + '<a class="hide-min" href="index.html">← Sommaire V2</a><button type="button" class="min-btn">Réduire</button>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('min-btn')) { var m = box.classList.toggle('min'); b.textContent = m ? 'Contrôles' : 'Réduire'; return; }
      setState(b.getAttribute('data-k'), b.getAttribute('data-v'));
    });
    if (location.hash === '#mobile') setState('view', 'mobile');
    if (window.innerWidth < 640) { box.classList.add('min'); box.querySelector('.min-btn').textContent = 'Contrôles'; }
  }

  // ---- Toast ----
  var toastEl, tt;
  function toast(msg, err) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!err);
    toastEl.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  window.LFE = { mount: mount, toast: toast, setState: setState, icon: icon };
})();
