/* NIKO Hospital — doctor setup after sign-in, schedule and days off, visiting specialists' visit dates,
   settings page, doctors & schedules (Director), video call monitoring and the patient check page.
   Builds on portal.js through window.NIKO_SITE.portal. */
(function () {
  'use strict';
  var N = window.NIKO_SITE, X = N && N.portal;
  if (!X) return;
  var $ = N.$, $$ = N.$$, esc = N.esc, icon = N.icon, L = N.L, T = N.T, S = N.S;
  var P = X.P, api = X.api, TABS = X.TABS, D = X.D, t = X.t, opt = X.opt, toast = X.toast, fail = X.fail, when = X.when, fmt = X.fmt, status = X.status;
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYN = { Sun: ['Sunday', 'आइतबार'], Mon: ['Monday', 'सोमबार'], Tue: ['Tuesday', 'मंगलबार'], Wed: ['Wednesday', 'बुधबार'], Thu: ['Thursday', 'बिहीबार'], Fri: ['Friday', 'शुक्रबार'], Sat: ['Saturday', 'शनिबार'] };
  function dn(d) { return t(DAYN[d][0], DAYN[d][1]); }
  function C() { return N.C; }
  var W = null;     // doctor setup wizard / editor state
  var M = {};       // doctors & schedules (Director) state

  // ------------------------------------------------------------ dashboard tabs
  N.portalTabs = function (a, tabs) {
    var mgr = a.seesAll || (a.roles || []).indexOf('scheduler') >= 0, at = tabs.length - 1;
    if (mgr) tabs.splice(at, 0, ['doctors', 'cal', a.seesAll ? t('Doctors & schedules', 'डाक्टर र तालिका') : t('Visiting specialists', 'भ्रमण विशेषज्ञ')]);
    if (a.seesAll) tabs.splice(at + (mgr ? 1 : 0), 0, ['monitor', 'shield', t('Video call monitoring', 'भिडियो कल अनुगमन')]);
    return tabs;
  };
  // a doctor sees their own waiting details on the website (nobody else does)
  N.afterMe = function () {
    if (!P.me || !P.me.doctorId) { window.NIKO_PREVIEW = null; return Promise.resolve(); }
    return api('GET', 'api/d/preview').then(function (j) { window.NIKO_PREVIEW = j.fields ? j : null; }).catch(function () {});
  };
  N.afterRender.push(function (r) {
    if (r.page === 'setup') setupInit();
    if (r.page === 'check') checkInit(r.id);
    var pv = window.NIKO_PREVIEW;
    if (pv && pv.fields && r.page === 'doctor' && r.id === pv.doctorId) {
      var main = document.getElementById('main'), c = main && $('.container', main);
      if (c && !$('#pvBanner')) c.insertAdjacentHTML('afterbegin', '<p class="alert warn" id="pvBanner" style="margin-bottom:14px">' + esc(t('Waiting for approval — only you can see these new details. Patients still see the old ones.', 'स्वीकृतिको पर्खाइमा — यी नयाँ विवरण तपाईंले मात्र देख्नुहुन्छ ।')) + '</p>');
    }
  });

  // ---------------------------------------------------------- small UI pieces
  function hoursParse(h) { // "07:00-09:00, 16:00-19:00" → [["07:00","09:00"],["16:00","19:00"]]
    var out = []; String(h || '').split(/[,;]/).forEach(function (r) { var m = r.match(/(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/); if (m) out.push([('0' + m[1]).slice(-2) + ':' + m[2], ('0' + m[3]).slice(-2) + ':' + m[4]]); });
    return out;
  }
  function hoursPretty(h) {
    return hoursParse(h).map(function (r) { return r.map(function (x) { var p = x.split(':'), hr = +p[0]; return (hr % 12 || 12) + (p[1] === '00' ? '' : ':' + p[1]) + (hr < 12 ? ' am' : ' pm'); }).join('–'); }).join(', ');
  }
  function dayRows(prefix, days, dayHours, sample) {
    return DAYS.map(function (d) {
      var on = days.indexOf(d) >= 0, r = hoursParse(dayHours && dayHours[d] !== undefined && dayHours[d] !== null ? dayHours[d] : sample(d));
      function tm(i, j) { return '<input type="time" step="900" data-h="' + d + '-' + i + '-' + j + '" value="' + esc((r[i] || [])[j] || '') + '" aria-label="' + esc(dn(d)) + '">'; }
      return '<div class="dayrow' + (on ? ' on' : '') + '" data-dayrow="' + d + '"><button type="button" class="daytap" data-p2="' + prefix + '-day" data-d="' + d + '" aria-pressed="' + on + '">' + esc(dn(d)) + '</button>' +
        '<div class="hrs"><span>' + tm(0, 0) + ' – ' + tm(0, 1) + '</span><span>' + tm(1, 0) + ' – ' + tm(1, 1) + '</span></div><span class="offtxt small muted">' + esc(t('Regular holiday', 'नियमित बिदा')) + '</span></div>';
    }).join('');
  }
  function readDayHours(box) {
    var out = {};
    DAYS.forEach(function (d) {
      var parts = [];
      [0, 1].forEach(function (i) { var a = $('[data-h="' + d + '-' + i + '-0"]', box), b = $('[data-h="' + d + '-' + i + '-1"]', box); if (a && b && a.value && b.value && a.value < b.value) parts.push(a.value + '-' + b.value); });
      out[d] = parts.join(', ');
    });
    return out;
  }
  // calendar of tappable dates. sel = chosen dates; counts = bookings per date
  function calendar(kind, sel, counts, months, canPick) {
    var today = N.today(), base = S.parse(today), html = '';
    for (var m = 0; m < months; m++) {
      var first = new Date(base.getFullYear(), base.getMonth() + m, 1), n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      html += '<div class="calm"><h4>' + esc(first.toLocaleDateString(N.lang === 'ne' ? 'ne-NP' : 'en-GB', { month: 'long', year: 'numeric' })) + '</h4><div class="calg">' + DAYS.map(function (d) { return '<small>' + esc(dn(d).slice(0, N.lang === 'ne' ? 3 : 2)) + '</small>'; }).join('');
      for (var i = 0; i < first.getDay(); i++) html += '<span></span>';
      for (var day = 1; day <= n; day++) {
        var s = S.ymd(new Date(first.getFullYear(), first.getMonth(), day)), past = s < today, on = sel.indexOf(s) >= 0, ok = !past && (!canPick || canPick(s) || on);
        html += '<button type="button" data-p2="cal" data-k="' + kind + '" data-d="' + s + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled') + '>' + day + (counts && counts[s] ? '<i>' + counts[s] + '</i>' : '') + '</button>';
      }
      html += '</div></div>';
    }
    return '<div class="cal">' + html + '</div>';
  }
  function stdText(pt) {
    if (!pt) return '';
    return t('Mon–Fri ', 'सोम–शुक्र ') + hoursPretty(pt.morning) + ', ' + hoursPretty(pt.evening) + (pt.switchDate ? ' (' + t('evening ', 'साँझ ') + hoursPretty(pt.eveningAfter) + ' ' + t('from', 'देखि') + ' ' + fmt(pt.switchDate) + ')' : '') + ' · ' + t('Sat–Sun ', 'शनि–आइत ') + hoursPretty(pt.weekend);
  }
  function chips(name, all, cur) {
    return '<div class="picker">' + all.map(function (x) { return '<label><input type="checkbox" name="' + name + '" value="' + esc(x) + '"' + (cur.indexOf(x) >= 0 ? ' checked' : '') + '>' + esc(x) + '</label>'; }).join('') + '</div>';
  }

  // ------------------------------------------------- doctor setup (after sign-in)
  N.PAGES.setup = function () {
    return X.head(t('Your details for the website', 'वेबसाइटका लागि तपाईंको विवरण'), t('Fill this once. You can change everything later from your dashboard.', 'एक पटक भर्नुहोस् । पछि ड्यासबोर्डबाट बदल्न सकिन्छ ।')) + '<section class="section"><div class="container" style="max-width:760px"><div class="card" id="swiz"><p class="muted">' + esc(T('loading')) + '</p></div></div></section>';
  };
  function setupInit() {
    var el = $('#swiz'); if (!el) return;
    if (!P.loaded) { setTimeout(setupInit, 300); return; }
    if (!P.me) { el.innerHTML = X.needLogin('#/setup'); return; }
    if (!P.me.doctorId) { location.hash = '#/dashboard'; return; }
    loadSetup(function () { W.step = W.step || 1; drawSetup(); });
  }
  function loadSetup(cb) {
    api('GET', 'api/d/setup').then(function (j) {
      var keep = W && W.step;
      W = { j: j, d: j.doctor, step: keep, visiting: j.doctor.employment === 'visiting', days: (j.doctor.days || []).slice(), off: (j.doctor.off || []).slice(), visit: (j.doctor.visitDates || []).slice(),
        std: j.doctor.employment === 'part' && !j.doctor.dayHours && !(j.doctor.hours && /\d/.test(j.doctor.hours)), dayHours: j.doctor.dayHours || null };
      cb();
    }).catch(function (e) { var el = $('#swiz') || $('#dmain'); if (el) el.innerHTML = '<div class="alert">' + esc(e.message) + '</div>'; });
  }
  function sample(d) { var j = W.j, dt = S.parse(j.today), i = 0; while (S.DAYS[dt.getDay()] !== d && i++ < 7) dt.setDate(dt.getDate() + 1); return S.hoursOn(Object.assign({}, W.d, { dayHours: null }), S.ymd(dt), C().booking); }
  function stepList() {
    var s = [['about', t('About you', 'तपाईंबारे')], ['work', t('What you treat', 'उपचार')], ['when', W.visiting ? t('Visit dates', 'भ्रमण मिति') : t('Days & hours', 'दिन र समय')]];
    if (!W.j.noVideo) s.push(['video', t('Video', 'भिडियो')]);
    s.push(['finish', t('Finish', 'अन्त्य')]);
    return s;
  }
  function bi(k, label, long, v) {
    var x = v[k] || {};
    return '<label class="f">' + esc(label) + (long ? '<textarea name="' + k + '_en" rows="4">' + esc(x.en || '') + '</textarea>' : '<input name="' + k + '_en" value="' + esc(x.en || '') + '">') + '</label>' +
      '<details class="small"><summary>' + esc(t('Add it in Nepali too (optional)', 'नेपालीमा पनि (ऐच्छिक)')) + '</summary>' + (long ? '<textarea name="' + k + '_ne" lang="ne" rows="3">' + esc(x.ne || '') + '</textarea>' : '<input name="' + k + '_ne" lang="ne" value="' + esc(x.ne || '') + '">') + '</details>';
  }
  function partAbout(v) {
    var langs = ['Nepali', 'English', 'Hindi', 'Maithili', 'Bhojpuri', 'Newari', 'Tamang'];
    (v.languages || []).forEach(function (x) { if (langs.indexOf(x) < 0) langs.push(x); });
    return '<div class="photo-row"><img src="' + esc(v.photo || 'img/ph/P19.svg') + '" alt="" id="p2Photo"><div><input type="hidden" name="photo" value="' + esc(v.photo && !v.template ? v.photo : '') + '"><label class="btn sm" style="cursor:pointer">' + icon('upload') + esc(t('Take or choose a photo', 'फोटो खिच्नुहोस् वा छान्नुहोस्')) + '<input type="file" accept="image/*" data-p2c="photo" hidden></label><p class="small muted" style="margin:6px 0 0">' + esc(t('Clear portrait, face to chest, plain background.', 'स्पष्ट पोर्ट्रेट फोटो ।')) + '</p></div></div>' +
      '<p style="margin:0"><b>' + esc(L(v.name)) + '</b></p>' +
      '<label class="f">' + esc(t('Your name in Nepali', 'नेपालीमा नाम')) + '<input name="name_ne" lang="ne" value="' + esc((v.name || {}).ne || '') + '"></label>' +
      bi('title', t('Title shown under your name (e.g. Consultant Physician)', 'पद'), false, v) +
      '<label class="f">' + esc(t('Qualifications (e.g. MBBS, MD Internal Medicine – TUTH)', 'योग्यता')) + '<input name="degrees" value="' + esc(v.degrees || '') + '"></label>' +
      '<div class="two"><label class="f">' + esc(t('NMC number', 'एनएमसी नम्बर')) + '<input name="nmc" inputmode="numeric" value="' + esc(v.nmc || '') + '"></label><label class="f">' + esc(t('Years of experience', 'अनुभव (वर्ष)')) + '<input name="experience" inputmode="numeric" maxlength="20" value="' + esc(v.experience || '') + '"></label></div>' +
      '<div class="two"><label class="f">' + esc(t('Gender', 'लिङ्ग')) + '<select name="gender">' + opt('', '—', v.gender) + opt('Male', t('Male', 'पुरुष'), v.gender) + opt('Female', t('Female', 'महिला'), v.gender) + '</select></label><label class="f">' + esc(t('Also works at (optional)', 'अन्य संस्था (ऐच्छिक)')) + '<input name="affiliation" value="' + esc(v.affiliation || '') + '"></label></div>' +
      '<div class="f"><span style="font-weight:600;font-size:.9rem">' + esc(t('Languages you speak with patients', 'बोल्ने भाषा')) + '</span>' + chips('languages', langs, v.languages || []) + '</div>';
  }
  function partWork(v) {
    return '<label class="f">' + esc(t('Conditions you treat — one per line', 'उपचार गर्ने रोग — प्रति लाइन एक')) + '<textarea name="focus" rows="5" placeholder="' + esc(t('Diabetes\nHigh blood pressure\nThyroid', 'मधुमेह\nउच्च रक्तचाप')) + '">' + esc((v.focus || []).join('\n')) + '</textarea></label>' + bi('bio', t('A few lines about you for patients', 'बिरामीका लागि छोटो परिचय'), true, v);
  }
  function partWhen() {
    var j = W.j;
    if (W.visiting) return '<p class="muted" style="margin:0">' + esc(t('Tap the dates you will come to NIKO Hospital. Patients can book only on these dates. There is no limit on bookings; each patient gets a token number.', 'निको अस्पताल आउने मितिमा थिच्नुहोस् । बिरामीले यिनै मितिमा मात्र बुक गर्न सक्छन् । बुकिङको सीमा छैन; प्रत्येक बिरामीले टोकन नम्बर पाउँछन् ।')) + '</p>' + calendar('visit', W.visit, j.bookings, 6) +
      '<p class="small muted" id="calNote">' + W.visit.length + ' ' + esc(t('visit dates chosen. A small number on a date shows patients already booked.', 'मिति छानिएको ।')) + '</p>';
    return '<p class="muted" style="margin:0">' + esc(t('Tap the days you are at NIKO Hospital. Days you leave off are your regular holidays. These hours are used for both clinic and video bookings.', 'निको अस्पतालमा हुने दिनमा थिच्नुहोस् । नथिचेका दिन नियमित बिदा हुन् । यही समय ओपीडी र भिडियो दुवैका लागि हो ।')) + '</p>' +
      (W.d.employment === 'part' ? '<label class="check" style="margin-top:6px"><input type="checkbox" data-p2c="std"' + (W.std ? ' checked' : '') + '> <span><b>' + esc(t('Use the hospital’s standard part-time hours', 'अस्पतालको मानक समय प्रयोग गर्ने')) + '</b><br><span class="small muted">' + esc(stdText(j.partTime)) + '</span></span></label>' : '') +
      '<div class="dayrows' + (W.std ? ' std' : '') + '" id="dayRows">' + dayRows('w', W.days, W.dayHours, sample) + '</div>';
  }
  function partOff() {
    return '<h3 style="margin:14px 0 0">' + esc(t('Days you will be away', 'बिदा बस्ने दिन')) + '</h3><p class="small muted" style="margin:0">' + esc(t('Tap any future date you will not be available (leave, travel, conference). Patients cannot book that day. Tap again to undo.', 'उपलब्ध नहुने मितिमा थिच्नुहोस् । बिरामीले त्यो दिन बुक गर्न सक्दैनन् ।')) + '</p>' + calendar('off', W.off, W.j.bookings, 3);
  }
  function partVideo(v) {
    var yes = v.videoConsult !== false;
    return '<p class="muted" style="margin:0">' + esc(t('Do you want to see patients by video call on this website, during your clinic hours?', 'के तपाईं आफ्नो ओपीडी समयमा यस वेबसाइटबाट भिडियो कलमा बिरामी हेर्न चाहनुहुन्छ?')) + '</p><div class="yn"><label><input type="radio" name="videoConsult" value="1"' + (yes ? ' checked' : '') + '><span>' + icon('video') + esc(t('Yes', 'हुन्छ')) + '</span></label><label><input type="radio" name="videoConsult" value=""' + (yes ? '' : ' checked') + '><span>' + esc(t('No', 'हुँदैन')) + '</span></label></div>' +
      '<p class="small muted" style="margin:0">' + esc(t('Video hours are the same as your clinic hours. Only the Director can add extra video hours for calls from home.', 'भिडियोको समय ओपीडी समय नै हो । घरबाट कलका लागि थप समय सञ्चालकले मात्र थप्न सक्नुहुन्छ ।')) + '</p>';
  }
  function partPrivate(v) {
    var pr = v.private || {};
    return '<p class="alert info small" style="margin:0">' + esc(t('For the hospital only. Your phone number, email and address are never shown to patients.', 'अस्पतालका लागि मात्र । तपाईंको फोन, इमेल र ठेगाना बिरामीलाई कहिल्यै देखाइँदैन ।')) + '</p>' +
      '<div class="two"><label class="f">' + esc(t('Your mobile number', 'मोबाइल नम्बर')) + '<input name="private_phone" type="tel" inputmode="tel" value="' + esc(pr.phone || (P.me.profile || {}).phone || '') + '"></label><label class="f">' + esc(t('Home address', 'घरको ठेगाना')) + '<input name="private_address" value="' + esc(pr.address || '') + '"></label></div>';
  }
  function drawSetup() {
    var el = $('#swiz'); if (!el || !W) return;
    var steps = stepList(), cur = steps[W.step - 1] || steps[0], v = W.d, j = W.j, body;
    if (cur[0] === 'about') body = partAbout(v);
    else if (cur[0] === 'work') body = partWork(v);
    else if (cur[0] === 'when') body = partWhen();
    else if (cur[0] === 'video') body = partVideo(v);
    else body = partPrivate(v) + (j.missing.length ? '<p class="alert warn" style="margin:0">' + esc(t('Still needed before you can finish:', 'बाँकी:')) + ' <b>' + esc(j.missing.join(', ')) + '</b></p>' : '') +
      '<label class="check"><input type="checkbox" name="agree" value="1"' + (j.agreed ? ' checked' : '') + '> <span>' + esc(j.agreement) + '</span></label>' +
      '<p class="small muted" style="margin:0">' + esc(t('After you finish, the Director checks your details. Until then only you can see them on the website.', 'सञ्चालकले स्वीकृत नगरेसम्म यी विवरण तपाईंले मात्र देख्नुहुन्छ ।')) + '</p>';
    el.innerHTML = '<ol class="steps">' + steps.map(function (s, i) { return '<li' + (W.step === i + 1 ? ' aria-current="step"' : '') + (W.step > i + 1 ? ' class="done"' : '') + '>' + esc(s[1]) + '</li>'; }).join('') + '</ol>' +
      '<form class="form-grid" data-p2form="setup" data-step="' + cur[0] + '"><h2 style="margin:0">' + esc(cur[1]) + '</h2>' + body +
      '<div class="msg" role="status"></div><div class="wiz-nav">' + (W.step > 1 ? '<button type="button" class="btn ghost" data-p2="s-back">← ' + esc(T('back')) + '</button>' : '<span></span>') + '<button class="btn" type="submit">' + esc(cur[0] === 'finish' ? t('Finish and send for approval', 'सम्पन्न गरी स्वीकृतिका लागि पठाउनुहोस्') : t('Save and continue', 'सेभ गरी अगाडि')) + ' →</button></div></form>';
    window.scrollTo(0, 0);
  }
  function collect(f, part) {
    var data = {}; new FormData(f).forEach(function (val, k) { if (typeof val === 'string') { if (data[k] !== undefined) data[k] = [].concat(data[k], val); else data[k] = val; } });
    var b = {};
    if (part === 'about' || part === 'all') {
      b.photo = data.photo; b.name = { ne: data.name_ne }; b.title = { en: data.title_en, ne: data.title_ne }; b.degrees = data.degrees; b.nmc = data.nmc; b.experience = data.experience; b.gender = data.gender; b.affiliation = data.affiliation; b.languages = [].concat(data.languages || []);
      if (!b.photo) delete b.photo;
    }
    if (part === 'work' || part === 'all') { b.focus = data.focus; b.bio = { en: data.bio_en, ne: data.bio_ne }; }
    if (part === 'when' || part === 'sched') {
      if (W.visiting) b.visitDates = W.visit;
      else { b.days = W.days; if (W.std) b.useStandard = true; else b.dayHours = readDayHours(f); }
      if (part === 'sched' && !W.visiting) b.off = W.off;
    }
    if ((part === 'video' || part === 'sched') && !W.j.noVideo && data.videoConsult !== undefined) b.videoConsult = !!data.videoConsult;
    if (part === 'finish' || part === 'all') { b.private = { phone: data.private_phone, address: data.private_address }; }
    if (part === 'finish') { b.agree = !!data.agree; b.finish = true; }
    return b;
  }

  // dashboard: my details (waits for approval) and my schedule (live at once)
  TABS.profile = function () {
    loadSetup(function () {
      var j = W.j, v = W.d;
      D('<h2 style="font-size:1.3rem">' + esc(t('My details on the website', 'वेबसाइटमा मेरो विवरण')) + '</h2>' +
        (j.pending ? '<p class="alert warn">' + esc(t('Your changes are waiting for the Director’s approval. Only you can see them on the website until then.', 'तपाईंको परिवर्तन स्वीकृतिको पर्खाइमा छ ।')) + ' <a href="#/doctor/' + esc(v.id) + '">' + esc(t('See my page', 'मेरो पेज हेर्नुहोस्')) + ' →</a></p>' : j.rejected ? '<p class="alert">' + esc(t('Your last changes were not approved', 'पछिल्लो परिवर्तन स्वीकृत भएन')) + (j.rejected.note ? ': ' + esc(j.rejected.note) : '') + '</p>' : '<p class="muted small">' + esc(t('Changes here go to the Director for approval before patients see them.', 'यहाँका परिवर्तन स्वीकृतिपछि मात्र बिरामीले देख्छन् ।')) + ' <a href="#/doctor/' + esc(v.id) + '">' + esc(t('See my page', 'मेरो पेज हेर्नुहोस्')) + ' →</a></p>') +
        '<form class="card form-grid" data-p2form="details">' + partAbout(v) + partWork(v) + partPrivate(v) + '<div class="msg" role="status"></div><button class="btn" type="submit">' + esc(t('Send for approval', 'स्वीकृतिका लागि पठाउनुहोस्')) + '</button></form>');
    });
  };
  TABS.schedule = function () {
    loadSetup(function () {
      var j = W.j, v = W.d;
      D('<h2 style="font-size:1.3rem">' + esc(t('My schedule & days off', 'मेरो तालिका र बिदा')) + '</h2>' +
        (j.active && (j.setupDone || j.boss) && !(j.pending && (j.pending.fields.indexOf('days') >= 0 || j.pending.fields.indexOf('visitDates') >= 0)) ? '<p class="muted small">' + esc(t('Changes here are live on the website as soon as you save. The Director is told. Patients already booked on a day you close are asked to choose a new date.', 'यहाँको परिवर्तन सेभ गर्नासाथ वेबसाइटमा देखिन्छ । बन्द गरिएको दिनका बिरामीलाई नयाँ मिति छान्न भनिन्छ ।')) + '</p>' : '<p class="alert warn">' + esc(t('Your schedule goes live after the Director approves your account and first details.', 'सञ्चालकको स्वीकृतिपछि तालिका लागू हुन्छ ।')) + '</p>') +
        (j.noVideo ? '' : '<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><b>' + esc(t('Available now for video', 'भिडियोका लागि अहिले उपलब्ध')) + '</b><br><span class="small muted">' + esc(t('Patients see “Consult right now” for you only while this is on. It works during your hours and switches off by itself.', 'यो खुला हुँदा मात्र बिरामीले “अहिले नै परामर्श” देख्छन् ।')) + '</span></div><button class="btn sm' + (j.now ? ' green' : ' ghost') + '" data-p2="now" data-on="' + (j.now ? '' : '1') + '">' + esc(j.now ? t('ON — tap to switch off', 'खुला — बन्द गर्न थिच्नुहोस्') : t('OFF — tap to switch on', 'बन्द — खोल्न थिच्नुहोस्')) + '</button></div></div>') +
        '<form class="card form-grid" data-p2form="sched">' + partWhen() + (W.visiting ? '' : partOff()) + (j.noVideo ? '' : '<h3 style="margin:14px 0 0">' + esc(t('Video consultation', 'भिडियो परामर्श')) + '</h3>' + partVideo(v)) +
        '<div class="msg" role="status"></div><button class="btn" type="submit">' + esc(t('Save schedule', 'तालिका सेभ गर्नुहोस्')) + '</button></form>');
    });
  };
  // "Available now" switch on the doctor's video consultation tab
  var consultsTab = TABS.consults;
  TABS.consults = function () {
    consultsTab();
    var a = P.me;
    if (a.type === 'staff' && a.staffRole === 'doctor' && a.doctorId && !a.seesAll) api('GET', 'api/d/setup').then(function (j) {
      var el = $('#nowSwitch'); if (!el || j.noVideo) return;
      el.innerHTML = '<div class="card" style="margin-bottom:12px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><b>' + esc(t('Available now for video', 'भिडियोका लागि अहिले उपलब्ध')) + '</b><button class="btn sm' + (j.now ? ' green' : ' ghost') + '" data-p2="now" data-on="' + (j.now ? '' : '1') + '">' + esc(j.now ? t('ON — tap to switch off', 'खुला') : t('OFF — tap to switch on', 'बन्द')) + '</button></div>';
    }).catch(function () {});
  };

  // ------------------------------------------------------------------ settings
  TABS.account = function () {
    var a = P.me, p = a.profile || {}, off = (a.prefs || {}).emailOff || {};
    var cats = [['notice', t('Notices for staff groups', 'कर्मचारी समूहका सूचना')], ['lab', t('Lab bookings and reports', 'ल्याब बुकिङ र रिपोर्ट')], ['requests', t('Requests and replies', 'अनुरोध र जवाफ')], ['schedule', t('Schedule and booking changes', 'तालिका र बुकिङ परिवर्तन')], ['account', t('Account and approvals', 'खाता र स्वीकृति')]];
    D('<h2 style="font-size:1.3rem">' + esc(t('Settings', 'सेटिङ')) + '</h2>' +
      '<form class="card form-grid" data-p2form="set-basic"><h3 style="margin:0">' + esc(t('Account', 'खाता')) + '</h3><p class="small muted" style="margin:0">' + esc(a.type === 'staff' ? X.roleName(a.staffRole) : t('Patient', 'बिरामी')) + ' ' + status(a.status) + '</p>' +
      '<div class="two"><label class="f">' + esc(t('Full name', 'पूरा नाम')) + '<input name="name" required value="' + esc(p.name || '') + '"></label><label class="f">' + esc(t('Mobile number', 'मोबाइल नम्बर')) + '<input name="phone" type="tel" inputmode="tel" value="' + esc(p.phone || '') + '"></label></div>' +
      '<div class="f"><span style="font-weight:600;font-size:.9rem">' + esc(t('Language', 'भाषा')) + '</span><div class="yn"><label><input type="radio" name="lang" value="en"' + (N.lang !== 'ne' ? ' checked' : '') + '><span>English</span></label><label><input type="radio" name="lang" value="ne"' + (N.lang === 'ne' ? ' checked' : '') + '><span>नेपाली</span></label></div></div>' +
      '<div class="msg" role="status"></div><div class="acts"><button class="btn sm" type="submit">' + esc(t('Save', 'सेभ गर्नुहोस्')) + '</button>' + (a.type === 'patient' ? '<a class="btn sm ghost" href="#/account">' + esc(t('Age, gender, address', 'उमेर, लिङ्ग, ठेगाना')) + '</a>' : '') + '</div></form>' +
      '<form class="card form-grid" data-p2form="set-mail" style="margin-top:16px"><h3 style="margin:0">' + esc(t('Notifications by email', 'इमेलबाट सूचना')) + '</h3><p class="small muted" style="margin:0">' + esc(t('Everything always shows in your dashboard. Choose what also comes by email.', 'सबै कुरा ड्यासबोर्डमा देखिन्छ । इमेलमा के आउने छान्नुहोस् ।')) + '</p>' +
      cats.map(function (c) { return '<label class="check"><input type="checkbox" name="on" value="' + c[0] + '"' + (off[c[0]] ? '' : ' checked') + '> <span>' + esc(c[1]) + '</span></label>'; }).join('') +
      '<label class="check" style="opacity:.7"><input type="checkbox" checked disabled> <span>' + esc(t('Messages from the Director, video consultation alerts and payment alerts — always on', 'सञ्चालकका सन्देश, भिडियो परामर्श र भुक्तानीका सूचना — सधैँ खुला')) + '</span></label>' +
      '<div class="msg" role="status"></div><button class="btn sm" type="submit">' + esc(t('Save', 'सेभ गर्नुहोस्')) + '</button></form>' +
      '<form class="card form-grid" data-p2form="set-email" style="margin-top:16px"><h3 style="margin:0">' + esc(t('Sign-in email', 'साइन इन इमेल')) + '</h3><p style="margin:0">' + esc(a.email) + '</p><div class="two"><label class="f">' + esc(t('New email', 'नयाँ इमेल')) + '<input name="email" type="email" required></label><label class="f">' + esc(t('Your password', 'तपाईंको पासवर्ड')) + '<input name="password" type="password" autocomplete="current-password" required></label></div>' +
      '<label class="f" id="emCode" hidden>' + esc(t('6-digit code sent to the new email', 'नयाँ इमेलमा आएको ६ अंकको कोड')) + '<input name="code" inputmode="numeric" maxlength="6"></label><div class="msg" role="status"></div><button class="btn sm" type="submit">' + esc(t('Change email', 'इमेल बदल्नुहोस्')) + '</button></form>' +
      '<form class="card form-grid" data-pform="changepw" style="margin-top:16px"><h3 style="margin:0">' + esc(t('Change password', 'पासवर्ड बदल्नुहोस्')) + '</h3><div class="two"><label class="f">' + esc(t('Current password', 'हालको पासवर्ड')) + '<input type="password" name="current" autocomplete="current-password" required></label><label class="f">' + esc(t('New password', 'नयाँ पासवर्ड')) + '<input type="password" name="next" autocomplete="new-password" minlength="8" required></label></div><button class="btn sm" type="submit">' + esc(t('Change', 'बदल्नुहोस्')) + '</button><div class="msg"></div></form>' +
      '<div class="card" style="margin-top:16px"><div class="acts"><button class="btn sm ghost" data-pact="logout">' + icon('logout') + esc(t('Sign out', 'साइन आउट')) + '</button>' +
      (a.deleteRequested ? '<span class="small muted">' + esc(t('You asked for this account to be deleted. The Director will do it.', 'खाता मेटाउने अनुरोध गरिएको छ ।')) + '</span><button class="btn xs ghost" data-p2="del-cancel">' + esc(t('Cancel the request', 'अनुरोध रद्द')) + '</button>' : '<button class="btn sm ghost" data-p2="del-ask" style="color:#9b1c1c">' + esc(t('Ask to delete my account', 'खाता मेटाउन अनुरोध')) + '</button>') + '</div></div>');
  };

  // ----------------------------------------- doctors & schedules (Director / chosen staff)
  TABS.doctors = function () {
    api('GET', 'api/d/doctors').then(function (j) {
      M.j = j; M.sel = M.sel && j.doctors.some(function (d) { return d.id === M.sel; }) ? M.sel : '';
      var kind = { full: t('Full-time', 'पूर्णकालीन'), part: t('Part-time', 'आंशिक'), visiting: t('Visiting', 'भ्रमण') };
      D('<h2 style="font-size:1.3rem">' + esc(j.full ? t('Doctors & schedules', 'डाक्टर र तालिका') : t('Visiting specialists’ visit dates', 'भ्रमण विशेषज्ञका मिति')) + '</h2>' +
        (j.full ? '<p class="muted small">' + esc(t('Doctor ID numbers are for the hospital only. Add a new doctor in the admin page — the next number is given automatically. Standard part-time hours:', 'डाक्टर आईडी अस्पतालका लागि मात्र हो । मानक समय:')) + ' ' + esc(stdText(j.partTime)) + '</p>' : '') +
        '<div class="list">' + j.doctors.map(function (d) {
          var open = M.sel === d.id, ac = d.account;
          return '<div class="item" id="md-' + esc(d.id) + '"><div class="top" style="cursor:pointer" data-p2="m-open" data-id="' + esc(d.id) + '"><h3>' + (d.no ? '<span class="tag grey">ID ' + d.no + '</span> ' : '') + esc(L(d.name)) + '</h3><span>' + (d.now ? '<span class="tag green">' + esc(t('available now', 'अहिले उपलब्ध')) + '</span> ' : '') + '<span class="tag' + (d.employment === 'visiting' ? ' orange' : d.employment === 'full' ? ' green' : '') + '">' + esc(kind[d.employment]) + '</span></span></div>' +
            '<div class="small muted">' + esc(d.employment === 'visiting' ? t('Visit dates', 'भ्रमण मिति') + ': ' + (d.visitDates.filter(function (x) { return x >= j.today; }).map(function (x) { return fmt(x) + (d.bookings[x] ? ' (' + d.bookings[x] + ')' : ''); }).join(', ') || '—') : (d.days.join(', ') || t('no days set', 'दिन तोकिएको छैन')) + (d.off.length ? ' · ' + t('away', 'बिदा') + ': ' + d.off.filter(function (x) { return x >= j.today; }).map(fmt).join(', ') : '')) +
            (j.full ? ' · ' + (ac ? esc(t('account', 'खाता')) + ' ' + esc(ac.status) + (ac.setupDone ? '' : ' · ' + esc(t('details not filled yet', 'विवरण भरिएको छैन'))) + (ac.agreedAt ? ' · ' + esc(t('agreement', 'सहमति')) + ' ' + esc(fmt(ac.agreedAt)) : '') : esc(t('no account yet', 'खाता छैन'))) : '') + '</div>' + (open ? editor(d, j) : '') + '</div>';
        }).join('') + '</div>');
    }).catch(fail);
  };
  function editor(d, j) {
    M.days = d.days.slice(); M.off = d.off.slice(); M.visit = d.visitDates.slice(); M.emp = d.employment; M.std = d.employment === 'part' && !d.dayHours && !(d.hours && /\d/.test(d.hours));
    var smp = function (day) { var dt = S.parse(j.today), i = 0; while (S.DAYS[dt.getDay()] !== day && i++ < 7) dt.setDate(dt.getDate() + 1); return S.hoursOn({ employment: d.employment, hours: d.hours }, S.ymd(dt), C().booking); };
    var vis = d.employment === 'visiting';
    return '<form class="form-grid" data-p2form="m-save" data-id="' + esc(d.id) + '" style="margin-top:12px;border-top:1px solid var(--line);padding-top:12px">' +
      (j.full ? '<div class="two"><label class="f">' + esc(t('Type', 'प्रकार')) + '<select name="employment" data-p2c="m-emp">' + opt('full', t('Full-time', 'पूर्णकालीन'), d.employment) + opt('part', t('Part-time (standard part-time hours)', 'आंशिक'), d.employment) + opt('visiting', t('Visiting specialist (visit dates, tokens, no video)', 'भ्रमण विशेषज्ञ'), d.employment) + '</select></label><label class="f">' + esc(t('Degree level (video fee)', 'डिग्री तह')) + '<select name="degreeLevel">' + opt('MD', 'MD / MS', d.degreeLevel) + opt('DM', 'DM / MCh', d.degreeLevel) + '</select></label></div>' +
        (d.private && (d.private.phone || d.private.address) ? '<p class="small muted" style="margin:0">' + esc(t('Hospital only', 'अस्पतालका लागि मात्र')) + ': ' + esc(d.private.phone || '') + ' · ' + esc(d.private.address || '') + '</p>' : '') : '') +
      (vis ? '<p class="small muted" style="margin:0">' + esc(t('Tap the visit dates. The number on a date is patients already booked. Removing a date emails every booked patient.', 'भ्रमण मितिमा थिच्नुहोस् ।')) + '</p>' + calendar('m-visit', M.visit, d.bookings, 6) :
        (j.full ? (d.employment === 'part' ? '<label class="check"><input type="checkbox" data-p2c="m-std"' + (M.std ? ' checked' : '') + '> <span>' + esc(t('Use the standard part-time hours', 'मानक समय प्रयोग गर्ने')) + '</span></label>' : '') + '<div class="dayrows' + (M.std ? ' std' : '') + '">' + dayRows('m', M.days, d.dayHours, smp) + '</div>' +
          '<h4 style="margin:10px 0 0">' + esc(t('Days away', 'बिदा')) + '</h4>' + calendar('m-off', M.off, d.bookings, 3) +
          (d.dept === 'anaesthesiology' ? '<p class="small muted">' + esc(t('No video consultation for anaesthesia.', 'एनेस्थेसियाका लागि भिडियो परामर्श छैन ।')) + '</p>' :
          '<h4 style="margin:10px 0 0">' + esc(t('Video consultation', 'भिडियो परामर्श')) + '</h4><label class="check"><input type="checkbox" name="videoConsult" value="1"' + (d.videoConsult ? ' checked' : '') + '> <span>' + esc(t('Takes video consultations (same hours as the clinic)', 'भिडियो परामर्श लिने')) + '</span></label>' +
          '<p class="small muted" style="margin:0">' + esc(t('Extra video-only hours, for example calls from home. Only you can set these. Leave empty for none.', 'घरबाट कलका लागि थप भिडियो समय । खाली छोडे हुँदैन ।')) + '</p><div class="vhrs">' + DAYS.map(function (x) { var r = hoursParse((d.videoHours || {})[x])[0] || []; return '<label class="small">' + esc(dn(x).slice(0, 3)) + ' <input type="time" step="900" data-vh="' + x + '-0" value="' + esc(r[0] || '') + '">–<input type="time" step="900" data-vh="' + x + '-1" value="' + esc(r[1] || '') + '"></label>'; }).join('') + '</div>') : '')) +
      '<div class="msg" role="status"></div><div class="acts"><button class="btn sm" type="submit">' + esc(t('Save — live at once', 'सेभ — तुरुन्त लागू')) + '</button></div></form>';
  }

  // ------------------------------------------------------- video call monitoring
  TABS.monitor = function () {
    api('GET', 'api/p/monitor').then(function (j) {
      M.mon = j; var f = M.monF || { doc: '', only: '' };
      var list = j.consults.filter(function (c) { return (!f.doc || c.doctorId === f.doc) && (!f.only || c.flags.length); });
      D('<h2 style="font-size:1.3rem">' + esc(t('Video call monitoring', 'भिडियो कल अनुगमन')) + '</h2><p class="muted small">' + esc(t('Only the Director and the owner see this page. Calls are not recorded; this shows who started each call, when, how long, payment, links sent, the whole chat and every warning sign.', 'यो पेज सञ्चालक र मालिकले मात्र देख्छन् ।')) + ' ' + esc(j.paymentRequired ? '' : t('Payment check is switched OFF (trial).', 'भुक्तानी जाँच बन्द छ (परीक्षण) ।')) + '</p>' +
        '<div class="table-wrap"><table><thead><tr><th>' + esc(t('Doctor', 'डाक्टर')) + '</th><th>' + esc(t('Bookings', 'बुकिङ')) + '</th><th>' + esc(t('Calls held', 'भएका कल')) + '</th><th>' + esc(t('Minutes', 'मिनेट')) + '</th><th>' + esc(t('With warnings', 'चेतावनी')) + '</th><th>' + esc(t('Patient said “yes”', 'बिरामीले “हो” भने')) + '</th><th>' + esc(t('Follow-ups set', 'फलोअप')) + '</th></tr></thead><tbody>' +
        j.doctors.map(function (d) { return '<tr><td><a href="#" data-p2="mon-doc" data-id="' + esc(d.doctorId) + '">' + esc(d.doctorName) + '</a></td><td>' + d.calls + '</td><td>' + d.held + '</td><td>' + d.minutes + '</td><td>' + (d.flagged ? '<b style="color:#9b1c1c">' + d.flagged + '</b>' : 0) + '</td><td>' + (d.saidYes ? '<b style="color:#9b1c1c">' + d.saidYes + '</b>' : 0) + '</td><td>' + d.followUps + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="tabs" style="margin-top:14px"><button data-p2="mon-f" data-only="" aria-pressed="' + !f.only + '">' + esc(t('All calls', 'सबै कल')) + '</button><button data-p2="mon-f" data-only="1" aria-pressed="' + !!f.only + '">' + esc(t('Only with warnings', 'चेतावनी भएका मात्र')) + '</button>' + (f.doc ? '<button data-p2="mon-doc" data-id="">× ' + esc(((j.doctors.filter(function (d) { return d.doctorId === f.doc; })[0]) || {}).doctorName || '') + '</button>' : '') + '</div>' +
        (list.length ? '<div class="list">' + list.slice(0, 150).map(function (c) {
          return '<details class="item"' + (c.flags.length ? ' style="border-left:4px solid #c62828"' : '') + '><summary style="cursor:pointer"><b>' + esc(c.doctorName) + '</b> → ' + esc(c.patientName) + ' <span class="small muted">' + esc(fmt(c.date)) + ' ' + esc(c.time) + ' · ' + esc(c.code) + '</span> ' + status(c.status) + (c.minutes ? ' <span class="tag">' + c.minutes + ' min</span>' : ' <span class="tag grey">' + esc(t('no call yet', 'कल भएको छैन')) + '</span>') + c.flags.map(function (x) { return ' <span class="tag red">' + esc(x.why) + '</span>'; }).join('') + '</summary>' +
            '<dl class="kv" style="margin-top:10px"><dt>' + esc(t('Started by', 'सुरु गर्ने')) + '</dt><dd>' + esc(c.startedBy) + (c.instant ? ' · ' + esc(t('right now', 'अहिले नै')) : '') + '</dd><dt>' + esc(t('Payment', 'भुक्तानी')) + '</dt><dd>' + (c.fee ? 'Rs ' + esc(c.fee) + ' · ' + esc(c.method) : esc(t('none', 'छैन'))) + ' · ' + esc(c.payCheck === 'off' ? t('check switched off', 'जाँच बन्द') : c.payCheck || '—') + (c.verifiedBy ? ' · ' + esc(c.verifiedBy) : '') + '</dd>' +
            '<dt>' + esc(t('Patient contact', 'बिरामी सम्पर्क')) + '</dt><dd>' + esc(c.phone || '—') + ' · ' + esc(c.patientEmail || '—') + '</dd><dt>' + esc(t('Doctor joined', 'डाक्टर जोडिए')) + '</dt><dd>' + esc(when(c.doctorJoinedAt) || '—') + '</dd><dt>' + esc(t('Patient joined', 'बिरामी जोडिए')) + '</dt><dd>' + esc(when(c.patientJoinedAt) || '—') + '</dd>' +
            '<dt>' + esc(t('Call', 'कल')) + '</dt><dd>' + (c.callStart ? esc(when(c.callStart)) + ' · ' + c.minutes + ' min' : '—') + '</dd>' + (c.followUp ? '<dt>' + esc(t('Follow-up', 'फलोअप')) + '</dt><dd>' + esc(fmt(c.followUp.due)) + '</dd>' : '') +
            '<dt>' + esc(t('Patient check', 'बिरामी जाँच')) + '</dt><dd>' + (c.check ? (c.check.answer === 'yes' ? '<b style="color:#9b1c1c">' + esc(t('YES — asked to go or pay outside NIKO', 'हो — बाहिर बोलाइएको')) + '</b>' + (c.check.note ? ': ' + esc(c.check.note) : '') : c.check.answer === 'no' ? esc(t('No', 'होइन')) : esc(t('question emailed, no answer yet', 'प्रश्न पठाइएको, जवाफ आएको छैन'))) : '—') + '</dd>' + (c.notes ? '<dt>' + esc(t('Doctor’s notes', 'डाक्टरको टिप्पणी')) + '</dt><dd style="white-space:pre-line">' + esc(c.notes) + '</dd>' : '') + '</dl>' +
            '<h4 style="margin:10px 0 4px">' + esc(t('What happened', 'घटनाक्रम')) + '</h4><ul class="small" style="margin:0;padding-left:18px">' + c.history.map(function (h) { return '<li>' + esc(when(h.at)) + ' — ' + esc(h.action) + '</li>'; }).join('') + '</ul>' +
            '<h4 style="margin:10px 0 4px">' + esc(t('Chat', 'च्याट')) + ' (' + c.chat.length + ')</h4>' + (c.chat.length ? '<div class="small">' + c.chat.map(function (m) { return '<div style="padding:5px 8px;border-radius:8px;margin-bottom:4px;background:' + (m.blocked ? '#fde8e8' : m.flags.length ? '#fff1d6' : '#f1f3f5') + '"><b>' + esc(m.from) + '</b> <span class="muted">' + esc(when(m.at)) + '</span>' + (m.blocked ? ' <span class="tag red">' + esc(t('blocked', 'रोकिएको')) + ': ' + esc(m.blocked) + '</span>' : '') + (m.flags.length ? ' <span class="tag amber">' + esc(m.flags.join(', ')) + '</span>' : '') + '<br>' + esc(m.text) + '</div>'; }).join('') + '</div>' : '<p class="small muted" style="margin:0">' + esc(t('No chat messages.', 'च्याट छैन ।')) + '</p>') + '</details>';
        }).join('') + '</div>' : '<p class="empty">' + esc(t('No video consultations yet.', 'भिडियो परामर्श छैन ।')) + '</p>'));
    }).catch(fail);
  };

  // ---------------------------------------------------- patient check after a call
  N.PAGES.check = function () {
    return X.head(t('One quick question', 'एउटा छोटो प्रश्न'), '') + '<section class="section"><div class="container" style="max-width:560px"><div class="card" id="chk"><p class="muted">' + esc(T('loading')) + '</p></div></div></section>';
  };
  function checkInit(token) {
    var el = $('#chk'); if (!el) return;
    fetch('api/p/check/' + encodeURIComponent(token || '')).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Error'); return j; }); }).then(function (j) {
      el.innerHTML = '<form class="form-grid" data-p2form="check" data-token="' + esc(token) + '"><p style="margin:0">' + esc(t('After your video consultation with', 'भिडियो परामर्शपछि —')) + ' <b>' + esc(j.doctorName) + '</b> (' + esc(fmt(j.date)) + '):</p><h2 style="margin:0;font-size:1.25rem">' + esc(t('Were you asked to visit or pay the doctor anywhere outside NIKO Hospital?', 'के तपाईंलाई निको अस्पताल बाहिर डाक्टरलाई भेट्न वा भुक्तानी गर्न भनिएको थियो?')) + '</h2>' +
        '<div class="yn"><label><input type="radio" name="answer" value="no" required><span>' + esc(t('No', 'होइन')) + '</span></label><label><input type="radio" name="answer" value="yes"><span>' + esc(t('Yes', 'हो')) + '</span></label></div>' +
        '<label class="f">' + esc(t('Anything you want to tell the Director (optional)', 'सञ्चालकलाई भन्न चाहेको कुरा (ऐच्छिक)')) + '<textarea name="note" maxlength="1000" rows="3"></textarea></label><p class="small muted" style="margin:0">' + esc(t('Only the hospital Director sees your answer.', 'तपाईंको जवाफ सञ्चालकले मात्र देख्नुहुन्छ ।')) + '</p><div class="msg" role="status"></div><button class="btn" type="submit">' + esc(t('Send', 'पठाउनुहोस्')) + '</button></form>';
    }).catch(function (e) { el.innerHTML = '<p class="alert">' + esc(e.message) + '</p>'; });
  }

  // -------------------------------------------------------------------- events
  function toggle(arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); arr.sort(); return i < 0; }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-p2]'); if (!el) return;
    var a = el.getAttribute('data-p2'), id = el.getAttribute('data-id'), d = el.getAttribute('data-d');
    if (a === 'w-day' || a === 'm-day') {
      var arr = a === 'w-day' ? W.days : M.days, on = toggle(arr, d);
      el.setAttribute('aria-pressed', on); el.parentNode.classList.toggle('on', on);
    } else if (a === 'cal') {
      var k = el.getAttribute('data-k'), list = k === 'visit' ? W.visit : k === 'off' ? W.off : k === 'm-visit' ? M.visit : M.off;
      var n = +(($('i', el) || {}).textContent || 0), was = list.indexOf(d) >= 0, closing = (k === 'visit' || k === 'm-visit') ? was : !was;
      if (n && closing && !confirm(n + ' ' + t('patients are already booked on this day. They will be asked to choose a new date. Continue?', 'बिरामी यो दिन बुक भइसकेका छन् । उनीहरूलाई नयाँ मिति छान्न भनिनेछ । अगाडि बढ्ने?'))) return;
      el.setAttribute('aria-pressed', toggle(list, d));
      var note = $('#calNote'); if (note && k === 'visit') note.textContent = W.visit.length + ' ' + t('visit dates chosen. A small number on a date shows patients already booked.', 'मिति छानिएको ।');
    } else if (a === 's-back') { W.step = Math.max(1, W.step - 1); drawSetup(); }
    else if (a === 'now') api('POST', 'api/d/now', { on: !!el.getAttribute('data-on') }).then(function (j) { toast(j.on ? t('You are shown as available now', 'तपाईं अहिले उपलब्ध देखिनुहुन्छ') : t('Switched off', 'बन्द गरियो')); X.reload(); }).catch(function (er) { toast(er.message); });
    else if (a === 'm-open') { M.sel = M.sel === id ? '' : id; TABS.doctors(); }
    else if (a === 'mon-doc') { e.preventDefault(); M.monF = Object.assign({ only: '' }, M.monF, { doc: id }); TABS.monitor(); }
    else if (a === 'mon-f') { M.monF = Object.assign({ doc: '' }, M.monF, { only: el.getAttribute('data-only') }); TABS.monitor(); }
    else if (a === 'del-ask') { var why = prompt(t('Your account is deleted by the Director after this request. Reason (optional):', 'यो अनुरोधपछि सञ्चालकले खाता मेटाउनुहुन्छ । कारण (ऐच्छिक):')); if (why === null) return; api('POST', 'api/acct/delete-request', { reason: why }).then(function (j) { P.me = Object.assign(P.me, j.account); toast(t('Request sent to the Director', 'अनुरोध पठाइयो')); X.reload(); }).catch(function (er) { toast(er.message); }); }
    else if (a === 'del-cancel') api('POST', 'api/acct/delete-request', { cancel: true }).then(function (j) { P.me = Object.assign(P.me, j.account); X.reload(); });
  });
  document.addEventListener('change', function (e) {
    var el = e.target, a = el.getAttribute && el.getAttribute('data-p2c'); if (!a) return;
    if (a === 'std' || a === 'm-std') { if (a === 'std') W.std = el.checked; else M.std = el.checked; var box = el.closest('form').querySelector('.dayrows'); if (box) box.classList.toggle('std', el.checked); }
    else if (a === 'm-emp') { var f = el.closest('form'); api('POST', 'api/d/doctors/' + f.getAttribute('data-id'), { employment: el.value }).then(function () { toast(t('Saved', 'सेभ भयो')); TABS.doctors(); }).catch(function (er) { toast(er.message); }); }
    else if (a === 'photo' && el.files && el.files[0]) {
      var fd = new FormData(); fd.append('file', el.files[0]);
      api('POST', 'api/p/photo', fd, true).then(function (j) { var f2 = el.closest('form'); f2.querySelector('[name=photo]').value = j.url; var im = $('#p2Photo', f2); if (im) im.src = j.url; toast(t('Photo added', 'फोटो थपियो')); }).catch(function (er) { toast(er.message); });
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-p2form'); if (!kind) return;
    e.preventDefault();
    var btn = $('button[type=submit]', f), data = {};
    new FormData(f).forEach(function (v, k) { if (typeof v === 'string') { if (data[k] !== undefined) data[k] = [].concat(data[k], v); else data[k] = v; } });
    function bad(er) { X.msgBox(f, er.message || er); if (btn) btn.disabled = false; }
    function good(m) { X.msgBox(f, m, true); if (btn) btn.disabled = false; }
    if (btn) btn.disabled = true;
    if (kind === 'setup') {
      var step = f.getAttribute('data-step');
      api('POST', 'api/d/setup', collect(f, step)).then(function (j) {
        P.me = Object.assign(P.me, j.account); window.NIKO_ACCT = P.me;
        if (step === 'finish') { N.afterMe().then(function () { toast(t('Sent to the Director for approval', 'स्वीकृतिका लागि पठाइयो')); location.hash = '#/dashboard/profile'; N.renderAll(); }); return; }
        W.step += 1; loadSetup(drawSetup);
      }).catch(bad);
    } else if (kind === 'details') {
      var b = collect(f, 'all'); b.finish = true; b.agree = W.j.agreed || undefined;
      api('POST', 'api/d/setup', b).then(function (j) { N.afterMe(); toast(j.pending ? t('Sent to the Director for approval', 'स्वीकृतिका लागि पठाइयो') : t('Saved', 'सेभ भयो')); X.reload(); }).catch(bad);
    } else if (kind === 'sched') {
      api('POST', 'api/d/setup', collect(f, 'sched')).then(function (j) { toast(j.live ? t('Saved — live on the website now', 'सेभ भयो — वेबसाइटमा लागू') + (j.affected ? ' · ' + j.affected + ' ' + t('booked patients asked to choose a new date', 'बिरामीलाई नयाँ मिति छान्न भनियो') : '') : t('Saved — waiting for the Director’s approval', 'सेभ भयो — स्वीकृतिको पर्खाइमा')); N.afterMe(); X.reload(); }).catch(bad);
    } else if (kind === 'm-save') {
      var body = { degreeLevel: data.degreeLevel };
      if (M.emp === 'visiting') body.visitDates = M.visit;
      else if (M.j.full) {
        body.days = M.days; body.off = M.off; if (M.std) body.useStandard = true; else body.dayHours = readDayHours(f);
        if ($('[name=videoConsult]', f)) body.videoConsult = !!data.videoConsult;
        var vh = {}; DAYS.forEach(function (x) { var a1 = $('[data-vh="' + x + '-0"]', f), b1 = $('[data-vh="' + x + '-1"]', f); vh[x] = a1 && b1 && a1.value && b1.value && a1.value < b1.value ? a1.value + '-' + b1.value : ''; });
        if ($('[data-vh]', f)) body.videoHours = vh;
      }
      if (!M.j.full) delete body.degreeLevel;
      api('POST', 'api/d/doctors/' + f.getAttribute('data-id'), body).then(function (j) { toast(t('Saved — live now', 'सेभ भयो — लागू') + (j.affected ? ' · ' + j.affected + ' ' + t('booked patients asked to choose a new date', 'बिरामीलाई नयाँ मिति छान्न भनियो') : '')); TABS.doctors(); }).catch(bad);
    } else if (kind === 'set-basic') {
      api('POST', 'api/acct/settings', { name: data.name, phone: data.phone, lang: data.lang }).then(function (j) {
        P.me = Object.assign(P.me, j.account); window.NIKO_ACCT = P.me;
        if (data.lang !== N.lang) { var lb = document.querySelector('[data-act=lang]'); if (lb) { lb.click(); return; } }
        good(t('Saved', 'सेभ भयो')); X.refreshChrome();
      }).catch(bad);
    } else if (kind === 'set-mail') {
      var onList = [].concat(data.on || []), offMap = {}; ['notice', 'lab', 'requests', 'schedule', 'account'].forEach(function (c) { if (onList.indexOf(c) < 0) offMap[c] = true; });
      api('POST', 'api/acct/settings', { emailOff: offMap }).then(function (j) { P.me = Object.assign(P.me, j.account); good(t('Saved', 'सेभ भयो')); }).catch(bad);
    } else if (kind === 'set-email') {
      var codeBox = $('#emCode', f);
      if (codeBox.hidden) api('POST', 'api/acct/email/start', { email: data.email, password: data.password }).then(function (j) { codeBox.hidden = false; good(t('We sent a code to the new email. Enter it and press the button again.', 'नयाँ इमेलमा कोड पठाइयो ।') + (j.devCode ? ' (test: ' + j.devCode + ')' : '')); $('input', codeBox).focus(); }).catch(bad);
      else api('POST', 'api/acct/email/confirm', { code: data.code }).then(function (j) { P.me = Object.assign(P.me, j.account); toast(t('Email changed', 'इमेल बदलियो')); X.reload(); }).catch(bad);
    } else if (kind === 'check') {
      fetch('api/p/check/' + encodeURIComponent(f.getAttribute('data-token')), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'niko-app' }, body: JSON.stringify({ answer: data.answer, note: data.note }) })
        .then(function (r) { if (!r.ok) throw new Error('Could not send. Please try again.'); f.innerHTML = '<div class="done-box"><div class="tick">' + icon('check') + '</div><h2>' + esc(t('Thank you', 'धन्यवाद')) + '</h2><p>' + esc(t('Your answer was sent to the hospital Director.', 'तपाईंको जवाफ सञ्चालकलाई पठाइयो ।')) + '</p></div>'; }).catch(bad);
    }
  });
}());
