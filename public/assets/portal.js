/* NIKO Hospital — accounts, dashboards, video consultation, lab, check-ups and service forms.
   Adds pages to the main site (site.js) through window.NIKO_SITE. */
(function () {
  'use strict';
  var N = window.NIKO_SITE;
  if (!N) return;
  var $ = N.$, $$ = N.$$, esc = N.esc, icon = N.icon, L = N.L, T = N.T;
  var P = { me: null, loaded: false, auth: { mode: 'login' }, cache: {}, consult: null, lab: { sel: {} }, room: null };
  function C() { return N.C; }
  function t(en, ne) { return N.lang === 'ne' && ne ? ne : en; }
  function fmt(d) { return d ? N.fmtDate(String(d).slice(0, 10)) : ''; }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleString(N.lang === 'ne' ? 'ne-NP' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function money(n) { return n || n === 0 ? 'Rs ' + Number(n).toLocaleString('en-IN') : t('Price at the lab', 'ल्याबमा सोध्नुहोस्'); }
  function head(title, sub, crumb) { return N.head(title, sub, crumb ? esc(crumb) : esc(title)); }
  function section(inner, max) { return '<section class="section"><div class="container"' + (max ? ' style="max-width:' + max + 'px"' : '') + '>' + inner + '</div></section>'; }
  function toast(msg) { var x = document.createElement('div'); x.className = 'toast'; x.setAttribute('role', 'status'); x.textContent = msg; document.body.appendChild(x); setTimeout(function () { x.remove(); }, 3200); }
  function status(s) { return '<span class="status ' + esc(s) + '">' + esc(String(s || '').replace(/_/g, ' ')) + '</span>'; }
  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function fileLink(f, label) { return f && f.file ? '<a href="api/p/file/' + encodeURIComponent(f.file) + '" target="_blank" rel="noopener">' + icon('file', ' width="15" height="15" style="display:inline;vertical-align:-2px"') + ' ' + esc(label || f.name || t('View file', 'फाइल हेर्नुहोस्')) + '</a>' : ''; }
  function msgBox(el, m, ok) { var b = $('.msg', el) || el; b.innerHTML = '<span class="' + (ok ? 'ok' : 'err') + '">' + esc(m) + '</span>'; }

  // ------------------------------------------------------------------ API
  function api(method, path, body, isForm) {
    var h = { 'X-Requested-With': 'niko-app' };
    if (body && !isForm) h['Content-Type'] = 'application/json';
    return fetch(path, { method: method, headers: h, credentials: 'same-origin', body: isForm ? body : body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && j.login) { P.me = null; window.NIKO_ACCT = null; var e1 = new Error(t('Please sign in first.', 'कृपया पहिले साइन इन गर्नुहोस् ।')); e1.login = true; throw e1; }
          if (!r.ok) { var e = new Error(j.error || ('Error ' + r.status)); e.status = r.status; e.data = j; throw e; }
          return j;
        });
      });
  }
  function fetchMe() {
    return fetch('api/acct/me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var before = JSON.stringify([P.me && P.me.id, P.me && P.me.unread, P.me && P.me.status, P.me && P.me.type]);
      P.me = j.account; window.NIKO_ACCT = P.me; P.loaded = true;
      if (JSON.stringify([P.me && P.me.id, P.me && P.me.unread, P.me && P.me.status, P.me && P.me.type]) !== before) refreshChrome();
      return P.me;
    }).catch(function () { P.loaded = true; return P.me; });
  }
  // Update the header, side tab and phone bar after sign-in or a new message, without redrawing the page.
  function refreshChrome() {
    if (!C() || !document.getElementById('main') || !N.shell) return;
    var tmp = document.createElement('div'); tmp.innerHTML = N.shell();
    ['#acctSlot', '.sidetab', '.mbar', '#drawer .panel'].forEach(function (s) { var a = $(s), b = $(s, tmp); if (a && b) a.innerHTML = b.innerHTML; });
    var m1 = $('.hdr [data-act=menu]'), m2 = $('.hdr [data-act=menu]', tmp); if (m1 && m2) m1.innerHTML = m2.innerHTML;
  }
  setInterval(function () { if (P.me && document.visibilityState === 'visible') fetchMe(); }, 60000);

  function needLogin(next) {
    return '<div class="card" style="text-align:center;padding:30px"><span class="eyebrow">' + esc(t('Account needed', 'खाता आवश्यक')) + '</span><h2>' + esc(t('Please sign in to continue', 'कृपया साइन इन गर्नुहोस्')) + '</h2>' +
      '<p class="muted">' + esc(t('It is free. Use your email — we send a code to check it.', 'नि:शुल्क छ । इमेलमा कोड पठाइन्छ ।')) + '</p><p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#/login?next=' + encodeURIComponent(next || location.hash) + '">' + esc(T('signIn')) + '</a><a class="btn ghost" href="#/login?signup=1&next=' + encodeURIComponent(next || location.hash) + '">' + esc(T('signUp')) + '</a></p></div>';
  }
  function needPatient(next) {
    if (!P.loaded) return '<p class="muted">' + esc(T('loading')) + '</p>';
    if (!P.me) return needLogin(next);
    if (P.me.needsProfile) return '<div class="alert info">' + esc(t('Please finish your profile first.', 'कृपया पहिले प्रोफाइल पूरा गर्नुहोस् ।')) + ' <a href="#/account?next=' + encodeURIComponent(next || location.hash) + '">' + esc(t('Finish profile', 'प्रोफाइल पूरा गर्नुहोस्')) + ' →</a></div>';
    if (P.me.type !== 'patient') return '<div class="alert warn">' + esc(t('This is a staff account. To book for yourself or family, sign out and use a patient account.', 'यो कर्मचारी खाता हो । बिरामी खाताबाट बुक गर्नुहोस् ।')) + '</div>';
    return '';
  }

  // --------------------------------------------------------------- sign in
  N.PAGES.login = function (_, q) {
    var a = P.auth;
    if (q.signup && a.mode === 'login' && !a.touched) a.mode = 'email';
    a.next = q.next || a.next || '';
    if (P.me && !P.me.needsProfile) { setTimeout(function () { location.hash = a.next || '#/dashboard'; }, 0); return ''; }
    return head(a.mode === 'login' ? T('signIn') : t('Create an account or reset password', 'खाता खोल्नुहोस् वा पासवर्ड बदल्नुहोस्'), t('For patients and NIKO Hospital staff', 'बिरामी तथा निको अस्पतालका कर्मचारीका लागि')) +
      section('<div class="card" id="authBox">' + authHTML() + '</div><p class="muted small" style="text-align:center;margin-top:14px">' + esc(t('Staff: sign up with your own email, choose “Staff” on the next page, and the Director will approve your account.', 'कर्मचारी: आफ्नै इमेलले खाता खोली “Staff” छान्नुहोस् ।')) + '</p>', 480);
  };
  function authHTML() {
    var a = P.auth;
    if (a.mode === 'login') return '<form class="form-grid" data-pform="login"><h2 style="margin:0">' + esc(T('signIn')) + '</h2>' +
      '<label class="f">' + esc(t('Email', 'इमेल')) + '<input name="email" type="email" autocomplete="email" required value="' + esc(a.email || '') + '"></label>' +
      '<label class="f">' + esc(t('Password', 'पासवर्ड')) + '<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn" type="submit">' + esc(T('signIn')) + '</button><div class="msg" role="status"></div>' +
      '<p style="margin:0;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><button type="button" class="btn ghost sm" data-pact="auth-mode" data-m="email">' + esc(t('New here? Create account', 'नयाँ? खाता खोल्नुहोस्')) + '</button><button type="button" class="btn ghost sm" data-pact="auth-mode" data-m="email">' + esc(t('Forgot password?', 'पासवर्ड बिर्सनुभयो?')) + '</button></p></form>';
    if (a.mode === 'email') return '<form class="form-grid" data-pform="code"><h2 style="margin:0">' + esc(t('Step 1: your email', 'चरण १: इमेल')) + '</h2><p class="muted" style="margin:0">' + esc(t('We will send a 6-digit code to your email.', 'तपाईंको इमेलमा ६ अंकको कोड पठाइनेछ ।')) + '</p>' +
      '<label class="f">' + esc(t('Email', 'इमेल')) + '<input name="email" type="email" autocomplete="email" required value="' + esc(a.email || '') + '"></label>' +
      '<button class="btn" type="submit">' + esc(t('Send code', 'कोड पठाउनुहोस्')) + '</button><div class="msg" role="status"></div><button type="button" class="btn ghost sm" data-pact="auth-mode" data-m="login">← ' + esc(T('signIn')) + '</button></form>';
    if (a.mode === 'code') return '<form class="form-grid" data-pform="verify"><h2 style="margin:0">' + esc(t('Step 2: enter the code', 'चरण २: कोड लेख्नुहोस्')) + '</h2><p class="muted" style="margin:0">' + esc(t('We sent a code to', 'कोड पठाइएको इमेल:')) + ' <b>' + esc(a.email) + '</b>. ' + esc(t('Check your spam folder too.', 'स्प्याम फोल्डर पनि हेर्नुहोस् ।')) + '</p>' +
      (a.devCode ? '<p class="alert warn">Test mode (email not set up): code ' + esc(a.devCode) + '</p>' : '') +
      '<label class="f">' + esc(t('6-digit code', '६ अंकको कोड')) + '<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required style="font-size:1.4rem;letter-spacing:6px;text-align:center"></label>' +
      '<button class="btn" type="submit">' + esc(t('Check code', 'कोड जाँच्नुहोस्')) + '</button><div class="msg" role="status"></div><button type="button" class="btn ghost sm" data-pact="auth-mode" data-m="email">' + esc(t('Send a new code', 'नयाँ कोड')) + '</button></form>';
    return '<form class="form-grid" data-pform="setpw"><h2 style="margin:0">' + esc(t('Step 3: choose a password', 'चरण ३: पासवर्ड राख्नुहोस्')) + '</h2>' +
      '<label class="f">' + esc(t('New password (at least 8 characters)', 'नयाँ पासवर्ड (कम्तीमा ८ अक्षर)')) + '<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="f">' + esc(t('Type it again', 'फेरि लेख्नुहोस्')) + '<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button class="btn" type="submit">' + esc(t('Save and continue', 'सेभ गरी अगाडि बढ्नुहोस्')) + '</button><div class="msg" role="status"></div></form>';
  }
  function afterSignIn(acct) {
    P.me = acct; window.NIKO_ACCT = acct; P.auth = { mode: 'login' };
    fetchMe().then(function () {
      var next = P.authNext || '';
      if (next.charAt(0) === '/' && P.me && !P.me.needsProfile) { location.href = next; return; }
      location.hash = P.me && P.me.needsProfile ? '#/account' + (next ? '?next=' + encodeURIComponent(next) : '') : (next || '#/dashboard');
      N.renderAll();
    });
  }

  // ------------------------------------------------------- profile (who are you)
  N.PAGES.account = function (_, q) {
    if (!P.loaded) return head(T('myAccount')) + section('<p>' + esc(T('loading')) + '</p>');
    if (!P.me) return head(T('myAccount')) + section(needLogin('#/account'), 560);
    var a = P.me, p = a.profile || {}, first = a.needsProfile;
    P.acctNext = q.next || '';
    var docs = N.doctors().slice().sort(function (x, y) { return L(x.name).localeCompare(L(y.name)); });
    return head(first ? t('Tell us about you', 'तपाईंको विवरण') : t('My profile', 'मेरो प्रोफाइल'), a.email) + section('<form class="card form-grid" data-pform="profile">' +
      (first ? '<p class="alert info" style="margin:0">' + esc(t('One last step. Are you a patient or a member of NIKO Hospital staff?', 'अन्तिम चरण: तपाईं बिरामी हो वा कर्मचारी?')) + '</p>' : '<p style="margin:0">' + esc(t('Account type', 'खाताको प्रकार')) + ': <b>' + esc(a.type === 'staff' ? t('Staff', 'कर्मचारी') + ' – ' + roleName(a.staffRole) : t('Patient', 'बिरामी')) + '</b> ' + status(a.status) + '</p>') +
      '<label class="f">' + esc(t('I am a', 'म')) + '<select name="type" data-pchange="ptype">' + opt('', '— ' + t('choose', 'छान्नुहोस्') + ' —', a.type) + opt('patient', t('Patient (or family member)', 'बिरामी (वा परिवार)'), a.type) + opt('staff', t('NIKO Hospital staff', 'निको अस्पतालका कर्मचारी'), a.type) + '</select></label>' +
      '<label class="f" id="fRole"' + (a.type === 'staff' ? '' : ' hidden') + '>' + esc(t('Staff type', 'कर्मचारीको प्रकार')) + '<select name="staffRole" data-pchange="prole">' + opt('', '— ' + t('choose', 'छान्नुहोस्') + ' —', a.staffRole) +
        [['lab', 'Lab staff'], ['pharmacy', 'Pharmacy staff'], ['management', 'Management staff'], ['nursing', 'Nursing staff'], ['doctor', 'Doctor']].map(function (r) { return opt(r[0], r[1], a.staffRole); }).join('') + '</select></label>' +
      '<label class="f" id="fDoc"' + (a.type === 'staff' && a.staffRole === 'doctor' ? '' : ' hidden') + '>' + esc(t('Choose your name from our doctor list', 'डाक्टर सूचीबाट आफ्नो नाम छान्नुहोस्')) + '<select name="doctorId">' + opt('', '— ' + t('choose', 'छान्नुहोस्') + ' —', a.doctorId) + docs.map(function (d) { return opt(d.id, L(d.name) + ' — ' + L(d.title), a.doctorId); }).join('') + '</select><span class="hint">' + esc(t('Not on the list? Ask the hospital admin to add you first.', 'सूचीमा छैन? पहिले एडमिनलाई थप्न भन्नुहोस् ।')) + '</span></label>' +
      '<div class="two"><label class="f">' + esc(t('Full name', 'पूरा नाम')) + '<input name="name" autocomplete="name" required value="' + esc(p.name || '') + '"></label>' +
      '<label class="f">' + esc(t('Mobile number', 'मोबाइल नम्बर')) + '<input name="phone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(p.phone || '') + '"></label></div>' +
      '<div class="two"><label class="f">' + esc(t('Age (years)', 'उमेर (वर्ष)')) + '<input name="age" inputmode="numeric" maxlength="3" value="' + esc(p.age || '') + '"><span class="hint">' + esc(t('Lab reports are matched to you by name and age.', 'ल्याब रिपोर्ट नाम र उमेरबाट मिलाइन्छ ।')) + '</span></label>' +
      '<label class="f">' + esc(t('Gender', 'लिङ्ग')) + '<select name="gender">' + opt('', '—', p.gender) + opt('Male', t('Male', 'पुरुष'), p.gender) + opt('Female', t('Female', 'महिला'), p.gender) + opt('Other', t('Other', 'अन्य'), p.gender) + '</select></label></div>' +
      '<label class="f">' + esc(t('Address', 'ठेगाना')) + '<input name="address" autocomplete="street-address" value="' + esc(p.address || '') + '"></label>' +
      (!first && a.type ? '<p class="small muted" style="margin:0">' + esc(t('Changing staff type or doctor sends your account to the Director for approval again.', 'कर्मचारीको प्रकार बदले फेरि स्वीकृति चाहिन्छ ।')) + '</p>' : '') +
      '<button class="btn" type="submit">' + esc(t('Save', 'सेभ गर्नुहोस्')) + '</button><div class="msg" role="status"></div></form>', 640);
  };
  function roleName(r) { return ({ doctor: 'Doctor', nursing: 'Nursing staff', lab: 'Lab staff', pharmacy: 'Pharmacy staff', management: 'Management staff' })[r] || r || ''; }

  // ---------------------------------------------------------------- dashboard
  function tabsFor(a) {
    var tabs = [['', 'grid', t('Overview', 'सारांश')], ['notes', 'bell', t('Messages & notices', 'सन्देश तथा सूचना')]];
    var staff = a.type === 'staff' && a.status === 'active', role = a.staffRole, all = a.seesAll;
    if (a.type === 'patient') tabs.push(['consults', 'video', t('Video consultations', 'भिडियो परामर्श')], ['reports', 'file', t('Lab reports', 'ल्याब रिपोर्ट')], ['lab', 'flask', t('Lab bookings', 'ल्याब बुकिङ')], ['requests', 'chat', t('My requests', 'मेरा अनुरोध')]);
    if ((staff && role === 'doctor') || all) tabs.push(['consults', 'video', t('Video consultations', 'भिडियो परामर्श')]);
    if ((staff && role === 'doctor' && a.doctorId) || all || (a.opdAccess || []).length) tabs.push(['opd', 'stethoscope', 'OPD']);
    if (staff && role === 'doctor' && a.doctorId) tabs.push(['profile', 'user', t('My public profile', 'मेरो प्रोफाइल')]);
    if ((staff && role === 'lab') || all) tabs.push(['lab', 'flask', t('Lab', 'ल्याब')]);
    if (a.canVerify) tabs.push(['payments', 'check', t('Payments to check', 'भुक्तानी जाँच')]);
    if ((staff && ['doctor', 'pharmacy', 'management'].indexOf(role) >= 0) || all) tabs.push(['requests', 'chat', t('Requests', 'अनुरोध')]);
    if (all) tabs.push(['send', 'send', t('Send message / notice', 'सन्देश पठाउनुहोस्')]);
    if (a.roles.indexOf('director') >= 0) tabs.push(['approvals', 'shield', t('Approvals', 'स्वीकृति')], ['people', 'users', t('People & access', 'व्यक्ति तथा पहुँच')]);
    tabs.push(['account', 'user', t('Account', 'खाता')]);
    var seen = {}; return tabs.filter(function (x) { if (seen[x[0]]) return false; seen[x[0]] = 1; return true; });
  }
  N.PAGES.dashboard = function (tab) {
    if (!P.loaded) return head(T('dashboard')) + section('<p>' + esc(T('loading')) + '</p>');
    if (!P.me) return head(T('dashboard')) + section(needLogin('#/dashboard' + (tab ? '/' + tab : '')), 560);
    if (P.me.needsProfile) { setTimeout(function () { location.hash = '#/account'; }, 0); return ''; }
    var a = P.me, tabs = tabsFor(a);
    if (tab && !tabs.some(function (x) { return x[0] === tab; })) tab = '';
    P.tab = tab || '';
    var role = a.type === 'staff' ? roleName(a.staffRole) : t('Patient', 'बिरामी');
    var extra = a.roles.map(function (r) { return { director: 'Director', owner: 'Owner', verifier: 'Payment checker' }[r]; }).filter(Boolean).join(', ');
    return head(t('Hello', 'नमस्ते') + ', ' + ((a.profile && a.profile.name) || a.email).split(' ')[0], role + (extra ? ' · ' + extra : '')) +
      '<section class="section"><div class="container dash"><nav class="dside" aria-label="' + esc(T('dashboard')) + '"><div class="who"><b>' + esc((a.profile && a.profile.name) || a.email) + '</b><small>' + esc(a.email) + '</small></div>' +
      tabs.map(function (x) { return '<a href="#/dashboard' + (x[0] ? '/' + x[0] : '') + '"' + (x[0] === P.tab ? ' aria-current="page"' : '') + '>' + icon(x[1]) + esc(x[2]) + (x[0] === 'notes' && a.unread ? '<span class="badge">' + a.unread + '</span>' : '') + '</a>'; }).join('') +
      '</nav><div class="dmain" id="dmain">' + (a.type === 'staff' && a.status !== 'active' && !a.seesAll ? '<div class="alert warn" style="margin-bottom:14px">' + esc(a.status === 'rejected' ? t('Your staff account was not approved. Please contact the hospital management.', 'तपाईंको कर्मचारी खाता स्वीकृत भएन ।') : t('Your staff account is waiting for the Director’s approval. You will get an email when it is approved.', 'तपाईंको कर्मचारी खाता सञ्चालकको स्वीकृतिको पर्खाइमा छ ।')) + '</div>' : '') +
      '<p class="muted">' + esc(T('loading')) + '</p></div></div></section>';
  };
  N.afterRender.push(function (r) {
    if (r.page === 'dashboard' && P.me && !P.me.needsProfile) loadTab(P.tab);
    if (r.page === 'consult') consultInit();
    if (r.page === 'room') roomInit(r.id);
    if (r.page !== 'room' && P.room) roomLeave();
    if (r.page === 'account') { var f = $('[data-pform=profile]'); if (f && !P.me.type) { var s = $('[name=type]', f); if (s) s.focus(); } }
  });
  function D(html) { var el = $('#dmain'); if (!el) return; var warn = $('.alert.warn', el); el.innerHTML = (warn ? warn.outerHTML : '') + html; }
  function loadTab(tab) {
    var fn = TABS[tab || 'overview'];
    if (fn) fn(); else D('<p class="empty">—</p>');
  }
  function reload() { loadTab(P.tab); }
  var TABS = {};

  TABS.overview = function () {
    Promise.all([api('GET', 'api/p/overview'), api('GET', 'api/p/notes')]).then(function (r) {
      var o = r[0], a = P.me, k = [];
      k.push(['notes', o.unread, t('New messages', 'नयाँ सन्देश'), o.unread]);
      if (o.paymentsToCheck !== undefined) k.push(['payments', o.paymentsToCheck, t('Payments to check', 'भुक्तानी जाँच'), o.paymentsToCheck]);
      if (o.approvals !== undefined) k.push(['approvals', o.approvals, t('Approvals waiting', 'स्वीकृति बाँकी'), o.approvals]);
      if (o.consultsToday !== undefined) k.push(['consults', o.consultsToday, t('Video consultations today', 'आजका भिडियो परामर्श')]);
      if (o.labOpen !== undefined) k.push(['lab', o.labOpen, t('Open lab orders', 'खुला ल्याब अर्डर'), 0], ['lab', o.labUnmatched, t('Reports to match', 'मिलाउन बाँकी रिपोर्ट'), o.labUnmatched]);
      if (o.requestsOpen) k.push(['requests', o.requestsOpen, t('Open requests', 'खुला अनुरोध'), o.requestsOpen]);
      var quick = a.type === 'patient' ? '<div class="grid" style="margin-bottom:18px">' + [['#/consult', 'video', T('videoConsult')], ['#/lab', 'flask', T('labTests')], ['#/book', 'cal', T('book')], ['#/packages', 'box', T('packages')]].map(function (x) { return '<a class="card svc" style="min-height:0" href="' + x[0] + '"><span class="ic">' + icon(x[1]) + '</span><h3>' + esc(x[2]) + '</h3></a>'; }).join('') + '</div>' : '';
      var mail = o.mail ? '<p class="small muted">' + esc(t('Emails sent today', 'आज पठाइएका इमेल')) + ': ' + o.mail.sentToday + ' / ' + o.mail.limit + (o.mail.via === 'none' ? ' · <b style="color:#9b1c1c">' + esc(t('Email sending is not set up yet (BREVO_API_KEY).', 'इमेल सेटअप गरिएको छैन ।')) + '</b>' : '') + (o.mail.waiting ? ' · ' + o.mail.waiting + ' ' + esc(t('people have notices waiting for tomorrow’s summary email', 'जनाको सूचना भोलिको इमेलमा जानेछ')) : '') + '</p>' : '';
      D('<div class="kpis">' + k.map(function (x) { return '<a class="kpi' + (x[3] ? ' hot' : '') + '" href="#/dashboard/' + x[0] + '"><b>' + (x[1] || 0) + '</b><span>' + esc(x[2]) + '</span></a>'; }).join('') + '</div>' + quick + mail +
        '<h2 style="font-size:1.2rem">' + esc(t('Latest messages & notices', 'पछिल्ला सन्देश')) + '</h2>' + notesList(r[1].notes.slice(0, 5)));
    }).catch(fail);
  };
  function fail(e) { D('<div class="alert">' + esc(e.message) + '</div>'); }

  // messages & notices
  function notesList(list) {
    if (!list.length) return '<p class="empty">' + esc(t('Nothing yet.', 'अहिलेसम्म केही छैन ।')) + '</p>';
    return '<div class="list">' + list.map(function (n) {
      return '<div class="item' + (n.read ? '' : ' unread') + '"><div class="top"><h3>' + esc(n.title) + '</h3><span class="small muted">' + esc(when(n.at)) + '</span></div>' +
        '<div class="small" style="margin-top:4px">' + (n.kind === 'message' ? '<span class="tag orange">' + esc(t('Private message', 'निजी सन्देश')) + '</span> ' : n.kind === 'notice' ? '<span class="tag">' + esc(t('Notice', 'सूचना')) + '</span> ' : '') + (n.from ? esc(t('From', 'बाट')) + ' ' + esc(n.from.name) : '') + '</div>' +
        '<pre>' + esc(n.body) + '</pre>' + (n.link ? '<div class="acts"><a class="btn xs ghost" href="' + esc(n.link) + '">' + esc(t('Open', 'खोल्नुहोस्')) + ' →</a></div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  TABS.notes = function () {
    api('GET', 'api/p/notes').then(function (j) {
      D('<div class="top" style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px"><h2 style="margin:0;font-size:1.3rem">' + esc(t('Messages & notices', 'सन्देश तथा सूचना')) + '</h2>' + (P.me.unread ? '<button class="btn xs ghost" data-pact="read-all">' + esc(t('Mark all read', 'सबै पढियो')) + '</button>' : '') + '</div>' + notesList(j.notes) +
        (j.sent && j.sent.length ? '<h2 style="font-size:1.2rem;margin-top:26px">' + esc(t('Sent by you', 'तपाईंले पठाएका')) + '</h2><div class="list">' + j.sent.map(function (n) { return '<div class="item"><div class="top"><h3>' + esc(n.title) + '</h3><span class="small muted">' + esc(when(n.at)) + '</span></div><div class="small muted">' + esc(n.kind) + ' · ' + n.count + ' ' + esc(t('people', 'जना')) + ' · ' + n.readCount + ' ' + esc(t('read', 'पढे')) + '</div><pre>' + esc(n.body) + '</pre><div class="acts"><button class="btn xs ghost" data-pact="note-del" data-id="' + esc(n.id) + '">' + esc(t('Delete', 'मेटाउनुहोस्')) + '</button></div></div>'; }).join('') + '</div>' : ''));
      if (P.me.unread) api('POST', 'api/p/notes/read', {}).then(function () { P.me.unread = 0; refreshChrome(); var b = $('.dside a[href="#/dashboard/notes"] .badge'); if (b) b.remove(); });
    }).catch(fail);
  };

  // video consultations list
  TABS.consults = function () {
    api('GET', 'api/p/consults').then(function (list) {
      var a = P.me, doc = a.type === 'staff' || a.seesAll, td = N.today();
      list.sort(function (x, y) { return (y.date + y.time).localeCompare(x.date + x.time); });
      var up = list.filter(function (c) { return c.date >= td && ['confirmed', 'payment_review'].indexOf(c.status) >= 0; }).reverse(), past = list.filter(function (c) { return up.indexOf(c) < 0; });
      function row(c) {
        var canRun = doc && c.status === 'confirmed';
        return '<div class="item"><div class="top"><h3>' + esc(doc ? c.patientName + (c.patientAge ? ' (' + c.patientAge + (c.patientGender ? ' ' + c.patientGender.charAt(0) : '') + ')' : '') : c.doctorName) + '</h3>' + status(c.status) + '</div>' +
          '<dl class="kv"><dt>' + esc(t('When', 'कहिले')) + '</dt><dd>' + esc(fmt(c.date)) + ' · ' + esc(c.time) + '</dd>' + (doc ? '<dt>' + esc(t('Doctor', 'डाक्टर')) + '</dt><dd>' + esc(c.doctorName) + '</dd><dt>' + esc(t('Phone', 'फोन')) + '</dt><dd><a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a></dd>' : '') +
          '<dt>' + esc(t('Code', 'कोड')) + '</dt><dd>' + esc(c.code) + ' · Rs ' + esc(c.fee) + '</dd>' + (c.reason ? '<dt>' + esc(t('Reason', 'कारण')) + '</dt><dd>' + esc(c.reason) + '</dd>' : '') + (c.patientJoinedAt && doc ? '<dt>' + esc(t('Patient joined', 'बिरामी जोडिए')) + '</dt><dd>' + esc(when(c.patientJoinedAt)) + '</dd>' : '') + '</dl>' +
          '<div class="acts">' + (c.joinUrl ? '<a class="btn sm" href="' + esc(c.joinUrl) + '">' + icon('video') + esc(doc ? t('Start the call', 'कल सुरु गर्नुहोस्') : t('Join the call', 'कलमा जोडिनुहोस्')) + '</a>' : '') +
          (canRun ? '<button class="btn sm ghost" data-pact="c-remind" data-id="' + esc(c.id) + '">' + icon('mail') + esc(t('Email join link to patient', 'बिरामीलाई लिङ्क इमेल')) + '</button><button class="btn sm ghost" data-pact="c-status" data-s="completed" data-id="' + esc(c.id) + '">' + esc(t('Mark completed', 'सम्पन्न')) + '</button>' : '') +
          (c.status === 'payment_review' && !doc ? '<span class="small muted">' + esc(t('We are checking your payment. You will get an email when it is confirmed.', 'भुक्तानी जाँच हुँदैछ । पुष्टि भएपछि इमेल आउनेछ ।')) + '</span>' : '') +
          (c.receipt && (a.seesAll || a.canVerify || !doc) ? fileLink(c.receipt, t('Receipt', 'रसिद')) : '') + '</div></div>';
      }
      D('<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><h2 style="margin:0;font-size:1.3rem">' + esc(t('Upcoming', 'आगामी')) + '</h2>' + (a.type === 'patient' ? '<a class="btn sm" href="#/consult">' + icon('video') + esc(t('Book a video consultation', 'भिडियो परामर्श बुक')) + '</a>' : '') + '</div>' +
        (up.length ? '<div class="list">' + up.map(row).join('') + '</div>' : '<p class="empty">' + esc(t('No upcoming video consultations.', 'आगामी भिडियो परामर्श छैन ।')) + '</p>') +
        (past.length ? '<h2 style="font-size:1.2rem;margin-top:24px">' + esc(t('Earlier', 'पहिलेका')) + '</h2><div class="list">' + past.slice(0, 60).map(row).join('') + '</div>' : ''));
    }).catch(fail);
  };

  // lab reports (patient)
  TABS.reports = function () {
    api('GET', 'api/p/reports').then(function (list) {
      D('<h2 style="font-size:1.3rem">' + esc(t('Lab reports', 'ल्याब रिपोर्ट')) + '</h2>' + (list.length ? '<div class="list">' + list.map(function (r) {
        return '<div class="item"><div class="top"><h3>' + esc(r.title) + '</h3><span class="small muted">' + esc(fmt(r.date)) + '</span></div><div class="small muted">' + esc(r.name || '') + (r.age ? ', ' + esc(r.age) : '') + '</div><div class="acts"><a class="btn sm" href="api/p/reports/' + esc(r.id) + '/pdf" target="_blank" rel="noopener">' + icon('file') + esc(t('Download PDF', 'PDF डाउनलोड')) + '</a></div></div>';
      }).join('') + '</div>' : '<p class="empty">' + esc(t('No reports yet. When the lab finishes your tests, the report appears here and you get an email.', 'अहिलेसम्म रिपोर्ट छैन ।')) + '</p>'));
    }).catch(fail);
  };

  // lab: patient bookings, or lab staff work list
  TABS.lab = function () {
    var a = P.me, isLab = a.seesAll || (a.type === 'staff' && a.staffRole === 'lab' && a.status === 'active');
    if (!isLab) {
      return api('GET', 'api/p/lab/orders').then(function (j) {
        D('<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><h2 style="margin:0;font-size:1.3rem">' + esc(t('Lab bookings', 'ल्याब बुकिङ')) + '</h2><a class="btn sm" href="#/lab">' + icon('flask') + esc(t('Book lab tests', 'ल्याब जाँच बुक')) + '</a></div>' +
          (j.online.length ? '<div class="list">' + j.online.map(function (o) { return '<div class="item"><div class="top"><h3>' + esc(o.tests.map(function (x) { return x.name; }).join(', ')) + '</h3>' + status(o.status) + '</div><dl class="kv"><dt>' + esc(t('Collection', 'नमुना संकलन')) + '</dt><dd>' + esc(fmt(o.date)) + ' ' + esc(o.slot || '') + '</dd><dt>' + esc(t('Payment', 'भुक्तानी')) + '</dt><dd>' + esc(o.payMethod === 'online' ? 'Online' : t('Pay when collected', 'संकलनमा तिर्ने')) + ' ' + status(o.payStatus) + '</dd><dt>' + esc(t('Code', 'कोड')) + '</dt><dd>' + esc(o.code) + (o.total ? ' · ' + money(o.total) : '') + '</dd></dl>' + (o.status === 'done' ? '<div class="acts"><a class="btn sm" href="#/dashboard/reports">' + esc(t('See report', 'रिपोर्ट हेर्नुहोस्')) + '</a></div>' : '') + '</div>'; }).join('') + '</div>' : '<p class="empty">' + esc(t('No lab bookings yet.', 'ल्याब बुकिङ छैन ।')) + '</p>'));
      }).catch(fail);
    }
    Promise.all([api('GET', 'api/p/lab/orders'), api('GET', 'api/p/lab/inbox')]).then(function (r) {
      var j = r[0], inbox = r[1]; P.cache.lab = j;
      var open = j.online.filter(function (o) { return ['done', 'cancelled'].indexOf(o.status) < 0; }), done = j.online.filter(function (o) { return open.indexOf(o) < 0; }).slice(0, 30);
      var opdOpen = j.opd.filter(function (o) { return o.status === 'pending'; }), opdDone = j.opd.filter(function (o) { return o.status !== 'pending'; });
      D('<div class="tabs">' + [['#lab-opd', t('OPD orders', 'ओपीडी अर्डर'), opdOpen.length], ['#lab-home', t('Home collections', 'घरमै संकलन'), open.length], ['#lab-inbox', t('Unmatched reports', 'नमिलेका रिपोर्ट'), inbox.length], ['#lab-upload', t('Upload a report', 'रिपोर्ट अपलोड'), 0]].map(function (x) { return '<a href="' + location.hash.split('#').slice(0, 2).join('#') + x[0] + '" data-pact="jump" data-t="' + x[0].slice(1) + '">' + esc(x[1]) + (x[2] ? ' <span class="badge">' + x[2] + '</span>' : '') + '</a>'; }).join('') + '</div>' +
        '<h2 id="lab-opd" style="font-size:1.2rem">' + esc(t('Orders from doctors’ OPD cards', 'डाक्टरको ओपीडी कार्डबाट आएका अर्डर')) + '</h2>' +
        (opdOpen.length ? '<div class="list">' + opdOpen.map(opdRow).join('') + '</div>' : '<p class="empty">' + esc(t('No open OPD lab orders.', 'खुला अर्डर छैन ।')) + '</p>') +
        (opdDone.length ? '<details style="margin-top:10px"><summary class="small">' + esc(t('Sent in the last 7 days', 'पछिल्ला ७ दिनमा पठाइएका')) + ' (' + opdDone.length + ')</summary><div class="list" style="margin-top:10px">' + opdDone.map(opdRow).join('') + '</div></details>' : '') +
        '<h2 id="lab-home" style="font-size:1.2rem;margin-top:26px">' + esc(t('Home sample collections (booked online)', 'घरमै नमुना संकलन')) + '</h2>' +
        (open.length ? '<div class="list">' + open.map(onlineRow).join('') + '</div>' : '<p class="empty">' + esc(t('No open home collections.', 'खुला संकलन छैन ।')) + '</p>') +
        (done.length ? '<details style="margin-top:10px"><summary class="small">' + esc(t('Finished', 'सम्पन्न')) + ' (' + done.length + ')</summary><div class="list" style="margin-top:10px">' + done.map(onlineRow).join('') + '</div></details>' : '') +
        '<h2 id="lab-inbox" style="font-size:1.2rem;margin-top:26px">' + esc(t('Reports from the lab system that need a patient', 'बिरामी छान्न बाँकी रिपोर्ट')) + '</h2>' +
        (inbox.length ? '<div class="list">' + inbox.map(function (x) {
          return '<div class="item"><div class="top"><h3>' + esc(x.subject || t('Lab report', 'ल्याब रिपोर्ट')) + '</h3><span class="small muted">' + esc(when(x.at)) + '</span></div>' + (x.file ? '<div class="acts">' + fileLink(x.file) + '</div>' : '<pre>' + esc(N.truncate(x.text, 400)) + '</pre>') +
            (x.candidates.length ? '<p class="small" style="margin:8px 0 0">' + esc(t('Possible patients', 'सम्भावित बिरामी')) + ': ' + x.candidates.map(function (c) { return '<button class="btn xs ghost" data-pact="inbox-assign" data-id="' + esc(x.id) + '" data-pid="' + esc(c.id) + '">' + esc((c.profile.name || c.email) + (c.profile.age ? ', ' + c.profile.age : '')) + '</button>'; }).join(' ') + '</p>' : '') +
            '<div class="acts">' + patientPicker('ib-' + x.id) + '<button class="btn xs" data-pact="inbox-assign" data-id="' + esc(x.id) + '" data-pick="ib-' + esc(x.id) + '">' + esc(t('Give to this patient', 'यो बिरामीलाई दिनुहोस्')) + '</button><button class="btn xs ghost" data-pact="inbox-discard" data-id="' + esc(x.id) + '">' + esc(t('Not a patient report – remove', 'हटाउनुहोस्')) + '</button></div></div>';
        }).join('') + '</div>' : '<p class="empty">' + esc(t('All reports from the lab system were matched.', 'सबै रिपोर्ट मिलाइयो ।')) + '</p>') +
        '<h2 id="lab-upload" style="font-size:1.2rem;margin-top:26px">' + esc(t('Upload a report PDF to a patient', 'बिरामीलाई रिपोर्ट अपलोड')) + '</h2>' +
        '<form class="card form-grid" data-pform="report-upload">' + patientPicker('up') + '<label class="f">' + esc(t('Title', 'शीर्षक')) + '<input name="title" placeholder="e.g. CBC, LFT — 24 Nov"></label><label class="f">' + esc(t('Report (PDF or photo)', 'रिपोर्ट (PDF वा फोटो)')) + '<input type="file" name="file" accept="application/pdf,image/*" required></label><button class="btn" type="submit">' + icon('upload') + esc(t('Upload', 'अपलोड')) + '</button><div class="msg"></div></form>');
    }).catch(fail);
  }
  function patientPicker(id) {
    return '<span class="pp" data-pp="' + esc(id) + '" style="display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center"><input type="search" data-ppq="' + esc(id) + '" placeholder="' + esc(t('Search patient name / phone', 'बिरामी खोज्नुहोस्')) + '" style="min-height:36px;max-width:240px"><select data-pps="' + esc(id) + '" style="min-height:36px;max-width:260px"><option value="">—</option></select></span>';
  }
  function opdRow(o) {
    return '<div class="item"><div class="top"><h3>#' + esc(o.id) + ' ' + esc(o.name) + ' <span class="small muted">' + esc(o.age) + (o.sex ? ' ' + esc(o.sex) : '') + '</span></h3>' + status(o.status === 'pending' ? 'pending' : 'done') + '</div>' +
      '<div class="small muted">' + esc(o.doctorName) + ' · ' + esc(when(o.orderedAt)) + '</div><pre>' + esc(o.orderText) + '</pre><div class="acts"><button class="btn xs" data-pact="opd-open" data-doc="' + esc(o.doctorId) + '" data-pid="' + esc(o.id) + '">' + esc(o.status === 'pending' ? t('Enter results', 'नतिजा लेख्नुहोस्') : t('Open', 'खोल्नुहोस्')) + '</button></div><div class="opd-ed" id="opd-' + esc(o.doctorId) + '-' + esc(o.id) + '"></div></div>';
  }
  function onlineRow(o) {
    return '<div class="item" id="lo-' + esc(o.id) + '"><div class="top"><h3>' + esc(o.code) + ' · ' + esc(o.name) + ' <span class="small muted">' + esc(o.age) + (o.sex ? ' ' + esc(o.sex) : '') + '</span></h3>' + status(o.status) + '</div>' +
      '<dl class="kv"><dt>' + esc(t('Tests', 'जाँच')) + '</dt><dd>' + esc(o.tests.map(function (x) { return x.name; }).join(', ')) + '</dd><dt>' + esc(t('Collect', 'संकलन')) + '</dt><dd>' + esc(fmt(o.date)) + ' ' + esc(o.slot || '') + '</dd><dt>' + esc(t('Address', 'ठेगाना')) + '</dt><dd>' + esc(o.address) + '</dd><dt>' + esc(t('Phone', 'फोन')) + '</dt><dd><a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a></dd>' +
      '<dt>' + esc(t('Payment', 'भुक्तानी')) + '</dt><dd>' + esc(o.payMethod === 'online' ? 'Online' : t('Pay when collected', 'संकलनमा')) + ' ' + status(o.payStatus) + (o.total ? ' · ' + money(o.total) : '') + ' ' + (o.receipt ? fileLink(o.receipt, t('receipt', 'रसिद')) : '') + '</dd>' + (o.note ? '<dt>' + esc(t('Note', 'टिप्पणी')) + '</dt><dd>' + esc(o.note) + '</dd>' : '') + '</dl>' +
      '<div class="acts"><select data-pchange="lo-status" data-id="' + esc(o.id) + '" style="min-height:36px;max-width:200px">' + ['new', 'scheduled', 'collected', 'processing', 'done', 'cancelled'].map(function (s) { return opt(s, s, o.status); }).join('') + '</select>' +
      (o.payMethod === 'onsite' && o.payStatus !== 'paid' ? '<button class="btn xs ghost" data-pact="lo-paid" data-id="' + esc(o.id) + '">' + esc(t('Cash received', 'नगद प्राप्त')) + '</button>' : '') +
      '<button class="btn xs" data-pact="lo-results" data-id="' + esc(o.id) + '">' + esc(t('Results', 'नतिजा')) + '</button></div><div class="lo-ed"></div></div>';
  }
  function resultsTable(rows) {
    return '<div class="table-wrap" style="margin-top:10px"><table class="results-table"><thead><tr><th>' + esc(t('Test', 'जाँच')) + '</th><th>' + esc(t('Result', 'नतिजा')) + '</th><th>Unit</th><th>' + esc(t('Reference', 'सन्दर्भ')) + '</th><th>Flag</th></tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr data-row="' + i + '" data-panel="' + esc(r.panel || '') + '"><td><input data-k="param" value="' + esc(r.param) + '"></td><td><input data-k="val" value="' + esc(r.val || '') + '"></td><td><input data-k="unit" value="' + esc(r.unit || '') + '" style="max-width:90px"></td><td><input data-k="ref" value="' + esc(r.ref || '') + '"></td><td><select data-k="flag" style="min-height:38px">' + ['', 'H', 'L', 'Abn'].map(function (f) { return opt(f, f || '—', r.flag || ''); }).join('') + '</select></td></tr>'; }).join('') +
      '</tbody></table></div><button class="btn xs ghost" data-pact="row-add" style="margin-top:8px">+ ' + esc(t('Add row', 'पङ्क्ति थप्नुहोस्')) + '</button>';
  }
  function readRows(box) { return $$('tbody tr', box).map(function (tr) { var o = { panel: tr.getAttribute('data-panel') || '' }; $$('[data-k]', tr).forEach(function (i) { o[i.getAttribute('data-k')] = i.value.trim(); }); return o; }).filter(function (r) { return r.param; }); }

  // payments to check (owner / payment checker)
  TABS.payments = function () {
    Promise.all([api('GET', 'api/p/consults'), api('GET', 'api/p/lab/orders')]).then(function (r) {
      var cs = r[0].filter(function (c) { return c.status === 'payment_review'; }), lo = r[1].online.filter(function (o) { return o.payStatus === 'review'; });
      var recent = r[0].filter(function (c) { return c.verifiedAt; }).slice(0, 15);
      D('<h2 style="font-size:1.3rem">' + esc(t('Video consultation payments', 'भिडियो परामर्श भुक्तानी')) + '</h2>' + (cs.length ? '<div class="list">' + cs.map(function (c) {
        return '<div class="item"><div class="top"><h3>' + esc(c.patientName) + ' → ' + esc(c.doctorName) + '</h3><span class="amount" style="font-size:1.1rem">Rs ' + esc(c.fee) + '</span></div><dl class="kv"><dt>' + esc(t('When', 'कहिले')) + '</dt><dd>' + esc(fmt(c.date)) + ' ' + esc(c.time) + '</dd><dt>' + esc(t('Paid by', 'माध्यम')) + '</dt><dd>' + esc(c.method) + '</dd><dt>' + esc(t('Code', 'कोड')) + '</dt><dd>' + esc(c.code) + '</dd><dt>' + esc(t('Phone', 'फोन')) + '</dt><dd>' + esc(c.phone) + '</dd></dl>' +
          '<div class="acts">' + fileLink(c.receipt, t('Open receipt', 'रसिद हेर्नुहोस्')) + '</div><div class="acts"><input data-note="' + esc(c.id) + '" placeholder="' + esc(t('Note (optional, sent to patient if not confirmed)', 'टिप्पणी')) + '" style="min-height:38px;flex:1;min-width:200px"><button class="btn sm green" data-pact="c-verify" data-ok="1" data-id="' + esc(c.id) + '">✓ ' + esc(t('Payment received – confirm', 'भुक्तानी प्राप्त – पुष्टि')) + '</button><button class="btn sm ghost" data-pact="c-verify" data-ok="" data-id="' + esc(c.id) + '">' + esc(t('Not received', 'प्राप्त भएन')) + '</button></div></div>';
      }).join('') + '</div>' : '<p class="empty">' + esc(t('Nothing to check.', 'जाँच्न केही छैन ।')) + '</p>') +
        '<h2 style="font-size:1.3rem;margin-top:24px">' + esc(t('Lab booking payments', 'ल्याब भुक्तानी')) + '</h2>' + (lo.length ? '<div class="list">' + lo.map(function (o) {
          return '<div class="item"><div class="top"><h3>' + esc(o.code) + ' · ' + esc(o.name) + '</h3><span>' + esc(o.total ? money(o.total) : '') + '</span></div><div class="small muted">' + esc(o.tests.map(function (x) { return x.name; }).join(', ')) + '</div><div class="acts">' + fileLink(o.receipt, t('Open receipt', 'रसिद हेर्नुहोस्')) + '<button class="btn sm green" data-pact="lo-pay" data-ok="1" data-id="' + esc(o.id) + '">✓ ' + esc(t('Confirm', 'पुष्टि')) + '</button><button class="btn sm ghost" data-pact="lo-pay" data-ok="" data-id="' + esc(o.id) + '">' + esc(t('Not received', 'प्राप्त भएन')) + '</button></div></div>';
        }).join('') + '</div>' : '<p class="empty">' + esc(t('Nothing to check.', 'जाँच्न केही छैन ।')) + '</p>') +
        (recent.length ? '<details style="margin-top:20px"><summary>' + esc(t('Recently checked', 'भर्खर जाँचिएका')) + '</summary><div class="list" style="margin-top:10px">' + recent.map(function (c) { return '<div class="item small"><b>' + esc(c.code) + '</b> ' + esc(c.patientName) + ' · Rs ' + esc(c.fee) + ' ' + status(c.status) + ' · ' + esc(c.verifiedBy || '') + ' ' + esc(when(c.verifiedAt)) + '</div>'; }).join('') + '</div></details>' : ''));
    }).catch(fail);
  };

  // requests (packages, refills, second opinions, grievances, incidents)
  TABS.requests = function () {
    api('GET', 'api/p/requests').then(function (list) {
      P.cache.requests = list;
      var kinds = {}; list.forEach(function (r) { kinds[r.kind] = r.kindName; });
      var f = P.reqFilter || '';
      var shown = list.filter(function (r) { return !f || r.kind === f; });
      D('<h2 style="font-size:1.3rem">' + esc(t('Requests', 'अनुरोध')) + '</h2>' + (Object.keys(kinds).length > 1 ? '<div class="tabs"><button data-pact="req-filter" data-k="" aria-pressed="' + !f + '">' + esc(T('all')) + '</button>' + Object.keys(kinds).map(function (k) { return '<button data-pact="req-filter" data-k="' + k + '" aria-pressed="' + (f === k) + '">' + esc(kinds[k]) + '</button>'; }).join('') + '</div>' : '') +
        (shown.length ? '<div class="list">' + shown.map(function (r) {
          var d = r.data || {};
          var kv = [['Package', d.packageName && d.packageName + (d.price ? ' (Rs ' + d.price + ')' : '')], [t('Date', 'मिति'), d.date], [t('Medicines', 'औषधि'), d.medicines], [t('Delivery', 'डेलिभरी'), d.delivery], [t('Address', 'ठेगाना'), d.address], [t('Subject', 'विषय'), d.subject], [t('Question', 'प्रश्न'), d.question], [t('History', 'इतिहास'), d.history],
            [t('What happened', 'के भयो'), d.details], [t('When', 'कहिले'), d.when], [t('Where', 'कहाँ'), d.where], [t('Category', 'प्रकार'), d.category], [t('Name', 'नाम'), r.name + (r.age ? ', ' + r.age : '')], [t('Phone', 'फोन'), r.phone], [t('Email', 'इमेल'), r.email]].filter(function (x) { return x[1]; });
          return '<div class="item"><div class="top"><h3>' + esc(r.kindName) + ' · ' + esc(r.code) + '</h3><span>' + status(r.status) + ' <span class="small muted">' + esc(when(r.at)) + '</span></span></div><dl class="kv">' + kv.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd style="white-space:pre-line">' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
            (r.files.length ? '<div class="acts">' + r.files.map(function (x) { return fileLink(x); }).join(' ') + '</div>' : '') +
            (r.replies.length ? '<div style="margin-top:10px">' + r.replies.map(function (x) { return '<div class="summary" style="margin-top:6px"><b>' + esc(x.by) + '</b> <span class="small muted">' + esc(when(x.at)) + '</span><div style="white-space:pre-line">' + esc(x.text) + '</div></div>'; }).join('') + '</div>' : '') +
            (r.canHandle ? '<div class="acts" style="align-items:flex-start"><select data-pchange="req-status" data-id="' + esc(r.id) + '" style="min-height:38px;max-width:180px">' + ['new', 'in-progress', 'done', 'closed'].map(function (s) { return opt(s, s, r.status); }).join('') + '</select><textarea data-reply="' + esc(r.id) + '" placeholder="' + esc(t('Write a reply (sent to the person)', 'जवाफ लेख्नुहोस्')) + '" style="min-height:60px;flex:1;min-width:220px"></textarea><button class="btn sm" data-pact="req-reply" data-id="' + esc(r.id) + '">' + esc(t('Send reply', 'जवाफ पठाउनुहोस्')) + '</button></div>' : '') + '</div>';
        }).join('') + '</div>' : '<p class="empty">' + esc(t('No requests.', 'अनुरोध छैन ।')) + '</p>'));
    }).catch(fail);
  };

  // doctor: public profile (goes live after the Director approves)
  TABS.profile = function () {
    api('GET', 'api/p/doctor-profile').then(function (j) {
      var d = j.doctor || {}, pend = (j.edits || []).find(function (e) { return e.status === 'pending'; }), last = (j.edits || [])[0];
      var v = pend ? Object.assign({}, d, pend.fields) : d;
      var missing = [['photo', !v.photo || /\/ph\//.test(v.photo)], ['degrees', !v.degrees], ['nmc', !v.nmc], ['bio', !L(v.bio)], ['focus', !(v.focus || []).length], ['title', !L(v.title)]].filter(function (x) { return x[1]; }).map(function (x) { return x[0]; });
      function bi(k, label, long) { var x = v[k] || {}; return '<div class="two"><label class="f">' + esc(label) + ' (English)' + (long ? '<textarea name="' + k + '_en">' + esc(x.en || '') + '</textarea>' : '<input name="' + k + '_en" value="' + esc(x.en || '') + '">') + '</label><label class="f">' + esc(label) + ' (नेपाली)' + (long ? '<textarea name="' + k + '_ne" lang="ne">' + esc(x.ne || '') + '</textarea>' : '<input name="' + k + '_ne" lang="ne" value="' + esc(x.ne || '') + '">') + '</label></div>'; }
      D('<h2 style="font-size:1.3rem">' + esc(t('My public profile', 'मेरो सार्वजनिक प्रोफाइल')) + '</h2>' +
        (pend ? '<p class="alert warn">' + esc(t('Your last changes are waiting for the Director’s approval. You can still change them below.', 'तपाईंको परिवर्तन स्वीकृतिको पर्खाइमा छ ।')) + '</p>' : last && last.status === 'rejected' ? '<p class="alert">' + esc(t('Your last changes were not approved', 'पछिल्लो परिवर्तन स्वीकृत भएन')) + (last.note ? ': ' + esc(last.note) : '') + '</p>' : '') +
        (missing.length ? '<p class="alert info">' + esc(t('Please complete these to help patients choose you:', 'कृपया यी विवरण पूरा गर्नुहोस्:')) + ' <b>' + esc(missing.join(', ')) + '</b></p>' : '') +
        '<form class="card form-grid" data-pform="docprofile"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><img src="' + esc(v.photo || 'img/ph/P19.svg') + '" alt="" id="docPhotoPrev" style="width:110px;height:130px;object-fit:cover;border-radius:14px;background:var(--tint)"><div><input type="hidden" name="photo" value="' + esc(v.photo || '') + '"><label class="btn sm ghost" style="cursor:pointer">' + icon('upload') + esc(t('Upload photo', 'फोटो अपलोड')) + '<input type="file" accept="image/*" data-pchange="docphoto" hidden></label><p class="small muted" style="margin:6px 0 0">' + esc(t('A clear portrait, face to chest, plain background.', 'स्पष्ट पोर्ट्रेट फोटो ।')) + '</p></div></div>' +
        '<p style="margin:0"><b>' + esc(L(d.name)) + '</b> · NMC ' + esc(d.nmc || '—') + '</p>' + bi('title', t('Title (e.g. Consultant Physician)', 'पद')) +
        '<div class="two"><label class="f">' + esc(t('Qualifications / degrees', 'योग्यता')) + '<input name="degrees" value="' + esc(v.degrees || '') + '" placeholder="MBBS, MD (Internal Medicine)"></label><label class="f">NMC No.<input name="nmc" value="' + esc(v.nmc || '') + '"></label></div>' +
        '<div class="two"><label class="f">' + esc(t('Also works at', 'अन्य संस्था')) + '<input name="affiliation" value="' + esc(v.affiliation || '') + '"></label><label class="f">' + esc(t('Gender', 'लिङ्ग')) + '<select name="gender">' + opt('', '—', v.gender) + opt('Male', 'Male', v.gender) + opt('Female', 'Female', v.gender) + '</select></label></div>' +
        '<div class="two"><label class="f">' + esc(t('Languages (comma separated)', 'भाषा')) + '<input name="languages" value="' + esc((v.languages || []).join(', ')) + '"></label><label class="f">' + esc(t('OPD hours (e.g. 09:00-13:00, 15:00-17:00)', 'ओपीडी समय')) + '<input name="hours" value="' + esc(v.hours || '') + '"></label></div>' +
        '<label class="f">' + esc(t('Clinical focus (one per line)', 'विशेषता (प्रति लाइन एक)')) + '<textarea name="focus">' + esc((v.focus || []).join('\n')) + '</textarea></label>' + bi('bio', t('About you', 'परिचय'), true) + bi('scheduleNote', t('Schedule text shown to patients', 'तालिका'), false) +
        '<button class="btn" type="submit">' + esc(t('Send for approval', 'स्वीकृतिका लागि पठाउनुहोस्')) + '</button><div class="msg"></div></form>');
    }).catch(fail);
  };

  // OPD
  TABS.opd = function () {
    var a = P.me, docs = N.doctors();
    var mine = a.doctorId && a.type === 'staff' && a.staffRole === 'doctor';
    var others = a.seesAll || (a.opdAccess || []).indexOf('all') >= 0 ? docs : docs.filter(function (d) { return (a.opdAccess || []).indexOf(d.id) >= 0; });
    D('<h2 style="font-size:1.3rem">' + esc(t('OPD cards', 'ओपीडी कार्ड')) + '</h2><p class="muted">' + esc(t('Write OPD cards, prescriptions and lab orders. Lab orders go straight to the lab staff, and results come back into the card.', 'ओपीडी कार्ड, प्रेस्क्रिप्सन र ल्याब अर्डर । ल्याब अर्डर सिधै ल्याब कर्मचारीमा जान्छ ।')) + '</p>' +
      (mine ? '<p><a class="btn" href="opd.html">' + icon('stethoscope') + esc(t('Open my OPD', 'मेरो ओपीडी खोल्नुहोस्')) + '</a></p>' : '') +
      (others.length && (a.seesAll || (a.opdAccess || []).length) ? '<h3 style="margin-top:18px">' + esc(t('Other doctors’ OPD', 'अन्य डाक्टरको ओपीडी')) + '</h3><div class="grid">' + others.filter(function (d) { return d.id !== a.doctorId; }).map(function (d) { return '<a class="card dept" href="opd.html?doctor=' + encodeURIComponent(d.id) + '"><span class="ic">' + icon('user') + '</span><span><h3>' + esc(L(d.name)) + '</h3><p>' + esc(L(d.title)) + '</p></span></a>'; }).join('') + '</div>' : ''));
  };

  // send message / notice (Director, owner)
  TABS.send = function () {
    P.sendTo = P.sendTo || [];
    D('<h2 style="font-size:1.3rem">' + esc(t('Send a message or notice', 'सन्देश वा सूचना पठाउनुहोस्')) + '</h2><form class="card form-grid" data-pform="send">' +
      '<label class="f">' + esc(t('Type', 'प्रकार')) + '<select name="kind">' + opt('message', t('Private message — only the people you choose can see it', 'निजी सन्देश')) + opt('notice', t('Notice for a group (e.g. duty schedule for nursing staff)', 'समूहका लागि सूचना')) + '</select></label>' +
      '<fieldset style="border:0;padding:0;margin:0"><legend class="f" style="font-weight:600;margin-bottom:6px">' + esc(t('Send to groups', 'समूहलाई पठाउनुहोस्')) + '</legend><div class="picker">' +
      '<label><input type="checkbox" name="allStaff" value="1">' + esc(t('All staff', 'सबै कर्मचारी')) + '</label>' + [['doctor', 'Doctors'], ['nursing', 'Nursing staff'], ['lab', 'Lab staff'], ['pharmacy', 'Pharmacy staff'], ['management', 'Management staff']].map(function (r) { return '<label><input type="checkbox" name="staff" value="' + r[0] + '">' + esc(r[1]) + '</label>'; }).join('') + '</div></fieldset>' +
      '<div class="f"><span style="font-weight:600;font-size:.88rem">' + esc(t('…and/or to chosen people', '…वा छानिएका व्यक्ति')) + '</span><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><input type="search" data-people="q" placeholder="' + esc(t('Search name or email', 'नाम वा इमेल खोज्नुहोस्')) + '" style="max-width:320px"><select data-people="type" style="max-width:160px">' + opt('', t('Staff & patients', 'सबै')) + opt('staff', t('Staff', 'कर्मचारी')) + opt('patient', t('Patients', 'बिरामी')) + '</select></div><div id="peopleRes" class="picker" style="margin-top:8px"></div><div id="sendTo" class="picker" style="margin-top:8px"></div></div>' +
      '<label class="f">' + esc(t('Title', 'शीर्षक')) + '<input name="title" required maxlength="160"></label><label class="f">' + esc(t('Message', 'सन्देश')) + '<textarea name="body" rows="6"></textarea></label>' +
      '<label class="f">' + esc(t('Link (optional)', 'लिङ्क (ऐच्छिक)')) + '<input name="link" placeholder="#/notices or https://…"></label>' +
      '<p class="small muted" style="margin:0">' + esc(t('Everyone gets it on their dashboard straight away, and by email (up to about 290 emails a day on the free plan — extra ones go out in a summary email the next morning).', 'ड्यासबोर्ड र इमेलमा पठाइन्छ ।')) + '</p>' +
      '<button class="btn" type="submit">' + icon('send') + esc(t('Send', 'पठाउनुहोस्')) + '</button><div class="msg"></div></form>');
    drawSendTo(); searchPeople('');
  };
  function drawSendTo() { var el = $('#sendTo'); if (el) el.innerHTML = P.sendTo.map(function (p) { return '<label style="background:var(--tint)">' + esc(p.name) + ' <button type="button" class="btn xs ghost" data-pact="to-remove" data-id="' + esc(p.id) + '" aria-label="Remove">×</button></label>'; }).join(''); }
  var peopleT;
  function searchPeople(q) {
    clearTimeout(peopleT);
    peopleT = setTimeout(function () {
      var ty = $('[data-people=type]'); api('GET', 'api/p/people?q=' + encodeURIComponent(q || '') + '&type=' + (ty ? ty.value : '')).then(function (list) {
        var el = $('#peopleRes'); if (!el) return;
        el.innerHTML = list.slice(0, 30).map(function (p) { return '<button type="button" class="btn xs ghost" data-pact="to-add" data-id="' + esc(p.id) + '" data-n="' + esc(p.name) + '">+ ' + esc(p.name) + ' <span class="muted">(' + esc(p.type === 'staff' ? roleName(p.staffRole) : 'patient') + ')</span></button>'; }).join('') || '<span class="small muted">—</span>';
      });
    }, 250);
  }

  // approvals (Director)
  TABS.approvals = function () {
    api('GET', 'api/p/approvals').then(function (j) {
      var docs = N.doctors();
      D('<h2 style="font-size:1.3rem">' + esc(t('New staff accounts', 'नयाँ कर्मचारी खाता')) + '</h2>' + (j.staff.length ? '<div class="list">' + j.staff.map(function (a) {
        var d = a.doctorId ? docs.find(function (x) { return x.id === a.doctorId; }) : null;
        return '<div class="item"><div class="top"><h3>' + esc(a.profile.name || a.email) + '</h3>' + status(a.status) + '</div><dl class="kv"><dt>Email</dt><dd>' + esc(a.email) + '</dd><dt>' + esc(t('Says they are', 'भूमिका')) + '</dt><dd>' + esc(roleName(a.staffRole)) + (d ? ' — ' + esc(L(d.name)) : '') + '</dd><dt>' + esc(t('Phone', 'फोन')) + '</dt><dd>' + esc(a.profile.phone || '—') + '</dd></dl>' +
          '<div class="acts"><button class="btn sm green" data-pact="acct-set" data-id="' + esc(a.id) + '" data-s="active">✓ ' + esc(t('Approve', 'स्वीकृत')) + '</button><button class="btn sm ghost" data-pact="acct-set" data-id="' + esc(a.id) + '" data-s="rejected">' + esc(t('Reject', 'अस्वीकृत')) + '</button></div></div>';
      }).join('') + '</div>' : '<p class="empty">' + esc(t('No staff accounts waiting.', 'कुनै खाता बाँकी छैन ।')) + '</p>') +
        '<h2 style="font-size:1.3rem;margin-top:24px">' + esc(t('Doctor profile changes', 'डाक्टर प्रोफाइल परिवर्तन')) + '</h2>' + (j.edits.length ? '<div class="list">' + j.edits.map(function (e) {
          var cur = e.current || {};
          var rows = Object.keys(e.fields).map(function (k) { var nv = e.fields[k], ov = cur[k]; var f = function (v) { return Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? [v.en, v.ne].filter(Boolean).join(' / ') : (v || ''); }; if (f(nv) === f(ov)) return ''; return '<tr><th>' + esc(k) + '</th><td>' + (k === 'photo' ? (ov ? '<img src="' + esc(ov) + '" style="width:60px;border-radius:8px">' : '—') : esc(f(ov) || '—')) + '</td><td>' + (k === 'photo' ? '<img src="' + esc(nv) + '" style="width:60px;border-radius:8px">' : '<b>' + esc(f(nv) || '—') + '</b>') + '</td></tr>'; }).join('');
          return '<div class="item"><div class="top"><h3>' + esc(L(cur.name) || e.doctorId) + '</h3><span class="small muted">' + esc(when(e.at)) + '</span></div>' +
            (rows ? '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th></th><th>' + esc(t('Now', 'अहिले')) + '</th><th>' + esc(t('New', 'नयाँ')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="small muted">' + esc(t('No visible change.', 'कुनै परिवर्तन छैन ।')) + '</p>') +
            '<div class="acts"><input data-note="' + esc(e.id) + '" placeholder="' + esc(t('Note to the doctor (optional)', 'डाक्टरलाई टिप्पणी')) + '" style="min-height:38px;flex:1;min-width:200px"><button class="btn sm green" data-pact="edit-decide" data-ok="1" data-id="' + esc(e.id) + '">✓ ' + esc(t('Approve & publish', 'स्वीकृत गरी प्रकाशित')) + '</button><button class="btn sm ghost" data-pact="edit-decide" data-ok="" data-id="' + esc(e.id) + '">' + esc(t('Reject', 'अस्वीकृत')) + '</button></div></div>';
        }).join('') + '</div>' : '<p class="empty">' + esc(t('No profile changes waiting.', 'कुनै परिवर्तन बाँकी छैन ।')) + '</p>'));
    }).catch(fail);
  };

  // people & access (Director)
  TABS.people = function () {
    api('GET', 'api/acct/admin/accounts').then(function (list) {
      P.cache.people = list;
      var f = P.peopleFilter || { q: '', type: 'staff' };
      var docs = N.doctors();
      var shown = list.filter(function (a) { return (!f.type || a.type === f.type || (f.type === 'pending' && a.status === 'pending')) && (!f.q || (a.email + ' ' + (a.profile.name || '')).toLowerCase().indexOf(f.q.toLowerCase()) >= 0); });
      D('<h2 style="font-size:1.3rem">' + esc(t('People & access', 'व्यक्ति तथा पहुँच')) + '</h2><p class="muted small">' + esc(t('Give roles: Owner (sees everything, checks payments), Payment checker, or another Director. For OPD, choose which doctors’ OPD cards a person may open.', 'भूमिका र ओपीडी पहुँच दिनुहोस् ।')) + '</p>' +
        '<div class="filters" style="grid-template-columns:2fr 1fr"><input type="search" data-pf="q" placeholder="' + esc(t('Search', 'खोज्नुहोस्')) + '" value="' + esc(f.q) + '"><select data-pf="type">' + opt('staff', t('Staff', 'कर्मचारी'), f.type) + opt('patient', t('Patients', 'बिरामी'), f.type) + opt('pending', t('Waiting approval', 'स्वीकृति बाँकी'), f.type) + opt('', t('Everyone', 'सबै'), f.type) + '</select></div>' +
        '<div class="list">' + shown.slice(0, 200).map(function (a) {
          var isDoc = a.staffRole === 'doctor', d = isDoc ? docs.find(function (x) { return x.id === a.doctorId; }) : null;
          return '<details class="item"><summary style="cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>' + esc(a.profile.name || a.email) + '</b> <span class="small muted">' + esc(a.email) + '</span> ' + status(a.status) + ' <span class="tag">' + esc(a.type === 'staff' ? roleName(a.staffRole) : a.type || '—') + '</span>' + a.roles.map(function (r) { return ' <span class="tag orange">' + esc(r) + '</span>'; }).join('') + '</summary>' +
            '<div class="form-grid" style="margin-top:12px" data-acct="' + esc(a.id) + '"><div class="two"><label class="f">' + esc(t('Status', 'स्थिति')) + '<select data-k="status">' + ['active', 'pending', 'rejected', 'disabled'].map(function (s) { return opt(s, s, a.status); }).join('') + '</select></label>' +
            (a.type === 'staff' ? '<label class="f">' + esc(t('Staff type', 'प्रकार')) + '<select data-k="staffRole">' + ['doctor', 'nursing', 'lab', 'pharmacy', 'management'].map(function (r) { return opt(r, roleName(r), a.staffRole); }).join('') + '</select></label>' : '<span></span>') + '</div>' +
            (isDoc ? '<p class="small" style="margin:0">' + esc(t('Doctor profile', 'डाक्टर प्रोफाइल')) + ': <b>' + esc(d ? L(d.name) : a.doctorId || '—') + '</b></p>' : '') +
            '<div class="picker">' + [['owner', 'Owner'], ['verifier', 'Payment checker'], ['director', 'Director']].map(function (r) { return '<label><input type="checkbox" data-role="' + r[0] + '"' + (a.roles.indexOf(r[0]) >= 0 ? ' checked' : '') + '>' + esc(r[1]) + '</label>'; }).join('') + '</div>' +
            (a.type === 'staff' ? '<label class="f">' + esc(t('Can also open the OPD of', 'यिनको ओपीडी पनि खोल्न सक्ने')) + '<select data-k="opdAccess" multiple size="5">' + opt('all', t('All doctors', 'सबै डाक्टर'), (a.opdAccess || []).indexOf('all') >= 0 ? 'all' : '') + docs.map(function (x) { return '<option value="' + esc(x.id) + '"' + ((a.opdAccess || []).indexOf(x.id) >= 0 ? ' selected' : '') + '>' + esc(L(x.name)) + '</option>'; }).join('') + '</select><span class="hint">Ctrl/⌘-click ' + esc(t('to choose more than one', 'धेरै छान्न')) + '</span></label>' : '') +
            '<div class="acts"><button class="btn sm" data-pact="acct-save" data-id="' + esc(a.id) + '">' + esc(t('Save', 'सेभ')) + '</button><span class="small muted">' + esc(t('Joined', 'खोलिएको')) + ' ' + esc(fmt(a.createdAt)) + (a.lastLoginAt ? ' · ' + esc(t('last sign-in', 'पछिल्लो साइन इन')) + ' ' + esc(when(a.lastLoginAt)) : '') + '</span></div></div></details>';
        }).join('') + '</div>' + (shown.length > 200 ? '<p class="small muted">' + esc(t('Showing first 200 — search to find others.', 'पहिलो २०० मात्र ।')) + '</p>' : ''));
    }).catch(fail);
  };

  // account
  TABS.account = function () {
    var a = P.me, p = a.profile || {};
    D('<div class="card"><h2 style="font-size:1.2rem">' + esc(p.name || a.email) + '</h2><dl class="kv"><dt>Email</dt><dd>' + esc(a.email) + '</dd><dt>' + esc(t('Type', 'प्रकार')) + '</dt><dd>' + esc(a.type === 'staff' ? roleName(a.staffRole) : t('Patient', 'बिरामी')) + ' ' + status(a.status) + '</dd><dt>' + esc(t('Age', 'उमेर')) + '</dt><dd>' + esc(p.age || '—') + '</dd><dt>' + esc(t('Phone', 'फोन')) + '</dt><dd>' + esc(p.phone || '—') + '</dd></dl>' +
      '<div class="acts"><a class="btn sm ghost" href="#/account">' + esc(t('Edit profile', 'प्रोफाइल सम्पादन')) + '</a><button class="btn sm ghost" data-pact="logout">' + icon('logout') + esc(t('Sign out', 'साइन आउट')) + '</button></div></div>' +
      '<form class="card form-grid" data-pform="changepw" style="margin-top:16px"><h3 style="margin:0">' + esc(t('Change password', 'पासवर्ड बदल्नुहोस्')) + '</h3><label class="f">' + esc(t('Current password', 'हालको पासवर्ड')) + '<input type="password" name="current" autocomplete="current-password" required></label><label class="f">' + esc(t('New password', 'नयाँ पासवर्ड')) + '<input type="password" name="next" autocomplete="new-password" minlength="8" required></label><button class="btn sm" type="submit">' + esc(t('Change', 'बदल्नुहोस्')) + '</button><div class="msg"></div></form>');
  };

  // --------------------------------------------------------- payment box (shared)
  function payBox(amount, what) {
    var pay = C().payments || {};
    var qrs = [['fonepay', 'Fonepay', pay.fonepayQr], ['esewa', 'eSewa', pay.esewaQr]].filter(function (x) { return x[2]; });
    return '<div class="pay"><div><p style="margin:0 0 6px">' + esc(what) + '</p>' + (amount ? '<div class="amount">Rs ' + esc(amount) + '</div>' : '') + '<p class="small muted" style="margin-top:6px">' + esc(L(pay.instructions)) + '</p>' +
      (L(pay.accountName) ? '<p class="small" style="margin:0">' + esc(t('Pay to', 'भुक्तानी')) + ': <b>' + esc(L(pay.accountName)) + '</b></p>' : '') + '</div>' +
      '<div class="qr">' + (qrs.length ? qrs.map(function (q) { return '<figure>' + N.img(q[2], q[1] + ' QR') + '<figcaption>' + q[1] + '</figcaption></figure>'; }).join('') : '<p class="alert warn" style="margin:0">' + esc(t('The QR code has not been added yet. Please call 057-520223 for payment details.', 'QR कोड राखिएको छैन । ०५७-५२०२२३ मा फोन गर्नुहोस् ।')) + '</p>') + '</div></div>';
  }

  // ------------------------------------------------------- video consultation page
  N.PAGES.consult = function () {
    var cs = C().consult || {};
    if (!P.consult || P.consult.done) P.consult = { step: 1, doctorId: '', date: '', time: '', taken: [] };
    return head(T('videoConsult'), L(cs.intro)) + '<section class="section"><div class="container" style="max-width:900px">' +
      '<p class="alert warn">' + esc(L(cs.notFor)) + '</p>' + (cs.enabled === false ? '<p class="alert">' + esc(t('Video consultation is closed at the moment. Please call us.', 'भिडियो परामर्श अहिले बन्द छ ।')) + '</p>' : '<div class="card" id="cwiz"></div>') + '</div></section>';
  };
  function feeOf(d) { var cs = C().consult || {}; return String(d.degreeLevel || 'MD').toUpperCase() === 'DM' ? +cs.feeDM || 950 : +cs.feeMD || 700; }
  function consultDoctors() { return N.doctors().filter(function (d) { return d.videoConsult !== false && N.S.hasFixedSchedule(d); }); }
  function consultInit() { drawConsult(); }
  function drawConsult(focus) {
    var el = $('#cwiz'); if (!el) return;
    var w = P.consult, cs = C().consult || {}, docs = consultDoctors(), d = N.docById(w.doctorId);
    var steps = '<ol class="steps">' + [t('Doctor', 'डाक्टर'), t('Date & time', 'मिति र समय'), t('Pay & upload receipt', 'भुक्तानी र रसिद')].map(function (s, i) { return '<li' + (w.step === i + 1 ? ' aria-current="step"' : '') + (w.step > i + 1 ? ' class="done"' : '') + '>' + esc(s) + '</li>'; }).join('') + '</ol>';
    var html = steps;
    if (w.done) {
      var c = w.done, pay = C().payments || {};
      var wa = pay.whatsapp ? 'https://wa.me/' + N.waNum(pay.whatsapp) + '?text=' + encodeURIComponent('Namaste, I paid Rs ' + c.fee + ' for video consultation ' + c.code + ' with ' + c.doctorName + ' on ' + c.date + ' ' + c.time + '. Name: ' + c.patientName + '.') : '';
      el.innerHTML = '<div class="done-box"><div class="tick">' + icon('check') + '</div><h2>' + esc(t('Done! Booking received', 'बुकिङ प्राप्त भयो')) + '</h2><p>' + esc(t('We are checking your payment. When it is confirmed you will get an email with the link to join the video call, and it will also show in your dashboard.', 'भुक्तानी जाँच भएपछि भिडियो कलको लिङ्क इमेलमा आउनेछ ।')) + '</p><div class="code">' + esc(c.code) + '</div>' +
        '<dl class="kv" style="max-width:360px;margin:16px auto;text-align:left"><dt>' + esc(t('Doctor', 'डाक्टर')) + '</dt><dd>' + esc(c.doctorName) + '</dd><dt>' + esc(t('When', 'कहिले')) + '</dt><dd>' + esc(fmt(c.date)) + ' · ' + esc(c.time) + '</dd><dt>' + esc(t('Fee', 'शुल्क')) + '</dt><dd>Rs ' + esc(c.fee) + '</dd></dl>' +
        '<p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#/dashboard/consults">' + esc(t('My video consultations', 'मेरा भिडियो परामर्श')) + '</a>' + (wa ? '<a class="btn ghost" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('whatsapp') + esc(t('Also tell the hospital on WhatsApp', 'व्हाट्सएपमा पनि जानकारी')) + '</a>' : '') + '</p></div>';
      return;
    }
    if (w.step === 1) {
      html += '<h2>' + esc(t('Choose a doctor', 'डाक्टर छान्नुहोस्')) + '</h2><p class="muted small">' + esc(t('Fee', 'शुल्क')) + ': MD Rs ' + esc(cs.feeMD || 700) + ' · DM Rs ' + esc(cs.feeDM || 950) + '</p><div class="pick">' + docs.map(function (x) {
        return '<button class="pick-doc" data-pact="c-doc" data-id="' + esc(x.id) + '" aria-pressed="' + (x.id === w.doctorId) + '">' + N.img(N.photoOf(x), '') + '<span><b>' + esc(L(x.name)) + '</b><small>' + esc(L(x.title)) + '</small><small>' + esc(N.scheduleOf(x)) + '</small></span><span class="fee">Rs ' + feeOf(x) + '</span></button>';
      }).join('') + (docs.length ? '' : '<p class="empty">' + esc(t('No doctors are taking video consultations right now.', 'अहिले कुनै डाक्टर उपलब्ध छैनन् ।')) + '</p>') + '</div>';
    } else if (w.step === 2 && d) {
      var dates = N.S.nextDates(d, C().booking, 14);
      html += '<div class="summary"><b>' + esc(L(d.name)) + '</b> · Rs ' + feeOf(d) + '</div><h2 style="margin-top:16px">' + esc(t('Choose a date', 'मिति छान्नुहोस्')) + '</h2><div class="dates">' + dates.map(function (s) { var dt = N.S.parse(s); return '<button data-pact="c-date" data-d="' + s + '" aria-pressed="' + (s === w.date) + '"><small>' + esc(dt.toLocaleDateString(N.lang === 'ne' ? 'ne-NP' : 'en-GB', { weekday: 'short' })) + '</small><b>' + dt.getDate() + '</b><small>' + esc(dt.toLocaleDateString(N.lang === 'ne' ? 'ne-NP' : 'en-GB', { month: 'short' })) + '</small></button>'; }).join('') + '</div>';
      if (w.date) {
        var now = new Date(Date.now() + 345 * 60e3), isToday = w.date === N.today(), nowMin = now.getUTCHours() * 60 + now.getUTCMinutes() + 30;
        var slots = N.S.slots(d, Object.assign({}, C().booking, { slotMinutes: +(cs.slotMinutes || 15) })).filter(function (s) { var p = s.split(':'); return !isToday || +p[0] * 60 + +p[1] > nowMin; });
        html += '<h2 style="margin-top:12px">' + esc(t('Choose a time', 'समय छान्नुहोस्')) + '</h2>' + (slots.length ? '<div class="slots">' + slots.map(function (s) { var tk = w.taken.indexOf(s) >= 0; return '<button data-pact="c-time" data-t="' + s + '" aria-pressed="' + (s === w.time) + '"' + (tk ? ' disabled' : '') + '>' + s + '</button>'; }).join('') + '</div>' : '<p class="empty">' + esc(t('No times left on this day.', 'यो दिन समय बाँकी छैन ।')) + '</p>');
      }
      html += '<div class="wiz-nav"><button class="btn ghost" data-pact="c-back">← ' + esc(T('back')) + '</button><button class="btn" data-pact="c-next"' + (w.time ? '' : ' disabled') + '>' + esc(T('next')) + ' →</button></div>';
    } else if (w.step === 3 && d) {
      var gate = needPatient('#/consult');
      html += '<div class="summary"><b>' + esc(L(d.name)) + '</b> · ' + esc(fmt(w.date)) + ' · ' + esc(w.time) + '</div>';
      if (gate) html += '<div style="margin-top:16px">' + gate + '</div><div class="wiz-nav"><button class="btn ghost" data-pact="c-back">← ' + esc(T('back')) + '</button></div>';
      else html += '<form class="form-grid" data-pform="consult" style="margin-top:16px">' + payBox(feeOf(d), t('Video consultation fee', 'भिडियो परामर्श शुल्क')) +
        '<label class="f">' + esc(t('Reason for consultation', 'परामर्शको कारण')) + '<textarea name="reason" maxlength="1000" placeholder="' + esc(t('Your main problem, how long, current medicines', 'मुख्य समस्या, कति समयदेखि, हालका औषधि')) + '"></textarea></label>' +
        '<div class="two"><label class="f">' + esc(t('Paid with', 'भुक्तानी माध्यम')) + '<select name="method">' + opt('fonepay', 'Fonepay') + opt('esewa', 'eSewa') + '</select></label><label class="f">' + esc(t('Mobile number', 'मोबाइल नम्बर')) + '<input name="phone" type="tel" value="' + esc((P.me.profile || {}).phone || '') + '" required></label></div>' +
        '<label class="f">' + esc(t('Payment receipt (screenshot or PDF)', 'भुक्तानी रसिद (स्क्रिनसट वा PDF)')) + '<input type="file" name="receipt" accept="image/*,application/pdf" required></label>' +
        '<div class="wiz-nav"><button type="button" class="btn ghost" data-pact="c-back">← ' + esc(T('back')) + '</button><button class="btn" type="submit">' + esc(t('Submit booking', 'बुकिङ पठाउनुहोस्')) + '</button></div><div class="msg" role="status"></div></form>';
    }
    el.innerHTML = html;
    if (focus) { var f = $(focus, el); if (f) f.focus(); }
  }

  // --------------------------------------------------------------- video room
  N.PAGES.room = function (id) {
    return head(t('Video consultation', 'भिडियो परामर्श'), '', T('videoConsult')) + '<section class="section"><div class="container" id="roomBox"><p>' + esc(T('loading')) + '</p></div></section>';
  };
  function roomInit(id) {
    if (P.room && P.room.id === id) return;
    if (!P.loaded) { setTimeout(function () { roomInit(id); }, 300); return; }
    var box = $('#roomBox');
    if (!P.me) { box.innerHTML = needLogin('#/room/' + id); return; }
    api('GET', 'api/p/room/' + encodeURIComponent(id)).then(function (j) {
      var c = j.consult, me = j.me;
      P.room = { id: id, me: me, ice: j.ice, after: 0, pc: null, local: null, queue: [], timer: null, joined: false, consult: c };
      box.innerHTML = '<div class="room"><div><div class="stage"><video id="remoteV" autoplay playsinline></video><div class="msg" id="stageMsg">' + esc(me === 'doctor' ? t('Press “Start” to turn on your camera and call the patient.', '“Start” थिच्नुहोस् ।') : t('Press “Join” and allow the camera and microphone. The doctor will connect at the appointment time.', '“Join” थिच्नुहोस् र क्यामेरा/माइक अनुमति दिनुहोस् ।')) + '</div><video id="localV" class="me" autoplay playsinline muted hidden></video></div>' +
        '<div class="controls" style="margin-top:12px"><button class="btn" data-pact="r-join" style="border-radius:999px;height:54px">' + icon('video') + esc(me === 'doctor' ? t('Start', 'सुरु') : t('Join', 'जोडिनुहोस्')) + '</button>' +
        '<button data-pact="r-mic" aria-label="Microphone" hidden>' + icon('mic') + '</button><button data-pact="r-cam" aria-label="Camera" hidden>' + icon('video') + '</button><button class="end" data-pact="r-end" hidden>' + icon('phone') + esc(t('End', 'अन्त्य')) + '</button></div>' +
        '<p class="small muted" id="roomTip" style="text-align:center;margin-top:10px"></p></div>' +
        '<aside class="card"><h3>' + esc(c.code) + '</h3><dl class="kv"><dt>' + esc(t('Doctor', 'डाक्टर')) + '</dt><dd>' + esc(c.doctorName) + '</dd><dt>' + esc(t('Patient', 'बिरामी')) + '</dt><dd>' + esc(c.patientName) + (c.patientAge ? ' (' + esc(c.patientAge) + ')' : '') + '</dd><dt>' + esc(t('When', 'कहिले')) + '</dt><dd>' + esc(fmt(c.date)) + ' · ' + esc(c.time) + '</dd>' + (c.reason ? '<dt>' + esc(t('Reason', 'कारण')) + '</dt><dd>' + esc(c.reason) + '</dd>' : '') + (c.phone ? '<dt>' + esc(t('Phone', 'फोन')) + '</dt><dd><a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a></dd>' : '') + '</dl>' +
        (c.status !== 'confirmed' ? '<p class="alert warn" style="margin-top:10px">' + esc(t('This consultation is', 'यो परामर्श')) + ' ' + esc(c.status.replace('_', ' ')) + '.</p>' : '') +
        (me === 'doctor' ? '<div class="acts" style="flex-direction:column;align-items:stretch"><button class="btn sm ghost" data-pact="r-remind">' + icon('mail') + esc(t('Patient not here? Email them the join link', 'बिरामीलाई लिङ्क इमेल गर्नुहोस्')) + '</button>' +
          '<label class="f" style="margin-top:8px">' + esc(t('Notes (private)', 'टिप्पणी')) + '<textarea id="docNotes" rows="4"></textarea></label><button class="btn sm" data-pact="r-complete">' + esc(t('Finish & mark completed', 'सम्पन्न')) + '</button></div>' : '') +
        '<p class="small muted" style="margin-top:12px">' + esc(t('Video not connecting? Use the backup room:', 'भिडियो जोडिएन? ब्याकअप कोठा:')) + ' <a href="https://meet.jit.si/NIKO-' + esc(id) + '" target="_blank" rel="noopener">meet.jit.si</a></p></aside></div>';
    }).catch(function (e) { box.innerHTML = '<div class="alert">' + esc(e.message) + '</div>' + (e.login ? needLogin('#/room/' + id) : ''); });
  }
  function sig(type, data) { if (!P.room) return Promise.resolve(); return api('POST', 'api/p/room/' + encodeURIComponent(P.room.id) + '/signal', { type: type, data: data }).catch(function () {}); }
  function newPC() {
    var R = P.room;
    if (R.pc) { try { R.pc.close(); } catch (e) {} }
    var pc = new RTCPeerConnection({ iceServers: R.ice });
    R.pc = pc; R.queue = [];
    R.local.getTracks().forEach(function (tr) { pc.addTrack(tr, R.local); });
    pc.onicecandidate = function (e) { if (e.candidate) sig('ice', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
    pc.ontrack = function (e) { var v = $('#remoteV'); if (v && v.srcObject !== e.streams[0]) { v.srcObject = e.streams[0]; } var m = $('#stageMsg'); if (m) m.hidden = true; };
    pc.onconnectionstatechange = function () {
      var m = $('#stageMsg'), s = pc.connectionState;
      if (s === 'connected') { if (m) m.hidden = true; $('#roomTip').textContent = ''; }
      if ((s === 'failed' || s === 'disconnected') && m) { m.hidden = false; m.textContent = t('Connection lost. Waiting to reconnect…', 'जडान टुट्यो । पुन: जोडिँदै…'); if (R.me === 'doctor' && s === 'failed') offer(); }
    };
    return pc;
  }
  function offer() {
    var pc = newPC();
    pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { sig('offer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); });
  }
  function pollRoom() {
    var R = P.room; if (!R) return;
    api('GET', 'api/p/room/' + encodeURIComponent(R.id) + '/signal?after=' + R.after).then(function (j) {
      if (!P.room) return;
      j.msgs.forEach(function (m) {
        R.after = Math.max(R.after, m.n);
        if (m.type === 'join') {
          if (R.me === 'doctor') offer(); else sig('join');
          var sm = $('#stageMsg'); if (sm) sm.textContent = t('Connecting…', 'जोडिँदै…');
        } else if (m.type === 'offer' && R.me !== 'doctor') {
          var pc = newPC();
          pc.setRemoteDescription(m.data).then(function () { R.queue.forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); }); R.queue = []; return pc.createAnswer(); })
            .then(function (a) { return pc.setLocalDescription(a); }).then(function () { sig('answer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); });
        } else if (m.type === 'answer' && R.me === 'doctor' && R.pc) {
          R.pc.setRemoteDescription(m.data).then(function () { R.queue.forEach(function (c) { R.pc.addIceCandidate(c).catch(function () {}); }); R.queue = []; }).catch(function () {});
        } else if (m.type === 'ice') {
          if (R.pc && R.pc.remoteDescription) R.pc.addIceCandidate(m.data).catch(function () {}); else R.queue.push(m.data);
        } else if (m.type === 'leave') {
          var msg = $('#stageMsg'); if (msg) { msg.hidden = false; msg.textContent = R.me === 'doctor' ? t('The patient left the call.', 'बिरामीले कल छोडे ।') : t('The doctor ended the call.', 'डाक्टरले कल अन्त्य गर्नुभयो ।'); }
        }
      });
    }).catch(function () {}).then(function () { if (P.room) P.room.timer = setTimeout(pollRoom, 1200); });
  }
  function roomJoin() {
    var R = P.room; if (!R || R.joined) return;
    if (!navigator.mediaDevices || !window.RTCPeerConnection) { $('#roomTip').textContent = t('This browser cannot make video calls. Please use Chrome or Safari, or the backup room link.', 'यो ब्राउजरले भिडियो कल गर्न सक्दैन ।'); return; }
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 } }, audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      R.local = stream; R.joined = true;
      var lv = $('#localV'); lv.srcObject = stream; lv.hidden = false;
      $$('[data-pact=r-mic],[data-pact=r-cam],[data-pact=r-end]').forEach(function (b) { b.hidden = false; });
      $('[data-pact=r-join]').hidden = true;
      $('#stageMsg').textContent = R.me === 'doctor' ? t('Waiting for the patient to join…', 'बिरामीको पर्खाइमा…') : t('Waiting for the doctor…', 'डाक्टरको पर्खाइमा…');
      // read only what is new from now on, then announce ourselves
      api('GET', 'api/p/room/' + encodeURIComponent(R.id) + '/signal?after=999999999').then(function (j) { R.after = j.n || 0; sig('join'); pollRoom(); });
      setTimeout(function () { if (P.room && (!P.room.pc || P.room.pc.connectionState !== 'connected')) { var tip = $('#roomTip'); if (tip) tip.innerHTML = esc(t('Taking long? Check that the other person has joined. If video still does not connect, both open the backup room link on the right, or call.', 'धेरै समय लाग्यो? ब्याकअप लिङ्क प्रयोग गर्नुहोस् ।')); } }, 45000);
    }).catch(function () { $('#roomTip').textContent = t('Camera or microphone was blocked. Allow them in the browser settings and press Join again.', 'क्यामेरा/माइक अनुमति दिनुहोस् ।'); });
  }
  function roomLeave() {
    var R = P.room; if (!R) return;
    clearTimeout(R.timer);
    if (R.joined) sig('leave');
    if (R.pc) try { R.pc.close(); } catch (e) {}
    if (R.local) R.local.getTracks().forEach(function (tr) { tr.stop(); });
    P.room = null;
  }
  window.addEventListener('beforeunload', function () { if (P.room && P.room.joined && navigator.sendBeacon) { /* best effort */ roomLeave(); } });

  // ---------------------------------------------------------------- lab page
  N.PAGES.lab = function (_, q) {
    var lab = C().lab || {}, tests = N.vis(lab.tests), cats = [];
    tests.forEach(function (x) { if (cats.indexOf(x.category) < 0) cats.push(x.category); });
    var sel = P.lab.sel, chosen = tests.filter(function (x) { return sel[x.id]; });
    var total = chosen.reduce(function (s, x) { return s + (+x.price || 0); }, 0), allPriced = chosen.every(function (x) { return +x.price > 0; });
    var fee = +lab.homeCollectionFee || 0;
    return head(T('labTests'), L(lab.intro), T('labTests')) + '<section class="section"><div class="container"><div class="split" style="align-items:start;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">' +
      '<div><div class="home-search" style="margin-bottom:16px">' + icon('search', ' width="18" height="18" style="color:var(--muted);flex:none"') + '<input type="search" id="labQ" placeholder="' + esc(t('Search a test (e.g. sugar, thyroid, CBC)', 'जाँच खोज्नुहोस्')) + '" value="' + esc(P.lab.q || '') + '"></div>' +
      (L(lab.note) ? '<p class="small muted">' + esc(L(lab.note)) + '</p>' : '') +
      cats.map(function (c) { return '<div class="lab-cat" style="margin-bottom:18px"><h3>' + esc(c) + '</h3><div class="testlist">' + tests.filter(function (x) { return x.category === c; }).map(function (x) {
        return '<label data-test="' + esc((x.name + ' ' + c).toLowerCase()) + '"><input type="checkbox" data-pchange="lab-pick" value="' + esc(x.id) + '"' + (sel[x.id] ? ' checked' : '') + '><span><b style="font-weight:600">' + esc(x.name) + '</b><small>' + esc(x.sample || '') + (x.fasting ? ' · ' + t('fasting needed', 'खाली पेट') : '') + '</small></span><span class="pr">' + (+x.price ? 'Rs ' + esc(x.price) : '') + '</span></label>';
      }).join('') + '</div></div>'; }).join('') + '</div>' +
      '<aside class="cart"><div class="card" id="labCart"><h2 style="font-size:1.2rem">' + esc(t('Your tests', 'तपाईंका जाँच')) + ' (' + chosen.length + ')</h2>' +
      (chosen.length ? '<ul style="padding-left:18px;margin:0 0 10px">' + chosen.map(function (x) { return '<li>' + esc(x.name) + (+x.price ? ' — Rs ' + esc(x.price) : '') + '</li>'; }).join('') + '</ul>' + (fee ? '<p class="small" style="margin:0">' + esc(t('Home collection', 'घरमै संकलन')) + ': Rs ' + fee + '</p>' : '') +
        '<p style="margin:6px 0 12px"><b>' + esc(t('Total', 'जम्मा')) + ':</b> <span class="amount" style="font-size:1.2rem">' + (allPriced ? 'Rs ' + (total + fee) : esc(t('confirmed by the lab', 'ल्याबले पुष्टि गर्छ'))) + '</span></p>' : '<p class="muted small">' + esc(t('Tick the tests you need.', 'चाहिने जाँचमा टिक लगाउनुहोस् ।')) + '</p>') +
      (chosen.length ? labForm(allPriced ? total + fee : null) : '') + '</div><p class="small muted" style="margin-top:10px">' + esc(t('You can also come to the lab any time — it is open 24 hours.', 'ल्याब २४ घण्टा खुला छ ।')) + '</p></aside></div></div></section>';
  };
  function labForm(amount) {
    var gate = needPatient('#/lab'); if (gate) return gate;
    var lab = C().lab || {}, slots = lab.collectionSlots || [];
    var tomorrow = N.S.ymd(new Date(Date.now() + 345 * 60e3 + 864e5));
    return '<form class="form-grid" data-pform="lab"><label class="f">' + esc(t('Collection date', 'संकलन मिति')) + '<input type="date" name="date" min="' + N.today() + '" value="' + tomorrow + '" required></label>' +
      (slots.length ? '<label class="f">' + esc(t('Time', 'समय')) + '<select name="slot">' + slots.map(function (s) { return opt(s, s); }).join('') + '</select></label>' : '') +
      '<label class="f">' + esc(t('Address for collection', 'संकलन ठेगाना')) + '<textarea name="address" rows="2" required>' + esc((P.me.profile || {}).address || '') + '</textarea></label>' +
      '<label class="f">' + esc(t('Mobile number', 'मोबाइल नम्बर')) + '<input name="phone" type="tel" value="' + esc((P.me.profile || {}).phone || '') + '" required></label>' +
      '<fieldset style="border:0;padding:0;margin:0"><legend class="f" style="font-weight:600;margin-bottom:6px">' + esc(t('Payment', 'भुक्तानी')) + '</legend><label class="check"><input type="radio" name="payMethod" value="onsite" checked data-pchange="lab-pay"> ' + esc(t('Pay when the lab staff come', 'ल्याब कर्मचारी आउँदा तिर्ने')) + '</label><label class="check"><input type="radio" name="payMethod" value="online" data-pchange="lab-pay"> ' + esc(t('Pay now by Fonepay / eSewa', 'अहिले फोनपे / इसेवाबाट तिर्ने')) + '</label></fieldset>' +
      '<div id="labPay" hidden>' + payBox(amount, t('Lab tests', 'ल्याब जाँच')) + '<label class="f" style="margin-top:10px">' + esc(t('Payment receipt (screenshot or PDF)', 'भुक्तानी रसिद')) + '<input type="file" name="receipt" accept="image/*,application/pdf"></label></div>' +
      '<label class="f">' + esc(t('Note (optional)', 'टिप्पणी')) + '<input name="note"></label><button class="btn" type="submit">' + esc(t('Book home collection', 'घरमै संकलन बुक')) + '</button><div class="msg" role="status"></div></form>';
  }

  // ------------------------------------------------------- health check-up packages
  N.PAGES.packages = function (id) {
    var list = N.vis(C().packages);
    if (id) {
      var p = list.find(function (x) { return x.id === id; }); if (!p) return N.notFound();
      var gate = needPatient('#/packages/' + id);
      return head(L(p.name), L(p.description), T('packages')) + section('<div class="split" style="align-items:start"><div class="card"><h2 style="font-size:1.2rem">' + esc(t('What is included', 'के के समावेश')) + '</h2><ul>' + (p.tests || []).map(function (x) { return '<li>' + esc(L(x)) + '</li>'; }).join('') + '</ul>' + (L(p.forWhom) ? '<p class="muted small">' + esc(t('For', 'कसका लागि')) + ': ' + esc(L(p.forWhom)) + '</p>' : '') + '<p class="amount">' + (p.price ? 'Rs ' + esc(p.price) : esc(t('Price at the hospital', 'मूल्य अस्पतालमा'))) + '</p></div>' +
        '<div>' + (gate || '<form class="card form-grid" data-pform="request" data-kind="package"><input type="hidden" name="packageId" value="' + esc(p.id) + '"><h2 style="font-size:1.2rem;margin:0">' + esc(t('Book this check-up', 'यो जाँच बुक गर्नुहोस्')) + '</h2><label class="f">' + esc(t('Preferred date', 'मिति')) + '<input type="date" name="date" min="' + N.today() + '" required></label><label class="f">' + esc(t('Mobile number', 'मोबाइल')) + '<input name="phone" type="tel" value="' + esc((P.me.profile || {}).phone || '') + '" required></label><label class="f">' + esc(t('Note (optional)', 'टिप्पणी')) + '<input name="details"></label><p class="small muted" style="margin:0">' + esc(t('Come fasting (8–10 hours, water is fine) unless the hospital tells you otherwise. Pay at the hospital.', 'खाली पेट आउनुहोस् । भुक्तानी अस्पतालमा ।')) + '</p><button class="btn" type="submit">' + esc(t('Book', 'बुक')) + '</button><div class="msg" role="status"></div></form>') + '</div></div>', 1000);
    }
    return head(T('packages'), t('Preventive check-ups for you and your family', 'तपाईं र परिवारका लागि स्वास्थ्य जाँच'), T('packages')) + section('<div class="grid g3">' + list.map(function (p, i) {
      return '<div class="card svc' + (i === 0 ? ' feature' : '') + '"><span class="ic">' + icon('box') + '</span><h3>' + esc(L(p.name)) + '</h3><p>' + esc(L(p.description)) + '</p><ul class="small" style="margin:0;padding-left:18px">' + (p.tests || []).slice(0, 6).map(function (x) { return '<li>' + esc(L(x)) + '</li>'; }).join('') + '</ul><p style="margin:6px 0 0;font-weight:800;font-size:1.2rem">' + (p.price ? 'Rs ' + esc(p.price) : esc(t('Price at the hospital', 'मूल्य अस्पतालमा'))) + '</p><a class="btn sm' + (i === 0 ? ' light' : '') + '" href="#/packages/' + esc(p.id) + '">' + esc(t('Book', 'बुक')) + '</a></div>';
    }).join('') + '</div>');
  };

  // ----------------------------------------------- refill, second opinion (signed-in patients)
  N.PAGES.refill = function () {
    var gate = needPatient('#/refill');
    return head(T('refill'), t('Upload your prescription and our 24-hour pharmacy prepares your medicines.', 'प्रेस्क्रिप्सन अपलोड गर्नुहोस्, फार्मेसीले औषधि तयार गर्छ ।')) + section(gate || '<form class="card form-grid" data-pform="request" data-kind="refill">' +
      '<label class="f">' + esc(t('Prescription (photo or PDF)', 'प्रेस्क्रिप्सन (फोटो वा PDF)')) + '<input type="file" name="files" accept="image/*,application/pdf" multiple></label>' +
      '<label class="f">' + esc(t('Medicines and how many (if no prescription)', 'औषधि र संख्या')) + '<textarea name="medicines" placeholder="e.g. Metformin 500 mg – 60 tablets"></textarea></label>' +
      '<div class="two"><label class="f">' + esc(t('How do you want it?', 'कसरी लिने?')) + '<select name="delivery">' + opt('pickup', t('I will pick it up', 'आफैं लिन आउँछु')) + opt('delivery', t('Home delivery (Hetauda area, charges may apply)', 'घरमै डेलिभरी (हेटौंडा)')) + '</select></label><label class="f">' + esc(t('Mobile number', 'मोबाइल')) + '<input name="phone" type="tel" value="' + esc(((P.me || {}).profile || {}).phone || '') + '" required></label></div>' +
      '<label class="f">' + esc(t('Address (for delivery)', 'ठेगाना')) + '<input name="address" value="' + esc(((P.me || {}).profile || {}).address || '') + '"></label>' +
      '<p class="small muted" style="margin:0">' + esc(t('The pharmacy will call you with the price and when it is ready. Prescription medicines are given only with a valid prescription.', 'फार्मेसीले मूल्य र समय बताउन फोन गर्नेछ ।')) + '</p><button class="btn" type="submit">' + esc(t('Send to pharmacy', 'फार्मेसीमा पठाउनुहोस्')) + '</button><div class="msg" role="status"></div></form>', 720);
  };
  N.PAGES['second-opinion'] = function () {
    var gate = needPatient('#/second-opinion');
    var docs = N.doctors().filter(function (d) { return d.videoConsult !== false; });
    return head(T('secondOpinion'), t('Share your reports and get a written review from a NIKO specialist.', 'रिपोर्ट पठाउनुहोस्, विशेषज्ञको लिखित राय पाउनुहोस् ।')) + section(gate || '<form class="card form-grid" data-pform="request" data-kind="second">' +
      '<label class="f">' + esc(t('Doctor (optional)', 'डाक्टर (ऐच्छिक)')) + '<select name="doctorId">' + opt('', t('Let the hospital choose the right specialist', 'अस्पतालले छान्ने')) + docs.map(function (d) { return opt(d.id, L(d.name) + ' — ' + L(d.title)); }).join('') + '</select></label>' +
      '<label class="f">' + esc(t('Your question', 'तपाईंको प्रश्न')) + '<textarea name="question" required placeholder="' + esc(t('What do you want the specialist to review?', 'विशेषज्ञले के हेर्नुपर्छ?')) + '"></textarea></label>' +
      '<label class="f">' + esc(t('Short history (illness, treatment so far, medicines)', 'छोटो इतिहास')) + '<textarea name="history"></textarea></label>' +
      '<label class="f">' + esc(t('Reports, scans, prescriptions (photos or PDF, up to 5)', 'रिपोर्ट (५ वटासम्म)')) + '<input type="file" name="files" accept="image/*,application/pdf" multiple></label>' +
      '<p class="small muted" style="margin:0">' + esc(t('A second opinion is advice based on your documents. It does not replace an examination. The hospital will tell you the fee, if any, before the review.', 'यो कागजातमा आधारित सल्लाह हो ।')) + '</p><button class="btn" type="submit">' + esc(t('Send', 'पठाउनुहोस्')) + '</button><div class="msg" role="status"></div></form>', 760);
  };

  // ------------------------------------------------------ grievance & incident (public)
  N.PAGES.grievance = function () {
    var g = C().grievance || {};
    return head(T('grievance'), L(g.intro)) + section('<div class="split" style="align-items:start"><div class="card"><span class="eyebrow">' + esc(L(g.designation)) + '</span><h2 style="font-size:1.3rem">' + esc(g.officerName || t('Information & Grievance Officer', 'सूचना तथा गुनासो अधिकारी')) + '</h2>' +
      '<dl class="kv">' + (g.phone ? '<dt>' + esc(t('Phone', 'फोन')) + '</dt><dd><a href="' + N.tel(g.phone) + '">' + esc(g.phone) + '</a></dd>' : '') + (g.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(g.email) + '">' + esc(g.email) + '</a></dd>' : '') + '</dl>' +
      '<p class="small muted" style="margin-top:12px">' + esc(t('You can also report a safety concern or incident confidentially:', 'सुरक्षासम्बन्धी घटना गोप्य रूपमा जानकारी दिन:')) + ' <a href="#/incident">' + esc(T('reportIncident')) + '</a></p></div>' +
      '<form class="card form-grid" data-pform="request" data-kind="grievance"><h2 style="font-size:1.2rem;margin:0">' + esc(t('Send a complaint or request information', 'गुनासो वा सूचना माग')) + '</h2>' +
      '<label class="f">' + esc(t('Type', 'प्रकार')) + '<select name="category">' + opt('complaint', t('Complaint', 'गुनासो')) + opt('information', t('Request for information', 'सूचना माग')) + opt('suggestion', t('Suggestion', 'सुझाव')) + '</select></label>' +
      '<label class="f">' + esc(t('Subject', 'विषय')) + '<input name="subject" required></label><label class="f">' + esc(t('Details', 'विवरण')) + '<textarea name="details" required></textarea></label>' +
      '<div class="two"><label class="f">' + esc(t('Name', 'नाम')) + '<input name="name" value="' + esc(((P.me || {}).profile || {}).name || '') + '"></label><label class="f">' + esc(t('Phone', 'फोन')) + '<input name="phone" type="tel" value="' + esc(((P.me || {}).profile || {}).phone || '') + '"></label></div>' +
      '<label class="f">Email<input name="email" type="email" value="' + esc((P.me || {}).email || '') + '"></label><input name="website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="f">' + esc(t('Attach a photo or document (optional)', 'फोटो/कागजात (ऐच्छिक)')) + '<input type="file" name="files" accept="image/*,application/pdf"></label><button class="btn" type="submit">' + esc(t('Send', 'पठाउनुहोस्')) + '</button><div class="msg" role="status"></div></form></div>', 1100);
  };
  N.PAGES.incident = function () {
    return head(T('reportIncident'), t('Tell us about anything that harmed, or could have harmed, a patient, visitor or staff member. Reports go to the Director.', 'बिरामी, आगन्तुक वा कर्मचारीलाई हानि भएको वा हुन सक्ने घटनाबारे जानकारी दिनुहोस् ।')) + section('<form class="card form-grid" data-pform="request" data-kind="incident">' +
      '<div class="two"><label class="f">' + esc(t('When did it happen?', 'कहिले भयो?')) + '<input name="when" type="datetime-local"></label><label class="f">' + esc(t('Where?', 'कहाँ?')) + '<input name="where" placeholder="' + esc(t('Ward, OPD, lab, pharmacy…', 'वार्ड, ओपीडी, ल्याब…')) + '"></label></div>' +
      '<label class="f">' + esc(t('Type', 'प्रकार')) + '<select name="category">' + ['Medication error', 'Fall or injury', 'Infection risk', 'Equipment problem', 'Communication problem', 'Behaviour', 'Other'].map(function (x) { return opt(x, x); }).join('') + '</select></label>' +
      '<label class="f">' + esc(t('What happened?', 'के भयो?')) + '<textarea name="details" required></textarea></label>' +
      '<label class="check"><input type="checkbox" name="anonymous" value="1"> ' + esc(t('Send without my name (anonymous)', 'नाम नखुलाई पठाउनुहोस्')) + '</label>' +
      '<div class="two"><label class="f">' + esc(t('Name (optional)', 'नाम')) + '<input name="name" value="' + esc(((P.me || {}).profile || {}).name || '') + '"></label><label class="f">' + esc(t('Phone (optional)', 'फोन')) + '<input name="phone" type="tel" value="' + esc(((P.me || {}).profile || {}).phone || '') + '"></label></div>' +
      '<input name="website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true"><label class="f">' + esc(t('Photo or document (optional)', 'फोटो (ऐच्छिक)')) + '<input type="file" name="files" accept="image/*,application/pdf"></label>' +
      '<p class="small muted" style="margin:0">' + esc(t('For emergencies, call 057-520223 now.', 'आकस्मिक अवस्थामा ०५७-५२०२२३ मा फोन गर्नुहोस् ।')) + '</p><button class="btn" type="submit">' + esc(t('Send report', 'पठाउनुहोस्')) + '</button><div class="msg" role="status"></div></form>', 760);
  };

  // ------------------------------------------------------------- health risk check
  // Indian Diabetes Risk Score (IDRS, Mohan et al. 2005) and a blood-pressure reading guide.
  N.PAGES.risk = function () {
    function q(name, label, opts) { return '<div class="risk-q"><b>' + esc(label) + '</b><div class="opts">' + opts.map(function (o, i) { return '<label><input type="radio" name="' + name + '" value="' + o[1] + '"' + (i === 0 ? ' required' : '') + '> ' + esc(o[0]) + '</label>'; }).join('') + '</div></div>'; }
    return head(T('riskCheck'), t('Two quick self-checks. They do not replace a doctor’s check-up.', 'दुई छिटो स्व-जाँच । यो डाक्टरको जाँचको विकल्प होइन ।')) + '<section class="section"><div class="container"><div class="split" style="align-items:start">' +
      '<form class="card" data-pform="idrs"><span class="eyebrow">IDRS</span><h2 style="font-size:1.3rem">' + esc(t('Diabetes risk', 'मधुमेहको जोखिम')) + '</h2>' +
      q('age', t('Age', 'उमेर'), [[t('Under 35 years', '३५ वर्षमुनि'), 0], ['35–49', 20], [t('50 or older', '५० वा माथि'), 30]]) +
      q('waist', t('Waist (measure at the belly button)', 'कम्मरको नाप (नाभिमा)'), [[t('Women under 80 cm (31.5 in) / Men under 90 cm (35.5 in)', 'महिला ८० सेमी / पुरुष ९० सेमीभन्दा कम'), 0], [t('Women 80–89 cm / Men 90–99 cm', 'महिला ८०–८९ / पुरुष ९०–९९ सेमी'), 10], [t('Women 90 cm or more / Men 100 cm or more', 'महिला ९० / पुरुष १०० सेमी वा बढी'), 20]]) +
      q('act', t('Physical activity', 'शारीरिक गतिविधि'), [[t('Regular exercise or hard physical work', 'नियमित व्यायाम वा कडा शारीरिक काम'), 0], [t('Some exercise or physical work', 'केही व्यायाम वा काम'), 20], [t('No exercise and sitting work', 'व्यायाम नगर्ने, बसेर काम'), 30]]) +
      q('fam', t('Parents with diabetes', 'आमाबुबामा मधुमेह'), [[t('Neither', 'कोही पनि छैन'), 0], [t('One parent', 'एक जना'), 10], [t('Both parents', 'दुवै'), 20]]) +
      '<button class="btn" type="submit">' + esc(t('See my score', 'मेरो स्कोर')) + '</button><div class="msg" role="status" style="margin-top:14px"></div></form>' +
      '<form class="card" data-pform="bp"><span class="eyebrow">BP</span><h2 style="font-size:1.3rem">' + esc(t('What does my blood pressure mean?', 'मेरो रक्तचापको अर्थ')) + '</h2><p class="small muted">' + esc(t('Sit quietly for 5 minutes, then measure. Enter the two numbers.', '५ मिनेट आराम गरी नाप्नुहोस् ।')) + '</p>' +
      '<div class="form-grid"><div class="two"><label class="f">' + esc(t('Top number (systolic)', 'माथिल्लो (सिस्टोलिक)')) + '<input name="sys" inputmode="numeric" required></label><label class="f">' + esc(t('Bottom number (diastolic)', 'तल्लो (डायस्टोलिक)')) + '<input name="dia" inputmode="numeric" required></label></div><button class="btn" type="submit">' + esc(t('Check', 'जाँच्नुहोस्')) + '</button><div class="msg" role="status"></div></div></form></div></div></section>';
  };

  // ---------------------------------------------------------------- events
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-pact]'); if (!el) return;
    var a = el.getAttribute('data-pact'), id = el.getAttribute('data-id');
    function done(m) { toast(m || t('Saved', 'सेभ भयो')); reload(); }
    function err(x) { toast(x.message); }
    switch (a) {
      case 'auth-mode': P.auth.mode = el.getAttribute('data-m'); P.auth.touched = true; $('#authBox').innerHTML = authHTML(); var i1 = $('#authBox input'); if (i1) i1.focus(); break;
      case 'logout': api('POST', 'api/acct/logout', {}).then(function () { P.me = null; window.NIKO_ACCT = null; location.hash = '#/'; N.renderAll(); }); break;
      case 'read-all': api('POST', 'api/p/notes/read', {}).then(function () { P.me.unread = 0; refreshChrome(); reload(); }); break;
      case 'note-del': if (confirm(t('Delete this message for everyone?', 'सबैका लागि मेटाउने?'))) api('DELETE', 'api/p/notes/' + id).then(function () { done(); }).catch(err); break;
      case 'jump': e.preventDefault(); var tg = document.getElementById(el.getAttribute('data-t')); if (tg) tg.scrollIntoView({ behavior: 'smooth' }); break;
      case 'c-doc': P.consult.doctorId = id; P.consult.step = 2; P.consult.date = ''; P.consult.time = ''; drawConsult('.dates button'); $('#cwiz').scrollIntoView({ block: 'start' }); break;
      case 'c-date': P.consult.date = el.getAttribute('data-d'); P.consult.time = '';
        api('GET', 'api/p/consult/taken?doctor=' + encodeURIComponent(P.consult.doctorId) + '&date=' + P.consult.date).then(function (j) { P.consult.taken = j.taken || []; drawConsult('.slots button:not([disabled])'); }).catch(function () { P.consult.taken = []; drawConsult(); }); break;
      case 'c-time': P.consult.time = el.getAttribute('data-t'); drawConsult('[data-pact=c-next]'); break;
      case 'c-next': P.consult.step = 3; drawConsult('textarea'); break;
      case 'c-back': P.consult.step = Math.max(1, P.consult.step - 1); drawConsult(); break;
      case 'c-remind': case 'r-remind':
        var cid = id || (P.room && P.room.consult.id);
        api('POST', 'api/p/consults/' + cid + '/remind', {}).then(function (j) { toast(j.emailed ? t('Join link emailed to the patient', 'बिरामीलाई लिङ्क इमेल गरियो') : t('Shown on the patient’s dashboard (email not sent)', 'ड्यासबोर्डमा देखाइयो')); }).catch(err); break;
      case 'c-status': api('POST', 'api/p/consults/' + id + '/status', { status: el.getAttribute('data-s') }).then(function () { done(); }).catch(err); break;
      case 'c-verify': var note = $('[data-note="' + id + '"]'); api('POST', 'api/p/consults/' + id + '/verify', { ok: !!el.getAttribute('data-ok'), note: note ? note.value : '' }).then(function () { done(el.getAttribute('data-ok') ? t('Confirmed — doctor, Director and patient were told', 'पुष्टि भयो') : t('Patient was told', 'बिरामीलाई जानकारी दिइयो')); }).catch(err); break;
      case 'lo-pay': api('PATCH', 'api/p/lab/orders/' + id, { payOk: !!el.getAttribute('data-ok') }).then(function () { done(); }).catch(err); break;
      case 'lo-paid': api('PATCH', 'api/p/lab/orders/' + id, { payStatus: 'paid' }).then(function () { done(); }).catch(err); break;
      case 'lo-results':
        var o = (P.cache.lab.online || []).find(function (x) { return x.id === id; }), box = $('#lo-' + id + ' .lo-ed');
        var rows = o.rows && o.rows.length ? o.rows : o.tests.map(function (x) { return { param: x.name, val: '', unit: '', ref: '' }; });
        box.innerHTML = resultsTable(rows) + '<label class="f" style="margin-top:10px">' + esc(t('Note', 'टिप्पणी')) + '<input data-lnote value="' + esc(o.resultNote || '') + '"></label><div class="acts"><label class="btn xs ghost" style="cursor:pointer">' + icon('upload') + esc(o.reportFile ? t('Replace report PDF', 'PDF बदल्नुहोस्') : t('Attach report PDF', 'PDF जोड्नुहोस्')) + '<input type="file" hidden accept="application/pdf,image/*" data-pchange="lo-file" data-id="' + esc(id) + '"></label>' + (o.reportFile ? fileLink(o.reportFile) : '') +
          '<button class="btn xs ghost" data-pact="lo-save" data-id="' + esc(id) + '">' + esc(t('Save draft', 'ड्राफ्ट सेभ')) + '</button><button class="btn xs green" data-pact="lo-save" data-done="1" data-id="' + esc(id) + '">' + esc(t('Send report to patient', 'बिरामीलाई रिपोर्ट पठाउनुहोस्')) + '</button></div>';
        break;
      case 'lo-save':
        var bx = $('#lo-' + id + ' .lo-ed'), body = { rows: readRows(bx), resultNote: ($('[data-lnote]', bx) || {}).value || '' };
        if (el.getAttribute('data-done')) body.status = 'done';
        api('PATCH', 'api/p/lab/orders/' + id, body).then(function () { done(body.status ? t('Report sent to the patient', 'रिपोर्ट पठाइयो') : t('Saved', 'सेभ भयो')); }).catch(err); break;
      case 'row-add': var tb = el.parentNode.querySelector('tbody') || el.previousElementSibling.querySelector('tbody'); var n = tb.children.length; tb.insertAdjacentHTML('beforeend', '<tr data-row="' + n + '"><td><input data-k="param"></td><td><input data-k="val"></td><td><input data-k="unit" style="max-width:90px"></td><td><input data-k="ref"></td><td><select data-k="flag" style="min-height:38px"><option value="">—</option><option>H</option><option>L</option><option>Abn</option></select></td></tr>'); break;
      case 'opd-open':
        var doc = el.getAttribute('data-doc'), pid = el.getAttribute('data-pid'), ed = document.getElementById('opd-' + doc + '-' + pid);
        api('GET', 'api/p/lab/opd/' + encodeURIComponent(doc) + '/' + encodeURIComponent(pid)).then(function (j) {
          var ord = j.order, rws = ord.rows.length ? ord.rows : ord.orderText.split(/[,\n;+]/).map(function (x) { return { param: x.trim(), val: '', unit: '', ref: '' }; }).filter(function (r) { return r.param; });
          ed.innerHTML = resultsTable(rws) + '<label class="f" style="margin-top:10px">' + esc(t('Note to the doctor', 'डाक्टरलाई टिप्पणी')) + '<input data-lnote value="' + esc(ord.note || '') + '"></label><div class="acts"><button class="btn xs ghost" data-pact="opd-save" data-doc="' + esc(doc) + '" data-pid="' + esc(pid) + '">' + esc(t('Save draft', 'ड्राफ्ट सेभ')) + '</button><button class="btn xs green" data-pact="opd-save" data-done="1" data-doc="' + esc(doc) + '" data-pid="' + esc(pid) + '">' + esc(t('Send results to the doctor', 'डाक्टरलाई नतिजा पठाउनुहोस्')) + '</button></div>';
        }).catch(err); break;
      case 'opd-save':
        var d2 = el.getAttribute('data-doc'), p2 = el.getAttribute('data-pid'), e2 = document.getElementById('opd-' + d2 + '-' + p2);
        api('PUT', 'api/p/lab/opd/' + encodeURIComponent(d2) + '/' + encodeURIComponent(p2), { rows: readRows(e2), note: ($('[data-lnote]', e2) || {}).value || '', done: !!el.getAttribute('data-done') })
          .then(function (j) { done(j.orderChanged ? t('The doctor added tests — please fill them too', 'डाक्टरले जाँच थप्नुभयो') : el.getAttribute('data-done') ? t('Results sent to the doctor', 'नतिजा पठाइयो') : t('Saved', 'सेभ भयो')); }).catch(err); break;
      case 'inbox-assign':
        var pickId = el.getAttribute('data-pick'), pidv = el.getAttribute('data-pid') || (pickId ? ($('[data-pps="' + pickId + '"]') || {}).value : '');
        if (!pidv) { toast(t('Choose a patient first', 'पहिले बिरामी छान्नुहोस्')); break; }
        api('POST', 'api/p/lab/inbox/' + id, { patientId: pidv }).then(function () { done(t('Report given to the patient', 'रिपोर्ट बिरामीलाई दिइयो')); }).catch(err); break;
      case 'inbox-discard': if (confirm(t('Remove this item?', 'हटाउने?'))) api('POST', 'api/p/lab/inbox/' + id, { discard: true }).then(function () { done(); }).catch(err); break;
      case 'req-filter': P.reqFilter = el.getAttribute('data-k'); reload(); break;
      case 'req-reply': var ta = $('[data-reply="' + id + '"]'); if (!ta.value.trim()) break; api('POST', 'api/p/requests/' + id, { reply: ta.value, status: 'in-progress' }).then(function () { done(t('Reply sent', 'जवाफ पठाइयो')); }).catch(err); break;
      case 'to-add': if (!P.sendTo.some(function (p) { return p.id === id; })) P.sendTo.push({ id: id, name: el.getAttribute('data-n') }); drawSendTo(); break;
      case 'to-remove': P.sendTo = P.sendTo.filter(function (p) { return p.id !== id; }); drawSendTo(); break;
      case 'acct-set': api('PATCH', 'api/acct/admin/accounts/' + id, { status: el.getAttribute('data-s') }).then(function () { done(); fetchMe(); }).catch(err); break;
      case 'acct-save':
        var f = $('[data-acct="' + id + '"]'), body2 = { roles: $$('[data-role]', f).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-role'); }) };
        $$('[data-k]', f).forEach(function (x) { body2[x.getAttribute('data-k')] = x.multiple ? $$('option', x).filter(function (o) { return o.selected; }).map(function (o) { return o.value; }) : x.value; });
        api('PATCH', 'api/acct/admin/accounts/' + id, body2).then(function () { done(); }).catch(err); break;
      case 'edit-decide': var nt = $('[data-note="' + id + '"]'); api('POST', 'api/p/approvals/edit/' + id, { approve: !!el.getAttribute('data-ok'), note: nt ? nt.value : '' }).then(function () { done(el.getAttribute('data-ok') ? t('Published on the website', 'वेबसाइटमा प्रकाशित') : t('Rejected', 'अस्वीकृत')); }).catch(err); break;
      case 'r-join': roomJoin(); break;
      case 'r-mic': var at = P.room.local.getAudioTracks()[0]; at.enabled = !at.enabled; el.classList.toggle('off', !at.enabled); el.innerHTML = icon(at.enabled ? 'mic' : 'micoff'); break;
      case 'r-cam': var vt = P.room.local.getVideoTracks()[0]; vt.enabled = !vt.enabled; el.classList.toggle('off', !vt.enabled); el.innerHTML = icon(vt.enabled ? 'video' : 'camoff'); break;
      case 'r-end': var rid = P.room.id; roomLeave(); $('#roomBox').innerHTML = '<div class="done-box card"><h2>' + esc(t('Call ended', 'कल समाप्त')) + '</h2><p><a class="btn" href="#/room/' + esc(rid) + '" data-pact="r-rejoin">' + esc(t('Rejoin', 'फेरि जोडिनुहोस्')) + '</a> <a class="btn ghost" href="#/dashboard/consults">' + esc(T('dashboard')) + '</a></p></div>'; break;
      case 'r-rejoin': e.preventDefault(); roomInit(location.hash.split('/')[2]); break;
      case 'r-complete': var nts = ($('#docNotes') || {}).value || ''; api('POST', 'api/p/consults/' + P.room.consult.id + '/status', { status: 'completed', notes: nts }).then(function () { roomLeave(); toast(t('Marked completed', 'सम्पन्न भयो')); location.hash = '#/dashboard/consults'; }).catch(err); break;
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, a = el.getAttribute('data-pchange');
    if (el.closest('[data-pform=profile]') && el.name === 'type') { $('#fRole').hidden = el.value !== 'staff'; $('#fDoc').hidden = !(el.value === 'staff' && $('[name=staffRole]').value === 'doctor'); }
    if (a === 'prole') $('#fDoc').hidden = el.value !== 'doctor';
    if (a === 'lab-pick') { P.lab.sel[el.value] = el.checked; var y = window.scrollY; N.renderPage(false); window.scrollTo(0, y); }
    if (a === 'lab-pay') { var lp = $('#labPay'); if (lp) lp.hidden = el.value !== 'online'; }
    if (a === 'lo-status') api('PATCH', 'api/p/lab/orders/' + el.getAttribute('data-id'), { status: el.value }).then(function () { toast(t('Saved', 'सेभ भयो')); if (el.value === 'done') reload(); }).catch(function (x) { toast(x.message); reload(); });
    if (a === 'lo-file') { var fd = new FormData(); fd.append('file', el.files[0]); api('POST', 'api/p/lab/orders/' + el.getAttribute('data-id') + '/file', fd, true).then(function () { toast(t('Report attached', 'रिपोर्ट जोडियो')); reload(); }).catch(function (x) { toast(x.message); }); }
    if (a === 'req-status') api('POST', 'api/p/requests/' + el.getAttribute('data-id'), { status: el.value }).then(function () { toast(t('Saved', 'सेभ भयो')); });
    if (a === 'docphoto' && el.files[0]) { var f2 = new FormData(); f2.append('file', el.files[0]); api('POST', 'api/p/photo', f2, true).then(function (j) { $('[data-pform=docprofile] [name=photo]').value = j.url; $('#docPhotoPrev').src = j.url; }).catch(function (x) { toast(x.message); }); }
    if (el.hasAttribute('data-pf')) { P.peopleFilter = P.peopleFilter || { q: '', type: 'staff' }; P.peopleFilter[el.getAttribute('data-pf')] = el.value; TABS.people(); }
    if (el.getAttribute('data-people') === 'type') searchPeople(($('[data-people=q]') || {}).value);
  });
  var ppT;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'labQ') { P.lab.q = el.value; var q = el.value.toLowerCase().trim(); $$('[data-test]').forEach(function (l) { l.hidden = q && l.getAttribute('data-test').indexOf(q) < 0; }); $$('.lab-cat').forEach(function (c) { c.hidden = !$$('[data-test]', c).some(function (l) { return !l.hidden; }); }); }
    if (el.getAttribute('data-people') === 'q') searchPeople(el.value);
    if (el.hasAttribute('data-ppq')) {
      clearTimeout(ppT); var key = el.getAttribute('data-ppq');
      ppT = setTimeout(function () { api('GET', 'api/p/people?type=patient&q=' + encodeURIComponent(el.value)).then(function (list) { var s = $('[data-pps="' + key + '"]'); s.innerHTML = '<option value="">— ' + list.length + ' —</option>' + list.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name + (p.age ? ', ' + p.age : '') + (p.phone ? ' · ' + p.phone : '')) + '</option>'; }).join(''); if (list.length === 1) s.value = list[0].id; }); }, 250);
    }
    if (el.hasAttribute('data-pf') && el.type === 'search') { clearTimeout(ppT); ppT = setTimeout(function () { P.peopleFilter = P.peopleFilter || { q: '', type: 'staff' }; P.peopleFilter.q = el.value; TABS.people(); setTimeout(function () { var s = $('[data-pf=q]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 50); }, 350); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-pform'); if (!kind) return;
    e.preventDefault();
    var btn = $('button[type=submit]', f), data = {};
    new FormData(f).forEach(function (v, k) { if (typeof v === 'string') { if (data[k] !== undefined) data[k] = [].concat(data[k], v); else data[k] = v; } });
    function fail(err) { msgBox(f, err.message || err); if (btn) btn.disabled = false; if (err.login) location.hash = '#/login?next=' + encodeURIComponent(location.hash); }
    function ok(m) { msgBox(f, m, true); if (btn) btn.disabled = false; }
    if (btn) btn.disabled = true;
    if (kind === 'login') api('POST', 'api/acct/login', data).then(function (j) { P.authNext = P.auth.next; afterSignIn(j.account); }).catch(fail);
    else if (kind === 'code') api('POST', 'api/acct/code', data).then(function (j) { P.auth.email = data.email; P.auth.mode = 'code'; P.auth.devCode = j.devCode; $('#authBox').innerHTML = authHTML(); $('#authBox input').focus(); }).catch(fail);
    else if (kind === 'verify') api('POST', 'api/acct/verify', { email: P.auth.email, code: data.code }).then(function (j) { P.auth.setupToken = j.setupToken; P.auth.mode = 'password'; $('#authBox').innerHTML = authHTML(); $('#authBox input').focus(); }).catch(fail);
    else if (kind === 'setpw') { if (data.password !== data.password2) return fail(t('The two passwords are different', 'दुई पासवर्ड फरक छन्')); api('POST', 'api/acct/password', { setupToken: P.auth.setupToken, password: data.password }).then(function (j) { P.authNext = P.auth.next; afterSignIn(j.account); }).catch(fail); }
    else if (kind === 'profile') api('POST', 'api/acct/profile', data).then(function (j) {
      P.me = Object.assign(P.me || {}, j.account); window.NIKO_ACCT = P.me; fetchMe();
      var next = P.acctNext; if (next && next.charAt(0) === '/') { location.href = next; return; } toast(j.account.status === 'pending' ? t('Saved — waiting for the Director’s approval', 'सेभ भयो — स्वीकृतिको पर्खाइमा') : t('Saved', 'सेभ भयो'));
      location.hash = next || '#/dashboard'; N.renderAll();
    }).catch(fail);
    else if (kind === 'changepw') api('POST', 'api/acct/change-password', data).then(function () { f.reset(); ok(t('Password changed', 'पासवर्ड बदलियो')); }).catch(fail);
    else if (kind === 'docprofile') {
      var b = { title: { en: data.title_en, ne: data.title_ne }, bio: { en: data.bio_en, ne: data.bio_ne }, scheduleNote: { en: data.scheduleNote_en, ne: data.scheduleNote_ne }, degrees: data.degrees, nmc: data.nmc, affiliation: data.affiliation, gender: data.gender, languages: data.languages, focus: data.focus, hours: data.hours, photo: data.photo };
      api('POST', 'api/p/doctor-profile', b).then(function () { toast(t('Sent to the Director for approval', 'स्वीकृतिका लागि पठाइयो')); reload(); }).catch(fail);
    } else if (kind === 'send') {
      var body = { kind: data.kind, title: data.title, body: data.body, link: data.link, allStaff: !!data.allStaff, staff: [].concat(data.staff || []), users: P.sendTo.map(function (p) { return p.id; }) };
      api('POST', 'api/p/notes/send', body).then(function (j) { f.reset(); P.sendTo = []; drawSendTo(); ok(t('Sent to', 'पठाइयो') + ' ' + j.count + ' ' + t('people', 'जना')); }).catch(fail);
    } else if (kind === 'report-upload') {
      var fd = new FormData(f); fd.append('patientId', ($('[data-pps=up]') || {}).value || '');
      api('POST', 'api/p/reports/upload', fd, true).then(function () { f.reset(); ok(t('Report uploaded and patient told', 'रिपोर्ट अपलोड भयो')); }).catch(fail);
    } else if (kind === 'consult') {
      var w = P.consult, fd2 = new FormData(f);
      fd2.append('doctorId', w.doctorId); fd2.append('date', w.date); fd2.append('time', w.time);
      api('POST', 'api/p/consults', fd2, true).then(function (j) { w.done = j.consult; drawConsult(); window.scrollTo(0, 0); }).catch(function (er) {
        fail(er); if (er.status === 409) { w.step = 2; w.time = ''; api('GET', 'api/p/consult/taken?doctor=' + encodeURIComponent(w.doctorId) + '&date=' + w.date).then(function (j) { w.taken = j.taken; drawConsult(); }); }
      });
    } else if (kind === 'lab') {
      var fd3 = new FormData(f); fd3.append('tests', JSON.stringify(Object.keys(P.lab.sel).filter(function (k) { return P.lab.sel[k]; })));
      api('POST', 'api/p/lab/orders', fd3, true).then(function (j) {
        P.lab.sel = {};
        $('#labCart').innerHTML = '<div class="done-box"><div class="tick">' + icon('check') + '</div><h2>' + esc(t('Booked!', 'बुक भयो!')) + '</h2><div class="code">' + esc(j.order.code) + '</div><p style="margin-top:12px">' + esc(t('Our lab staff will call you before coming. Your report will appear in your account as a PDF.', 'ल्याब कर्मचारी आउनुअघि फोन गर्नुहुनेछ । रिपोर्ट खातामा आउनेछ ।')) + '</p><a class="btn" href="#/dashboard/lab">' + esc(t('My lab bookings', 'मेरा ल्याब बुकिङ')) + '</a></div>';
        $$('[data-pchange=lab-pick]').forEach(function (c) { c.checked = false; });
      }).catch(fail);
    } else if (kind === 'request') {
      var fd4 = new FormData(f); fd4.append('kind', f.getAttribute('data-kind'));
      api('POST', 'api/p/requests', fd4, true).then(function (j) {
        f.innerHTML = '<div class="done-box"><div class="tick">' + icon('check') + '</div><h2>' + esc(t('Sent. Thank you.', 'पठाइयो । धन्यवाद ।')) + '</h2>' + (j.code ? '<div class="code">' + esc(j.code) + '</div>' : '') + '<p style="margin-top:12px">' + esc(t('We will contact you soon.', 'हामी छिट्टै सम्पर्क गर्नेछौं ।')) + '</p>' + (P.me ? '<a class="btn" href="#/dashboard/requests">' + esc(t('My requests', 'मेरा अनुरोध')) + '</a>' : '') + '</div>';
      }).catch(fail);
    } else if (kind === 'idrs') {
      var sc = ['age', 'waist', 'act', 'fam'].reduce(function (s, k) { return s + (+data[k] || 0); }, 0);
      var lvl = sc >= 60 ? ['red', t('High risk', 'उच्च जोखिम'), t('Please get a fasting blood sugar or HbA1c test soon and see a doctor.', 'छिट्टै रगतमा चिनी जाँच गरी डाक्टरलाई देखाउनुहोस् ।')] : sc >= 30 ? ['amber', t('Moderate risk', 'मध्यम जोखिम'), t('A blood sugar test is a good idea. Walk 30 minutes a day and keep a healthy weight.', 'रगतमा चिनी जाँच गराउनुहोस् र दिनमा ३० मिनेट हिँड्नुहोस् ।')] : ['green', t('Low risk', 'कम जोखिम'), t('Keep active and check again every year.', 'सक्रिय रहनुहोस् र हरेक वर्ष जाँच गर्नुहोस् ।')];
      $('.msg', f).innerHTML = '<div class="meter"><i style="left:calc(' + Math.min(100, sc) + '% - 2px)"></i></div><p><b>' + esc(t('Your score', 'तपाईंको स्कोर')) + ': ' + sc + ' / 100</b> <span class="tag ' + lvl[0] + '">' + esc(lvl[1]) + '</span></p><p>' + esc(lvl[2]) + '</p><p style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm" href="#/lab">' + esc(T('labTests')) + '</a><a class="btn sm ghost" href="#/packages/diabetes">' + esc(T('packages')) + '</a></p>';
      if (btn) btn.disabled = false;
    } else if (kind === 'bp') {
      var s1 = +data.sys, d1 = +data.dia, r;
      if (!s1 || !d1) { fail(t('Enter both numbers', 'दुवै नम्बर लेख्नुहोस्')); return; }
      if (s1 >= 180 || d1 >= 120) r = ['red', t('Very high', 'अत्यधिक उच्च'), t('Measure again after 5 minutes. If it is still this high, or you have chest pain, breathlessness, weakness or headache, come to Emergency now or call 057-520223.', 'फेरि नाप्नुहोस् । उच्च भए तुरुन्त आकस्मिकमा आउनुहोस् ।')];
      else if (s1 >= 140 || d1 >= 90) r = ['red', t('High blood pressure', 'उच्च रक्तचाप'), t('See a doctor soon. Several high readings mean you may need treatment.', 'छिट्टै डाक्टरलाई देखाउनुहोस् ।')];
      else if (s1 >= 130 || d1 >= 80) r = ['amber', t('Raised', 'केही बढी'), t('Cut down salt, stay active and check again in a few weeks.', 'नुन कम गर्नुहोस्, सक्रिय रहनुहोस् ।')];
      else if (s1 < 90 || d1 < 60) r = ['amber', t('Low', 'कम'), t('If you feel dizzy or faint, see a doctor.', 'रिंगटा लागे डाक्टरलाई देखाउनुहोस् ।')];
      else r = ['green', t('Normal', 'सामान्य'), t('Good. Check once a year, or more often if a doctor advised.', 'राम्रो । वर्षमा एक पटक जाँच गर्नुहोस् ।')];
      $('.msg', f).innerHTML = '<p style="margin-top:10px"><span class="tag ' + r[0] + '">' + esc(r[1]) + '</span> <b>' + s1 + '/' + d1 + ' mmHg</b></p><p>' + esc(r[2]) + '</p><a class="btn sm" href="#/book">' + esc(T('book')) + '</a>';
      if (btn) btn.disabled = false;
    }
  });

  fetchMe().then(function () { var r = N.parseHash(); if (C() && ['dashboard', 'account', 'consult', 'lab', 'login', 'room', 'refill', 'second-opinion', 'packages'].indexOf(r.page) >= 0) N.renderPage(false); });
}());
