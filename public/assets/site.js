/* NIKO Hospital — public website (no framework, fast on phones). */
(function () {
  'use strict';
  var S = window.NikoSchedule, I = window.NIKO_I18N;
  var C = null, version = null, lang = 'en';
  var st = {
    demo: false, preview: /[?&]preview=1/.test(location.search) || window.name === 'niko-preview',
    fontStep: 0, hc: false, slideIdx: 0, slideTimer: null, slidePaused: false, demoBookings: [], reviews: null,
    wiz: null, docFilter: {}, noticeTab: 'all', popupShown: false,
  };

  // ---------------------------------------------------------------- helpers
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(v) { if (v == null) return ''; if (typeof v === 'object') return v[lang] || v.en || ''; return String(v); }
  function T(k) { var u = C && C.ui; return (u && u[lang] && u[lang][k]) || I[lang][k] || (u && u.en && u.en[k]) || I.en[k] || k; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('niko_' + k); localStorage.setItem('niko_' + k, v); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem('niko_' + k); sessionStorage.setItem('niko_' + k, v); } catch (e) { return null; } }
  function vis(list) { return (list || []).filter(function (x) { return x && x.visible !== false; }); }
  function tel(n) { return 'tel:' + String(n || '').replace(/[^\d+]/g, ''); }
  function waNum(n) { var d = String(n || '').replace(/\D/g, ''); return d.length === 10 ? '977' + d : d; }
  function img(src, alt, cls, eager) { return src ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '"' + (cls ? ' class="' + cls + '"' : '') + (eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"') + '>' : ''; }
  function today() { return S.ymd(new Date()); }
  function fmtDate(s, opts) {
    if (!s) return '';
    try { return S.parse(s).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return s; }
  }
  function dayName(d) { return (I.days[lang] || I.days.en)[d] || d; }
  var NOPHOTO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720"><rect width="600" height="720" fill="#dfe8f3"/><circle cx="300" cy="270" r="120" fill="#1f487c" fill-opacity=".2"/><path d="M80 720c0-140 100-230 220-230s220 90 220 230z" fill="#1f487c" fill-opacity=".2"/></svg>');
  function photoOf(d) { return d.photo || NOPHOTO; }
  function deptOf(id) { return (C.departments || []).find(function (d) { return d.id === id; }); }
  function doctors() { return vis(C.doctors); }
  function docById(id) { return doctors().find(function (d) { return d.id === id; }); }
  function plain(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }

  // ------------------------------------------------------------------- icons
  var IC = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    map: '<path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    nav: '<path d="M3 11l19-9-9 19-2-8-8-2z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
    emergency: '<path d="M12 2v20M2 12h20" stroke-width="4"/>',
    stethoscope: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a5 5 0 0 0 10 0v-2"/><circle cx="21" cy="12" r="2"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/><path d="M3.5 12h4l2-3 3 6 2-3h6"/>',
    drop: '<path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z"/>',
    lungs: '<path d="M6.1 7C4 8 2 12 2 16c0 2 1 3 3 3 3 0 4-2 4-5V6a1 1 0 0 0-2.9 1zM17.9 7C20 8 22 12 22 16c0 2-1 3-3 3-3 0-4-2-4-5V6a1 1 0 0 1 2.9 1z"/><path d="M12 3v8l-3 2M12 11l3 2"/>',
    bone: '<path d="M17 10c.7-.7 1.7-.7 2.5 0a2.5 2.5 0 1 0 0-3.5 2.5 2.5 0 1 0-3.5 0c.7.8.7 1.8 0 2.5L10 15c-.7.7-1.7.7-2.5 0a2.5 2.5 0 1 0 0 3.5 2.5 2.5 0 1 0 3.5 0c-.7-.8-.7-1.8 0-2.5z"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.9.9A4 4 0 0 0 4 13a4 4 0 0 0 4 6 3 3 0 0 0 4 0 3 3 0 0 0 4 0 4 4 0 0 0 4-6 4 4 0 0 0-2.1-7.1A3 3 0 1 0 12 5zM12 5v15"/>',
    female: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 19h6"/>',
    ear: '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
    skin: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16a2 2 0 0 1 3-2.6L8 15"/>',
    mind: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    child: '<circle cx="12" cy="5" r="3"/><path d="M9 22v-6H7l2-7h6l2 7h-2v6"/>',
    scalpel: '<path d="M3 21l9-9M12.5 11.5l8-8a2.1 2.1 0 0 0-3-3l-8 8z"/><path d="M14 4l6 6"/>',
    kidney: '<path d="M9 3C5 3 3 7 3 11s2 9 6 9c3 0 3-3 3-5s-2-3-2-5 2-2 2-4-1-3-3-3zM15 3c4 0 6 4 6 8s-2 9-6 9"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
    mask: '<path d="M4 9h16v5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M4 11H2M22 11h-2M9 14h6"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20"/><circle cx="7" cy="12" r="2"/>',
    pill: '<path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7"/>',
    whatsapp: '<path d="M3 21l1.6-4.8A9 9 0 1 1 8 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.3-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 9.5z"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    tiktok: '<path d="M9 12a4 4 0 1 0 4 4V2c.5 2.5 2.5 4.5 5 5"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    youtube: '<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6z"/><path d="M10 15l5-3-5-3z"/>',
    viber: '<path d="M12 2C6 2 3 4.5 3 10c0 3 1 5 3 6.3V21l3.5-3c.8.1 1.6.1 2.5.1 6 0 9-2.6 9-8.1S18 2 12 2z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    font: '<path d="M4 20l6-16 6 16M6.5 14h7M17 20l2.5-6 2.5 6M18 18h3"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
    up: '<path d="M18 15l-6-6-6 6"/>',
  };
  function icon(n, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (IC[n] || IC.stethoscope) + '</svg>'; }

  // ------------------------------------------------------------------- theme
  function applyTheme() {
    var t = C.theme || {}, r = document.documentElement.style;
    var map = { primary: '--primary', primaryDark: '--primary-dark', accent: '--accent', emergency: '--emergency', background: '--bg', surface: '--surface', text: '--text', mutedText: '--muted' };
    Object.keys(map).forEach(function (k) { if (t[k]) r.setProperty(map[k], t[k]); });
    var px = { radius: '--radius', buttonRadius: '--btn-radius', containerWidth: '--container', sectionSpacing: '--section', cardMinWidth: '--card-min', doctorPhotoHeight: '--doc-photo', slideshowHeight: '--slide-h', slideshowHeightMobile: '--slide-h-m', tableFontSize: '--table-fs', logoSize: '--logo' };
    Object.keys(px).forEach(function (k) { if (t[k] !== undefined && t[k] !== '') r.setProperty(px[k], t[k] + 'px'); });
    r.setProperty('--fs', ((+t.baseFontSize || 17) + st.fontStep) + 'px');
    r.setProperty('--h-scale', +t.headingScale || 1);
    var fonts = { system: '', serif: 'Georgia,"Noto Serif","Noto Serif Devanagari",serif', rounded: '"Nunito","Varela Round","Mukta",system-ui,sans-serif' };
    if (fonts[t.fontFamily]) r.setProperty('--font', fonts[t.fontFamily]); else r.removeProperty('--font');
    document.documentElement.classList.toggle('hc', st.hc);
    document.documentElement.lang = lang === 'ne' ? 'ne' : 'en';
    var meta = $('meta[name=theme-color]'); if (meta) meta.content = t.primary || '#1f487c';
  }

  // ---------------------------------------------------------------- loading
  function load() {
    if (st.preview) {
      window.addEventListener('message', function (e) {
        var m = e.data || {};
        if (m.type === 'niko-content') {
          C = m.content; applyTheme();
          if (m.route && m.route !== location.hash) location.hash = m.route; else renderAll(true);
        }
      });
      try { (window.parent || window.opener).postMessage({ type: 'niko-preview-ready' }, '*'); } catch (e) {}
    }
    return fetch('api/content', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { if (!C) { C = j.content; version = j.version; } })
      .catch(function () {
        if (C) return;
        if (window.NIKO_DEFAULT) { C = JSON.parse(JSON.stringify(window.NIKO_DEFAULT)); st.demo = true; }
        else document.body.innerHTML = '<p style="padding:20px">Could not load the website. Please call 057-520223.</p>';
      });
  }
  function watchVersion() {
    if (st.demo || st.preview) return;
    setInterval(function () {
      if (document.hidden) return;
      fetch('api/version', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.version && j.version !== version) {
          var a = document.activeElement;
          if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return; // don't interrupt someone typing
          fetch('api/content', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (k) { C = k.content; version = k.version; applyTheme(); renderAll(true); });
        }
      }).catch(function () {});
    }, 30000);
  }

  // ------------------------------------------------------------ doctor info
  function hoursOf(d) { return d.hours && /\d/.test(d.hours) ? d.hours : (C.booking && C.booking.defaultHours) || ''; }
  function scheduleOf(d) {
    var note = L(d.scheduleNote);
    if (note) return note;
    if (+d.monthlyWeek > 0) return T('firstSat');
    if (d.days && d.days.length === 7) return T('everyDay');
    if (d.days && d.days.length) return d.days.map(dayName).join(', ');
    return '';
  }
  function availToday(d) { return S.hasFixedSchedule(d) && S.availableOn(d, today(), C.booking); }
  function isVisiting(d) { return +d.monthlyWeek > 0; }
  function nextVisit(d) { return S.nextDates(d, C.booking, 1)[0]; }

  // ------------------------------------------------------------------ search
  var SYN = { sugar: 'diabetes', bp: 'blood pressure', pressure: 'blood pressure', heart: 'cardiology', bone: 'orthopaedics', bones: 'orthopaedics', skin: 'dermatology', child: 'paediatrics', baby: 'paediatrics', kids: 'paediatrics', pregnant: 'pregnancy', women: 'gynaecology', lady: 'gynaecology', kidney: 'kidney', stone: 'stones', xray: 'x-ray', usg: 'ultrasound', video: 'ultrasound', ent: 'ent', mental: 'psychiatry', tension: 'anxiety', gastric: 'gastritis', cancer: 'tumour', operation: 'surgery', breathing: 'lung', cough: 'lung', medicine: 'pharmacy', test: 'laboratory', blood: 'laboratory', echo: '2d echo' };
  function buildIndex() {
    var idx = [];
    (C.departments || []).forEach(function (d) { idx.push({ kind: 'dept', label: T('department'), title: L(d.name), alt: d.name.en + ' ' + (d.name.ne || ''), keys: (d.keywords || []).join(' ') + ' ' + L(d.summary), url: '#/department/' + d.id }); });
    doctors().forEach(function (d) { var dp = deptOf(d.dept); idx.push({ kind: 'doctor', label: lang === 'ne' ? 'डाक्टर' : 'Doctor', title: L(d.name), sub: L(d.title), alt: d.name.en + ' ' + (d.name.ne || '') + ' ' + d.nmc, keys: L(d.title) + ' ' + (dp ? dp.name.en + ' ' + (dp.keywords || []).join(' ') : '') + ' ' + (d.focus || []).join(' '), url: '#/doctor/' + d.id }); });
    vis(C.conditions).forEach(function (c) { var dp = deptOf(c.dept); idx.push({ kind: 'cond', label: T('condition'), title: L(c.name), sub: dp ? L(dp.name) : '', alt: c.name.en + ' ' + (c.name.ne || ''), keys: (c.keywords || []).join(' ') + ' ' + L(c.symptoms), url: '#/condition/' + c.id }); });
    vis(C.facilities).forEach(function (f) { idx.push({ kind: 'fac', label: lang === 'ne' ? 'सुविधा' : 'Facility', title: L(f.name), sub: L(f.short), alt: f.name.en + ' ' + (f.name.ne || ''), keys: L(f.description), url: '#/facilities#' + f.id }); });
    [['book', '#/book', 'appointment booking schedule'], ['emergency24', tel(C.hospital.phone24), 'emergency ambulance urgent accident'], ['contact', '#/contact', 'address location map phone'],
      ['notices', '#/notices', 'notice vacancy job holiday'], ['myBooking', '#/my-booking', 'cancel reschedule change'], ['qa', '#/qa', 'faq question'], ['feedback', '#/feedback', 'complaint review'], ['portal', '#/portal', 'report prescription bill']]
      .forEach(function (p) { idx.push({ kind: 'page', label: lang === 'ne' ? 'पृष्ठ' : 'Page', title: T(p[0]), alt: I.en[p[0]] + ' ' + I.ne[p[0]], keys: p[2], url: p[1] }); });
    return idx;
  }
  function lev1(a, b) { // true if edit distance ≤ 1
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, e = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++e > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return e + (a.length - i) + (b.length - j) <= 1;
  }
  function search(q) {
    q = plain(q).trim(); if (q.length < 2) return [];
    var toks = q.split(/\s+/).map(function (w) { return SYN[w] ? w + ' ' + SYN[w] : w; }).join(' ').split(/\s+/);
    return buildIndex().map(function (e) {
      var title = plain(e.title + ' ' + e.alt), keys = plain(e.keys + ' ' + (e.sub || ''));
      var words = (title + ' ' + keys).split(/[^a-z0-9ऀ-ॿ-]+/);
      var score = 0;
      if (title.indexOf(q) === 0) score += 120; else if (title.indexOf(q) > -1) score += 80;
      if (keys.indexOf(q) > -1) score += 40;
      toks.forEach(function (t) {
        if (title.indexOf(t) > -1) score += 25;
        else if (keys.indexOf(t) > -1) score += 14;
        else if (t.length >= 4 && words.some(function (w) { return w.length >= 4 && lev1(w, t); })) score += 16;
      });
      return { e: e, score: score + (e.kind === 'cond' || e.kind === 'dept' ? 2 : 0) };
    }).filter(function (r) { return r.score >= 14; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 14).map(function (r) { return r.e; });
  }
  function resultsHTML(list) {
    if (!list.length) return '<li class="muted" style="padding:12px">' + esc(T('noResults')) + '</li>';
    return list.map(function (e, i) { return '<li><a href="' + esc(e.url) + '"' + (i === 0 ? ' class="active"' : '') + '><span class="kind">' + esc(e.label) + '</span><span><b>' + esc(e.title) + '</b>' + (e.sub ? '<small>' + esc(e.sub) + '</small>' : '') + '</span></a></li>'; }).join('');
  }
  function openSearch(prefill) {
    var pop = $('#searchPop'); pop.classList.add('open');
    var inp = $('#searchInput'); inp.value = prefill || ''; inp.focus(); onSearch();
  }
  function closeSearch() { var p = $('#searchPop'); if (p) p.classList.remove('open'); }
  function onSearch() {
    var q = $('#searchInput').value;
    $('#searchResults').innerHTML = q.trim().length < 2 ? '<li class="muted" style="padding:12px">' + esc(T('searchHint')) + '</li>' : resultsHTML(search(q));
  }

  // ------------------------------------------------------------------ shell
  function navLinks() {
    return [['#/about', 'about'], ['#/departments', 'departments'], ['#/doctors', 'doctors'], ['#/conditions', 'conditions'], ['#/facilities', 'facilities'], ['#/notices', 'notices'], ['#/contact', 'contact']];
  }
  function shell() {
    var h = C.hospital, cur = location.hash || '#/';
    var amb = h.ambulance ? '<a class="pill" href="' + tel(h.ambulance) + '">' + icon('phone', ' width="16" height="16"') + esc(T('ambulance')) + ': ' + esc(h.ambulance) + '</a>' : '';
    var notices = vis(C.notices).filter(noticeLive);
    var ticker = C.home.noticeTicker !== false && notices.length ? '<div class="ticker" role="region" aria-label="' + esc(T('notices')) + '"><div class="container"><b>' + icon('bell', ' width="18" height="18"') + '</b><div class="track"><span class="move">' +
      notices.map(function (n) { return '<a href="#/notices">' + esc(L(n.title)) + '</a>'; }).join('') + '</span></div></div></div>' : '';
    return '<a class="skip" href="#/" data-act="skip">' + esc(T('skip')) + '</a>' +
      '<div class="topwrap"><div class="ebar" role="region" aria-label="' + esc(T('emergency24')) + '"><div class="container">' +
      '<span class="lbl"><span class="pulse" aria-hidden="true"></span><span class="hide-s">' + esc(T('emergency24')) + ':</span></span>' +
      '<a class="pill" href="' + tel(h.phone24) + '">' + icon('phone', ' width="16" height="16"') + esc(h.phone24) + '</a>' + amb +
      '<span class="spacer"></span><span class="hide-m" style="gap:6px"><button class="fz" data-act="font-down" aria-label="' + esc(T('smaller')) + '">A−</button><button class="fz" data-act="font-up" aria-label="' + esc(T('larger')) + '">A+</button><button class="fz" data-act="contrast" aria-pressed="' + st.hc + '" aria-label="' + esc(T('contrast')) + '">' + icon('contrast') + '</button></span><a class="pill" href="' + esc(h.directionsUrl) + '" target="_blank" rel="noopener">' + icon('nav', ' width="16" height="16"') + esc(T('directions')) + '</a></div></div>' +
      '<header class="hdr"><div class="container"><a class="brand" href="#/" aria-label="' + esc(L(h.name)) + ' — ' + esc(T('home')) + '">' + img(h.logo, '', '', true) +
      '<span><b>' + esc(L(h.shortName) || L(h.name)) + '</b><small>' + esc(L(h.slogan)) + '</small></span></a>' +
      '<nav class="nav" aria-label="Main">' + navLinks().map(function (n) { return '<a href="' + n[0] + '"' + (cur === n[0] || (n[0] !== '#/' && cur.indexOf(n[0]) === 0) ? ' aria-current="page"' : '') + '>' + esc(T(n[1])) + '</a>'; }).join('') + '</nav>' +
      '<div class="tools"><button class="icon-btn" data-act="search" aria-label="' + esc(T('search')) + '">' + icon('search') + '</button>' +
      '<button class="icon-btn" data-act="lang" aria-label="' + esc(T('language')) + '" lang="' + (lang === 'ne' ? 'en' : 'ne') + '">' + (lang === 'ne' ? 'EN' : 'नेपाली') + '</button>' +
      '<a class="btn sm hide-m" href="#/book">' + icon('cal') + esc(T('bookShort')) + '</a>' +
      '<button class="icon-btn hide-l" data-act="menu" aria-label="' + esc(T('menu')) + '" aria-expanded="false" aria-controls="drawer">' + icon('menu') + '</button></div></div></header></div>' + ticker +
      '<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="' + esc(T('menu')) + '"><div class="scrim" data-act="menu-close"></div><div class="panel">' +
      '<button class="icon-btn" data-act="menu-close" style="align-self:flex-end" aria-label="' + esc(T('close')) + '">' + icon('x') + '</button>' +
      [['#/', 'home']].concat(navLinks()).concat([['#/book', 'book'], ['#/my-booking', 'myBooking'], ['#/news', 'news'], ['#/stories', 'stories'], ['#/qa', 'qa'], ['#/feedback', 'feedback'], ['#/portal', 'portal']]).map(function (n) { return '<a href="' + n[0] + '">' + esc(T(n[1])) + '</a>'; }).join('') +
      '<div class="row"><button class="icon-btn" data-act="font-down" aria-label="' + esc(T('smaller')) + '">A−</button><button class="icon-btn" data-act="font-up" aria-label="' + esc(T('larger')) + '">A+</button><button class="icon-btn" data-act="contrast" aria-pressed="' + st.hc + '">' + icon('contrast') + esc(T('contrast')) + '</button></div></div></div>' +
      '<div class="search-pop" id="searchPop" role="dialog" aria-modal="true" aria-label="' + esc(T('search')) + '"><div class="search-box"><div class="search-row"><label class="sr-only" for="searchInput">' + esc(T('search')) + '</label><input id="searchInput" type="search" autocomplete="off" placeholder="' + esc(T('searchPlaceholder')) + '" aria-controls="searchResults">' +
      '<button class="icon-btn" data-act="search-close" aria-label="' + esc(T('close')) + '">' + icon('x') + '</button></div><ul class="results" id="searchResults" role="listbox"></ul></div></div>' +
      '<main id="main" tabindex="-1"></main>' + footer() +
      '<nav class="mbar" aria-label="Quick actions"><a class="red" href="' + tel(h.phone24) + '">' + icon('phone') + esc(T('call')) + '</a><a class="book" href="#/book">' + icon('cal') + esc(T('bookShort')) + '</a>' +
      '<a href="#/doctors">' + icon('user') + esc(lang === 'ne' ? 'डाक्टर' : 'Doctors') + '</a><a href="' + esc(h.directionsUrl) + '" target="_blank" rel="noopener">' + icon('nav') + esc(T('directions')) + '</a></nav>' +
      (st.demo ? '<div class="preview-badge">' + esc(T('offline')) + '</div>' : '') + '<div class="sr-only" aria-live="polite" id="announce"></div>';
  }
  function footer() {
    var h = C.hospital, s = C.social || {}, r = C.registration || {};
    return '<footer><div class="container"><div class="cols"><div><div class="brand" style="color:#fff">' + img(h.logo, '') + '<span><b style="color:#fff">' + esc(L(h.name)) + '</b><small style="color:#c8d6ea">' + esc(L(h.tagline)) + '</small></span></div>' +
      '<p style="margin-top:12px">' + esc(L(h.address)) + '</p>' + socialLinks(s, true) + '</div>' +
      '<div><h3>' + esc(T('ourServices')) + '</h3><ul>' + [['#/book', 'book'], ['#/doctors', 'doctors'], ['#/departments', 'departments'], ['#/conditions', 'conditions'], ['#/facilities', 'facilities'], ['#/portal', 'portal']].map(fl).join('') + '</ul></div>' +
      '<div><h3>' + esc(T('about')) + '</h3><ul>' + [['#/about', 'about'], ['#/notices', 'notices'], ['#/news', 'news'], ['#/stories', 'stories'], ['#/qa', 'qa'], ['#/feedback', 'feedback'], ['#/privacy', 'privacy']].map(fl).join('') + '</ul></div>' +
      '<div><h3>' + esc(T('contact')) + '</h3><ul><li><a href="' + tel(h.phone24) + '">' + esc(T('emergency24')) + ': ' + esc(h.phone24) + '</a></li>' +
      (h.phones || []).filter(function (p) { return p !== h.phone24; }).map(function (p) { return '<li><a href="' + tel(p) + '">' + esc(p) + '</a></li>'; }).join('') +
      (h.email ? '<li><a href="mailto:' + esc(h.email) + '">' + esc(h.email) + '</a></li>' : '') + '<li>' + esc(L(h.openingHours)) + '</li>' +
      (r.showOnWebsite !== false ? '<li>' + esc(L(r.registeredWith)) + (r.panNo ? ' · ' + esc(T('pan')) + ' ' + esc(r.panNo) : '') + (r.registrationNo ? ' · ' + esc(T('regNo')) + ' ' + esc(r.registrationNo) : '') + '</li>' : '') + '</ul></div></div>' +
      '<div class="base">' + esc(L(C.pages.footerNote)) + ' · <a href="#/privacy">' + esc(T('privacy')) + '</a>' + (C.staffMail && C.staffMail.enabled ? ' · <a href="#/staff-mail">' + esc(T('staffMail')) + '</a>' : '') + ' · <a href="admin.html">Staff login</a></div></div></footer>';
    function fl(x) { return '<li><a href="' + x[0] + '">' + esc(T(x[1])) + '</a></li>'; }
  }
  function socialLinks(s, light) {
    var items = [['facebook', s.facebook, 'Facebook'], ['tiktok', s.tiktok, 'TikTok'], ['instagram', s.instagram, 'Instagram'], ['youtube', s.youtube, 'YouTube'],
      ['whatsapp', s.whatsapp ? 'https://wa.me/' + waNum(s.whatsapp) : '', 'WhatsApp'], ['viber', s.viber ? 'viber://chat?number=%2B' + waNum(s.viber) : '', 'Viber']].filter(function (x) { return x[1]; });
    return '<div class="soc-links">' + items.map(function (x) { return '<a class="icon-btn" ' + (light ? 'style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)" ' : '') + 'href="' + esc(x[1]) + '" target="_blank" rel="noopener" aria-label="' + x[2] + '">' + icon(x[0]) + '</a>'; }).join('') + '</div>';
  }

  // ------------------------------------------------------------- page parts
  function head(title, sub, crumbs) {
    return '<div class="page-head"><div class="container">' + (crumbs ? '<div class="crumbs"><a href="#/">' + esc(T('home')) + '</a> › ' + crumbs + '</div>' : '') + '<h1 tabindex="-1">' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></div>';
  }
  function secHead(sec, link, linkText) {
    return '<div class="sec-head"><div><h2>' + esc(L(sec.title)) + '</h2>' + (L(sec.subtitle) ? '<p>' + esc(L(sec.subtitle)) + '</p>' : '') + '</div>' + (link ? '<a class="btn ghost sm" href="' + link + '">' + esc(linkText || T('viewAll')) + ' →</a>' : '') + '</div>';
  }
  function docCard(d) {
    var dp = deptOf(d.dept), a = availToday(d), visit = isVisiting(d);
    return '<article class="card doc"><a class="ph" href="#/doctor/' + esc(d.id) + '" tabindex="-1" aria-hidden="true">' + img(photoOf(d), '') + '</a><div class="bd">' +
      '<h3><a href="#/doctor/' + esc(d.id) + '" style="text-decoration:none">' + esc(L(d.name)) + '</a></h3><div class="ttl">' + esc(L(d.title)) + '</div>' +
      (dp ? '<div><span class="tag">' + esc(L(dp.name)) + '</span></div>' : '') +
      '<div class="meta">' + icon('clock', ' width="14" height="14" style="vertical-align:-2px"') + ' ' + esc(scheduleOf(d)) + (S.hasFixedSchedule(d) && hoursOf(d) ? ' · ' + esc(hoursOf(d)) : '') + '</div>' +
      (visit ? '<div class="avail">' + esc(T('nextVisit')) + ': ' + esc(fmtDate(nextVisit(d))) + '</div>' : S.hasFixedSchedule(d) ? '<div class="avail' + (a ? '' : ' off') + '">' + esc(a ? T('today') : T('schedule') + ': ' + scheduleOf(d)) + '</div>' : '') +
      (d.nmc ? '<div class="meta">' + esc(T('nmc')) + ' ' + esc(d.nmc) + '</div>' : '') +
      '<div class="acts"><a class="btn sm" href="#/book?doctor=' + esc(d.id) + '">' + esc(T('bookShort')) + '</a><a class="btn sm ghost" href="#/doctor/' + esc(d.id) + '">' + esc(T('seeProfile')) + '</a></div></div></article>';
  }
  function deptCard(d) {
    return '<a class="card dept" href="#/department/' + esc(d.id) + '"><span class="ic">' + icon(d.icon) + '</span><span><h3>' + esc(L(d.name)) + '</h3><p>' + esc(L(d.summary)) + '</p></span></a>';
  }
  function facCard(f) {
    return '<article class="card fac" id="' + esc(f.id) + '">' + img(f.image, L(f.name)) + '<div class="bd"><h3>' + esc(L(f.name)) + (f.open247 ? ' <span class="tag green">' + esc(T('open247')) + '</span>' : '') + '</h3><p>' + esc(L(f.description) || L(f.short)) + '</p></div></article>';
  }
  function newsCard(n) {
    return '<a class="card news" href="#/news/' + esc(n.id) + '">' + img(n.image, '') + '<div class="bd"><span class="tag' + (n.kind === 'event' ? ' amber' : '') + '">' + esc(T(n.kind === 'event' ? 'event' : 'news')) + '</span> <span class="date">' + esc(fmtDate(n.date)) + '</span><h3 style="margin-top:6px">' + esc(L(n.title)) + '</h3><p class="muted small">' + esc(L(n.summary)) + '</p></div></a>';
  }
  function noticeLive(n) { return !n.expires || n.expires >= today(); }
  function stars(n) { n = Math.round(+n || 0); return '<span class="stars" aria-label="' + n + ' / 5">' + '★★★★★'.slice(0, n) + '<span style="color:#cfd8e3">' + '★★★★★'.slice(n) + '</span></span>'; }

  // ------------------------------------------------------------- home page
  var HOME = {
    slideshow: function () {
      var slides = vis(C.slides); if (!slides.length) return '';
      return '<section class="hero" aria-roledescription="carousel" aria-label="Highlights">' + slides.map(function (s, i) {
        return '<div class="slide' + (i === st.slideIdx % slides.length ? ' on' : '') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' / ' + slides.length + '"' + (i === st.slideIdx % slides.length ? '' : ' aria-hidden="true"') + '>' + img(s.image, L(s.title), '', i === 0) +
          '<div class="shade"></div><div class="cap"><div class="container"><h2>' + esc(L(s.title)) + '</h2>' + (L(s.text) ? '<p>' + esc(L(s.text)) + '</p>' : '') +
          (L(s.buttonText) ? '<a class="btn light" href="' + esc(s.buttonLink || '#/book') + '"' + (i === st.slideIdx % slides.length ? '' : ' tabindex="-1"') + '>' + esc(L(s.buttonText)) + '</a>' : '') + '</div></div></div>';
      }).join('') + (slides.length > 1 ? '<div class="arrows"><button class="prev" data-act="slide-prev" aria-label="Previous slide">‹</button><button class="next" data-act="slide-next" aria-label="Next slide">›</button></div>' +
        '<button class="pause" data-act="slide-pause" aria-label="' + (st.slidePaused ? 'Play slideshow' : 'Pause slideshow') + '">' + (st.slidePaused ? '▶' : '❚❚') + '</button>' +
        '<div class="dots">' + slides.map(function (s, i) { return '<button data-act="slide-go" data-i="' + i + '" aria-label="Slide ' + (i + 1) + '" aria-current="' + (i === st.slideIdx % slides.length) + '"></button>'; }).join('') + '</div>' : '') + '</section>';
    },
    quickActions: function () {
      var h = C.hospital;
      return '<section class="quick" aria-label="Quick actions"><div class="container"><div class="grid">' +
        '<a class="qa-card" href="#/book"><span class="ic">' + icon('cal') + '</span><b>' + esc(T('book')) + '</b><small>' + esc(T('bookOnline')) + '</small></a>' +
        '<a class="qa-card" href="#/doctors"><span class="ic">' + icon('user') + '</span><b>' + esc(T('doctors')) + '</b><small>' + esc(T('findDoctor')) + '</small></a>' +
        '<a class="qa-card red" href="' + tel(h.phone24) + '"><span class="ic">' + icon('phone') + '</span><b>' + esc(T('emergencyNow')) + '</b><small>' + esc(h.phone24) + '</small></a>' +
        '<a class="qa-card" href="#/conditions"><span class="ic">' + icon('file') + '</span><b>' + esc(T('conditions')) + '</b><small>' + esc(T('healthInfo')) + '</small></a>' +
        '</div><form class="home-search" role="search" data-form="home-search"><label class="sr-only" for="hs">' + esc(T('search')) + '</label><input id="hs" name="q" type="search" placeholder="' + esc(T('searchPlaceholder')) + '" autocomplete="off"><button class="btn sm" type="submit">' + icon('search') + '<span class="hide-m">' + esc(T('search')) + '</span></button></form></div></section>';
    },
    stats: function () {
      var s = vis(C.stats).length ? vis(C.stats) : C.stats || []; if (!s.length) return '';
      return '<section class="section" style="padding-bottom:0"><div class="container"><div class="stats">' + s.map(function (x) { return '<div class="stat"><b>' + esc(x.value) + '</b><span>' + esc(L(x.label)) + '</span></div>'; }).join('') + '</div></div></section>';
    },
    visiting: function (sec) {
      var v = doctors().filter(isVisiting); if (!v.length) return '';
      return '<section class="section"><div class="container">' + secHead(sec, '#/doctors?day=visiting') + '<div class="grid">' + v.map(docCard).join('') + '</div></div></section>';
    },
    departments: function (sec) {
      return '<section class="section alt"><div class="container">' + secHead(sec, '#/departments') + '<div class="grid">' + (C.departments || []).slice(0, 8).map(deptCard).join('') + '</div></div></section>';
    },
    doctors: function (sec) {
      var f = doctors().filter(function (d) { return d.featured && !isVisiting(d); });
      if (!f.length) f = doctors();
      return '<section class="section"><div class="container">' + secHead(sec, '#/doctors') + '<div class="grid">' + f.slice(0, 8).map(docCard).join('') + '</div></div></section>';
    },
    conditions: function (sec) {
      var list = vis(C.conditions).slice(0, 18);
      return '<section class="section alt"><div class="container">' + secHead(sec, '#/conditions') + '<div class="chips" style="gap:10px">' + list.map(function (c) { return '<a class="chip" href="#/condition/' + esc(c.id) + '">' + esc(L(c.name)) + '</a>'; }).join('') + '</div></div></section>';
    },
    facilities: function (sec) {
      return '<section class="section"><div class="container">' + secHead(sec, '#/facilities') + '<div class="grid">' + vis(C.facilities).slice(0, 8).map(facCard).join('') + '</div></div></section>';
    },
    about: function (sec) {
      var a = C.about, d = C.director;
      return '<section class="section alt"><div class="container split"><div><h2>' + esc(L(sec.title) || L(a.title)) + '</h2><p>' + esc(L(a.intro)) + '</p>' +
        (d && d.show !== false ? '<div class="director" style="margin-top:18px">' + img(photoOf(d), L(d.name)) + '<div><h3>' + esc(T('directorMessage')) + '</h3><blockquote>' + esc(truncate(L(d.message), 260)) + '</blockquote><p style="margin-top:8px"><b>' + esc(L(d.name)) + '</b><br><span class="muted">' + esc(L(d.designation)) + '</span></p></div></div>' : '') +
        '<a class="btn ghost" href="#/about">' + esc(T('readMore')) + '</a></div><div>' + img(a.image, L(C.hospital.name)) + '</div></div></section>';
    },
    news: function (sec) {
      var n = vis(C.news).sort(byDateDesc).slice(0, 3); if (!n.length) return '';
      return '<section class="section"><div class="container">' + secHead(sec, '#/news') + '<div class="grid">' + n.map(newsCard).join('') + '</div></div></section>';
    },
    stories: function (sec) {
      var s = vis(C.stories); if (!s.length) return '';
      return '<section class="section alt"><div class="container">' + secHead(sec, '#/stories') + '<div class="grid">' + s.slice(0, 3).map(storyCard).join('') + '</div></div></section>';
    },
    reviews: function (sec) {
      var t = vis(C.testimonials);
      return '<section class="section"><div class="container">' + secHead(sec, '#/feedback', T('feedback')) + '<div id="reviewsBox">' + reviewsHTML(t) + '</div></div></section>';
    },
    accreditations: function (sec) {
      var a = vis(C.accreditations), r = C.registration || {}; if (!a.length) return '';
      return '<section class="section alt"><div class="container">' + secHead(sec) + '<div class="grid">' + a.map(function (x) {
        return '<div class="card" style="display:flex;gap:14px;align-items:center">' + (x.image ? img(x.image, L(x.name), '', false).replace('<img', '<img style="width:64px;height:64px;object-fit:contain"') : '<span class="dept"><span class="ic">' + icon('check') + '</span></span>') + '<div><b>' + esc(L(x.name)) + '</b><div class="muted small">' + esc(L(x.detail)) + '</div></div></div>';
      }).join('') + '</div>' + (r.showOnWebsite !== false && (r.registrationNo || r.licenceNo) ? '<p class="muted small" style="margin-top:12px">' + [r.registrationNo ? T('regNo') + ' ' + r.registrationNo : '', r.licenceNo ? 'Licence ' + r.licenceNo + (r.licenceAuthority ? ' (' + r.licenceAuthority + ')' : '') : ''].filter(Boolean).map(esc).join(' · ') + '</p>' : '') + '</div></section>';
    },
    social: function (sec) {
      var s = C.social || {};
      return '<section class="section"><div class="container">' + secHead(sec) + socialEmbeds(s) + '</div></section>';
    },
    location: function (sec) {
      var h = C.hospital;
      return '<section class="section alt"><div class="container">' + secHead(sec) + '<div class="split" style="align-items:start"><div>' + contactList() + '<p><a class="btn" href="' + esc(h.directionsUrl) + '" target="_blank" rel="noopener">' + icon('nav') + esc(T('directions')) + '</a></p></div>' +
        (h.mapEmbedUrl ? '<iframe class="map" src="' + esc(h.mapEmbedUrl) + '" title="Map: ' + esc(L(h.name)) + '" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' : '') + '</div></div></section>';
    },
  };
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }
  function byDateDesc(a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }
  function storyCard(s) {
    return '<article class="card news">' + img(s.image, '') + '<div class="bd"><h3>' + esc(L(s.title)) + '</h3><p class="muted small">' + esc(s.patientName || '') + (s.condition ? ' · ' + esc(L(s.condition)) : '') + '</p><p class="quote">' + esc(truncate(L(s.story), 320)) + '</p></div></article>';
  }
  function reviewsHTML(t) {
    var g = C.integrations || {};
    var html = '';
    if (st.reviews && st.reviews.enabled && g.showGoogleReviews !== false) {
      html += '<div class="card" style="margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><b style="font-size:2rem;color:var(--primary)">' + esc((+st.reviews.rating || 0).toFixed(1)) + '</b><div>' + stars(st.reviews.rating) + '<div class="muted small">' + esc(st.reviews.count) + ' ' + esc(T('reviewsOnGoogle')) + '</div></div></div>';
      t = st.reviews.reviews.map(function (r) { return { name: r.author, text: r.text, rating: r.rating, date: r.when, source: 'Google' }; }).concat(t);
    }
    html += t.length ? '<div class="grid">' + t.slice(0, 6).map(function (r) { return '<figure class="card review" style="margin:0">' + stars(r.rating || 5) + '<blockquote class="quote" style="margin:0">' + esc(truncate(L(r.text), 300)) + '</blockquote><figcaption class="muted small">— ' + esc(r.name || '') + (r.source ? ' · ' + esc(r.source) : '') + (r.date ? ' · ' + esc(r.date) : '') + '</figcaption></figure>'; }).join('') + '</div>' : '';
    if (g.googleReviewUrl) html += '<p style="margin-top:16px"><a class="btn ghost" href="' + esc(g.googleReviewUrl) + '" target="_blank" rel="noopener">' + icon('star') + esc(T('reviewGoogle')) + '</a></p>';
    return html;
  }
  function loadReviews() {
    if (st.reviews !== null || st.demo || st.preview) return;
    st.reviews = { enabled: false };
    fetch('api/reviews').then(function (r) { return r.json(); }).then(function (j) { st.reviews = j; var b = $('#reviewsBox'); if (b && j.enabled) b.innerHTML = reviewsHTML(vis(C.testimonials)); }).catch(function () {});
  }
  function socialEmbeds(s, noLinks) {
    var parts = [];
    if (s.facebook && s.showFacebookFeed !== false) parts.push('<div><iframe class="fb-frame" title="Facebook" loading="lazy" src="https://www.facebook.com/plugins/page.php?href=' + encodeURIComponent(s.facebook) + '&tabs=timeline&width=500&height=520&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false" allow="encrypted-media"></iframe></div>');
    if (s.tiktokUsername && s.showTiktokFeed !== false) parts.push('<div class="tt-wrap"><blockquote class="tiktok-embed" cite="https://www.tiktok.com/@' + esc(s.tiktokUsername) + '" data-unique-id="' + esc(s.tiktokUsername) + '" data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0"><section><a target="_blank" rel="noopener" href="https://www.tiktok.com/@' + esc(s.tiktokUsername) + '?refer=creator_embed">@' + esc(s.tiktokUsername) + '</a></section></blockquote></div>');
    if (s.customEmbedHtml) parts.push('<div>' + s.customEmbedHtml + '</div>'); // set by admins only
    return (noLinks ? '' : socialLinks(s)) + (parts.length ? '<div class="social-grid" style="margin-top:16px">' + parts.join('') + '</div>' : '');
  }
  function loadTikTok() {
    if (!$('.tiktok-embed') || st.preview && !navigator.onLine) return;
    var old = document.getElementById('tt-js'); if (old) old.remove();
    var sc = document.createElement('script'); sc.id = 'tt-js'; sc.async = true; sc.src = 'https://www.tiktok.com/embed.js'; document.body.appendChild(sc);
  }
  function contactList() {
    var h = C.hospital;
    return '<div class="profile" style="display:block;margin-bottom:12px"><dl>' +
      '<dt>' + esc(T('address')) + '</dt><dd>' + esc(L(h.address)) + '</dd>' +
      '<dt>' + esc(T('emergency24')) + '</dt><dd><a href="' + tel(h.phone24) + '"><b>' + esc(h.phone24) + '</b></a></dd>' +
      '<dt>' + esc(T('phones')) + '</dt><dd>' + (h.phones || []).map(function (p) { return '<a href="' + tel(p) + '">' + esc(p) + '</a>'; }).join(', ') + '</dd>' +
      (h.ambulance ? '<dt>' + esc(T('ambulance')) + '</dt><dd><a href="' + tel(h.ambulance) + '">' + esc(h.ambulance) + '</a></dd>' : '') +
      (h.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(h.email) + '">' + esc(h.email) + '</a></dd>' : '') +
      '<dt>' + esc(T('openingHours')) + '</dt><dd>' + esc(L(h.openingHours)) + '</dd></dl></div>';
  }

  // ------------------------------------------------------------------ pages
  var PAGES = {
    '': function () {
      var html = (C.home.sections || []).filter(function (s) { return s.visible !== false; }).map(function (s) { return HOME[s.id] ? HOME[s.id](s) : ''; }).join('');
      return html;
    },
    about: function () {
      var a = C.about, d = C.director, r = C.registration || {};
      return head(L(a.title), L(C.hospital.tagline)) + '<section class="section"><div class="container split" style="align-items:start"><div><p style="font-size:1.1rem"><b>' + esc(L(a.intro)) + '</b></p><p style="white-space:pre-line">' + esc(L(a.body)) + '</p>' +
        (L(a.mission) ? '<h2>' + esc(T('mission')) + '</h2><p>' + esc(L(a.mission)) + '</p>' : '') + (L(a.vision) ? '<h2>' + esc(T('vision')) + '</h2><p>' + esc(L(a.vision)) + '</p>' : '') +
        ((a.values || []).length ? '<h2>' + esc(T('values')) + '</h2><ul class="chips">' + a.values.map(function (v) { return '<li>' + esc(L(v)) + '</li>'; }).join('') + '</ul>' : '') + '</div><div>' + img(a.image, L(C.hospital.name)) + '</div></div></section>' +
        (d && d.show !== false ? '<section class="section alt"><div class="container"><h2>' + esc(T('directorMessage')) + '</h2><div class="director">' + img(photoOf(d), L(d.name)) + '<div><blockquote>' + esc(L(d.message)) + '</blockquote><p style="margin-top:10px"><b>' + esc(L(d.name)) + '</b><br><span class="muted">' + esc(L(d.designation)) + '</span></p></div></div></div></section>' : '') +
        HOME.stats() + HOME.accreditations({ title: { en: T('registration') + ' & recognition', ne: 'दर्ता तथा मान्यता' } }) +
        (r.showOnWebsite !== false ? '<section class="section"><div class="container"><div class="table-wrap"><table><tbody>' +
          [[T('registration'), L(r.registeredWith)], [T('regNo'), r.registrationNo], ['Company Reg. No.', r.companyRegNo], [T('pan'), r.panNo], ['Licence', r.licenceNo && (r.licenceNo + (r.licenceAuthority ? ' — ' + r.licenceAuthority : ''))], [T('beds'), C.hospital.beds]]
            .filter(function (x) { return x[1]; }).map(function (x) { return '<tr><th scope="row">' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</tbody></table></div></div></section>' : '');
    },
    departments: function () {
      return head(T('departments'), '', esc(T('departments'))) + '<section class="section"><div class="container"><div class="grid">' + (C.departments || []).map(deptCard).join('') + '</div></div></section>';
    },
    department: function (id) {
      var d = deptOf(id); if (!d) return notFound();
      var docs = doctors().filter(function (x) { return x.dept === id; }), conds = vis(C.conditions).filter(function (c) { return c.dept === id; });
      return head(L(d.name), L(d.summary), '<a href="#/departments">' + esc(T('departments')) + '</a>') + '<section class="section"><div class="container">' +
        (d.image ? img(d.image, L(d.name)).replace('<img', '<img style="border-radius:var(--radius);margin-bottom:20px;max-height:360px;width:100%;object-fit:cover"') : '') +
        (docs.length ? '<h2>' + esc(T('doctors')) + '</h2><div class="grid" style="margin-bottom:28px">' + docs.map(docCard).join('') + '</div>' : '') +
        (conds.length ? '<h2>' + esc(T('relatedConditions')) + '</h2><div class="chips" style="margin-bottom:24px">' + conds.map(function (c) { return '<a class="chip" href="#/condition/' + esc(c.id) + '">' + esc(L(c.name)) + '</a>'; }).join('') + '</div>' : '') +
        '<a class="btn" href="#/book?dept=' + esc(id) + '">' + icon('cal') + esc(T('book')) + '</a></div></section>';
    },
    doctors: function (_, q) {
      st.docFilter = { q: q.q || '', dept: q.dept || '', cond: q.cond || '', lang: '', gender: '', day: q.day || '' };
      var langs = {}, genders = {};
      doctors().forEach(function (d) { (d.languages || []).forEach(function (l) { langs[l] = 1; }); if (d.gender) genders[d.gender] = 1; });
      var f = st.docFilter;
      return head(T('doctors'), doctors().length + ' ' + T('doctorsFound'), esc(T('doctors'))) + '<section class="section"><div class="container"><form class="filters" data-form="docfilter" role="search">' +
        '<label class="f full">' + esc(T('search')) + '<input name="q" type="search" value="' + esc(f.q) + '" placeholder="' + esc(lang === 'ne' ? 'नाम वा विशेषज्ञता' : 'Name or speciality') + '"></label>' +
        sel('dept', T('department'), [['', T('allDepartments')]].concat((C.departments || []).map(function (d) { return [d.id, L(d.name)]; })), f.dept) +
        sel('cond', T('condition'), [['', T('anyCondition')]].concat(vis(C.conditions).map(function (c) { return [c.id, L(c.name)]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); })), f.cond) +
        sel('day', T('available'), [['', T('anyDay')], ['today', T('today')], ['visiting', T('visitingSpecialists')]].concat(S.DAYS.map(function (d) { return [d, dayName(d)]; })), f.day) +
        sel('lang', T('languages'), [['', T('anyLanguage')]].concat(Object.keys(langs).map(function (l) { return [l, l]; })), '') +
        (Object.keys(genders).length ? sel('gender', T('gender'), [['', T('anyGender')]].concat(Object.keys(genders).map(function (g) { return [g, g]; })), '') : '') +
        '</form><p class="muted" id="docCount" aria-live="polite"></p><div class="grid" id="docList"></div></div></section>';
    },
    doctor: function (id) {
      var d = docById(id); if (!d) return notFound();
      var dp = deptOf(d.dept), conds = vis(C.conditions).filter(function (c) { return c.dept === d.dept; });
      var visit = isVisiting(d);
      return head(L(d.name), L(d.title), '<a href="#/doctors">' + esc(T('doctors')) + '</a>') + '<section class="section"><div class="container profile"><div><div class="portrait">' + img(photoOf(d), L(d.name)) + '</div>' +
        '<p style="margin-top:14px"><a class="btn" style="width:100%" href="#/book?doctor=' + esc(d.id) + '">' + icon('cal') + esc(T('bookWith')) + '</a></p><p><a class="btn ghost" style="width:100%" href="' + tel(C.hospital.phones[0]) + '">' + icon('phone') + esc(T('call')) + '</a></p></div><div>' +
        (L(d.bio) ? '<p style="font-size:1.05rem">' + esc(L(d.bio)) + '</p>' : '') + '<dl>' +
        (dp ? '<dt>' + esc(T('department')) + '</dt><dd><a href="#/department/' + esc(dp.id) + '">' + esc(L(dp.name)) + '</a></dd>' : '') +
        (d.degrees ? '<dt>' + esc(T('degrees')) + '</dt><dd>' + esc(d.degrees) + '</dd>' : '') +
        (d.nmc ? '<dt>' + esc(T('nmc')) + '</dt><dd>' + esc(d.nmc) + '</dd>' : '') +
        (d.affiliation ? '<dt>' + esc(T('affiliation')) + '</dt><dd>' + esc(d.affiliation) + '</dd>' : '') +
        '<dt>' + esc(T('schedule')) + '</dt><dd>' + esc(scheduleOf(d)) + (visit ? ' — ' + esc(T('nextVisit')) + ': <b>' + esc(fmtDate(nextVisit(d))) + '</b>' : '') + '</dd>' +
        (S.hasFixedSchedule(d) && hoursOf(d) ? '<dt>' + esc(T('hours')) + '</dt><dd>' + esc(hoursOf(d)) + '</dd>' : '') +
        ((d.languages || []).length ? '<dt>' + esc(T('languages')) + '</dt><dd>' + esc(d.languages.join(', ')) + '</dd>' : '') +
        (d.gender ? '<dt>' + esc(T('gender')) + '</dt><dd>' + esc(d.gender) + '</dd>' : '') + '</dl>' +
        ((d.focus || []).length ? '<h2 style="margin-top:22px">' + esc(T('focus')) + '</h2><ul class="chips">' + d.focus.map(function (x) { return '<li>' + esc(L(x)) + '</li>'; }).join('') + '</ul>' : '') +
        (conds.length ? '<h2 style="margin-top:22px">' + esc(T('relatedConditions')) + '</h2><div class="chips">' + conds.map(function (c) { return '<a class="chip" href="#/condition/' + esc(c.id) + '">' + esc(L(c.name)) + '</a>'; }).join('') + '</div>' : '') +
        '</div></div></section>';
    },
    conditions: function () {
      var list = vis(C.conditions);
      var groups = (C.departments || []).map(function (d) { return { d: d, items: list.filter(function (c) { return c.dept === d.id; }) }; }).filter(function (g) { return g.items.length; });
      return head(T('conditions'), lang === 'ne' ? 'रोगबारे सरल भाषामा जानकारी — के हो, कसरी तयारी गर्ने र निको हुने क्रम' : 'Plain-language guides: what it is, how to prepare, and what recovery looks like.', esc(T('conditions'))) +
        '<section class="section"><div class="container"><form class="home-search" data-form="cond-filter" role="search" style="margin:0 0 18px"><label class="sr-only" for="cf">' + esc(T('search')) + '</label><input id="cf" type="search" placeholder="' + esc(lang === 'ne' ? 'रोग वा लक्षण…' : 'Type a condition or symptom…') + '" autocomplete="off"></form>' +
        '<div class="az">' + groups.map(function (g) { return '<a class="chip" href="#/conditions" data-act="jump" data-target="g-' + esc(g.d.id) + '">' + esc(L(g.d.name)) + '</a>'; }).join('') + '</div><div id="condGroups">' +
        groups.map(function (g) { return '<div class="cgroup" id="g-' + esc(g.d.id) + '" style="margin-bottom:22px"><h2 style="font-size:1.15rem"><a href="#/department/' + esc(g.d.id) + '" style="text-decoration:none">' + esc(L(g.d.name)) + '</a></h2><ul class="cond-list">' +
          g.items.map(function (c) { return '<li data-text="' + esc(plain(c.name.en + ' ' + (c.name.ne || '') + ' ' + (c.keywords || []).join(' '))) + '"><a href="#/condition/' + esc(c.id) + '">' + esc(L(c.name)) + '</a></li>'; }).join('') + '</ul></div>'; }).join('') + '</div></div></section>';
    },
    condition: function (id) {
      var c = vis(C.conditions).find(function (x) { return x.id === id; }); if (!c) return notFound();
      var dp = deptOf(c.dept), docs = doctors().filter(function (d) { return d.dept === c.dept; });
      var blocks = [['whatIsIt', c.what], ['symptoms', c.symptoms], ['prepare', L(c.prepare) ? c.prepare : C.pages.conditionPrepare], ['treatment', c.treatment], ['recovery', c.recovery]].filter(function (b) { return L(b[1]); });
      return head(L(c.name), dp ? L(dp.name) : '', '<a href="#/conditions">' + esc(T('conditions')) + '</a>') + '<section class="section"><div class="container" style="max-width:860px">' +
        (L(c.urgent) ? '<div class="alert" role="note" style="margin-bottom:16px"><b>' + esc(T('urgent')) + ':</b> ' + esc(L(c.urgent)) + ' <a href="' + tel(C.hospital.phone24) + '" style="color:inherit;font-weight:800">' + esc(C.hospital.phone24) + '</a></div>' : '') +
        blocks.map(function (b, i) { return '<div class="qa-block"><h2><span class="n">' + (i + 1) + '</span>' + esc(T(b[0])) + '</h2><p style="margin:0;white-space:pre-line">' + esc(L(b[1])) + '</p></div>'; }).join('') +
        '<p><a class="btn" href="#/book?dept=' + esc(c.dept) + '">' + icon('cal') + esc(T('book')) + '</a></p>' +
        (docs.length ? '<h2 style="margin-top:28px">' + esc(T('whoTreats')) + '</h2><div class="grid">' + docs.map(docCard).join('') + '</div>' : '') +
        '<p class="muted small" style="margin-top:24px"><b>' + esc(T('disclaimer')) + ':</b> ' + esc(L(C.pages.conditionDisclaimer)) + '</p></div></section>';
    },
    facilities: function () {
      return head(T('facilities'), '', esc(T('facilities'))) + '<section class="section"><div class="container"><div class="grid">' + vis(C.facilities).map(facCard).join('') + '</div></div></section>' +
        '<section class="section alt"><div class="container"><h2>' + esc(T('ourServices')) + '</h2><div class="grid">' + vis(C.services).map(function (s) { return '<div class="card dept"><span class="ic">' + icon(s.icon) + '</span><span><h3>' + esc(L(s.name)) + '</h3><p>' + esc(L(s.description)) + '</p></span></div>'; }).join('') + '</div></div></section>';
    },
    notices: function () {
      var types = ['all', 'notice', 'vacancy', 'event', 'holiday'];
      return head(T('notices'), '', esc(T('notices'))) + '<section class="section"><div class="container" style="max-width:900px"><div class="tabs" role="group" aria-label="' + esc(T('filterBy')) + '">' +
        types.map(function (t) { return '<button data-act="ntab" data-t="' + t + '" aria-pressed="' + (st.noticeTab === t) + '">' + esc(T(t)) + '</button>'; }).join('') + '</div><div class="card" id="noticeList">' + noticeList() + '</div></div></section>';
    },
    news: function (id) {
      if (id) {
        var n = vis(C.news).find(function (x) { return x.id === id; }); if (!n) return notFound();
        return head(L(n.title), fmtDate(n.date), '<a href="#/news">' + esc(T('news')) + '</a>') + '<section class="section"><div class="container" style="max-width:860px">' + img(n.image, '').replace('<img', '<img style="border-radius:var(--radius);margin-bottom:18px;width:100%"') + '<p style="font-size:1.08rem"><b>' + esc(L(n.summary)) + '</b></p><p style="white-space:pre-line">' + esc(L(n.body)) + '</p></div></section>';
      }
      var all = vis(C.news).sort(byDateDesc);
      return head(T('news'), '', esc(T('news'))) + '<section class="section"><div class="container">' + (all.length ? '<div class="grid">' + all.map(newsCard).join('') + '</div>' : '<p>' + esc(T('newsEmpty')) + '</p>') + '</div></section>';
    },
    stories: function () {
      var s = vis(C.stories);
      return head(T('stories'), '', esc(T('stories'))) + '<section class="section"><div class="container">' + (s.length ? '<div class="grid">' + s.map(storyCard).join('') + '</div>' : '<p>' + esc(T('storiesEmpty')) + '</p>') + '</div></section>';
    },
    feedback: function () {
      return head(T('feedback'), '', esc(T('feedback'))) + '<section class="section"><div class="container split" style="align-items:start"><form class="card form-grid" data-form="feedback" novalidate>' +
        '<label class="f">' + esc(T('name')) + '<input name="name" autocomplete="name"></label><label class="f">' + esc(T('phone')) + '<input name="phone" type="tel" inputmode="tel" autocomplete="tel"></label>' +
        '<fieldset style="border:0;padding:0;margin:0"><legend class="f" style="font-weight:600">' + esc(T('rating')) + '</legend><div class="tabs">' + [5, 4, 3, 2, 1].map(function (n) { return '<label class="check" style="border:1.5px solid var(--line);border-radius:999px;padding:6px 12px"><input type="radio" name="rating" value="' + n + '"' + (n === 5 ? ' checked' : '') + '>' + n + ' ★</label>'; }).join('') + '</div></fieldset>' +
        '<label class="f">' + esc(T('message')) + ' <span class="muted small">(' + esc(T('required')) + ')</span><textarea name="message" required></textarea></label>' +
        '<input name="website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<button class="btn" type="submit">' + esc(T('send')) + '</button><div class="msg" role="status"></div></form><div><h2>' + esc(T('reviewsOnGoogle')) + '</h2><div id="reviewsBox">' + reviewsHTML(vis(C.testimonials)) + '</div></div></div></section>';
    },
    qa: function () {
      var ans = C.answeredQuestions || [];
      return head(T('qa'), '', esc(T('qa'))) + '<section class="section"><div class="container" style="max-width:900px"><h2>' + esc(T('faq')) + '</h2>' +
        vis(C.faq).map(function (f) { return '<details class="qa-block"><summary style="cursor:pointer;font-weight:700;min-height:28px">' + esc(L(f.q)) + '</summary><p style="margin:10px 0 0;white-space:pre-line">' + esc(L(f.a)) + '</p></details>'; }).join('') +
        (ans.length ? '<h2 style="margin-top:28px">' + esc(T('askedQuestions')) + '</h2>' + ans.map(function (f) { return '<details class="qa-block"><summary style="cursor:pointer;font-weight:700">' + esc(f.q) + '</summary><p style="margin:10px 0 0;white-space:pre-line">' + esc(f.a) + '</p></details>'; }).join('') : '') +
        '<h2 style="margin-top:28px">' + esc(T('askQuestion')) + '</h2><form class="card form-grid" data-form="question" novalidate><label class="f">' + esc(T('name')) + '<input name="name" autocomplete="name"></label>' +
        '<label class="f">' + esc(T('phone')) + ' / Email<input name="contact" autocomplete="tel"></label><label class="f">' + esc(T('yourQuestion')) + '<textarea name="question" required></textarea></label>' +
        '<input name="website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn" type="submit">' + esc(T('send')) + '</button><div class="msg" role="status"></div></form></div></section>';
    },
    contact: function () {
      var h = C.hospital;
      return head(T('contact'), L(h.address), esc(T('contact'))) + '<section class="section"><div class="container split" style="align-items:start"><div>' + contactList() +
        '<p style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn red" href="' + tel(h.phone24) + '">' + icon('phone') + esc(T('call')) + ' ' + esc(h.phone24) + '</a><a class="btn" href="' + esc(h.directionsUrl) + '" target="_blank" rel="noopener">' + icon('nav') + esc(T('directions')) + '</a>' +
        (h.whatsapp ? '<a class="btn ghost" href="https://wa.me/' + waNum(h.whatsapp) + '" target="_blank" rel="noopener">' + icon('whatsapp') + 'WhatsApp</a>' : '') + '</p>' +
        '<h2 style="margin-top:20px">' + esc(T('followUs')) + '</h2>' + socialLinks(C.social || {}) + '</div>' +
        (h.mapEmbedUrl ? '<iframe class="map" style="height:420px" src="' + esc(h.mapEmbedUrl) + '" title="Map" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' : '') + '</div></section>' +
        '<section class="section alt"><div class="container">' + socialEmbeds(C.social || {}, true) + '</div></section>';
    },
    portal: function () {
      return head(T('portal'), T('portalSoon'), esc(T('portal'))) + '<section class="section"><div class="container" style="max-width:760px"><div class="card"><span class="tag amber">' + esc(T('portalSoon')) + '</span><p style="margin-top:10px">' + esc(L(C.pages.portalIntro)) + '</p><p class="muted">' + esc(T('portalFeatures')) + '</p>' +
        '<a class="btn" href="#/my-booking">' + esc(T('myBooking')) + '</a></div></div></section>';
    },
    privacy: function () { return head(T('privacy'), '', esc(T('privacy'))) + '<section class="section"><div class="container" style="max-width:860px"><p style="white-space:pre-line">' + esc(L(C.pages.privacy)) + '</p></div></section>'; },
    'staff-mail': function () {
      var m = C.staffMail || {};
      return head(T('staffMail'), '', esc(T('staffMail'))) + '<section class="section"><div class="container" style="max-width:640px"><div class="card">' + (m.enabled && m.webmailUrl ? '<p>' + esc(m.provider || '') + (m.domain ? ' · @' + esc(m.domain) : '') + '</p><a class="btn" href="' + esc(m.webmailUrl) + '" target="_blank" rel="noopener">' + icon('mail') + 'Open staff mailbox</a>' : '<p>' + esc(L(m.note)) + '</p>') + '</div></div></section>';
    },
    search: function (_, q) {
      var list = search(q.q || '');
      return head(T('search') + ': “' + (q.q || '') + '”', list.length + ' ' + T('results')) + '<section class="section"><div class="container" style="max-width:820px"><ul class="results card">' + resultsHTML(list) + '</ul></div></section>';
    },
    book: function (_, q) {
      if (!st.wiz || q.doctor || q.dept || st.wiz.done) st.wiz = { step: q.doctor ? 2 : 1, doctorId: q.doctor || '', dept: q.dept || (q.doctor && docById(q.doctor) ? docById(q.doctor).dept : ''), date: '', time: '', taken: {} };
      return head(T('book'), T('bookOnline'), esc(T('book'))) + '<section class="section"><div class="container" style="max-width:820px"><div class="card" id="wizard">' + wizardHTML() + '</div>' +
        '<p class="muted small" style="margin-top:12px">' + esc(L(C.booking.instructions)) + '</p></div></section>';
    },
    'my-booking': function () {
      return head(T('myBooking'), T('manage'), esc(T('myBooking'))) + '<section class="section"><div class="container" style="max-width:720px"><form class="card form-grid" data-form="lookup" novalidate>' +
        '<label class="f">' + esc(T('bookingCode')) + '<input name="code" autocapitalize="characters" required placeholder="NK…"></label><label class="f">' + esc(T('phone')) + '<input name="phone" type="tel" inputmode="tel" required></label>' +
        '<button class="btn" type="submit">' + esc(T('lookup')) + '</button><div class="msg" role="status"></div></form><div id="manageBox" style="margin-top:16px"></div></div></section>';
    },
  };
  function sel(name, label, opts, val) {
    return '<label class="f">' + esc(label) + '<select name="' + name + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
  }
  function notFound() { return head(T('pageNotFound')) + '<section class="section"><div class="container"><a class="btn" href="#/">' + esc(T('home')) + '</a></div></section>'; }

  function noticeList() {
    var list = vis(C.notices).filter(noticeLive).filter(function (n) { return st.noticeTab === 'all' || n.type === st.noticeTab; })
      .sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || byDateDesc(a, b); });
    if (!list.length) return '<p style="margin:0">' + esc(T('noticesEmpty')) + '</p>';
    return list.map(function (n) {
      var d = n.date ? S.parse(n.date) : null;
      return '<article class="notice"><div class="d">' + (d ? '<b>' + d.getDate() + '</b><span>' + esc(d.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB', { month: 'short' })) + '</span>' : '') + '</div><div><span class="tag' + (n.type === 'vacancy' ? ' green' : n.important ? ' red' : '') + '">' + esc(T(n.type || 'notice')) + '</span>' + (n.important ? ' <span class="tag red">' + esc(T('important')) + '</span>' : '') +
        '<h3 style="margin:6px 0 4px">' + esc(L(n.title)) + '</h3><p style="margin:0;white-space:pre-line">' + esc(L(n.body)) + '</p>' +
        (n.link ? '<p style="margin:8px 0 0"><a href="' + esc(n.link) + '">' + esc(T('learnMore')) + ' →</a></p>' : '') + (n.attachment ? '<p style="margin:8px 0 0"><a href="' + esc(n.attachment) + '" target="_blank" rel="noopener">' + icon('file', ' width="16" height="16" style="vertical-align:-3px"') + ' PDF</a></p>' : '') + '</div></article>';
    }).join('');
  }

  function filterDoctors() {
    var f = st.docFilter, q = plain(f.q), td = today();
    var cond = f.cond ? vis(C.conditions).find(function (c) { return c.id === f.cond; }) : null;
    var list = doctors().filter(function (d) {
      if (f.dept && d.dept !== f.dept) return false;
      if (cond && d.dept !== cond.dept && !(d.focus || []).some(function (x) { return plain(x).indexOf(plain(cond.name.en).split(' ')[0]) > -1; })) return false;
      if (f.lang && (d.languages || []).indexOf(f.lang) < 0) return false;
      if (f.gender && d.gender !== f.gender) return false;
      if (f.day === 'today' && !availToday(d)) return false;
      if (f.day === 'visiting' && !isVisiting(d)) return false;
      if (f.day && S.DAYS.indexOf(f.day) > -1 && (!d.days || d.days.indexOf(f.day) < 0)) return false;
      if (q) { var dp = deptOf(d.dept); var hay = plain(d.name.en + ' ' + (d.name.ne || '') + ' ' + L(d.title) + ' ' + (dp ? dp.name.en + ' ' + (dp.name.ne || '') : '') + ' ' + (d.focus || []).join(' ')); if (hay.indexOf(q) < 0) return false; }
      return true;
    });
    $('#docList').innerHTML = list.length ? list.map(docCard).join('') : '<p>' + esc(T('noResults')) + '</p>';
    $('#docCount').textContent = list.length + ' ' + T('doctorsFound');
    void td;
  }

  // -------------------------------------------------------------- booking
  function wizardHTML() {
    var w = st.wiz;
    var steps = '<ol class="steps">' + [1, 2, 3].map(function (n) { return '<li' + (w.step === n ? ' aria-current="step"' : '') + (w.step > n || w.done ? ' class="done"' : '') + '>' + esc(T('step')) + ' ' + n + ': ' + esc(T('step' + n)) + '</li>'; }).join('') + '</ol>';
    if (w.done) return confirmationHTML(w.done);
    if (w.step === 1) {
      var list = doctors().filter(function (d) { return !w.dept || d.dept === w.dept; });
      return steps + '<h2>' + esc(T('chooseDoctor')) + '</h2><div class="filters" style="grid-template-columns:1fr">' + sel('wdept', T('department'), [['', T('allDepartments')]].concat((C.departments || []).map(function (d) { return [d.id, L(d.name)]; })), w.dept).replace('<select', '<select data-act-change="wdept"') + '</div>' +
        '<div class="pick" role="list">' + list.map(function (d) {
          return '<button type="button" class="pick-doc" data-act="wdoc" data-id="' + esc(d.id) + '" aria-pressed="' + (w.doctorId === d.id) + '">' + img(photoOf(d), '') + '<span><b>' + esc(L(d.name)) + '</b><small>' + esc(L(d.title)) + '</small><small>' + esc(scheduleOf(d)) + (isVisiting(d) ? ' · ' + esc(T('nextVisit')) + ': ' + esc(fmtDate(nextVisit(d))) : '') + '</small></span></button>';
        }).join('') + '</div>';
    }
    var d = docById(w.doctorId);
    if (!d) { w.step = 1; return wizardHTML(); }
    var summary = '<div class="summary"><b>' + esc(L(d.name)) + '</b> — ' + esc(L(d.title)) + (w.date ? '<br>' + icon('cal', ' width="14" height="14" style="vertical-align:-2px"') + ' ' + esc(fmtDate(w.date)) + (w.time ? ' · ' + esc(w.time) : '') : '') + '</div>';
    if (w.step === 2) {
      var dates = S.nextDates(d, C.booking, isVisiting(d) && !(d.days || []).length ? 4 : 14);
      var fixed = S.hasFixedSchedule(d);
      var html = steps + summary + '<h2 style="margin-top:16px">' + esc(T('chooseDate')) + '</h2><div class="dates" role="group" aria-label="' + esc(T('chooseDate')) + '">' + dates.map(function (s) {
        var dt = S.parse(s);
        return '<button type="button" data-act="wdate" data-d="' + s + '" aria-pressed="' + (w.date === s) + '" aria-label="' + esc(fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long' })) + '"><small>' + esc(dayName(S.DAYS[dt.getDay()])) + '</small><b>' + dt.getDate() + '</b><small>' + esc(dt.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB', { month: 'short' })) + '</small></button>';
      }).join('') + '</div>';
      if (w.date) {
        if (fixed) {
          var max = +C.booking.maxPerSlot || 1, now = new Date(), isToday = w.date === today();
          var slots = S.slots(d, C.booking).filter(function (t) { if (!isToday) return true; var p = t.split(':'); return +p[0] * 60 + +p[1] > now.getHours() * 60 + now.getMinutes() + 30; });
          html += '<h2 style="margin-top:12px">' + esc(T('chooseTime')) + '</h2>' + (slots.length ? '<div class="slots" role="group" aria-label="' + esc(T('chooseTime')) + '">' + slots.map(function (t) {
            var full = (w.taken[t] || 0) >= max;
            return '<button type="button" data-act="wtime" data-t="' + t + '" aria-pressed="' + (w.time === t) + '"' + (full ? ' disabled aria-label="' + t + ' (booked)"' : '') + '>' + t + '</button>';
          }).join('') + '</div>' : '<p class="alert warn">' + esc(T('noSlots')) + '</p>');
        } else html += '<p class="alert info" style="margin-top:12px">' + esc(T('timeConfirm')) + '</p>';
      }
      return html + '<div class="wiz-nav"><button class="btn ghost" data-act="wback">← ' + esc(T('back')) + '</button><button class="btn" data-act="wnext"' + (w.date && (w.time || !fixed) ? '' : ' disabled') + '>' + esc(T('next')) + ' →</button></div>';
    }
    // step 3
    var b = C.booking;
    return steps + summary + '<form class="form-grid" data-form="booking" novalidate style="margin-top:16px">' +
      '<label class="f">' + esc(T('patientName')) + ' <span class="muted small">(' + esc(T('required')) + ')</span><input name="name" required autocomplete="name"></label>' +
      '<label class="f">' + esc(T('phone')) + ' <span class="muted small">(' + esc(T('required')) + ')</span><input name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="98XXXXXXXX"></label>' +
      (b.askEmail !== false ? '<label class="f">' + esc(T('email')) + '<input name="email" type="email" autocomplete="email"></label>' : '') +
      (b.askAge !== false ? '<div class="filters" style="grid-template-columns:1fr 1fr;margin:0"><label class="f">' + esc(T('age')) + '<input name="age" inputmode="numeric" maxlength="3"></label>' + sel('gender', T('gender'), [['', '—'], ['Male', lang === 'ne' ? 'पुरुष' : 'Male'], ['Female', lang === 'ne' ? 'महिला' : 'Female'], ['Other', lang === 'ne' ? 'अन्य' : 'Other']], '') + '</div>' : '') +
      '<label class="f">' + esc(T('reason')) + '<textarea name="reason" style="min-height:80px"></textarea></label>' +
      '<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:600;font-size:.9rem;margin-bottom:6px">' + esc(T('notifyMe')) + '</legend><div style="display:flex;gap:16px;flex-wrap:wrap">' +
      [['sms', T('sms')], ['whatsapp', T('whatsapp')], ['email', 'Email']].map(function (x) { return '<label class="check"><input type="checkbox" name="notify" value="' + x[0] + '"' + (x[0] !== 'email' ? ' checked' : '') + '>' + esc(x[1]) + '</label>'; }).join('') + '</div></fieldset>' +
      '<label class="check"><input type="checkbox" name="consent" required> <span>' + esc(T('consent')) + ' <a href="#/privacy" target="_blank">' + esc(T('privacy')) + '</a></span></label>' +
      '<input name="website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true"><div class="msg" role="alert"></div>' +
      '<div class="wiz-nav"><button type="button" class="btn ghost" data-act="wback">← ' + esc(T('back')) + '</button><button class="btn" type="submit">' + icon('check') + esc(T('confirm')) + '</button></div></form>';
  }
  function confirmationHTML(b) {
    var h = C.hospital;
    var text = 'Appointment booked at ' + L(h.shortName) + '\nCode: ' + b.code + '\nPatient: ' + b.name + '\nDoctor: ' + b.doctorName + '\nDate: ' + b.date + ' ' + (b.time || '') + '\nPhone: ' + (b.rawPhone || b.phone);
    var wa = C.booking.notifyWhatsApp || h.whatsapp;
    return '<div style="text-align:center"><div class="dept" style="justify-content:center"><span class="ic" style="background:#e3f4ea;color:#17603a">' + icon('check') + '</span></div><h2 tabindex="-1" id="doneHead" style="margin-top:10px">' + esc(T('booked')) + '</h2>' +
      '<p>' + esc(T('bookingCode')) + '</p><div class="code">' + esc(b.code) + '</div><p class="muted" style="margin-top:8px">' + esc(T('keepCode')) + '</p>' +
      '<div class="summary" style="text-align:left;margin:14px 0"><b>' + esc(b.doctorName) + '</b><br>' + esc(fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + ' · ' + esc(b.time) + '<br>' + esc(b.name) + '</div>' +
      (st.demo ? '<p class="alert warn">' + esc(T('offline')) + '</p>' : '') +
      '<div style="display:grid;gap:10px">' + (wa ? '<a class="btn" style="background:#1f8a4c;border-color:#1f8a4c" target="_blank" rel="noopener" href="https://wa.me/' + waNum(wa) + '?text=' + encodeURIComponent(text) + '">' + icon('whatsapp') + esc(T('sendWhatsApp')) + '</a>' : '') +
      '<button class="btn ghost" data-act="ics">' + icon('cal') + esc(T('addCalendar')) + '</button><a class="btn ghost" href="#/my-booking">' + esc(T('manage')) + '</a><button class="btn ghost" data-act="wreset">' + esc(T('bookAnother')) + '</button></div></div>';
  }
  function fetchTaken(doctorId, date, cb) {
    if (st.demo || st.preview) { var t = {}; st.demoBookings.forEach(function (b) { if (b.doctorId === doctorId && b.date === date && b.status !== 'cancelled') t[b.time] = (t[b.time] || 0) + 1; }); cb(t); return; }
    fetch('api/slots?doctor=' + encodeURIComponent(doctorId) + '&date=' + date).then(function (r) { return r.json(); }).then(function (j) { cb(j.taken || {}); }).catch(function () { cb({}); });
  }
  function redrawWizard(focusSel) {
    var box = $('#wizard'); if (!box) return;
    box.innerHTML = wizardHTML();
    var f = focusSel && $(focusSel, box); if (f) f.focus();
  }
  function api(path, body) {
    if (st.demo || st.preview) return demoApi(path, body);
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || T('error')); return j; }); });
  }
  function demoApi(path, body) {
    return new Promise(function (res, rej) {
      setTimeout(function () {
        if (path === 'api/bookings') {
          var d = docById(body.doctorId);
          var b = { code: 'NK' + Math.random().toString(16).slice(2, 8).toUpperCase(), status: 'new', doctorId: d.id, doctorName: d.name.en, date: body.date, time: S.hasFixedSchedule(d) ? body.time : 'To be confirmed', name: body.name, phone: body.phone };
          st.demoBookings.push(b); res({ ok: true, booking: b });
        } else if (/lookup|reschedule|cancel/.test(path)) {
          var f = st.demoBookings.find(function (x) { return x.code === String(body.code || '').toUpperCase().trim(); });
          if (!f) return rej(new Error('No booking found. Check the code and phone number.'));
          if (/reschedule/.test(path)) { f.date = body.date; f.time = body.time || f.time; f.status = 'rescheduled'; }
          if (/cancel/.test(path)) f.status = 'cancelled';
          res({ ok: true, booking: f });
        } else res({ ok: true });
      }, 300);
    });
  }
  function downloadICS(b) {
    var t = (b.time && /\d/.test(b.time) ? b.time : '09:00').replace(':', '');
    var dt = b.date.replace(/-/g, '') + 'T' + t + '00';
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIKO Hospital//EN', 'BEGIN:VEVENT', 'UID:' + b.code + '@niko', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;TZID=Asia/Kathmandu:' + dt, 'DURATION:PT30M', 'SUMMARY:Appointment – ' + b.doctorName, 'LOCATION:' + L(C.hospital.name) + ', ' + C.hospital.address.en, 'DESCRIPTION:Booking code ' + b.code + '. Call ' + C.hospital.phone24, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'appointment-' + b.code + '.ics'; document.body.appendChild(a); a.click(); a.remove();
  }

  // manage booking
  function manageHTML(b) {
    var d = docById(b.doctorId);
    var html = '<div class="card"><p><span class="tag' + (b.status === 'cancelled' ? ' red' : ' green') + '">' + esc(b.status === 'cancelled' ? T('cancelled') : b.status) + '</span></p><p><b>' + esc(b.doctorName) + '</b><br>' + esc(fmtDate(b.date)) + ' · ' + esc(b.time) + '<br>' + esc(b.name) + '</p>';
    if (b.status !== 'cancelled' && d) {
      st.manage = { b: b, d: d, date: '', time: '', taken: {} };
      html += '<div id="reschedBox"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn ghost red" style="color:var(--emergency);border-color:var(--emergency)" data-act="mcancel">' + esc(T('cancelBooking')) + '</button></div>';
    }
    return html + '</div>';
  }
  function reschedHTML() {
    var m = st.manage, d = m.d, fixed = S.hasFixedSchedule(d);
    var dates = S.nextDates(d, C.booking, 14);
    var h = '<h3 style="margin-top:12px">' + esc(T('reschedule')) + '</h3><div class="dates">' + dates.map(function (s) { var dt = S.parse(s); return '<button type="button" data-act="mdate" data-d="' + s + '" aria-pressed="' + (m.date === s) + '"><small>' + esc(dayName(S.DAYS[dt.getDay()])) + '</small><b>' + dt.getDate() + '</b><small>' + esc(dt.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB', { month: 'short' })) + '</small></button>'; }).join('') + '</div>';
    if (m.date && fixed) h += '<div class="slots">' + S.slots(d, C.booking).map(function (t) { var full = (m.taken[t] || 0) >= (+C.booking.maxPerSlot || 1); return '<button type="button" data-act="mtime" data-t="' + t + '" aria-pressed="' + (m.time === t) + '"' + (full ? ' disabled' : '') + '>' + t + '</button>'; }).join('') + '</div>';
    return h + '<p style="margin-top:12px"><button class="btn" data-act="msave"' + (m.date && (m.time || !fixed) ? '' : ' disabled') + '>' + esc(T('saveChanges')) + '</button></p><div class="msg" role="status"></div>';
  }

  // ----------------------------------------------------------------- slides
  function startSlides() {
    clearInterval(st.slideTimer);
    var n = vis(C.slides).length; if (n < 2 || st.slidePaused || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    st.slideTimer = setInterval(function () { showSlide(st.slideIdx + 1); }, Math.max(3, +C.theme.slideIntervalSeconds || 6) * 1000);
  }
  function showSlide(i) {
    var slides = $$('.hero .slide'); if (!slides.length) return;
    st.slideIdx = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { var on = k === st.slideIdx; s.classList.toggle('on', on); s.setAttribute('aria-hidden', on ? 'false' : 'true'); $$('a', s).forEach(function (a) { a.tabIndex = on ? 0 : -1; }); });
    $$('.hero .dots button').forEach(function (b, k) { b.setAttribute('aria-current', k === st.slideIdx); });
  }

  // ----------------------------------------------------------------- router
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '').split('#')[0];
    var parts = h.split('?'), path = parts[0].split('/').filter(Boolean), q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    return { page: path[0] || '', id: path[1] || '', q: q };
  }
  function renderAll(keepScroll) {
    var y = window.scrollY;
    document.body.innerHTML = shell();
    renderPage(!keepScroll);
    if (keepScroll) window.scrollTo(0, y);
  }
  function renderPage(scrollTop) {
    var r = parseHash();
    var fn = PAGES[r.page] || (r.page === 'facilities' ? PAGES.facilities : null);
    var main = $('#main');
    main.innerHTML = fn ? fn(r.id, r.q) : notFound();
    $$('.nav a').forEach(function (a) { var href = a.getAttribute('href'); var cur = '#/' + r.page; if ((href === '#/' && !r.page) || (href !== '#/' && cur.indexOf(href) === 0)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var h1 = $('h1', main);
    document.title = (h1 ? h1.textContent + ' | ' : '') + L(C.hospital.name);
    if (scrollTop !== false) {
      var anchor = location.hash.split('#')[2];
      if (anchor && document.getElementById(anchor)) document.getElementById(anchor).scrollIntoView();
      else window.scrollTo(0, 0);
      if (h1 && st.navigated) h1.focus({ preventScroll: true });
    }
    if (r.page === '') { startSlides(); maybePopup(); } else clearInterval(st.slideTimer);
    if (r.page === 'doctors') filterDoctors();
    if ($('#reviewsBox')) loadReviews();
    if ($('.tiktok-embed') && !st.preview) loadTikTok();
    var an = $('#announce'); if (an && h1) an.textContent = h1.textContent;
  }
  function maybePopup() {
    if (st.preview || st.popupShown || C.home.importantNoticePopup === false || sstore('popup') === '1') return;
    var n = vis(C.notices).filter(noticeLive).find(function (x) { return x.important; }); if (!n) return;
    st.popupShown = true;
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'popT');
    m.innerHTML = '<div class="box"><span class="tag red">' + esc(T('important')) + '</span><h2 id="popT" style="margin-top:8px">' + esc(L(n.title)) + '</h2><p style="white-space:pre-line">' + esc(L(n.body)) + '</p><div style="display:flex;gap:10px;flex-wrap:wrap">' + (n.link ? '<a class="btn" href="' + esc(n.link) + '" data-act="pop-close">' + esc(T('learnMore')) + '</a>' : '') + '<button class="btn ghost" data-act="pop-close">' + esc(T('close')) + '</button></div></div>';
    document.body.appendChild(m); $('button', m).focus();
  }

  // ----------------------------------------------------------------- events
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), w = st.wiz;
    switch (a) {
      case 'skip': e.preventDefault(); $('#main').focus(); break;
      case 'search': openSearch(); break;
      case 'search-close': closeSearch(); break;
      case 'menu': $('#drawer').classList.add('open'); el.setAttribute('aria-expanded', 'true'); $('#drawer .panel a').focus(); break;
      case 'menu-close': $('#drawer').classList.remove('open'); break;
      case 'lang': lang = lang === 'ne' ? 'en' : 'ne'; store('lang', lang); applyTheme(); renderAll(true); break;
      case 'font-up': st.fontStep = Math.min(8, st.fontStep + 2); store('font', st.fontStep); applyTheme(); break;
      case 'font-down': st.fontStep = Math.max(-4, st.fontStep - 2); store('font', st.fontStep); applyTheme(); break;
      case 'contrast': st.hc = !st.hc; store('hc', st.hc ? '1' : ''); applyTheme(); el.setAttribute('aria-pressed', st.hc); break;
      case 'slide-next': showSlide(st.slideIdx + 1); startSlides(); break;
      case 'slide-prev': showSlide(st.slideIdx - 1); startSlides(); break;
      case 'slide-go': showSlide(+el.getAttribute('data-i')); startSlides(); break;
      case 'slide-pause': st.slidePaused = !st.slidePaused; el.textContent = st.slidePaused ? '▶' : '❚❚'; el.setAttribute('aria-label', st.slidePaused ? 'Play slideshow' : 'Pause slideshow'); if (st.slidePaused) clearInterval(st.slideTimer); else startSlides(); break;
      case 'pop-close': sstore('popup', '1'); el.closest('.modal').remove(); break;
      case 'ntab': st.noticeTab = el.getAttribute('data-t'); $$('.tabs button').forEach(function (b) { b.setAttribute('aria-pressed', b === el); }); $('#noticeList').innerHTML = noticeList(); break;
      case 'jump': e.preventDefault(); var t = document.getElementById(el.getAttribute('data-target')); if (t) t.scrollIntoView({ behavior: 'smooth' }); break;
      case 'wdoc': w.doctorId = el.getAttribute('data-id'); w.date = ''; w.time = ''; w.step = 2; redrawWizard('.dates button'); $('#wizard').scrollIntoView({ block: 'start' }); break;
      case 'wdate': w.date = el.getAttribute('data-d'); w.time = ''; fetchTaken(w.doctorId, w.date, function (t) { w.taken = t; redrawWizard('.slots button:not([disabled]), [data-act=wnext]'); }); break;
      case 'wtime': w.time = el.getAttribute('data-t'); redrawWizard('[data-act=wnext]'); break;
      case 'wnext': w.step = 3; redrawWizard('input[name=name]'); break;
      case 'wback': w.step = Math.max(1, w.step - 1); redrawWizard(); break;
      case 'wreset': st.wiz = { step: 1, doctorId: '', dept: '', date: '', time: '', taken: {} }; redrawWizard(); break;
      case 'ics': downloadICS(w.done); break;
      case 'mdate': st.manage.date = el.getAttribute('data-d'); st.manage.time = ''; fetchTaken(st.manage.d.id, st.manage.date, function (t) { st.manage.taken = t; $('#reschedBox').innerHTML = reschedHTML(); }); break;
      case 'mtime': st.manage.time = el.getAttribute('data-t'); $('#reschedBox').innerHTML = reschedHTML(); break;
      case 'msave': api('api/bookings/reschedule', { code: st.manage.b.code, phone: st.manage.phone, date: st.manage.date, time: st.manage.time })
        .then(function (j) { $('#manageBox').innerHTML = manageHTML(j.booking); if ($('#reschedBox')) $('#reschedBox').innerHTML = reschedHTML(); $('#manageBox').insertAdjacentHTML('afterbegin', '<p class="ok">✓ ' + esc(T('thanks')) + '</p>'); })
        .catch(function (err) { $('#reschedBox .msg').innerHTML = '<span class="err">' + esc(err.message) + '</span>'; }); break;
      case 'mcancel': if (!confirm(T('confirmCancel'))) break; api('api/bookings/cancel', { code: st.manage.b.code, phone: st.manage.phone }).then(function (j) { $('#manageBox').innerHTML = manageHTML(j.booking); }); break;
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-act-change') === 'wdept') { st.wiz.dept = el.value; redrawWizard('select'); }
    var f = el.closest('[data-form=docfilter]');
    if (f) { st.docFilter[el.name] = el.value; filterDoctors(); }
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'searchInput') onSearch();
    if (el.closest('[data-form=docfilter]') && el.name === 'q') { st.docFilter.q = el.value; filterDoctors(); }
    if (el.id === 'cf') {
      var q = plain(el.value).trim();
      $$('.cond-list li').forEach(function (li) { li.hidden = q && li.getAttribute('data-text').indexOf(q) < 0; });
      $$('.cgroup').forEach(function (g) { g.hidden = !$$('li', g).some(function (li) { return !li.hidden; }); });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSearch(); var d = $('#drawer'); if (d) d.classList.remove('open'); var m = $('.modal'); if (m) { sstore('popup', '1'); m.remove(); } }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) { e.preventDefault(); openSearch(); }
    if ($('#searchPop.open') && /ArrowDown|ArrowUp|Enter/.test(e.key)) {
      var links = $$('#searchResults a'), i = links.findIndex(function (a) { return a.classList.contains('active'); });
      if (e.key === 'Enter' && links[i]) { e.preventDefault(); links[i].click(); return; }
      if (e.key !== 'Enter') { e.preventDefault(); if (links[i]) links[i].classList.remove('active'); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; if (links[i]) { links[i].classList.add('active'); links[i].scrollIntoView({ block: 'nearest' }); } }
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form'); if (!kind) return;
    e.preventDefault();
    var data = {}; new FormData(f).forEach(function (v, k) { if (k === 'notify') (data.notify = data.notify || []).push(v); else data[k] = v; });
    var msg = $('.msg', f), btn = $('button[type=submit]', f);
    function fail(m) { if (msg) msg.innerHTML = '<span class="err">' + esc(m) + '</span>'; if (btn) btn.disabled = false; }
    if (kind === 'home-search') { if (data.q && data.q.trim()) location.hash = '#/search?q=' + encodeURIComponent(data.q.trim()); return; }
    if (kind === 'cond-filter' || kind === 'docfilter') return;
    if (btn) btn.disabled = true;
    if (kind === 'booking') {
      if (!data.name || data.name.trim().length < 2) return fail(T('patientName') + ' — ' + T('required'));
      if (!/^(\+?977[- ]?)?(9[678]\d{8}|0?\d{2}[- ]?\d{6,7})$/.test(String(data.phone || '').replace(/\s/g, ''))) return fail(T('phone') + ' — 98XXXXXXXX');
      if (!data.consent) return fail(T('consent'));
      var w = st.wiz;
      api('api/bookings', Object.assign(data, { doctorId: w.doctorId, date: w.date, time: w.time, consent: true, lang: lang }))
        .then(function (j) { w.done = Object.assign({}, j.booking, { rawPhone: data.phone }); redrawWizard('#doneHead'); })
        .catch(function (err) {
          fail(err.message);
          if (/booked|time/i.test(err.message)) { w.step = 2; w.time = ''; fetchTaken(w.doctorId, w.date, function (t) { w.taken = t; redrawWizard(); $('#wizard').insertAdjacentHTML('afterbegin', '<p class="alert warn">' + esc(err.message) + '</p>'); }); }
        });
    } else if (kind === 'feedback' || kind === 'question') {
      if (kind === 'feedback' && (!data.message || data.message.trim().length < 5)) return fail(T('message') + ' — ' + T('required'));
      if (kind === 'question' && (!data.question || data.question.trim().length < 5)) return fail(T('yourQuestion') + ' — ' + T('required'));
      api(kind === 'feedback' ? 'api/feedback' : 'api/questions', data).then(function () { f.reset(); msg.innerHTML = '<span class="ok">✓ ' + esc(T('thanks')) + '</span>'; btn.disabled = false; }).catch(function (err) { fail(err.message); });
    } else if (kind === 'lookup') {
      api('api/bookings/lookup', data).then(function (j) { btn.disabled = false; msg.innerHTML = ''; $('#manageBox').innerHTML = manageHTML(j.booking); if (st.manage) { st.manage.phone = data.phone; $('#reschedBox').innerHTML = reschedHTML(); } }).catch(function (err) { fail(err.message); });
    }
  });
  document.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);
  window.addEventListener('hashchange', function () {
    st.navigated = true; closeSearch(); var d = $('#drawer'); if (d) d.classList.remove('open');
    if (st.preview) { try { parent.postMessage({ type: 'niko-route', route: location.hash }, '*'); } catch (e) {} }
    if (!C) return;
    if (!$('#main')) { renderAll(); return; }
    renderPage();
  });

  // ------------------------------------------------------------------ start
  lang = store('lang') || ((navigator.language || '').indexOf('ne') === 0 ? 'ne' : 'en');
  st.fontStep = +store('font') || 0; st.hc = store('hc') === '1';
  load().then(function () { if (!C) return; applyTheme(); renderAll(); watchVersion(); });
}());
