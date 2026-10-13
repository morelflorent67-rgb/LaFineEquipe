/* Forge V2 final · éléments communs du prototype : icônes, navigation, barre mobile, pied de page,
   panneau de démo, toasts, apparitions au défilement et animation FLIP des classements. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('js');
  if (/[?&]shot=1/.test(location.search)) html.classList.add('capture');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return mq.matches || html.classList.contains('reduce'); }

  var ICONS = {
    spk: '<symbol id="i-spk" viewBox="0 0 20 40"><path d="M10 0 L15 24 L10 40 L5 24 Z"/></symbol>',
    arrow: '<symbol id="i-arrow" viewBox="0 0 44 20"><path d="M0 8 H30 L26 0 L44 10 L26 20 L30 12 H0 Z"/></symbol>',
    play: '<symbol id="i-play" viewBox="0 0 24 24"><path d="M6 3 L21 12 L6 21 Z"/></symbol>',
    ext: '<symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"/></symbol>',
    lock: '<symbol id="i-lock" viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10H7zm2 0h6V7a3 3 0 0 0-6 0v3z"/></symbol>',
    search: '<symbol id="i-search" viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></symbol>',
    home: '<symbol id="i-home" viewBox="0 0 24 24"><path d="M12 2.5 22 11h-3v10h-5.5v-6h-3v6H5V11H2l10-8.5z"/></symbol>',
    trophy: '<symbol id="i-trophy" viewBox="0 0 24 24"><path d="M6 3h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 16v3h4v2H7v-2h4v-3a6 6 0 0 1-3.4-3A5 5 0 0 1 3 8V5h3V3zm0 4H5v1a3 3 0 0 0 1.4 2.5A6 6 0 0 1 6 9V7zm12 0v2a6 6 0 0 1-.4 1.5A3 3 0 0 0 19 8V7h-1z"/></symbol>',
    target: '<symbol id="i-target" viewBox="0 0 24 24"><path d="M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1V2zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></symbol>',
    nade: '<symbol id="i-nade" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M10 1h4v3h-4zM12 5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/></symbol>',
    menu: '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M5 6h15l-1 2H4zM4 11h15l-1 2H3zM3 16h15l-1 2H2z"/></symbol>',
    close: '<symbol id="i-close" viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></symbol>',
    refresh: '<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M12 4a8 8 0 0 1 7.4 5H22l-3.5 4.5L15 9h2.2A6 6 0 1 0 18 14.5l1.9.7A8 8 0 1 1 12 4z"/></symbol>',
    share: '<symbol id="i-share" viewBox="0 0 24 24"><path d="M17 3a3 3 0 1 1-2.8 4.1L9.6 9.7a3 3 0 0 1 0 4.6l4.6 2.6A3 3 0 1 1 13.5 19l-4.9-2.8a3 3 0 1 1 0-8.4L13.5 5A3 3 0 0 1 17 3z"/></symbol>',
    copy: '<symbol id="i-copy" viewBox="0 0 24 24"><path d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8V3zM5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v10h10V9H5z"/></symbol>',
    plus: '<symbol id="i-plus" viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/></symbol>',
    minus: '<symbol id="i-minus" viewBox="0 0 24 24"><path d="M4 11h16v2H4z"/></symbol>',
    fit: '<symbol id="i-fit" viewBox="0 0 24 24"><path d="M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm16 0h2v7h-7v-2h5v-5z"/></symbol>',
    wall: '<symbol id="i-wall" viewBox="0 0 24 24"><path d="M2 4h20v16H2V4zm2 2v3h7V6H4zm9 0v3h7V6h-7zM4 11v3h3v-3H4zm5 0v3h7v-3H9zm9 0v3h2v-3h-2zM4 16v2h7v-2H4zm9 0v2h7v-2h-7z"/></symbol>',
    users: '<symbol id="i-users" viewBox="0 0 24 24"><path d="M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1zm15.5-5.9c2.6.4 4.5 2.4 4.5 4.9v1h-4.2v-1c0-1.9-.8-3.6-2.1-4.9z"/></symbol>',
    map: '<symbol id="i-map" viewBox="0 0 24 24"><path d="M9 3 15 5.5 21 3v16l-6 2.5L9 19l-6 2.5v-16L9 3zm1 2.6v11.8l4 1.7V7.3l-4-1.7z"/></symbol>',
    grid: '<symbol id="i-grid" viewBox="0 0 24 24"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></symbol>',
    pin: '<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></symbol>',
    xh: '<symbol id="i-xh" viewBox="0 0 24 24"><path d="M11 2h2v7h-2zM11 15h2v7h-2zM2 11h7v2H2zM15 11h7v2h-7z"/></symbol>',
    edit: '<symbol id="i-edit" viewBox="0 0 24 24"><path d="M15.5 3.5l5 5L9 20H4v-5L15.5 3.5zm0 2.8L6 15.8V18h2.2l9.5-9.5-2.2-2.2z"/></symbol>',
    archive: '<symbol id="i-archive" viewBox="0 0 24 24"><path d="M3 3h18v5H3V3zm1 6h16v12H4V9zm5 3v2h6v-2H9z"/></symbol>',
    trash: '<symbol id="i-trash" viewBox="0 0 24 24"><path d="M9 2h6l1 2h5v2H3V4h5l1-2zM5 8h14l-1 14H6L5 8z"/></symbol>',
    check: '<symbol id="i-check" viewBox="0 0 24 24"><path d="M9.5 16.2 4.8 11.5l-1.4 1.4 6.1 6.1L21 7.5l-1.4-1.4z"/></symbol>',
    upload: '<symbol id="i-upload" viewBox="0 0 24 24"><path d="M11 16V7.8L7.4 11.4 6 10l6-6 6 6-1.4 1.4L13 7.8V16h-2zM4 18h16v2H4z"/></symbol>',
    drag: '<symbol id="i-drag" viewBox="0 0 24 24"><path d="M8 5h3v3H8zm5 0h3v3h-3zM8 10.5h3v3H8zm5 0h3v3h-3zM8 16h3v3H8zm5 0h3v3h-3z"/></symbol>',
    train: '<symbol id="i-train" viewBox="0 0 24 24"><path d="M4 4h16v2H4zM6 8h12l2 9H4l2-9zm1 11h3v2H7zm7 0h3v2h-3z"/></symbol>',
    'g-smoke': '<symbol id="g-smoke" viewBox="0 0 24 24"><path d="M7 19a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.6 8.6 5 5 0 0 1 17.5 19H7z"/></symbol>',
    'g-flash': '<symbol id="g-flash" viewBox="0 0 24 24"><path d="M12 1 L14 9 L22 6 L16 12 L22 18 L14 15 L12 23 L10 15 L2 18 L8 12 L2 6 L10 9 Z"/></symbol>',
    'g-molo': '<symbol id="g-molo" viewBox="0 0 24 24"><path d="M12 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z"/></symbol>',
    'g-he': '<symbol id="g-he" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M10 1h4v3h-4z M12 5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17z M12 9.5a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"/></symbol>'
  };
  var sprite = document.createElement('div');
  sprite.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + Object.keys(ICONS).map(function (k) { return ICONS[k]; }).join('') + '</svg>';
  document.body.insertBefore(sprite.firstChild, document.body.firstChild);
  function icon(id, cls) { return '<svg class="' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>'; }

  var NAV = [
    { id: 'home', label: 'Accueil', href: 'home.html', icon: 'i-home' },
    { id: 'elo', label: 'ELO Run', href: 'elo-run.html', icon: 'i-trophy' },
    { id: 'matchs', label: 'Matchs', href: 'home.html#now', icon: 'i-target' },
    { id: 'clips', label: 'Clips', href: 'home.html#clips', prio: 2 },
    { id: 'xh', label: 'Crosshairs', href: 'crosshairs.html', prio: 2 },
    { id: 'stuffs', label: 'Stuffs', href: 'stuffs.html', icon: 'i-nade' },
    { id: 'mur', label: 'Mur', full: 'Mur des lamentations', href: 'mur.html', restricted: true }
  ];

  function mount(cfg) {
    cfg = cfg || {};
    var active = cfg.active;
    var navSlot = document.getElementById('nav-slot');
    if (navSlot) {
      var links = NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.prio === 2 ? ' data-prio="2"' : '') + (n.id === active ? ' aria-current="page"' : '') + (n.full ? ' title="' + n.full + '"' : '') + '>'
          + n.label + (n.restricted ? '<span class="only-visitor">' + icon('i-lock', 'lock') + '<span class="sr"> (réservé aux membres)</span></span>' : '') + '</a>';
      }).join('');
      navSlot.outerHTML = '<header class="nav" id="nav">'
        + '<a class="brand" href="home.html" aria-label="LaFineEquipe, accueil"><img src="assets/brand/lfe-round-temp.webp" alt="" width="42" height="42"><span class="brand-word">La<b>Fine</b>Equipe</span></a>'
        + '<nav class="menu" aria-label="Menu principal">' + links + '</nav>'
        + '<div class="nav-tools">'
        + '<a class="live only-live" href="home.html#now" title="Match en cours, statut vérifié"><span class="dot" aria-hidden="true"></span>Live</a>'
        + '<a class="nav-btn only-visitor" href="#" data-demo-login>' + icon('i-lock') + 'Connexion team</a>'
        + '<a class="nav-btn admin only-admin" href="admin.html">' + icon('i-lock') + 'Admin</a>'
        + '</div></header>';
    }
    var tabSlot = document.getElementById('tab-slot');
    if (tabSlot) {
      var tabs = [NAV[0], NAV[1], NAV[2], NAV[5]];
      var sheetLinks = NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' + (n.full || n.label)
          + (n.restricted ? '<small class="only-visitor">réservé à la team</small>' : '') + '</a>';
      }).join('');
      tabSlot.outerHTML = '<div class="sheet" id="sheet" aria-label="Toutes les pages">' + sheetLinks
        + '<hr><a class="only-visitor" href="#" data-demo-login>Connexion team <small>membres et admin</small></a>'
        + '<a class="only-admin" href="admin.html">Espace admin <small>réservé</small></a></div>'
        + '<nav class="tabbar" aria-label="Navigation rapide">'
        + tabs.map(function (n) {
          var cur = n.id === active || (n.id === 'stuffs' && (active === 'map' || active === 'fiche'));
          return '<a href="' + n.href + '"' + (cur ? ' aria-current="page"' : '') + '>' + icon(n.icon) + (n.id === 'matchs' ? '<span class="tdot only-live"></span>' : '') + n.label + '</a>';
        }).join('')
        + '<button type="button" id="sheet-btn" aria-expanded="false" aria-controls="sheet">' + icon('i-menu') + 'Menu</button></nav>';
      var sheet = document.getElementById('sheet');
      var sbtn = document.getElementById('sheet-btn');
      var closeSheet = function (focusBtn) { sheet.classList.remove('open'); sbtn.setAttribute('aria-expanded', 'false'); if (focusBtn) sbtn.focus(); };
      sbtn.addEventListener('click', function () {
        var o = sheet.classList.toggle('open');
        sbtn.setAttribute('aria-expanded', String(o));
        if (o) { var first = sheet.querySelector('a:not([hidden])'); if (first) first.focus(); }
      });
      sheet.addEventListener('click', function (e) { if (e.target.closest('a')) closeSheet(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(true); });
    }
    var footSlot = document.getElementById('foot-slot');
    if (footSlot) {
      footSlot.outerHTML = '<footer class="foot"><p class="foot-word" aria-hidden="true">La<b>Fine</b>Equipe</p><div class="foot-row">'
        + '<span class="foot-brand"><img src="assets/brand/lfe-round-temp.webp" alt="" width="34" height="34">Site communautaire, non affilié à FACEIT ni à Valve.</span>'
        + '<nav aria-label="Pied de page"><a href="elo-run.html">ELO Run</a><a href="stuffs.html">Stuffs</a><a href="crosshairs.html">Crosshairs</a><a href="mur.html">Mur des lamentations</a><a class="only-admin" href="admin.html">Espace admin</a></nav></div>'
        + '<p class="foot-legal">Counter-Strike 2 et ses images de maps sont la propriété de Valve. Prototype : données fictives, images utilisées localement.</p></footer>';
    }

    // Connexion simulée
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-demo-login]');
      if (!a) return;
      e.preventDefault();
      setState('role', 'member');
      toast('Connexion simulée : rôle « membre »');
    });

    // Barre de navigation compacte au défilement
    var nav = document.getElementById('nav');
    var scroller = function () { return document.getElementById('stage').classList.contains('mobile') ? document.getElementById('site') : window; };
    var onScroll = function () {
      var s = scroller();
      var y = s === window ? window.scrollY : s.scrollTop;
      if (nav) nav.classList.toggle('scrolled', y > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.getElementById('site').addEventListener('scroll', onScroll, { passive: true });

    buildDemo(cfg);
    reveal();
  }

  /* ---------- Apparitions au défilement ---------- */
  var io;
  function reveal(root) {
    var els = (root || document).querySelectorAll('.rv:not(.in),.rv-x:not(.in)');
    if (reduced() || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    }
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- FLIP : déplace les lignes vers leur nouvelle place sans toucher aux valeurs ---------- */
  function flip(container, mutate, opts) {
    opts = opts || {};
    var before = {};
    container.querySelectorAll('[data-key]').forEach(function (el) { before[el.getAttribute('data-key')] = el.getBoundingClientRect(); });
    mutate();
    if (reduced()) return;
    container.querySelectorAll('[data-key]').forEach(function (el, i) {
      var b = before[el.getAttribute('data-key')];
      var a = el.getBoundingClientRect();
      if (!b) {
        el.animate([{ opacity: 0, transform: 'translateX(-24px)', clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', delay: opts.stagger ? i * 25 : 0 });
        return;
      }
      var dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  /* ---------- Panneau de démo ---------- */
  var GROUPS = {
    view: ['Vue', [['desktop', 'Desktop'], ['mobile', 'Mobile 390']]],
    role: ['Rôle', [['visitor', 'Visiteur'], ['member', 'Membre'], ['admin', 'Admin']]],
    motion: ['Animations', [['on', 'Oui'], ['reduce', 'Réduites']]]
  };
  function setState(key, val) {
    var site = document.getElementById('site');
    if (key === 'view') {
      document.getElementById('stage').classList.toggle('mobile', val === 'mobile');
      if (val === 'mobile') site.scrollTop = 0;
    } else if (key === 'motion') html.classList.toggle('reduce', val === 'reduce');
    else site.setAttribute('data-' + key, val);
    document.querySelectorAll('.demo [data-k="' + key + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === val)); });
    document.dispatchEvent(new CustomEvent('lfe:state', { detail: { key: key, value: val } }));
  }
  function buildDemo(cfg) {
    var site = document.getElementById('site');
    var groups = cfg.demo || ['view', 'role', 'motion'];
    var box = document.createElement('aside');
    box.className = 'demo';
    box.setAttribute('aria-label', 'Contrôles du prototype');
    var defs = { view: 'desktop', motion: 'on' };
    box.innerHTML = '<b>Prototype</b>' + groups.map(function (g) {
      var def = defs[g] || site.getAttribute('data-' + g);
      var G = GROUPS[g] || (cfg.groups && cfg.groups[g]);
      return '<div class="grp"><span>' + G[0] + '</span>' + G[1].map(function (o) {
        return '<button type="button" data-k="' + g + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === def) + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    }).join('')
      + (cfg.actions || []).map(function (a, i) { return '<button type="button" class="act" data-act="' + i + '">' + a.label + '</button>'; }).join('')
      + '<a class="hide-min" href="index.html">← Sommaire</a><button type="button" class="min-btn">Réduire</button>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('min-btn')) { var m = box.classList.toggle('min'); b.textContent = m ? 'Contrôles' : 'Réduire'; return; }
      if (b.hasAttribute('data-act')) { cfg.actions[+b.getAttribute('data-act')].run(); return; }
      setState(b.getAttribute('data-k'), b.getAttribute('data-v'));
    });
    if (/[#&]mobile/.test(location.hash)) setState('view', 'mobile');
    var role = (location.search.match(/[?&]role=(\w+)/) || [])[1];
    if (role) setState('role', role);
    if (window.innerWidth < 640) { box.classList.add('min'); box.querySelector('.min-btn').textContent = 'Contrôles'; }
  }

  /* ---------- Toast ---------- */
  var toastEl, tt;
  function toast(msg, err) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!err);
    toastEl.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  /* Copie dans le presse-papiers avec repli */
  function copy(text, okMsg) {
    var done = function () { toast(okMsg || 'Copié'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { toast('Copie impossible : sélectionne le texte', true); });
    else { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copie impossible', true); } t.remove(); }
  }

  window.LFE = { mount: mount, toast: toast, setState: setState, icon: icon, flip: flip, reveal: reveal, reduced: reduced, copy: copy };
})();
