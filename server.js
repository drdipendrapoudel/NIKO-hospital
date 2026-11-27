// NIKO Hospital website — backend (Node.js + Express)
// Start:  npm install && npm start      Admin: http://localhost:3000/admin.html
require('./lib/env');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const compression = require('compression');

const store = require('./lib/store');
const sheet = require('./lib/sheet');
const notify = require('./lib/notify');
const schedule = require('./public/assets/schedule');
const DEFAULT_CONTENT = require('./content/default-content');
const TP = require('./content/template-photos');
const stock = require('./lib/stock');
const mailer = require('./lib/mailer');
const accounts = require('./lib/accounts');
const portal = require('./lib/portal');
const opdLib = require('./lib/opd');

const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// Private files (payment receipts, prescriptions, lab reports) are never served publicly.
const PRIVATE_DIR = process.env.PRIVATE_DIR || path.join(path.dirname(path.resolve(UPLOAD_DIR)), 'private');
const OPD_DIR = process.env.OPD_DIR || path.join(path.dirname(path.resolve(UPLOAD_DIR)), 'opd');
let SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

// ------------------------------------------------------------------ data setup
let content = store.read('content', null);
if (!content) { content = JSON.parse(JSON.stringify(DEFAULT_CONTENT)); content.meta.updatedAt = new Date().toISOString(); store.write('content', content); }

// Fill in any new settings added in later versions of the default content.
(function upgrade(target, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in target)) target[k] = JSON.parse(JSON.stringify(v));
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) upgrade(target[k], v);
  }
}(content, DEFAULT_CONTENT));

// Phase 2 (Nov 2026): new home sections, slide timing, per-doctor video consultation and the blue/orange design.
(function migrate() {
  const m = content.meta || (content.meta = {});
  let changed = false;
  const defSecs = DEFAULT_CONTENT.home.sections;
  const secs = content.home.sections = Array.isArray(content.home.sections) ? content.home.sections : [];
  defSecs.forEach((d, i) => {
    let s = secs.find((x) => x.id === d.id);
    if (!s) { s = JSON.parse(JSON.stringify(d)); const before = defSecs.slice(0, i).map((x) => x.id).reverse().find((id) => secs.some((x) => x.id === id)); secs.splice(before ? secs.findIndex((x) => x.id === before) + 1 : secs.length, 0, s); changed = true; }
    if (!s.eyebrow) { s.eyebrow = JSON.parse(JSON.stringify(d.eyebrow)); changed = true; }
  });
  const slideKeys = { eyebrow: { en: '', ne: '' }, tab: { en: '', ne: '' }, seconds: Number(content.theme.slideIntervalSeconds) || 6, startDate: '', endDate: '' };
  (content.slides || []).forEach((s) => Object.keys(slideKeys).forEach((k) => { if (!(k in s)) { s[k] = JSON.parse(JSON.stringify(slideKeys[k])); changed = true; } }));
  (content.doctors || []).forEach((d) => {
    if (!('degreeLevel' in d)) { d.degreeLevel = 'MD'; changed = true; }
    if (!('videoConsult' in d)) { d.videoConsult = !(Number(d.monthlyWeek) > 0); changed = true; }
  });
  // The Director is Dr. Dipendra Poudel (told to us on 24 Nov 2026); replace the placeholder name only.
  if (content.director && content.director.name && content.director.name.en === 'Name of Director') {
    content.director.name = { en: 'Dr. Dipendra Poudel', ne: 'डा. दिपेन्द्र पौडेल' }; content.director.designation = { en: 'Director', ne: 'सञ्चालक' }; changed = true;
  }
  if (!(m.designVersion >= 2)) {
    const t = content.theme;
    if (t.primary === '#1f487c' && t.accent === '#2f80c9') { t.primary = '#1a5bb0'; t.primaryDark = '#0e3a73'; t.accent = '#f26b1d'; }
    secs.forEach((s) => { if (s.id === 'news' || s.id === 'stories') s.visible = false; });
    m.designVersion = 2; changed = true;
  }
  // Lab rate list from the hospital (approved 26 Nov 2026) replaces the 39-test template, unless prices were already entered by hand.
  if (!(Number(m.labListVersion) >= 2)) {
    const cur = Array.isArray(content.lab.tests) ? content.lab.tests : [];
    if (!cur.some((x) => Number(x.price) > 0)) {
      content.lab.tests = JSON.parse(JSON.stringify(DEFAULT_CONTENT.lab.tests));
      content.lab.note = JSON.parse(JSON.stringify(DEFAULT_CONTENT.lab.note));
    }
    m.labListVersion = 2; changed = true;
  }
  // Template photos, doctor avatars and sample reviews (27 Nov 2026): nothing on the site is left without a picture.
  // Only empty or numbered-placeholder pictures are filled; photos uploaded by the hospital are never touched.
  if (!(Number(m.templatePhotosVersion) >= 1)) {
    const blank = (v) => !v || /(^|\/)img\/ph\/P\d+\.svg$/.test(String(v));
    const en = (v) => (v && typeof v === 'object' ? v.en || '' : String(v || ''));
    const fill = (item, key, hint, n) => {
      if (!item || !blank(item[key])) return;
      const k = TP.BY_PHOTO_NO[item.photoNo] || hint || TP.pick(`${item.id || ''} ${en(item.name)} ${en(item.title)}`, n);
      item[key] = TP.path(k); item.template = true;
    };
    (content.facilities || []).forEach((f, i) => fill(f, 'image', null, i));
    (content.slides || []).forEach((x, i) => fill(x, 'image', null, i));
    (content.news || []).forEach((x, i) => fill(x, 'image', null, i));
    (content.stories || []).forEach((x, i) => fill(x, 'image', null, i));
    (content.articles || []).forEach((x, i) => fill(x, 'image', null, i));
    (content.departments || []).forEach((d, i) => fill(d, 'image', TP.BY_DEPARTMENT[d.id], i));
    (content.gallery || []).forEach((g, i) => fill(g, 'image', TP.GALLERY[i % TP.GALLERY.length][0], i));
    if ((content.gallery || []).length < 4) {
      const used = new Set((content.gallery || []).map((g) => g.image));
      content.gallery = (content.gallery || []).concat(TP.GALLERY.filter(([k]) => !used.has(TP.path(k)))
        .map(([k, e, n]) => ({ image: TP.path(k), caption: { en: e, ne: n }, template: true, visible: true })));
    }
    if (blank(content.pillarsImage)) content.pillarsImage = 'img/P01-building.jpg';
    if (content.about && blank(content.about.image)) content.about.image = 'img/P01-building.jpg';
    // Coloured avatars need a gender; the doctors on the poster are set to Male unless already filled in (change in Admin → Doctors).
    (content.doctors || []).forEach((d) => { if (!d.gender && /^D\d\d$/.test(d.id || '')) d.gender = 'Male'; });
    if (!(content.testimonials || []).length) content.testimonials = JSON.parse(JSON.stringify(DEFAULT_CONTENT.testimonials));
    m.templatePhotosVersion = 1; changed = true;
  }
  // Doctor setup (27 Nov 2026): serial numeric doctor IDs, full-time / part-time / visiting, visit dates, no video for
  // anaesthesia and visiting specialists.
  if (!(Number(m.doctorSetupVersion) >= 1)) {
    const fullTime = /dipendra\s+poudel|trayush/i;
    (content.doctors || []).forEach((d, i) => {
      if (!d.no) d.no = i + 1;
      const en = (d.name && d.name.en) || '';
      if (d.dept === 'endocrinology' && !(d.days || []).length && !(Number(d.monthlyWeek) > 0)) { d.monthlyWeek = 3; d.monthlyDay = 'Sat'; d.scheduleNote = { en: 'Third Saturday of every month', ne: 'प्रत्येक महिनाको तेस्रो शनिवार' }; }
      if (!d.employment) d.employment = Number(d.monthlyWeek) > 0 && !(d.days || []).length ? 'visiting' : fullTime.test(en) ? 'full' : 'part';
      if (d.employment === 'visiting' && !Array.isArray(d.visitDates)) {
        d.visitDates = schedule.nextDates(Object.assign({}, d, { employment: '', visitDates: null }), { daysAhead: 190 }, 6);
      }
      if (d.employment === 'visiting' || d.dept === 'anaesthesiology') d.videoConsult = false;
    });
    m.doctorSeq = Math.max(Number(m.doctorSeq) || 0, ...(content.doctors || []).map((d) => Number(d.no) || 0));
    m.doctorSetupVersion = 1; changed = true;
  }
  if (changed) store.write('content', content);
}());

// Every doctor has a serial number (numbers only, unique, never used again). New doctors get the next one.
function numberDoctors(c, prevSeq) {
  const m = c.meta || (c.meta = {});
  let seq = Math.max(Number(prevSeq) || 0, Number(m.doctorSeq) || 0, ...(c.doctors || []).map((d) => Number(d.no) || 0));
  const seen = new Set();
  (c.doctors || []).forEach((d) => {
    if (!Number(d.no) || seen.has(Number(d.no))) { seq += 1; d.no = seq; if (!d.id || /^(new|D[a-z0-9]{4}$)/.test(d.id)) d.id = String(seq); }
    seen.add(Number(d.no));
    if (!d.employment) d.employment = 'part';
    if (d.employment === 'visiting' || d.dept === 'anaesthesiology') d.videoConsult = false;
  });
  m.doctorSeq = seq;
}

const users = store.read('users', {});
if (!Object.keys(users).length) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
  users[process.env.ADMIN_USER || 'admin'] = { hash: bcrypt.hashSync(pw, 12), role: 'admin', created: new Date().toISOString() };
  store.write('users', users);
  console.log(`\n  Admin account created → user: ${process.env.ADMIN_USER || 'admin'}  password: ${pw}\n  (change it after first login)\n`);
}
const bookings = store.read('bookings', []);
const feedback = store.read('feedback', []);
const questions = store.read('questions', []);

// ------------------------------------------------------------- Google Sheet feed
async function syncSheet() {
  const i = content.integrations || {};
  await sheet.refresh(i.doctorSheetCsvUrl, content.departments, i.doctorSheetAutoPublish !== false);
}
let sheetTimer = null;
function scheduleSheet() {
  clearInterval(sheetTimer);
  const secs = Math.max(20, Number(content.integrations?.sheetRefreshSeconds || 60));
  syncSheet();
  sheetTimer = setInterval(syncSheet, secs * 1000);
}
scheduleSheet();

function publicContent() {
  const c = { ...content };
  c.doctors = sheet.merge(content.doctors || [], sheet.current().doctors || []).map((d) => { const x = { ...d }; delete x.no; delete x.private; return x; });
  c.consult = { ...(content.consult || {}) }; delete c.consult.alertWords;
  c.answeredQuestions = questions.filter((q) => q.published && q.answer)
    .map((q) => ({ q: q.question, a: q.answer, date: q.answeredAt }));
  c.notifyChannels = notify.configured();
  delete c.private;
  return c;
}
function versionTag() {
  return crypto.createHash('sha1').update(String(content.meta.updatedAt) + String(sheet.current().fetchedAt) + questions.length).digest('hex').slice(0, 12);
}

// ------------------------------------------------------------------- app setup
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", 'https://www.tiktok.com', 'https://*.tiktok.com', 'https://*.tiktokcdn.com', 'https://*.ttwstatic.com'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://www.facebook.com', 'https://web.facebook.com', 'https://www.tiktok.com', 'https://*.tiktok.com', 'https://www.youtube.com'],
      'connect-src': ["'self'", 'https://*.tiktok.com', 'https://*.tiktokv.com'],
      'media-src': ["'self'", 'blob:', 'data:'],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: PROD ? { maxAge: 31536000, includeSubDomains: true } : false,
}));
app.use(compression());
// The OPD card page (taken from the doctor's own system) uses inline scripts; it is only usable when signed in.
app.use((req, res, next) => {
  if (req.path === '/opd.html') res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  if (req.path === '/opd.html') res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.use((req, res, next) => { if (!SITE_URL && req.get('host') && !/localhost|127\.0\.0\.1/.test(req.get('host'))) SITE_URL = `https://${req.get('host')}`; next(); });
app.use((req, res, next) => (req.path === '/api/lab/inbound' ? next() : express.json({ limit: '4mb' })(req, res, next)));

// Redirect to HTTPS in production (when behind a proxy that sets x-forwarded-proto)
if (PROD && process.env.FORCE_HTTPS !== 'false') {
  app.use((req, res, next) => (req.secure ? next() : res.redirect(301, `https://${req.headers.host}${req.originalUrl}`)));
}

// ---------------------------------------------------------------- sessions/auth
const sessions = new Map(); // token → { user, expires }
const SESSION_HOURS = 12;
function cookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function auth(req, res, next) {
  const s = sessions.get(cookie(req, 'niko_sid'));
  if (!s || s.expires < Date.now()) return res.status(401).json({ error: 'Please log in' });
  // Simple CSRF protection: state-changing admin requests must carry the header set by admin.js
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'niko-admin') return res.status(403).json({ error: 'Bad request origin' });
  s.expires = Date.now() + SESSION_HOURS * 3600e3;
  req.user = s.user;
  next();
}
const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
const publicLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please call us instead.' } });

app.post('/api/login', loginLimiter, (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const u = users[String(username).trim()];
  if (!u || !bcrypt.compareSync(String(password), u.hash)) return res.status(401).json({ error: 'Wrong username or password' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: String(username).trim(), expires: Date.now() + SESSION_HOURS * 3600e3 });
  res.setHeader('Set-Cookie', `niko_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${PROD ? '; Secure' : ''}`);
  res.json({ ok: true, user: String(username).trim() });
});
app.post('/api/logout', (req, res) => {
  sessions.delete(cookie(req, 'niko_sid'));
  res.setHeader('Set-Cookie', 'niko_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/me', auth, (req, res) => res.json({ user: req.user, channels: notify.configured() }));
app.post('/api/admin/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const u = users[req.user];
  if (!bcrypt.compareSync(String(current || ''), u.hash)) return res.status(400).json({ error: 'Current password is wrong' });
  if (String(next || '').length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });
  u.hash = bcrypt.hashSync(String(next), 12);
  store.write('users', users);
  res.json({ ok: true });
});
app.get('/api/admin/users', auth, (req, res) => res.json(Object.keys(users).map((name) => ({ name, role: users[name].role }))));
app.post('/api/admin/users', auth, (req, res) => {
  const { name, password } = req.body || {};
  if (!/^[\w.@-]{3,40}$/.test(name || '')) return res.status(400).json({ error: 'Username: 3–40 letters/numbers' });
  if (String(password || '').length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
  users[name] = { hash: bcrypt.hashSync(String(password), 12), role: 'editor', created: new Date().toISOString() };
  store.write('users', users);
  res.json({ ok: true });
});
app.delete('/api/admin/users/:name', auth, (req, res) => {
  if (req.params.name === req.user) return res.status(400).json({ error: 'You cannot delete yourself' });
  delete users[req.params.name];
  store.write('users', users);
  res.json({ ok: true });
});

// -------------------------------------------------------------------- content
app.get('/api/content', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({ version: versionTag(), content: publicContent() });
});
app.get('/api/version', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ version: versionTag() }); });

app.get('/api/admin/content', auth, (req, res) => res.json(content));
app.put('/api/admin/content', auth, (req, res) => {
  const next = req.body;
  if (!next || typeof next !== 'object' || !next.hospital || !Array.isArray(next.doctors)) return res.status(400).json({ error: 'Invalid content' });
  next.meta = Object.assign({}, next.meta, { designVersion: content.meta.designVersion, doctorSetupVersion: content.meta.doctorSetupVersion });
  // keep what doctors set themselves in their dashboard if the admin page was opened before they saved
  numberDoctors(next, content.meta.doctorSeq);
  store.snapshot('content', content);
  next.meta = { ...(next.meta || {}), updatedAt: new Date().toISOString(), updatedBy: req.user };
  delete next.answeredQuestions; delete next.notifyChannels;
  const sheetChanged = JSON.stringify(next.integrations) !== JSON.stringify(content.integrations);
  content = next;
  store.write('content', content);
  if (sheetChanged) scheduleSheet();
  res.json({ ok: true, version: versionTag(), updatedAt: content.meta.updatedAt });
});
app.get('/api/admin/history', auth, (req, res) => res.json(store.listHistory('content').slice(0, 30)));
app.post('/api/admin/history/:file/restore', auth, (req, res) => {
  try {
    const old = store.readHistory(req.params.file);
    store.snapshot('content', content);
    content = old; content.meta = { ...(content.meta || {}), updatedAt: new Date().toISOString(), restoredFrom: req.params.file };
    store.write('content', content);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: 'Could not restore' }); }
});
app.get('/api/admin/default-content', auth, (req, res) => res.json(DEFAULT_CONTENT));

// --------------------------------------------------------------------- uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' }[file.mimetype];
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.mimetype)),
});
app.post('/api/admin/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only JPG, PNG, WEBP, GIF or PDF up to 8 MB' });
  res.json({ url: `uploads/${req.file.filename}` });
});

// -------------------------------------------------------------------- bookings
const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const validPhone = (p) => /^(\+?977[- ]?)?(9[678]\d{8}|0?\d{2}[- ]?\d{6,7})$/.test(String(p).replace(/\s/g, ''));
const allDoctors = () => sheet.merge(content.doctors || [], sheet.current().doctors || []);
const findDoctor = (id) => allDoctors().find((d) => d.id === id && d.visible !== false);
const nextToken = (doctorId, date) => bookings.filter((b) => b.doctorId === doctorId && b.date === date).reduce((n, b) => Math.max(n, Number(b.token) || 0), 0) + 1;

function takenSlots(doctorId, date, exceptCode) {
  return bookings.filter((b) => b.doctorId === doctorId && b.date === date && b.status !== 'cancelled' && b.code !== exceptCode)
    .reduce((acc, b) => { acc[b.time] = (acc[b.time] || 0) + 1; return acc; }, {});
}
function checkSlot(doc, date, time, exceptCode) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Choose a date';
  const today = schedule.todayInNepal();
  if (date < today) return 'That date has passed';
  if (!schedule.availableOn(doc, date, content.booking)) return 'The doctor is not available on that date';
  if (schedule.hasFixedSchedule(doc) && !schedule.isToken(doc)) {
    if (!schedule.slots(doc, content.booking, date).includes(time)) return 'Choose a valid time';
    const max = Number(content.booking.maxPerSlot || 1);
    if ((takenSlots(doc.id, date, exceptCode)[time] || 0) >= max) return 'That time was just booked. Please choose another time.';
  }
  return null;
}

app.get('/api/slots', (req, res) => {
  const doc = findDoctor(String(req.query.doctor || ''));
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  const date = String(req.query.date || '');
  res.json({ taken: takenSlots(doc.id, date), maxPerSlot: Number(content.booking.maxPerSlot || 1) });
});

app.post('/api/bookings', publicLimiter, async (req, res) => {
  if (!content.booking.enabled) return res.status(400).json({ error: 'Online booking is closed. Please call us.' });
  const b = req.body || {};
  if (b.website) return res.json({ ok: true, code: 'OK' }); // honeypot for spam bots
  const doc = findDoctor(b.doctorId);
  if (!doc) return res.status(400).json({ error: 'Choose a doctor' });
  const name = clean(b.name, 80);
  if (name.length < 2) return res.status(400).json({ error: 'Enter the patient name' });
  if (!validPhone(b.phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!b.consent) return res.status(400).json({ error: 'Please accept the privacy notice' });
  const err = checkSlot(doc, b.date, b.time);
  if (err) return res.status(409).json({ error: err });
  const code = `NK${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const booking = {
    code, status: 'new', createdAt: new Date().toISOString(),
    doctorId: doc.id, doctorName: doc.name.en, dept: doc.dept,
    date: b.date, time: schedule.isToken(doc) ? '' : schedule.hasFixedSchedule(doc) ? b.time : 'To be confirmed',
    name, phone: clean(b.phone, 20), email: clean(b.email, 120), age: clean(b.age, 3), gender: clean(b.gender, 10),
    reason: clean(b.reason, 500), notify: (Array.isArray(b.notify) ? b.notify : []).filter((x) => ['sms', 'whatsapp', 'email'].includes(x)),
    lang: b.lang === 'ne' ? 'ne' : 'en', history: [],
  };
  if (schedule.isToken(doc)) {
    // visiting specialist: no time slots and no limit – patients are seen in token order
    booking.token = nextToken(doc.id, b.date); booking.time = `Token ${booking.token}`;
  }
  bookings.push(booking);
  store.write('bookings', bookings);
  if (booking.token) {
    const count = bookings.filter((x) => x.doctorId === doc.id && x.date === b.date && x.status !== 'cancelled').length;
    if (count === 150 && ctx.notify) ctx.notify({ roles: ['director'], doctors: [doc.id] }, { title: `150 online bookings for ${doc.name.en} on ${b.date}`, body: `Online bookings for ${doc.name.en} on ${b.date} have reached 150. Booking stays open – there is no limit.`, link: '#/dashboard/doctors' });
  }
  const results = await notify.booking(booking, content, 'confirmed');
  res.json({ ok: true, booking: publicBooking(booking), notifications: results });
});

function publicBooking(b) {
  return { token: b.token || undefined, code: b.code, status: b.status, doctorId: b.doctorId, doctorName: b.doctorName, date: b.date, time: b.time, name: b.name, phone: b.phone.replace(/\d(?=\d{3})/g, '•') };
}
function findOwn(code, phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-8);
  return bookings.find((b) => b.code === String(code || '').trim().toUpperCase() && b.phone.replace(/\D/g, '').endsWith(digits) && digits.length >= 6);
}
app.post('/api/bookings/lookup', publicLimiter, (req, res) => {
  const b = findOwn(req.body?.code, req.body?.phone);
  if (!b) return res.status(404).json({ error: 'No booking found. Check the code and phone number.' });
  res.json({ booking: publicBooking(b) });
});
app.post('/api/bookings/reschedule', publicLimiter, async (req, res) => {
  const b = findOwn(req.body?.code, req.body?.phone);
  if (!b) return res.status(404).json({ error: 'No booking found' });
  if (b.status === 'cancelled') return res.status(400).json({ error: 'This booking was cancelled. Please make a new booking.' });
  const doc = findDoctor(b.doctorId);
  if (!doc) return res.status(400).json({ error: 'Doctor no longer available. Please call us.' });
  const err = checkSlot(doc, req.body.date, req.body.time, b.code);
  if (err) return res.status(409).json({ error: err });
  b.history.push({ at: new Date().toISOString(), from: `${b.date} ${b.time}`, action: 'rescheduled' });
  b.date = req.body.date; b.time = schedule.hasFixedSchedule(doc) ? req.body.time : 'To be confirmed'; b.status = 'rescheduled';
  if (schedule.isToken(doc)) { b.token = nextToken(doc.id, b.date); b.time = `Token ${b.token}`; }
  store.write('bookings', bookings);
  await notify.booking(b, content, 'rescheduled');
  res.json({ ok: true, booking: publicBooking(b) });
});
app.post('/api/bookings/cancel', publicLimiter, async (req, res) => {
  const b = findOwn(req.body?.code, req.body?.phone);
  if (!b) return res.status(404).json({ error: 'No booking found' });
  b.status = 'cancelled'; b.history.push({ at: new Date().toISOString(), action: 'cancelled by patient' });
  store.write('bookings', bookings);
  await notify.booking(b, content, 'cancelled');
  res.json({ ok: true, booking: publicBooking(b) });
});

app.get('/api/admin/bookings', auth, (req, res) => res.json(bookings.slice().reverse()));
app.patch('/api/admin/bookings/:code', auth, (req, res) => {
  const b = bookings.find((x) => x.code === req.params.code);
  if (!b) return res.status(404).json({ error: 'Not found' });
  const { status, note, date, time } = req.body || {};
  if (status && ['new', 'confirmed', 'rescheduled', 'arrived', 'done', 'no-show', 'cancelled'].includes(status)) b.status = status;
  if (note !== undefined) b.note = clean(note, 500);
  if (date) b.date = date;
  if (time) b.time = clean(time, 20);
  b.history.push({ at: new Date().toISOString(), action: `updated by ${req.user}`, status: b.status });
  store.write('bookings', bookings);
  res.json({ ok: true, booking: b });
});
app.get('/api/admin/bookings.csv', auth, (req, res) => {
  const cols = ['code', 'status', 'date', 'time', 'doctorName', 'name', 'phone', 'email', 'age', 'gender', 'reason', 'createdAt'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  res.type('text/csv').attachment('bookings.csv').send([cols.join(','), ...bookings.map((b) => cols.map((c) => q(b[c])).join(','))].join('\n'));
});

// ------------------------------------------------------------ feedback & Q&A
app.post('/api/feedback', publicLimiter, async (req, res) => {
  const f = req.body || {};
  if (f.website) return res.json({ ok: true });
  const message = clean(f.message, 2000);
  if (message.length < 5) return res.status(400).json({ error: 'Please write your feedback' });
  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), name: clean(f.name, 80), phone: clean(f.phone, 20),
    email: clean(f.email, 120), rating: Math.min(5, Math.max(0, Number(f.rating) || 0)), category: clean(f.category, 40), message, read: false };
  feedback.push(item); store.write('feedback', feedback);
  notify.staff(content, `[Website] New feedback (${item.rating || '-'}★)`, `${item.name} ${item.phone}\n${item.message}`);
  res.json({ ok: true });
});
app.get('/api/admin/feedback', auth, (req, res) => res.json(feedback.slice().reverse()));
app.patch('/api/admin/feedback/:id', auth, (req, res) => {
  const f = feedback.find((x) => x.id === req.params.id); if (!f) return res.status(404).end();
  Object.assign(f, { read: !!req.body.read, publishAsTestimonial: !!req.body.publishAsTestimonial }); store.write('feedback', feedback); res.json({ ok: true });
});
app.delete('/api/admin/feedback/:id', auth, (req, res) => {
  const i = feedback.findIndex((x) => x.id === req.params.id); if (i >= 0) feedback.splice(i, 1); store.write('feedback', feedback); res.json({ ok: true });
});

app.post('/api/questions', publicLimiter, async (req, res) => {
  const q = req.body || {};
  if (q.website) return res.json({ ok: true });
  const question = clean(q.question, 1000);
  if (question.length < 5) return res.status(400).json({ error: 'Please write your question' });
  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), name: clean(q.name, 80), contact: clean(q.contact, 120), question, answer: '', published: false };
  questions.push(item); store.write('questions', questions);
  notify.staff(content, '[Website] New question', `${item.name} ${item.contact}\n${item.question}`);
  res.json({ ok: true });
});
app.get('/api/admin/questions', auth, (req, res) => res.json(questions.slice().reverse()));
app.patch('/api/admin/questions/:id', auth, (req, res) => {
  const q = questions.find((x) => x.id === req.params.id); if (!q) return res.status(404).end();
  if (req.body.answer !== undefined) { q.answer = clean(req.body.answer, 3000); q.answeredAt = new Date().toISOString(); }
  if (req.body.question !== undefined) q.question = clean(req.body.question, 1000);
  if (req.body.published !== undefined) q.published = !!req.body.published;
  store.write('questions', questions); res.json({ ok: true });
});
app.delete('/api/admin/questions/:id', auth, (req, res) => {
  const i = questions.findIndex((x) => x.id === req.params.id); if (i >= 0) questions.splice(i, 1); store.write('questions', questions); res.json({ ok: true });
});

// ---------------------------------------------------------- Google sheet admin
app.get('/api/admin/sheet', auth, (req, res) => res.json(sheet.status()));
app.post('/api/admin/sheet/sync', auth, async (req, res) => { await syncSheet(); res.json(sheet.status()); });

// ------------------------------------------------------------- Google reviews
// Needs GOOGLE_PLACES_API_KEY in .env and the Place ID in Admin → Doctor form & Google.
let reviewsCache = { at: 0, data: null };
app.get('/api/reviews', async (req, res) => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = content.integrations?.googlePlaceId;
  if (!key || !placeId) return res.json({ enabled: false });
  if (reviewsCache.data && Date.now() - reviewsCache.at < 6 * 3600e3) return res.json(reviewsCache.data);
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri' }, signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || r.status);
    reviewsCache = { at: Date.now(), data: { enabled: true, rating: j.rating, count: j.userRatingCount, url: j.googleMapsUri,
      reviews: (j.reviews || []).map((v) => ({ author: v.authorAttribution?.displayName, photo: v.authorAttribution?.photoUri, rating: v.rating, text: v.text?.text || '', when: v.relativePublishTimeDescription })) } };
    res.json(reviewsCache.data);
  } catch (e) { res.json({ enabled: false, error: e.message }); }
});

// ------------------------------------------------ accounts, dashboards, OPD
function saveContent(next, by) {
  store.snapshot('content', content);
  next.meta = { ...(next.meta || {}), updatedAt: new Date().toISOString(), updatedBy: by };
  delete next.answeredQuestions; delete next.notifyChannels;
  numberDoctors(next, content.meta.doctorSeq);
  content = next;
  store.write('content', content);
}
const ctx = {
  prod: PROD, uploadDir: UPLOAD_DIR, privateDir: PRIVATE_DIR, opdDir: OPD_DIR, schedule, adminAuth: auth,
  content: () => content, saveContent, doctors: allDoctors, mailer, saveBookings: () => store.write('bookings', bookings), siteUrl: () => SITE_URL,
  today: () => schedule.todayInNepal(), bookings: () => bookings,
  updateBooking(code, doctorId, change) {
    const b = bookings.find((x) => x.code === code && x.doctorId === doctorId);
    if (!b) return false;
    if (change.status) { b.status = change.status; b.history.push({ at: new Date().toISOString(), action: `${change.status} from OPD` }); }
    if (change.opdPatientId) b.opdPatientId = change.opdPatientId;
    store.write('bookings', bookings);
    return true;
  },
};
accounts.mount(app, ctx);
ctx.opd = opdLib.create(ctx);
portal.mount(app, ctx);
require('./lib/doctors').mount(app, ctx);
app.use('/api/opd', ctx.opd.router);
app.get('/api/admin/mail-status', auth, (req, res) => res.json(mailer.status()));
// Notices and messages that waited because of the daily email limit go out once a day after 7 am (Nepal time).
setInterval(() => {
  const np = new Date(Date.now() + 345 * 60e3);
  const day = np.toISOString().slice(0, 10);
  if (np.getUTCHours() >= 7 && ctx.lastDigest !== day) { ctx.lastDigest = day; mailer.flushDigests(SITE_URL).catch((e) => console.error('[digest]', e.message)); }
}, 30 * 60e3).unref();

// ----------------------------------------------------------------- static files
stock.mount(app, UPLOAD_DIR); // template photos at /stock/<name>.jpg
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: PROD ? '1h' : 0,
  setHeaders: (res, p) => {
    if (/\.(svg|png|jpg|webp)$/.test(p)) res.set('Cache-Control', 'public, max-age=604800');
    // pages, scripts and styles: browsers check for a newer version every time (a quick 304 if unchanged), so fixes reach everyone at once
    else if (/\.(html|js|css)$/.test(p)) res.set('Cache-Control', 'no-cache');
  },
}));
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.get('/opd', (req, res) => res.redirect('/opd.html'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`NIKO Hospital website running on http://localhost:${PORT}  (admin: /admin.html)`));
