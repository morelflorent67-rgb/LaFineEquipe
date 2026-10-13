/* Forge V2 final · rendu et filtres partagés des pages Stuffs. Les filtres vivent dans l'URL
   (?type=&side=&q=) : un lien partagé ou un retour arrière retrouve exactement la même vue. */
window.LFE_STUFF = (function () {
  'use strict';
  var D = window.LFE_DATA;
  function icon(id, cls) { return '<svg class="' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>'; }
  function nade(type) { var t = D.types[type]; return '<span class="nade ' + type + '">' + icon(t.icon) + t.label + '</span>'; }
  function side(s) { return '<span class="side ' + s.toLowerCase() + '" aria-label="Camp ' + s + '">' + s + '</span>'; }
  function diff(d) { var n = D.diff[d] || 1; return '<span class="diff" aria-label="Difficulté : ' + d + '">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') + '<span style="margin-left:6px">' + d + '</span></span>'; }
  function verified(s) {
    return s.stale ? '<span class="chip stale" title="Vérifié le ' + D.dateFr(s.verifiedAt) + '">À revérifier · ' + D.dateShort(s.verifiedAt) + '</span>'
      : '<span class="chip ok" title="Vérifié le ' + D.dateFr(s.verifiedAt) + '">' + icon('i-check') + 'Vérifié ' + D.dateShort(s.verifiedAt) + '</span>';
  }
  function fromName(s) { var p = D.position(s.map, s.from); return p ? p.name : 'Position à préciser'; }
  function srcLabel(src) { return src === 'team' ? 'Capture de la team' : 'Image du jeu (Valve)'; }
  function card(s, i, withMap) {
    var m = D.mapBy(s.map);
    return '<a class="scard rv" style="--i:' + ((i || 0) % 6) + '" href="fiche.html?id=' + s.id + '" data-key="' + s.id + '">'
      + '<span class="im"><img src="' + s.img[0] + '" alt="" loading="lazy" decoding="async" style="view-transition-name:st-' + s.id + '"><span class="chips">' + nade(s.type) + side(s.side) + '</span><span class="srcl">' + srcLabel(s.src[0]) + '</span></span>'
      + '<span class="bd"><span class="t">' + D.esc(s.title) + (withMap ? ' <span class="dim" style="font-weight:600">· ' + m.name + '</span>' : '') + '</span>'
      + '<span class="path">' + D.esc(fromName(s)) + icon('i-arrow') + D.esc(s.to) + '</span>'
      + '<span class="ft"><span class="chip">' + s.tech + '</span>' + diff(s.diff) + verified(s) + '</span></span><span class="bar"></span></a>';
  }
  function readFilters() {
    var q = new URLSearchParams(location.search);
    return { type: q.get('type') || 'all', side: q.get('side') || 'all', q: q.get('q') || '' };
  }
  function writeFilters(f) {
    var q = new URLSearchParams(location.search);
    ['type', 'side'].forEach(function (k) { if (f[k] && f[k] !== 'all') q.set(k, f[k]); else q.delete(k); });
    if (f.q) q.set('q', f.q); else q.delete('q');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function match(s, f) {
    if (f.type !== 'all' && s.type !== f.type) return false;
    if (f.side !== 'all' && s.side !== f.side) return false;
    if (f.q) {
      var hay = norm([s.title, s.to, fromName(s), s.tech, D.mapBy(s.map).name, (s.tags || []).join(' '), D.types[s.type].label].join(' '));
      return norm(f.q).split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
    }
    return true;
  }
  return { icon: icon, nade: nade, side: side, diff: diff, verified: verified, fromName: fromName, srcLabel: srcLabel, card: card, readFilters: readFilters, writeFilters: writeFilters, match: match, norm: norm };
})();
