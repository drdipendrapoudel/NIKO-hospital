/* NIKO Hospital — admin panel. Edit everything on the website and see the change live on the right. */
(function () {
  'use strict';
  var I = window.NIKO_I18N;
  var A = {
    content: null, saved: '', tab: 'hospital', demo: false, user: '', open: {}, filter: {},
    previewDevice: 'phone', previewRoute: '#/', previewReady: false, inbox: { bookings: [], feedback: [], questions: [] }, sheet: null,
  };

  // ---------------------------------------------------------------- helpers
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isBi(v) { return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2 && 'en' in v && 'ne' in v; }
  function get(path) { return path.reduce(function (o, k) { return o == null ? o : o[k]; }, A.content); }
  function set(path, val) { var o = A.content; for (var i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = val; changed(); }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function req(method, url, body, isForm) {
    var h = { 'X-Requested-With': 'niko-admin' };
    if (body && !isForm) h['Content-Type'] = 'application/json';
    return fetch(url, { method: method, headers: h, body: isForm ? body : body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('Error ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function humanize(k) { return String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function L(v) { return isBi(v) ? (v.en || v.ne) : typeof v === 'string' ? v : ''; }

  // ------------------------------------------------------------- schema hints
  var LABELS = {
    phone24: '24-hour emergency phone', phones: 'Other phone numbers (one per line)', whatsapp: 'WhatsApp number', ambulance: 'Ambulance number (leave empty if none)',
    shortName: 'Short name', directionsUrl: 'Google Maps directions link', placeUrl: 'Google Maps place link', mapEmbedUrl: 'Google Map embed (paste the whole <iframe> code or its link)',
    openingHours: 'Opening hours text', latitude: 'Latitude', longitude: 'Longitude', beds: 'Number of beds',
    registeredWith: 'Registered with', registrationNo: 'Hospital registration number', panNo: 'PAN number', companyRegNo: 'Company registration number',
    licenceNo: 'Licence / permit number', licenceAuthority: 'Licence issued by', showOnWebsite: 'Show these numbers on the website',
    nmc: 'NMC number', dept: 'Department', degrees: 'Qualifications / degrees', affiliation: 'Other hospital / institution', focus: 'Clinical focus (one per line)',
    languages: 'Languages spoken (one per line)', days: 'OPD days', monthlyWeek: 'Monthly visit — which week (0 = not a monthly visitor)', monthlyDay: 'Monthly visit — day',
    scheduleNote: 'Schedule text shown to patients', hours: 'OPD hours (e.g. 09:00-13:00, 15:00-17:00). Empty = default hours',
    photo: 'Photo', image: 'Photo', logo: 'Logo', featured: 'Show on home page', visible: 'Show on website', lockFromForm: 'Ignore Google Form answers for this doctor',
    keywords: 'Search words & symptoms (one per line)', what: 'What is it?', symptoms: 'Symptoms', prepare: 'How to prepare (empty = general text)', treatment: 'What happens during treatment',
    recovery: 'Recovery', urgent: 'When to come to Emergency (red box)', open247: 'Show “Open 24 hours” badge', short: 'Short line', important: 'Important (shows a popup on the home page)',
    pinned: 'Pin to top', expires: 'Hide after this date (optional)', attachment: 'Attached PDF (optional)', link: 'Link (optional)', kind: 'Type', buttonText: 'Button text', buttonLink: 'Button link',
    doctorSheetCsvUrl: 'Google Sheet link (File → Share → Publish to web → CSV)', doctorSheetAutoPublish: 'Publish form answers immediately (off = only rows marked “Approved: Yes”)',
    sheetRefreshSeconds: 'Check the sheet every … seconds', googleReviewUrl: 'Google review link (from Google Business Profile → “Ask for reviews”)', googlePlaceId: 'Google Place ID (for showing Google reviews)', showGoogleReviews: 'Show Google reviews',
    defaultHours: 'Default OPD hours', slotMinutes: 'Minutes per appointment', maxPerSlot: 'Patients per time slot', daysAhead: 'How many days ahead patients can book', closedDates: 'Closed dates (YYYY-MM-DD, one per line)',
    notifyEmail: 'Send new bookings to this email', notifyWhatsApp: 'Send new bookings to this WhatsApp number', askEmail: 'Ask for email', askAge: 'Ask for age & gender', enabled: 'Turned on',
    tiktokUsername: 'TikTok username (or paste the embed code)', showFacebookFeed: 'Show Facebook page feed', showTiktokFeed: 'Show TikTok videos', customEmbedHtml: 'Extra embed code (Instagram/YouTube etc.)',
    noticeTicker: 'Show scrolling notice bar', importantNoticePopup: 'Show popup for important notices', webmailUrl: 'Webmail address', photoNo: 'Photo number',
    baseFontSize: 'Text size (px)', headingScale: 'Heading size', radius: 'Box corner roundness (px)', buttonRadius: 'Button corner roundness (px)', containerWidth: 'Page width (px)', sectionSpacing: 'Space between sections (px)',
    cardMinWidth: 'Card / box width (px)', doctorPhotoHeight: 'Doctor photo height (px)', slideshowHeight: 'Slideshow height on computer (px)', slideshowHeightMobile: 'Slideshow height on phone (px)', slideIntervalSeconds: 'Seconds per slide',
    tableFontSize: 'Table text size (px)', logoSize: 'Logo size (px)', primaryDark: 'Primary dark', mutedText: 'Muted text', fontFamily: 'Font style',
    conditionPrepare: 'General “How to prepare” text', conditionDisclaimer: 'Health information disclaimer', portalIntro: 'Patient portal text', footerNote: 'Footer copyright text',
    patientName: 'Patient name (or initials)', consent: 'Patient gave written consent to publish',
    eyebrow: 'Small label above the title', tab: 'Short text on the slide tab', seconds: 'Show this slide for … seconds', startDate: 'Show from (optional)', endDate: 'Show until (optional)',
    degreeLevel: 'Degree level (sets video consultation fee)', videoConsult: 'Takes video consultations', fonepayQr: 'Fonepay QR code image', esewaQr: 'eSewa QR code image', accountName: 'Account name shown under the QR',
    feeMD: 'Video consultation fee – MD doctors (Rs)', feeDM: 'Video consultation fee – DM doctors (Rs)', homeCollectionFee: 'Home collection charge (Rs, 0 = free)', collectionSlots: 'Collection time slots (one per line)',
    homeCollection: 'Offer home sample collection', notFor: 'Warning text (not for emergencies)', price: 'Price (Rs, empty = ask at the hospital)', forWhom: 'Who it is for', tests: 'Tests included',
    sample: 'Sample', fasting: 'Needs fasting', category: 'Category', showOnHome: 'Show on the home page', author: 'Written by', caption: 'Caption', pillarsImage: 'Photo in the middle of “Why NIKO”',
    articleCount: 'How many articles to show on the home page', officerName: 'Officer’s name', year: 'Year',
  };
  var HELP = {
    mapEmbedUrl: 'Google Maps → Share → Embed a map → Copy HTML, then paste here.',
    doctorSheetCsvUrl: 'Doctors who fill the Google Form appear on the website automatically within a minute.',
    photo: 'Upload a portrait photo. It is resized automatically.',
    hours: 'Used to make booking time slots.',
    notifyWhatsApp: 'Automatic WhatsApp needs the WhatsApp Business API (see README). Without it, patients get a button to send the booking to this number.',
    googlePlaceId: 'Also needs GOOGLE_PLACES_API_KEY in the server settings (.env).',
    id: 'Used in web links. Letters, numbers and dashes only.',
  };
  var RANGES = { baseFontSize: [14, 22, 1], headingScale: [0.8, 1.5, 0.05], radius: [0, 30, 1], buttonRadius: [0, 30, 1], containerWidth: [900, 1600, 10], sectionSpacing: [24, 120, 4],
    cardMinWidth: [180, 420, 10], doctorPhotoHeight: [140, 420, 10], slideshowHeight: [280, 800, 10], slideshowHeightMobile: [180, 520, 10], slideIntervalSeconds: [3, 15, 1], tableFontSize: [12, 20, 1], logoSize: [32, 96, 2] };
  var SELECTS = {
    kind: [['news', 'News'], ['event', 'Event']], type: [['notice', 'Notice'], ['vacancy', 'Vacancy']],
    degreeLevel: [['MD', 'MD / MS (Rs 700)'], ['DM', 'DM / MCh (Rs 950)']],
    category: [['success', 'Success story'], ['launch', 'New service'], ['news', 'News'], ['health', 'Health alert / epidemic'], ['director', 'Director’s article']],
    gender: [['', '—'], ['Male', 'Male'], ['Female', 'Female']], monthlyDay: [['', '—'], ['Sun', 'Sunday'], ['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday']],
    fontFamily: [['system', 'Clean (default)'], ['rounded', 'Rounded'], ['serif', 'Classic serif']],
    icon: ['emergency', 'stethoscope', 'heart', 'drop', 'lungs', 'bone', 'brain', 'female', 'ear', 'skin', 'mind', 'child', 'scalpel', 'kidney', 'scan', 'mask', 'star', 'bed', 'pill', 'clock', 'file', 'user'].map(function (x) { return [x, x]; }),
  };
  var LONG = /^(intro|notFor|body|message|description|summary|what|symptoms|prepare|treatment|recovery|urgent|bio|story|text|a|intro|mission|vision|privacy|portalIntro|conditionPrepare|conditionDisclaimer|instructions|note)$/;
  var IMAGES = /^(image|photo|logo|fonepayQr|esewaQr|pillarsImage)$/;
  var HIDE = { meta: 1, answeredQuestions: 1, notifyChannels: 1, source: 1, fromForm: 1 };
  var COLORS = /^(primary|primaryDark|accent|emergency|background|surface|text|mutedText)$/;

  var t = function (en, ne) { return { en: en || '', ne: ne || '' }; };
  var TEMPLATES = {
    slides: function () { return { image: 'img/ph/P19.svg', photoNo: '', eyebrow: t(), title: t('New slide'), tab: t(), text: t(), buttonText: t(), buttonLink: '#/book', seconds: 6, startDate: '', endDate: '', visible: true }; },
    articles: function () { return { id: 'a' + Date.now().toString(36), category: 'news', date: new Date().toISOString().slice(0, 10), image: 'img/P01-building-wide.jpg', title: t('New article'), summary: t(), body: t(), author: t('NIKO Hospital'), showOnHome: true, visible: true }; },
    gallery: function () { return { image: 'img/ph/P19.svg', caption: t(), visible: true }; },
    pillars: function () { return { title: t('Reason'), text: t(), icon: 'star', visible: true }; },
    packages: function () { return { id: 'pkg-' + Date.now().toString(36), name: t('New package'), price: '', forWhom: t(), tests: [], description: t(), visible: true }; },
    tests: function () { return { id: 'test-' + Date.now().toString(36), category: 'Other', name: 'New test', price: '', sample: 'Blood', fasting: false, homeCollection: true, visible: true }; },
    stats: function () { return { value: '0', label: t('Label') }; },
    departments: function () { return { id: 'new-dept-' + Date.now().toString(36), name: t('New department'), icon: 'stethoscope', summary: t(), keywords: [], image: '' }; },
    doctors: function () { return { id: 'D' + Date.now().toString(36).slice(-4), name: t('Dr. '), title: t(), dept: '', degrees: '', nmc: '', affiliation: '', gender: '', languages: ['Nepali', 'English'], days: [], monthlyWeek: 0, monthlyDay: '', scheduleNote: t(), hours: '', photo: 'img/ph/P19.svg', focus: [], bio: t(), featured: false, visible: true, lockFromForm: false }; },
    conditions: function () { return { id: 'condition-' + Date.now().toString(36), dept: '', name: t('New condition'), keywords: [], what: t(), symptoms: t(), prepare: t(), treatment: t(), recovery: t(), urgent: t(), visible: true }; },
    facilities: function () { return { id: 'facility-' + Date.now().toString(36), name: t('New facility'), short: t(), description: t(), image: 'img/ph/P19.svg', photoNo: '', open247: false, visible: true }; },
    services: function () { return { name: t('New service'), description: t(), icon: 'stethoscope', visible: true }; },
    notices: function () { return { id: 'n' + Date.now().toString(36), type: 'notice', important: false, pinned: false, date: new Date().toISOString().slice(0, 10), title: t('New notice'), body: t(), link: '', attachment: '', expires: '', visible: true }; },
    news: function () { return { id: 'e' + Date.now().toString(36), kind: 'news', date: new Date().toISOString().slice(0, 10), image: 'img/ph/P18.svg', photoNo: '', title: t('New item'), summary: t(), body: t(), visible: true }; },
    stories: function () { return { title: t('Patient story'), patientName: '', condition: t(), dept: '', image: '', story: t(), date: new Date().toISOString().slice(0, 10), consent: false, visible: true }; },
    testimonials: function () { return { name: '', text: t(), rating: 5, source: 'Patient', date: '', visible: true }; },
    accreditations: function () { return { name: t('New award or recognition'), detail: t(), year: '', image: '', visible: true }; },
    faq: function () { return { q: t('Question?'), a: t(), visible: true }; },
  };

  var TABS = [
    ['Website', [
      ['hospital', 'Hospital details', '#/contact', 'Name, address, phone numbers and map. These appear in the top bar, footer and contact page.'],
      ['registration', 'Registration numbers', '#/about', 'Registration, PAN and licence numbers.'],
      ['theme', 'Colours & sizes', '#/', 'Brand colours, text size, box sizes, slideshow height and more.'],
      ['home', 'Home page sections', '#/', 'Show, hide, rename and re-order the sections of the home page.'],
      ['slides', 'Slideshow', '#/', 'Pictures at the top of the home page. Add event photos here.'],
      ['stats', 'Numbers strip', '#/', 'The numbers shown under the slideshow.'],
      ['about', 'About us', '#/about', ''],
      ['director', 'Director’s message', '#/about', ''],
      ['departments', 'Departments', '#/departments', ''],
      ['doctors', 'Doctors', '#/doctors', 'Doctors who fill in the Google Form are added automatically (see “Doctor form & Google”). You can also add or edit doctors here.'],
      ['conditions', 'Conditions we treat', '#/conditions', 'Patient-friendly pages. Write in simple words.'],
      ['facilities', 'Facilities & diagnostics', '#/facilities', ''],
      ['services', 'Services', '#/facilities', ''],
      ['notices', 'Notices & vacancies', '#/notices', 'Mark a notice “Important” to show it as a popup on the home page.'],
      ['news', 'News & events', '#/news', ''],
      ['stories', 'Patient stories', '#/stories', 'Only publish with the patient’s written consent.'],
      ['testimonials', 'Testimonials', '#/feedback', 'Short patient reviews. Feedback can be published here from the Feedback inbox.'],
      ['accreditations', 'Accreditations', '#/about', ''],
      ['faq', 'FAQ', '#/qa', ''],
      ['social', 'Social media', '#/contact', 'Paste your page links. Facebook and TikTok feeds show on the home and contact pages.'],
      ['booking', 'Booking settings', '#/book', ''],
      ['articles', 'Articles (stories, news, health alerts)', '#/articles', 'Success stories, new services, news and your own articles. Choose “Show on the home page”, and set how many in Home page sections → Articles count.'],
      ['gallery', 'Gallery', '#/gallery', 'Photos of the hospital and events.'],
      ['pillars', 'Why NIKO (reasons)', '#/', 'The 4–5 reasons shown around a photo on the home page.'],
      ['consult', 'Video consultation', '#/consult', 'Fees and text for video consultation. In Doctors, set each doctor’s degree level (MD/DM) and whether they take video consultations.'],
      ['payments', 'Payment QR codes', '#/consult', 'Upload your Fonepay and eSewa QR codes. Used for video consultation and lab bookings.'],
      ['lab', 'Lab tests', '#/lab', 'The list of lab tests and prices patients can book. The current list is a template — replace it with the hospital’s list.'],
      ['packages', 'Health check-up packages', '#/packages', ''],
      ['grievance', 'Grievance officer', '#/grievance', 'Information & Grievance Officer details shown on the complaint page.'],
      ['pages', 'Other page text', '#/privacy', ''],
      ['ui', 'Menu & button text', '#/', 'Change any built-in menu or button text. Leave empty to use the default (shown in grey).'],
    ]],
    ['Inbox', [['bookings', 'Appointments', '#/book'], ['feedback', 'Feedback', '#/feedback'], ['questions', 'Questions', '#/qa'], ['webaccounts', 'Website accounts & Director', null]]],
    ['Settings', [['integrations', 'Doctor form & Google', '#/doctors'], ['staffMail', 'Staff email', '#/staff-mail'], ['account', 'Account & users', null], ['history', 'Undo / history', null]]],
  ];
  function tabInfo(k) { var r; TABS.forEach(function (g) { g[1].forEach(function (x) { if (x[0] === k) r = x; }); }); return r; }

  // ---------------------------------------------------------------- startup
  function start() {
    req('GET', 'api/me').then(function (j) { A.user = j.user; A.channels = j.channels; return loadContent(); })
      .catch(function (e) { if (e.status === 401) loginScreen(); else { A.demo = true; loginScreen(); } });
  }
  function loginScreen(msg) {
    $('#app').innerHTML = '<div class="login"><form id="loginForm"><img src="img/logo.png" alt=""><h1>NIKO Hospital — Staff login</h1>' +
      (A.demo ? '<p class="banner">Preview mode (no server). Use password <b>demo</b>. Changes are kept only until you close this page.</p>' : '') +
      '<label class="f"><span class="lbl">Username</span><input name="username" autocomplete="username" required value="admin"></label>' +
      '<label class="f"><span class="lbl">Password</span><input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn" type="submit">Log in</button><div class="err" role="alert">' + esc(msg || '') + '</div><a href="./" class="small">← Back to website</a></form></div>';
    $('#loginForm').password.focus();
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (A.demo) { if (f.password.value !== 'demo') { $('.err', f).textContent = 'Wrong password'; return; } A.user = 'demo'; loadContent(); return; }
      req('POST', 'api/login', { username: f.username.value, password: f.password.value }).then(function (j) { A.user = j.user; loadContent(); }).catch(function (err) { $('.err', f).textContent = err.message; });
    });
  }
  function loadContent() {
    var p = A.demo ? Promise.resolve(clone(window.NIKO_DEFAULT || {})) : req('GET', 'api/admin/content');
    return p.then(function (c) {
      if (A.demo) { try { var s = localStorage.getItem('niko_admin_demo'); if (s) c = JSON.parse(s); } catch (e) {} }
      A.content = normalize(c); A.saved = JSON.stringify(A.content); layout(); loadInbox();
    });
  }
  function normalize(c) {
    Object.keys(TEMPLATES).forEach(function (k) {
      if (!Array.isArray(c[k])) c[k] = [];
      c[k] = c[k].map(function (item) { var tpl = TEMPLATES[k](); Object.keys(item).forEach(function (x) { tpl[x] = item[x]; }); return tpl; });
    });
    c.ui = c.ui || { en: {}, ne: {} }; c.ui.en = c.ui.en || {}; c.ui.ne = c.ui.ne || {};
    return c;
  }

  // ----------------------------------------------------------------- layout
  function layout() {
    $('#app').innerHTML = '<div class="shell"><div class="top"><img src="' + esc(A.content.hospital.logo) + '" alt="" width="32" height="32" style="border-radius:50%;background:#fff"><b>' + esc(L(A.content.hospital.shortName)) + ' — Admin</b>' +
      '<span class="status" id="status"></span><span class="sp"></span>' +
      '<button class="btn ghost sm pv-toggle" data-a="pv-toggle">Preview</button><a class="btn ghost sm" href="./" target="_blank" rel="noopener">View website ↗</a>' +
      '<button class="btn save sm" id="saveBtn" data-a="save">Saved ✓</button><button class="btn ghost sm" data-a="logout">Log out</button></div>' +
      '<div class="body"><nav class="side" aria-label="Sections">' + TABS.map(function (g) { return '<h4>' + g[0] + '</h4>' + g[1].map(function (x) { return '<button data-tab="' + x[0] + '"' + (A.tab === x[0] ? ' aria-current="true"' : '') + '>' + esc(x[1]) + '<span class="count" id="cnt-' + x[0] + '" hidden></span></button>'; }).join(''); }).join('') + '</nav>' +
      '<section class="editor" id="editor" aria-live="polite"></section>' +
      '<aside class="pv" id="pv" aria-label="Live preview"><div class="bar"><b class="small">Live preview</b><select id="pvRoute" aria-label="Preview page">' +
      [['#/', 'Home'], ['#/about', 'About'], ['#/departments', 'Departments'], ['#/doctors', 'Doctors'], ['#/conditions', 'Conditions'], ['#/facilities', 'Facilities'], ['#/book', 'Booking'], ['#/notices', 'Notices'], ['#/news', 'News'], ['#/stories', 'Stories'], ['#/feedback', 'Feedback'], ['#/qa', 'Q&A'], ['#/contact', 'Contact'], ['#/portal', 'Portal'], ['#/privacy', 'Privacy']]
        .map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>' +
      '<button class="btn ghost sm" data-a="dev" data-d="phone" aria-pressed="' + (A.previewDevice === 'phone') + '">Phone</button><button class="btn ghost sm" data-a="dev" data-d="desktop" aria-pressed="' + (A.previewDevice === 'desktop') + '">Computer</button>' +
      '<button class="btn ghost sm pv-toggle" data-a="pv-toggle" aria-label="Close preview">✕</button></div><div class="stage" id="stage"></div></aside></div></div>';
    makePreview();
    renderTab();
    status();
  }
  function status() {
    var dirty = JSON.stringify(A.content) !== A.saved, b = $('#saveBtn');
    if (!b) return;
    b.textContent = dirty ? 'Save changes' : 'Saved ✓'; b.classList.toggle('dirty', dirty);
    $('#status').textContent = dirty ? 'Unsaved changes — visible in preview only' : (A.content.meta && A.content.meta.updatedAt ? 'Last saved ' + new Date(A.content.meta.updatedAt).toLocaleString() : '');
  }
  var pvTimer = null;
  function changed() { status(); clearTimeout(pvTimer); pvTimer = setTimeout(sendPreview, 120); }

  // ---------------------------------------------------------------- preview
  function makePreview() {
    var stage = $('#stage');
    var fr = document.createElement('iframe');
    fr.name = 'niko-preview'; fr.title = 'Website preview';
    if (window.NIKO_PREVIEW_SRCDOC) fr.srcdoc = window.NIKO_PREVIEW_SRCDOC; else fr.src = 'index.html?preview=1' + A.previewRoute;
    stage.appendChild(fr);
    fitPreview();
  }
  function fitPreview() {
    var stage = $('#stage'), fr = $('#stage iframe'); if (!stage || !fr) return;
    var w = A.previewDevice === 'phone' ? 390 : 1280, sw = stage.clientWidth || 360, sh = stage.clientHeight || 600;
    var scale = Math.min(1, sw / w);
    fr.style.width = w + 'px'; fr.style.height = (sh / scale) + 'px'; fr.style.transform = 'scale(' + scale + ')';
    if (A.previewDevice === 'phone' && sw > w) fr.style.left = ((sw - w) / 2) + 'px'; else fr.style.left = '0';
  }
  function sendPreview(route) {
    var fr = $('#stage iframe'); if (!fr || !fr.contentWindow) return;
    var c = clone(A.content);
    c.answeredQuestions = A.inbox.questions.filter(function (q) { return q.published && q.answer; }).map(function (q) { return { q: q.question, a: q.answer }; });
    fr.contentWindow.postMessage({ type: 'niko-content', content: c, route: route }, '*');
  }
  window.addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.type === 'niko-preview-ready') { A.previewReady = true; sendPreview(A.previewRoute); }
    if (m.type === 'niko-route' && m.route) { A.previewRoute = m.route; var s = $('#pvRoute'); if (s) s.value = m.route.split('?')[0].replace(/^(#\/[^/]*).*/, '$1'); }
  });
  window.addEventListener('resize', fitPreview);

  // ------------------------------------------------------------------- tabs
  function renderTab() {
    var info = tabInfo(A.tab) || ['', ''], ed = $('#editor'), k = A.tab;
    $$('.side button').forEach(function (b) { b.setAttribute('aria-current', b.getAttribute('data-tab') === k); });
    var head = '<h2>' + esc(info[1]) + '</h2>' + (info[3] ? '<p class="intro">' + esc(info[3]) + '</p>' : '');
    if (INBOX[k]) { ed.innerHTML = head + '<div id="inboxBody">Loading…</div>'; INBOX[k](); }
    else if (k === 'ui') ed.innerHTML = head + uiEditor();
    else if (k === 'integrations') ed.innerHTML = head + formHelp() + fieldsFor(['integrations'], A.content.integrations) + '<div id="sheetBox"></div>';
    else if (Array.isArray(A.content[k])) ed.innerHTML = head + listEditor([k], A.content[k], k);
    else if (A.content[k] && typeof A.content[k] === 'object') ed.innerHTML = head + fieldsFor([k], A.content[k]);
    else ed.innerHTML = head + '<p>Nothing to edit.</p>';
    if (k === 'integrations') loadSheet();
    if (info[2]) { A.previewRoute = info[2]; var s = $('#pvRoute'); if (s) s.value = info[2]; sendPreview(info[2]); }
    ed.scrollTop = 0;
  }

  // -------------------------------------------------------------- fields
  function pathAttr(p) { return esc(JSON.stringify(p)); }
  function fieldsFor(path, obj) {
    var keys = Object.keys(obj).filter(function (k) { return !HIDE[k]; });
    var simple = keys.filter(function (k) { var v = obj[k]; return !(Array.isArray(v) && v.length && typeof v[0] === 'object') && !(v && typeof v === 'object' && !Array.isArray(v) && !isBi(v)); });
    var complex = keys.filter(function (k) { return simple.indexOf(k) < 0; });
    return simple.map(function (k) { return field(path.concat(k), k, obj[k]); }).join('') +
      complex.map(function (k) { var v = obj[k]; return Array.isArray(v) ? '<fieldset><legend>' + esc(LABELS[k] || humanize(k)) + '</legend>' + listEditor(path.concat(k), v, k) + '</fieldset>' : '<fieldset><legend>' + esc(LABELS[k] || humanize(k)) + '</legend>' + fieldsFor(path.concat(k), v) + '</fieldset>'; }).join('');
  }
  function field(path, k, v) {
    var id = 'f_' + path.join('_').replace(/[^\w]/g, '_'), label = LABELS[k] || humanize(k), help = HELP[k] ? '<span class="help">' + esc(HELP[k]) + '</span>' : '';
    var pa = pathAttr(path);
    if (k === 'photoNo') return v ? '<p class="small muted" style="margin:-6px 0 10px">Photo number: <b>' + esc(v) + '</b> — staff photo with this number goes here.</p>' : '';
    if (isBi(v)) {
      var long = LONG.test(k) || (v.en || '').length > 90;
      var inp = function (l) { return long ? '<textarea data-p="' + esc(JSON.stringify(path.concat(l))) + '" id="' + id + l + '" rows="' + Math.min(8, Math.max(2, Math.ceil(((v[l] || v.en || '').length) / 70))) + '"' + (l === 'ne' ? ' lang="ne"' : '') + ' placeholder="' + (l === 'ne' ? 'नेपालीमा (खाली छोडे अंग्रेजी देखिन्छ)' : '') + '">' + esc(v[l]) + '</textarea>' : '<input data-p="' + esc(JSON.stringify(path.concat(l))) + '" id="' + id + l + '" value="' + esc(v[l]) + '"' + (l === 'ne' ? ' lang="ne" placeholder="नेपालीमा"' : '') + '>'; };
      return '<div class="f"><span class="lbl">' + esc(label) + '</span><div class="bi"><div><small>ENGLISH</small>' + inp('en') + '</div><div><small>नेपाली</small>' + inp('ne') + '</div></div>' + help + '</div>';
    }
    if (typeof v === 'boolean') return '<div class="f"><label class="chk"><input type="checkbox" data-p="' + pa + '" data-type="bool"' + (v ? ' checked' : '') + '> ' + esc(label) + '</label>' + help + '</div>';
    if (typeof v === 'number') {
      var r = RANGES[k];
      if (r) return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><div class="range"><input type="range" min="' + r[0] + '" max="' + r[1] + '" step="' + r[2] + '" value="' + v + '" data-p="' + pa + '" data-type="num" aria-label="' + esc(label) + '"><input type="number" id="' + id + '" min="' + r[0] + '" max="' + r[1] + '" step="' + r[2] + '" value="' + v + '" data-p="' + pa + '" data-type="num"></div>' + help + '</div>';
      return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><input type="number" id="' + id + '" value="' + v + '" data-p="' + pa + '" data-type="num">' + help + '</div>';
    }
    if (Array.isArray(v)) {
      if (k === 'days') return '<div class="f"><span class="lbl">' + esc(label) + '</span><div class="days">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d) { return '<label><input type="checkbox" data-days="' + pa + '" value="' + d + '"' + (v.indexOf(d) > -1 ? ' checked' : '') + '>' + d + '</label>'; }).join('') + '<button type="button" class="btn ghost sm" data-a="alldays" data-p="' + pa + '">Every day</button></div></div>';
      return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" data-p="' + pa + '" data-type="lines" rows="' + Math.min(6, Math.max(2, v.length + 1)) + '">' + esc(v.map(L).join('\n')) + '</textarea>' + help + '</div>';
    }
    v = v == null ? '' : String(v);
    if (IMAGES.test(k)) return '<div class="f"><span class="lbl">' + esc(label) + '</span><div class="img-field"><img class="thumb" src="' + esc(v) + '" alt="" id="th_' + id + '"><div class="ctl"><input data-p="' + pa + '" value="' + esc(v) + '" aria-label="' + esc(label) + ' link" placeholder="Image link or upload →"><div class="btns"><label class="btn sm">Upload photo<input type="file" accept="image/*" data-upload="' + pa + '" data-kind="' + k + '"></label>' + (v ? '<button type="button" class="btn ghost sm" data-a="clear" data-p="' + pa + '">Remove</button>' : '') + '</div></div></div>' + help + '</div>';
    if (k === 'attachment') return '<div class="f"><span class="lbl">' + esc(label) + '</span><div class="btns" style="display:flex;gap:6px;align-items:center"><input data-p="' + pa + '" value="' + esc(v) + '" placeholder="Link to PDF"><label class="btn sm">Upload PDF<input type="file" accept="application/pdf,image/*" data-upload="' + pa + '" data-kind="file" style="display:none"></label></div></div>';
    if (COLORS.test(k)) return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><div class="color"><input type="color" value="' + esc(v) + '" data-p="' + pa + '" aria-label="' + esc(label) + '"><input id="' + id + '" value="' + esc(v) + '" data-p="' + pa + '" style="max-width:130px"></div></div>';
    if (k === 'dept') return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" data-p="' + pa + '"><option value="">—</option>' + A.content.departments.map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === v ? ' selected' : '') + '>' + esc(L(d.name)) + '</option>'; }).join('') + '</select></div>';
    if (SELECTS[k]) return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '" data-p="' + pa + '">' + SELECTS[k].map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + (SELECTS[k].some(function (o) { return o[0] === v; }) ? '' : '<option selected value="' + esc(v) + '">' + esc(v) + '</option>') + '</select></div>';
    if (/^(date|expires)$/.test(k)) return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><input type="date" id="' + id + '" value="' + esc(v) + '" data-p="' + pa + '" style="max-width:220px"></div>';
    if (/(Html|Embed)/.test(k) || k === 'mapEmbedUrl' || LONG.test(k) || v.length > 90) return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" data-p="' + pa + '"' + (/(Html|Url)$/.test(k) ? ' class="code"' : '') + ' rows="3">' + esc(v) + '</textarea>' + help + '</div>';
    return '<div class="f"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" value="' + esc(v) + '" data-p="' + pa + '"' + (/phone|whatsapp|ambulance/i.test(k) ? ' inputmode="tel"' : '') + '>' + help + '</div>';
  }

  // ------------------------------------------------------------ list editor
  function itemTitle(it, i) {
    var x = it.name || it.title || it.q || it.label || it.value || it.text;
    var s = L(x) || (typeof x === 'string' ? x : '') || it.id || ('Item ' + (i + 1));
    if (it.id && A.tab === 'home') s = (L(it.title) || '') + ' (' + it.id + ')';
    return s;
  }
  function listEditor(path, list, key) {
    var pa = pathAttr(path), fkey = path.join('.'), q = (A.filter[fkey] || '').toLowerCase();
    var tools = list.length > 6 ? '<div class="list-tools"><input type="search" placeholder="Filter…" data-filter="' + esc(fkey) + '" value="' + esc(A.filter[fkey] || '') + '" aria-label="Filter list"><span class="muted small">' + list.length + ' items</span></div>' : '';
    var objs = list.length && typeof list[0] === 'object';
    if (!objs && !TEMPLATES[key]) return field(path, key, list);
    var html = list.map(function (it, i) {
      var title = itemTitle(it, i), p = path.concat(i), op = A.open[p.join('.')];
      if (q && JSON.stringify(it).toLowerCase().indexOf(q) < 0) return '';
      var thumb = it.photo || it.image;
      return '<details class="item" data-key="' + esc(p.join('.')) + '"' + (op ? ' open' : '') + '><summary>' + (thumb ? '<img src="' + esc(thumb) + '" alt="">' : '') + '<span class="t">' + esc(title) + '</span>' + (it.visible === false ? '<span class="hid">hidden</span>' : '') + (it.fromForm ? '<span class="hid">from form</span>' : '') +
        '<button type="button" class="ib" data-a="up" data-p="' + pa + '" data-i="' + i + '" aria-label="Move up">↑</button><button type="button" class="ib" data-a="down" data-p="' + pa + '" data-i="' + i + '" aria-label="Move down">↓</button>' +
        (key !== 'sections' ? '<button type="button" class="ib" data-a="dup" data-p="' + pa + '" data-i="' + i + '" aria-label="Duplicate">⧉</button><button type="button" class="ib" data-a="del" data-p="' + pa + '" data-i="' + i + '" aria-label="Delete" style="color:#c62828">✕</button>' : '') +
        '</summary><div class="inner">' + (op ? fieldsFor(p, it) : '') + '</div></details>';
    }).join('');
    return tools + html + (key !== 'sections' && (TEMPLATES[key] || objs) ? '<button type="button" class="add" data-a="add" data-p="' + pa + '" data-k="' + esc(key) + '">+ Add ' + esc(singular(key)) + '</button>' : '');
  }
  function singular(k) { return ({ news: 'news / event', faq: 'question', stories: 'story', facilities: 'facility', accreditations: 'accreditation', testimonials: 'testimonial' })[k] || k.replace(/s$/, ''); }

  // -------------------------------------------------------------- UI text
  function uiEditor() {
    var keys = Object.keys(I.en);
    return '<div class="list-tools"><input type="search" data-uifilter placeholder="Filter…" aria-label="Filter"></div><div class="tw"><table><thead><tr><th>Key</th><th>English</th><th>नेपाली</th></tr></thead><tbody>' + keys.map(function (k) {
      return '<tr data-k="' + k + '"><td class="small muted">' + k + '</td><td><input data-ui="en" data-k="' + k + '" value="' + esc(A.content.ui.en[k] || '') + '" placeholder="' + esc(I.en[k]) + '"></td><td><input lang="ne" data-ui="ne" data-k="' + k + '" value="' + esc(A.content.ui.ne[k] || '') + '" placeholder="' + esc(I.ne[k]) + '"></td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  // ------------------------------------------------------- doctor form help
  function formHelp() {
    return '<div class="card"><b>How the doctor form works</b><ol class="steps small"><li>Open <a href="https://script.google.com" target="_blank" rel="noopener">script.google.com</a> → New project → paste the code from <code>google-form/create-doctor-form.gs</code> → Run <code>setup</code>. It creates the form and its response sheet.</li>' +
      '<li>In the form, add one question: <b>Photo</b> → type “File upload” (Google does not allow scripts to add this).</li>' +
      '<li>Open the response sheet → File → Share → <b>Publish to web</b> → choose the responses sheet and <b>CSV</b> → Publish → copy the link into the box below → Save.</li>' +
      '<li>Send the form link to the doctors’ group. New answers appear on the website within a minute.</li></ol></div>';
  }
  function loadSheet() {
    if (A.demo) { $('#sheetBox').innerHTML = '<div class="card muted">Sheet status is shown when running on the server.</div>'; return; }
    req('GET', 'api/admin/sheet').then(function (s) {
      A.sheet = s;
      $('#sheetBox').innerHTML = '<div class="card"><b>Sheet status</b><p class="small">' + (s.url ? 'Last checked: ' + (s.fetchedAt ? new Date(s.fetchedAt).toLocaleString() : 'never') + ' · Rows: ' + s.rowCount + ' · Doctors from form: ' + s.doctorCount : 'No sheet link saved yet.') + '</p>' +
        (s.error ? '<p class="err">' + esc(s.error) + '</p>' : '') + '<button class="btn sm" data-a="sync">Check now</button></div>';
    }).catch(function () {});
  }

  // ------------------------------------------------------------------ inbox
  var INBOX = {
    bookings: function () {
      var f = A.filter.bk || { q: '', status: '', date: '' };
      var list = A.inbox.bookings.filter(function (b) {
        if (f.status && b.status !== f.status) return false;
        if (f.date && b.date !== f.date) return false;
        if (f.q && JSON.stringify(b).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
        return true;
      });
      var td = new Date().toISOString().slice(0, 10);
      var todayN = A.inbox.bookings.filter(function (b) { return b.date === td && b.status !== 'cancelled'; }).length;
      $('#inboxBody').innerHTML = '<div class="banner">Today: <b>' + todayN + '</b> appointments · New (not yet confirmed): <b>' + A.inbox.bookings.filter(function (b) { return b.status === 'new'; }).length + '</b>' + (A.demo ? ' · Preview mode shows no real bookings' : '') + '</div>' +
        '<div class="filters"><input type="search" placeholder="Search name, phone, code…" data-bk="q" value="' + esc(f.q) + '"><input type="date" data-bk="date" value="' + esc(f.date) + '"><select data-bk="status"><option value="">All statuses</option>' + ['new', 'confirmed', 'rescheduled', 'arrived', 'done', 'no-show', 'cancelled'].map(function (s) { return '<option' + (f.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<button class="btn ghost" data-a="reload-inbox">Refresh</button>' + (A.demo ? '' : '<a class="btn ghost" href="api/admin/bookings.csv">Download Excel (CSV)</a>') + '</div>' +
        '<div class="tw"><table><thead><tr><th>Date / time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Note</th></tr></thead><tbody>' + (list.length ? list.map(function (b) {
          var wa = 'https://wa.me/977' + String(b.phone).replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent('Namaste ' + b.name + ', your appointment at NIKO Hospital with ' + b.doctorName + ' on ' + b.date + ' ' + b.time + ' is confirmed. Code ' + b.code);
          return '<tr><td><b>' + esc(b.date) + '</b><br>' + esc(b.time) + '<br><span class="small muted">' + esc(b.code) + '</span></td><td>' + esc(b.name) + (b.age ? ' (' + esc(b.age) + (b.gender ? ' ' + esc(b.gender[0]) : '') + ')' : '') + '<br><a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a> · <a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' + (b.email ? '<br><span class="small">' + esc(b.email) + '</span>' : '') + (b.reason ? '<br><span class="small muted">' + esc(b.reason) + '</span>' : '') + '</td>' +
            '<td>' + esc(b.doctorName) + '</td><td><span class="pill ' + esc(b.status) + '">' + esc(b.status) + '</span><br><select data-bstatus="' + esc(b.code) + '" aria-label="Change status" style="margin-top:4px;min-height:30px">' + ['new', 'confirmed', 'rescheduled', 'arrived', 'done', 'no-show', 'cancelled'].map(function (s) { return '<option' + (b.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
            '<td><input data-bnote="' + esc(b.code) + '" value="' + esc(b.note || '') + '" placeholder="Note" style="min-height:32px"></td></tr>';
        }).join('') : '<tr><td colspan="5" class="muted">No appointments.</td></tr>') + '</tbody></table></div>';
    },
    feedback: function () {
      var list = A.inbox.feedback;
      $('#inboxBody').innerHTML = (list.length ? list.map(function (f) {
        return '<div class="card"' + (f.read ? '' : ' style="border-left:4px solid #f2a900"') + '><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>' + esc(f.name || 'Anonymous') + '</b><span class="small muted">' + esc(f.phone || '') + ' ' + esc(f.email || '') + '</span><span style="color:#f2a900">' + '★★★★★'.slice(0, f.rating || 0) + '</span><span class="small muted" style="margin-left:auto">' + new Date(f.at).toLocaleString() + '</span></div>' +
          '<p style="white-space:pre-line;margin:8px 0">' + esc(f.message) + '</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ghost sm" data-a="fb-read" data-id="' + f.id + '">' + (f.read ? 'Mark unread' : 'Mark read') + '</button><button class="btn ghost sm" data-a="fb-pub" data-id="' + f.id + '">Publish as testimonial</button><button class="btn red sm" data-a="fb-del" data-id="' + f.id + '">Delete</button></div></div>';
      }).join('') : '<p class="muted">No feedback yet.</p>');
    },
    questions: function () {
      var list = A.inbox.questions;
      $('#inboxBody').innerHTML = '<p class="intro">Answer a question and tick “Publish” to show it on the Q&A page.</p>' + (list.length ? list.map(function (q) {
        return '<div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap"><b>' + esc(q.name || 'Anonymous') + '</b><span class="small muted">' + esc(q.contact || '') + '</span><span class="small muted" style="margin-left:auto">' + new Date(q.at).toLocaleString() + '</span></div>' +
          '<label class="f" style="margin-top:8px"><span class="lbl">Question</span><textarea data-qq="' + q.id + '" rows="2">' + esc(q.question) + '</textarea></label><label class="f"><span class="lbl">Answer</span><textarea data-qa="' + q.id + '" rows="3">' + esc(q.answer || '') + '</textarea></label>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="chk"><input type="checkbox" data-qp="' + q.id + '"' + (q.published ? ' checked' : '') + '> Publish on website</label><button class="btn sm" data-a="q-save" data-id="' + q.id + '">Save answer</button><button class="btn red sm" data-a="q-del" data-id="' + q.id + '">Delete</button></div></div>';
      }).join('') : '<p class="muted">No questions yet.</p>');
    },
    webaccounts: function () {
      if (A.demo) { $('#inboxBody').innerHTML = '<p class="muted">Available when running on the server.</p>'; return; }
      Promise.all([req('GET', 'api/admin/accounts'), req('GET', 'api/admin/mail-status')]).then(function (r) {
        var list = r[0], mail = r[1];
        $('#inboxBody').innerHTML = '<div class="banner">Patients and staff create their own accounts on the website (Sign in → Create account). <b>To become the Director:</b> create your own account on the website first, then press “Make Director” next to it here. After that you can approve staff and give roles from your website dashboard.</div>' +
          '<p class="small muted">Emails sent today: ' + mail.sentToday + ' / ' + mail.limit + ' · sending by: <b>' + esc(mail.via) + '</b>' + (mail.via === 'none' ? ' — set BREVO_API_KEY and MAIL_FROM on the server to send emails' : '') + '</p>' +
          '<div class="tw"><table><thead><tr><th>Person</th><th>Type</th><th>Status</th><th>Roles</th><th></th></tr></thead><tbody>' + (list.length ? list.map(function (a) {
            return '<tr><td><b>' + esc(a.profile.name || '—') + '</b><br><span class="small muted">' + esc(a.email) + '</span></td><td>' + esc(a.type === 'staff' ? a.staffRole : a.type || '—') + '</td><td>' + esc(a.status) + '</td><td>' + esc(a.roles.join(', ') || '—') + '</td>' +
              '<td style="white-space:nowrap">' + (a.roles.indexOf('director') < 0 ? '<button class="btn ghost sm" data-a="acct-role" data-id="' + esc(a.id) + '" data-r="director">Make Director</button> ' : '<button class="btn ghost sm" data-a="acct-unrole" data-id="' + esc(a.id) + '" data-r="director">Remove Director</button> ') +
              (a.roles.indexOf('owner') < 0 ? '<button class="btn ghost sm" data-a="acct-role" data-id="' + esc(a.id) + '" data-r="owner">Make Owner</button> ' : '<button class="btn ghost sm" data-a="acct-unrole" data-id="' + esc(a.id) + '" data-r="owner">Remove Owner</button> ') +
              (a.status === 'pending' ? '<button class="btn sm" data-a="acct-status" data-id="' + esc(a.id) + '" data-s="active">Approve</button>' : '') + '</td></tr>';
          }).join('') : '<tr><td colspan="5" class="muted">No accounts yet.</td></tr>') + '</tbody></table></div>';
        A.webaccounts = list;
      }).catch(function (e) { $('#inboxBody').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
    },
    account: function () {
      if (A.demo) { $('#inboxBody').innerHTML = '<p class="muted">Available when running on the server.</p>'; return; }
      req('GET', 'api/admin/users').then(function (users) {
        $('#inboxBody').innerHTML = '<div class="card"><b>Change my password</b> <span class="muted small">(logged in as ' + esc(A.user) + ')</span><form data-form="pw" style="display:grid;gap:8px;max-width:360px;margin-top:8px"><input type="password" name="current" placeholder="Current password" autocomplete="current-password" required><input type="password" name="next" placeholder="New password (10+ characters)" autocomplete="new-password" required><button class="btn">Change password</button><span class="msg"></span></form></div>' +
          '<div class="card"><b>Staff who can log in</b><ul>' + users.map(function (u) { return '<li>' + esc(u.name) + ' <span class="muted small">(' + esc(u.role) + ')</span>' + (u.name !== A.user ? ' <button class="btn red sm" data-a="user-del" data-n="' + esc(u.name) + '">Remove</button>' : '') + '</li>'; }).join('') + '</ul>' +
          '<form data-form="user" style="display:grid;gap:8px;max-width:360px"><input name="name" placeholder="New username" required><input type="password" name="password" placeholder="Password (10+ characters)" autocomplete="new-password" required><button class="btn">Add staff login</button><span class="msg"></span></form></div>';
      });
    },
    history: function () {
      if (A.demo) { $('#inboxBody').innerHTML = '<p class="muted">Available when running on the server.</p>'; return; }
      req('GET', 'api/admin/history').then(function (list) {
        $('#inboxBody').innerHTML = '<p class="intro">Every save keeps a copy of the previous version. Restore one if something went wrong.</p>' + (list.length ? '<div class="tw"><table><tbody>' + list.map(function (f) {
          var d = f.replace(/^content-/, '').replace(/\.json$/, '').replace(/T(\d\d)-(\d\d)-(\d\d)-\d+Z/, ' $1:$2:$3 UTC');
          return '<tr><td>' + esc(d) + '</td><td><button class="btn ghost sm" data-a="restore" data-f="' + esc(f) + '">Restore this version</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No earlier versions yet.</p>');
      });
    },
  };
  INBOX.staffMail = null; delete INBOX.staffMail;
  function loadInbox() {
    if (A.demo) return;
    Promise.all([req('GET', 'api/admin/bookings'), req('GET', 'api/admin/feedback'), req('GET', 'api/admin/questions')]).then(function (r) {
      A.inbox = { bookings: r[0], feedback: r[1], questions: r[2] };
      count('bookings', r[0].filter(function (b) { return b.status === 'new'; }).length);
      count('feedback', r[1].filter(function (f) { return !f.read; }).length);
      count('questions', r[2].filter(function (q) { return !q.answer; }).length);
      if (INBOX[A.tab] && $('#inboxBody')) INBOX[A.tab]();
    }).catch(function () {});
  }
  function count(k, n) { var el = $('#cnt-' + k); if (el) { el.hidden = !n; el.textContent = n; } }

  // ------------------------------------------------------------- uploads
  function resize(file, kind) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      var max = kind === 'logo' ? 512 : kind === 'photo' ? 900 : 1600;
      var im = new Image(), url = URL.createObjectURL(file);
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height));
        if (s === 1 && file.size < 400000) return resolve(file);
        var c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        var type = kind === 'logo' && file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        c.toBlob(function (b) { resolve(new File([b], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type: type })); }, type, 0.82);
      };
      im.onerror = function () { resolve(file); };
      im.src = url;
    });
  }
  function upload(file, kind) {
    return resize(file, kind).then(function (f) {
      if (A.demo) return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(f); });
      var fd = new FormData(); fd.append('file', f);
      return req('POST', 'api/admin/upload', fd, true).then(function (j) { return j.url; });
    });
  }

  // ------------------------------------------------------------- events
  function normalizeInput(path, val) {
    var k = path[path.length - 1];
    if (k === 'mapEmbedUrl' && /<iframe/i.test(val)) { var m = val.match(/src="([^"]+)"/i); if (m) return m[1]; }
    if (k === 'tiktokUsername' && /tiktok/i.test(val)) { var u = val.match(/data-unique-id="([^"]+)"/) || val.match(/@([\w.]+)/); if (u) return u[1]; }
    return val;
  }
  document.addEventListener('input', function (e) {
    var el = e.target, p = el.getAttribute('data-p');
    if (p) {
      var path = JSON.parse(p), type = el.getAttribute('data-type'), v;
      if (type === 'bool') v = el.checked;
      else if (type === 'num') { v = +el.value; $$('[data-p="' + CSS.escape(p) + '"]').forEach(function (o) { if (o !== el) o.value = el.value; }); }
      else if (type === 'lines') v = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else { v = normalizeInput(path, el.value); if (/^#[0-9a-f]{6}$/i.test(v) || el.type === 'color') $$('[data-p="' + CSS.escape(p) + '"]').forEach(function (o) { if (o !== el) o.value = el.value; }); }
      set(path, v);
      var th = el.closest('.img-field'); if (th) $('.thumb', th).src = v;
      var det = el.closest('details.item'); if (det && /name|title|^q$/.test(path[path.length - 2] || path[path.length - 1])) { var tt = $('.t', det); var obj = get(JSON.parse('[' + det.getAttribute('data-key').split('.').map(function (x) { return /^\d+$/.test(x) ? x : JSON.stringify(x); }).join(',') + ']')); if (tt && obj) tt.textContent = itemTitle(obj, 0); }
    }
    if (el.hasAttribute('data-ui')) { var l = el.getAttribute('data-ui'), k = el.getAttribute('data-k'); if (el.value) A.content.ui[l][k] = el.value; else delete A.content.ui[l][k]; changed(); }
    if (el.hasAttribute('data-filter')) { A.filter[el.getAttribute('data-filter')] = el.value; var pos = el.selectionStart; renderTab(); var nf = $('[data-filter="' + el.getAttribute('data-filter') + '"]'); if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); } }
    if (el.hasAttribute('data-uifilter')) { var q = el.value.toLowerCase(); $$('tr[data-k]').forEach(function (tr) { tr.hidden = q && tr.textContent.toLowerCase().indexOf(q) < 0 && !$$('input', tr).some(function (i) { return (i.value + i.placeholder).toLowerCase().indexOf(q) > -1; }); }); }
    if (el.hasAttribute('data-bk')) { A.filter.bk = A.filter.bk || { q: '', status: '', date: '' }; A.filter.bk[el.getAttribute('data-bk')] = el.value; if (el.type !== 'search') INBOX.bookings(); else { clearTimeout(A.bkT); A.bkT = setTimeout(function () { INBOX.bookings(); var s = $('[data-bk=q]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 300); } }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-days')) { var p = JSON.parse(el.getAttribute('data-days')); set(p, $$('[data-days="' + CSS.escape(el.getAttribute('data-days')) + '"]').filter(function (c) { return c.checked; }).map(function (c) { return c.value; })); }
    if (el.hasAttribute('data-upload')) {
      var path = JSON.parse(el.getAttribute('data-upload')), file = el.files[0]; if (!file) return;
      toast('Uploading…');
      upload(file, el.getAttribute('data-kind')).then(function (url) { set(path, url); renderTab(); toast('Photo uploaded — press Save to publish'); }).catch(function (err) { toast(err.message); });
    }
    if (el.tagName === 'SELECT' && el.hasAttribute('data-p')) { /* handled by input */ }
    if (el.hasAttribute('data-bstatus')) updateBooking(el.getAttribute('data-bstatus'), { status: el.value });
    if (el.hasAttribute('data-bnote')) updateBooking(el.getAttribute('data-bnote'), { note: el.value });
    if (el.id === 'pvRoute') { A.previewRoute = el.value; sendPreview(el.value); }
  });
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d.matches || !d.matches('details.item')) return;
    var key = d.getAttribute('data-key'); A.open[key] = d.open;
    if (d.open && !$('.inner', d).innerHTML) { var path = key.split('.').map(function (x) { return /^\d+$/.test(x) ? +x : x; }); $('.inner', d).innerHTML = fieldsFor(path, get(path)); }
  }, true);
  document.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]'); if (tb) { A.tab = tb.getAttribute('data-tab'); renderTab(); return; }
    var el = e.target.closest('[data-a]'); if (!el) return;
    var a = el.getAttribute('data-a'), p = el.getAttribute('data-p') ? JSON.parse(el.getAttribute('data-p')) : null, i = +el.getAttribute('data-i');
    if (['up', 'down', 'dup', 'del'].indexOf(a) > -1) e.preventDefault();
    var list = p ? get(p) : null;
    switch (a) {
      case 'save': save(); break;
      case 'logout': if (JSON.stringify(A.content) !== A.saved && !confirm('You have unsaved changes. Log out anyway?')) break; (A.demo ? Promise.resolve() : req('POST', 'api/logout')).then(function () { A.saved = JSON.stringify(A.content); location.reload(); }); break;
      case 'pv-toggle': $('#pv').classList.toggle('open'); setTimeout(fitPreview, 30); break;
      case 'dev': A.previewDevice = el.getAttribute('data-d'); $$('[data-a=dev]').forEach(function (b) { b.setAttribute('aria-pressed', b === el); }); fitPreview(); break;
      case 'up': if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); shiftOpen(p, i, i - 1); changed(); renderTab(); } break;
      case 'down': if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); shiftOpen(p, i, i + 1); changed(); renderTab(); } break;
      case 'dup': var c = clone(list[i]); if (c.id) c.id = c.id + '-copy'; list.splice(i + 1, 0, c); changed(); renderTab(); break;
      case 'del': if (confirm('Delete “' + itemTitle(list[i], i) + '”?')) { list.splice(i, 1); A.open = {}; changed(); renderTab(); } break;
      case 'add': var k = el.getAttribute('data-k'); var item = TEMPLATES[k] ? TEMPLATES[k]() : blankLike(list[0]); list.push(item); A.open[p.concat(list.length - 1).join('.')] = true; changed(); renderTab();
        setTimeout(function () { var d = $$('details.item'); d = d[d.length - 1]; if (d) { d.scrollIntoView({ block: 'center' }); var f = $('input,textarea', $('.inner', d)); if (f) f.focus(); } }, 50); break;
      case 'clear': set(p, ''); renderTab(); break;
      case 'alldays': set(p, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']); renderTab(); break;
      case 'sync': el.disabled = true; req('POST', 'api/admin/sheet/sync').then(function () { loadSheet(); toast('Sheet checked'); }); break;
      case 'reload-inbox': loadInbox(); break;
      case 'fb-read': var f = A.inbox.feedback.find(function (x) { return x.id === el.getAttribute('data-id'); }); f.read = !f.read; req('PATCH', 'api/admin/feedback/' + f.id, { read: f.read }).then(loadInbox); INBOX.feedback(); break;
      case 'fb-pub': var fb = A.inbox.feedback.find(function (x) { return x.id === el.getAttribute('data-id'); }); A.content.testimonials.push({ name: fb.name || 'Patient', text: { en: fb.message, ne: '' }, rating: fb.rating || 5, source: 'Patient', date: (fb.at || '').slice(0, 10), visible: true }); changed(); toast('Added to Testimonials — press Save to publish'); break;
      case 'fb-del': if (confirm('Delete this feedback?')) req('DELETE', 'api/admin/feedback/' + el.getAttribute('data-id')).then(loadInbox); break;
      case 'q-save': var id = el.getAttribute('data-id'); req('PATCH', 'api/admin/questions/' + id, { question: $('[data-qq="' + id + '"]').value, answer: $('[data-qa="' + id + '"]').value, published: $('[data-qp="' + id + '"]').checked }).then(function () { toast('Saved — live on the website'); loadInbox(); }); break;
      case 'q-del': if (confirm('Delete this question?')) req('DELETE', 'api/admin/questions/' + el.getAttribute('data-id')).then(loadInbox); break;
      case 'acct-role': case 'acct-unrole':
        var acx = (A.webaccounts || []).find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!acx) break;
        var roles = acx.roles.filter(function (r) { return r !== el.getAttribute('data-r'); }); if (a === 'acct-role') roles.push(el.getAttribute('data-r'));
        req('PATCH', 'api/admin/accounts/' + acx.id, a === 'acct-role' ? { roles: roles, status: 'active' } : { roles: roles }).then(function () { toast('Saved'); INBOX.webaccounts(); }).catch(function (e) { toast(e.message); }); break;
      case 'acct-status': req('PATCH', 'api/admin/accounts/' + el.getAttribute('data-id'), { status: el.getAttribute('data-s') }).then(function () { toast('Saved'); INBOX.webaccounts(); }); break;
      case 'user-del': if (confirm('Remove ' + el.getAttribute('data-n') + '?')) req('DELETE', 'api/admin/users/' + encodeURIComponent(el.getAttribute('data-n'))).then(function () { INBOX.account(); }); break;
      case 'restore': if (confirm('Replace the current website content with this version?')) req('POST', 'api/admin/history/' + encodeURIComponent(el.getAttribute('data-f')) + '/restore').then(function () { toast('Restored'); return req('GET', 'api/admin/content'); }).then(function (c) { A.content = normalize(c); A.saved = JSON.stringify(A.content); status(); sendPreview(); }); break;
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, k = f.getAttribute('data-form'); if (!k) return; e.preventDefault();
    var msg = $('.msg', f);
    var body = k === 'pw' ? { current: f.current.value, next: f.next.value } : { name: f.name.value, password: f.password.value };
    req('POST', k === 'pw' ? 'api/admin/password' : 'api/admin/users', body).then(function () { msg.className = 'msg ok'; msg.textContent = 'Done ✓'; f.reset(); if (k === 'user') INBOX.account(); }).catch(function (err) { msg.className = 'msg err'; msg.textContent = err.message; });
  });
  function shiftOpen(p, from, to) { var a = p.concat(from).join('.'), b = p.concat(to).join('.'); var x = A.open[a]; A.open[a] = A.open[b]; A.open[b] = x; }
  function blankLike(o) { if (!o || typeof o !== 'object') return ''; var r = {}; Object.keys(o).forEach(function (k) { var v = o[k]; r[k] = isBi(v) ? t() : typeof v === 'boolean' ? v : typeof v === 'number' ? 0 : Array.isArray(v) ? [] : typeof v === 'object' && v ? blankLike(v) : ''; }); return r; }
  function updateBooking(code, body) {
    if (A.demo) return;
    req('PATCH', 'api/admin/bookings/' + encodeURIComponent(code), body).then(function () { toast('Updated'); loadInbox(); }).catch(function (err) { toast(err.message); });
  }
  function save() {
    var b = $('#saveBtn'); b.disabled = true; b.textContent = 'Saving…';
    var p = A.demo ? new Promise(function (res) { try { localStorage.setItem('niko_admin_demo', JSON.stringify(A.content)); } catch (e) {} A.content.meta = Object.assign({}, A.content.meta, { updatedAt: new Date().toISOString() }); res({}); })
      : req('PUT', 'api/admin/content', A.content).then(function (j) { A.content.meta = Object.assign({}, A.content.meta, { updatedAt: j.updatedAt }); });
    p.then(function () { A.saved = JSON.stringify(A.content); toast(A.demo ? 'Saved in this preview' : 'Saved — live on the website now'); })
      .catch(function (err) { if (err.status === 401) { toast('Session expired — please log in again in a new tab, then press Save'); window.open('admin.html', '_blank'); } else toast('Not saved: ' + err.message); })
      .then(function () { b.disabled = false; status(); });
  }
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 's' && A.content) { e.preventDefault(); save(); } });
  window.addEventListener('beforeunload', function (e) { if (A.content && JSON.stringify(A.content) !== A.saved) { e.preventDefault(); e.returnValue = ''; } });

  start();
}());
