// Website accounts for patients and staff: email code → set password → profile.
// Staff accounts wait for the Director's approval. Roles: director, owner, verifier (checks payment receipts).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const store = require('./store');
const mailer = require('./mailer');

const STAFF_ROLES = ['doctor', 'nursing', 'lab', 'pharmacy', 'management'];
const ROLE_NAMES = { doctor: 'Doctor', nursing: 'Nursing staff', lab: 'Lab staff', pharmacy: 'Pharmacy staff', management: 'Management staff' };
const SESSION_DAYS = 30;

const accounts = store.read('accounts', []);
const sessions = store.read('usessions', {}); // sha256(token) → { uid, expires }
const codes = new Map();   // email → { hash, expires, tries }
const setups = new Map();  // token → { email, expires }
const sentCodes = new Map(); // email → [timestamps] (max 5 an hour)

const now = () => new Date().toISOString();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const normEmail = (e) => String(e || '').trim().toLowerCase().slice(0, 160);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);

function directorEmails() { return String(process.env.DIRECTOR_EMAIL || '').split(',').map(normEmail).filter(Boolean); }
function ownerEmails() { return String(process.env.OWNER_EMAIL || '').split(',').map(normEmail).filter(Boolean); }

function byId(id) { return accounts.find((a) => a.id === id); }
function byEmail(email) { email = normEmail(email); return accounts.find((a) => a.email === email); }
function save() { store.write('accounts', accounts); }
function saveSessions() { store.write('usessions', sessions); }

function has(a, role) { return !!(a && Array.isArray(a.roles) && a.roles.includes(role)); }
function isDirector(a) { return has(a, 'director'); }
function isOwner(a) { return has(a, 'owner'); }
function seesAll(a) { return isDirector(a) || isOwner(a); }
function activeStaff(a, role) { return !!(a && a.type === 'staff' && a.status === 'active' && (!role || a.staffRole === role)); }
function isDoctor(a) { return activeStaff(a, 'doctor') && !!a.doctorId; }
function canVerifyPayments(a) { return seesAll(a) || has(a, 'verifier'); }
function displayName(a) { return (a && (a.profile && a.profile.name)) || (a && a.email) || ''; }

function publicView(a, extra) {
  if (!a) return null;
  return Object.assign({
    id: a.id, email: a.email, type: a.type || '', staffRole: a.staffRole || '', doctorId: a.doctorId || '', status: a.status,
    profile: a.profile || {}, roles: a.roles || [], opdAccess: a.opdAccess || [], createdAt: a.createdAt, lastLoginAt: a.lastLoginAt || '',
    needsProfile: !a.type,
  }, extra || {});
}

// ----------------------------------------------------------------- sessions
function cookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
function startSession(res, a, prod) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[sha(token)] = { uid: a.id, expires: Date.now() + SESSION_DAYS * 864e5 };
  a.lastLoginAt = now(); save();
  // tidy expired sessions
  for (const [k, s] of Object.entries(sessions)) if (s.expires < Date.now()) delete sessions[k];
  saveSessions();
  res.setHeader('Set-Cookie', `niko_u=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${prod ? '; Secure' : ''}`);
}
function current(req) {
  const s = sessions[sha(cookie(req, 'niko_u'))];
  if (!s || s.expires < Date.now()) return null;
  const a = byId(s.uid);
  if (!a || a.status === 'disabled') return null;
  return a;
}
// Every signed-in API call. State-changing calls must carry the header our own pages add.
function need(req, res, next) {
  const a = current(req);
  if (!a) return res.status(401).json({ error: 'Please sign in', login: true });
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'niko-app') return res.status(403).json({ error: 'Bad request origin' });
  req.acct = a;
  next();
}
function needDirector(req, res, next) { need(req, res, () => (isDirector(req.acct) ? next() : res.status(403).json({ error: 'Only the Director can do this' }))); }
function signOutEverywhere(uid) { for (const [k, s] of Object.entries(sessions)) if (s.uid === uid) delete sessions[k]; saveSessions(); }

// ---------------------------------------------------------------- routes
function mount(app, ctx) {
  const prod = ctx.prod;
  const codeLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again in an hour.' } });
  const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });

  app.post('/api/acct/code', codeLimiter, async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    const recent = (sentCodes.get(email) || []).filter((t) => t > Date.now() - 3600e3);
    if (recent.length >= 5) return res.status(429).json({ error: 'Too many codes sent to this email. Try again in an hour.' });
    if (!mailer.configured() && prod) return res.status(503).json({ error: 'Sign-up by email is not switched on yet. Please call the hospital on 057-520223.' });
    const code = String(crypto.randomInt(100000, 1000000));
    codes.set(email, { hash: sha(code + email), expires: Date.now() + 10 * 60e3, tries: 0 });
    recent.push(Date.now()); sentCodes.set(email, recent);
    const exists = !!(byEmail(email) && byEmail(email).hash);
    const r = await mailer.send(email, `${code} is your NIKO Hospital code`,
      `Your NIKO Hospital ${exists ? 'password reset' : 'sign-up'} code is:\n\n${code}\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email.`);
    if (!r.ok && mailer.configured()) return res.status(502).json({ error: 'We could not send the email just now. Please try again in a few minutes or call 057-520223.' });
    res.json({ ok: true, exists, devCode: !mailer.configured() && !prod ? code : undefined });
  });

  app.post('/api/acct/verify', loginLimiter, (req, res) => {
    const email = normEmail(req.body?.email), code = String(req.body?.code || '').replace(/\D/g, '');
    const c = codes.get(email);
    if (!c || c.expires < Date.now()) return res.status(400).json({ error: 'The code has expired. Ask for a new one.' });
    c.tries += 1;
    if (c.tries > 5) { codes.delete(email); return res.status(400).json({ error: 'Too many wrong tries. Ask for a new code.' }); }
    if (c.hash !== sha(code + email)) return res.status(400).json({ error: 'That code is not right. Check the email and try again.' });
    codes.delete(email);
    const token = crypto.randomBytes(24).toString('hex');
    setups.set(token, { email, expires: Date.now() + 30 * 60e3 });
    res.json({ ok: true, setupToken: token });
  });

  app.post('/api/acct/password', (req, res) => {
    const s = setups.get(String(req.body?.setupToken || ''));
    if (!s || s.expires < Date.now()) return res.status(400).json({ error: 'This step has expired. Please start again.' });
    const pw = String(req.body?.password || '');
    if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    setups.delete(String(req.body.setupToken));
    let a = byEmail(s.email);
    if (!a) {
      a = { id: `U${crypto.randomBytes(5).toString('hex')}`, email: s.email, createdAt: now(), status: 'new', type: '', profile: {}, roles: [], opdAccess: [] };
      accounts.push(a);
    }
    a.hash = bcrypt.hashSync(pw, 11);
    if (directorEmails().includes(a.email) && !isDirector(a)) a.roles.push('director');
    if (ownerEmails().includes(a.email) && !isOwner(a)) a.roles.push('owner');
    signOutEverywhere(a.id);
    save();
    startSession(res, a, prod);
    res.json({ ok: true, account: publicView(a) });
  });

  app.post('/api/acct/login', loginLimiter, (req, res) => {
    const a = byEmail(req.body?.email);
    if (!a || !a.hash || !bcrypt.compareSync(String(req.body?.password || ''), a.hash)) return res.status(401).json({ error: 'Wrong email or password' });
    if (a.status === 'disabled') return res.status(403).json({ error: 'This account is turned off. Please contact the hospital.' });
    startSession(res, a, prod);
    res.json({ ok: true, account: publicView(a) });
  });

  app.post('/api/acct/logout', (req, res) => {
    delete sessions[sha(cookie(req, 'niko_u'))]; saveSessions();
    res.setHeader('Set-Cookie', 'niko_u=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/acct/me', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const a = current(req);
    if (!a) return res.json({ account: null });
    res.json({ account: publicView(a, { unread: ctx.unreadCount ? ctx.unreadCount(a) : 0, canVerify: canVerifyPayments(a), seesAll: seesAll(a) }) });
  });

  // Who the person is: patient or staff (and which staff). Doctors pick their own name from the doctor list.
  app.post('/api/acct/profile', need, (req, res) => {
    const a = req.acct, b = req.body || {};
    const p = { name: clean(b.name, 80), age: clean(b.age, 3).replace(/\D/g, ''), gender: clean(b.gender, 10), phone: clean(b.phone, 20), address: clean(b.address, 200) };
    if (p.name.length < 2) return res.status(400).json({ error: 'Enter your full name' });
    const wasType = a.type, wasRole = a.staffRole, wasDoc = a.doctorId;
    if (!a.type || b.type) {
      if (!['patient', 'staff'].includes(b.type)) return res.status(400).json({ error: 'Choose Patient or Staff' });
      if (b.type === 'patient' && !p.age) return res.status(400).json({ error: 'Enter your age' });
      if (b.type === 'staff') {
        if (!STAFF_ROLES.includes(b.staffRole)) return res.status(400).json({ error: 'Choose your staff type' });
        if (b.staffRole === 'doctor') {
          const docs = ctx.doctors();
          if (!docs.find((d) => d.id === b.doctorId)) return res.status(400).json({ error: 'Choose your name from the list' });
          const taken = accounts.find((x) => x.id !== a.id && x.doctorId === b.doctorId && x.status !== 'rejected' && x.status !== 'disabled');
          if (taken) return res.status(409).json({ error: 'Another account already uses this doctor profile. Please contact the Director.' });
        }
      }
      a.type = b.type;
      a.staffRole = b.type === 'staff' ? b.staffRole : '';
      a.doctorId = b.type === 'staff' && b.staffRole === 'doctor' ? b.doctorId : '';
    }
    a.profile = Object.assign({}, a.profile, p);
    const changedRole = wasType !== a.type || wasRole !== a.staffRole || wasDoc !== a.doctorId;
    if (a.type === 'patient') a.status = 'active';
    else if (seesAll(a)) a.status = 'active';
    else if (changedRole || a.status === 'new' || a.status === 'rejected') a.status = 'pending';
    save();
    if (a.status === 'pending' && changedRole && ctx.notify) {
      const doc = a.doctorId ? ctx.doctors().find((d) => d.id === a.doctorId) : null;
      ctx.notify({ roles: ['director'] }, {
        title: `New staff account to approve: ${p.name}`,
        body: `${p.name} (${a.email}) signed up as ${ROLE_NAMES[a.staffRole]}${doc ? ` – ${doc.name.en}` : ''}. Approve or reject it in Dashboard → Approvals.`,
        link: '#/dashboard/approvals', kind: 'system',
      });
    }
    res.json({ ok: true, account: publicView(a) });
  });

  app.post('/api/acct/change-password', need, (req, res) => {
    const a = req.acct;
    if (!bcrypt.compareSync(String(req.body?.current || ''), a.hash)) return res.status(400).json({ error: 'Current password is wrong' });
    if (String(req.body?.next || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    a.hash = bcrypt.hashSync(String(req.body.next), 11); save();
    res.json({ ok: true });
  });

  // ------------------------------------------------ Director: accounts and access
  app.get('/api/acct/admin/accounts', needDirector, (req, res) => res.json(accounts.map((a) => publicView(a))));
  app.patch('/api/acct/admin/accounts/:id', needDirector, (req, res) => {
    const a = byId(req.params.id); if (!a) return res.status(404).json({ error: 'Not found' });
    const r = applyAdminChange(a, req.body || {}, req.acct);
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, account: publicView(a) });
  });

  function applyAdminChange(a, b, by) {
    const before = a.status;
    if (b.status && ['active', 'pending', 'rejected', 'disabled'].includes(b.status)) {
      if (by && a.id === by.id && b.status !== 'active') return { error: 'You cannot turn off your own account' };
      a.status = b.status;
      if (b.status === 'disabled') signOutEverywhere(a.id);
    }
    if (Array.isArray(b.roles)) {
      const roles = b.roles.filter((r) => ['director', 'owner', 'verifier'].includes(r));
      if (by && a.id === by.id && !roles.includes('director')) return { error: 'You cannot remove your own Director role' };
      a.roles = roles;
    }
    if (Array.isArray(b.opdAccess)) a.opdAccess = b.opdAccess.map((x) => clean(x, 40)).filter(Boolean);
    if (b.staffRole !== undefined && (b.staffRole === '' || STAFF_ROLES.includes(b.staffRole))) { a.staffRole = b.staffRole; if (b.staffRole) a.type = 'staff'; }
    if (b.doctorId !== undefined) a.doctorId = clean(b.doctorId, 40);
    save();
    if (before !== a.status && (a.status === 'active' || a.status === 'rejected') && a.type === 'staff') {
      mailer.send(a.email, a.status === 'active' ? 'Your NIKO Hospital staff account is approved' : 'Your NIKO Hospital staff account',
        a.status === 'active' ? 'Your staff account has been approved. You can now use your dashboard.' : 'Your staff account request was not approved. Please contact the hospital management.',
        { link: ctx.siteUrl() ? { text: 'Open my dashboard', url: `${ctx.siteUrl()}/#/dashboard` } : null });
    }
    return { ok: true };
  }

  // The admin panel (username login) can also manage accounts, so the first Director can be set up there.
  app.get('/api/admin/accounts', ctx.adminAuth, (req, res) => res.json(accounts.map((a) => publicView(a))));
  // Create an account directly (e.g. the Director's own, before email sending is set up).
  app.post('/api/admin/accounts', ctx.adminAuth, (req, res) => {
    const b = req.body || {}, email = normEmail(b.email);
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (byEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' });
    if (String(b.password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const roles = (Array.isArray(b.roles) ? b.roles : []).filter((r) => ['director', 'owner', 'verifier'].includes(r));
    const a = { id: `U${crypto.randomBytes(5).toString('hex')}`, email, hash: bcrypt.hashSync(String(b.password), 11), createdAt: now(), status: roles.length ? 'active' : 'new', type: '', profile: { name: clean(b.name, 80) }, roles, opdAccess: [] };
    accounts.push(a); save();
    res.json({ ok: true, account: publicView(a) });
  });
  app.patch('/api/admin/accounts/:id', ctx.adminAuth, (req, res) => {
    const a = byId(req.params.id); if (!a) return res.status(404).json({ error: 'Not found' });
    const r = applyAdminChange(a, req.body || {}, null);
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, account: publicView(a) });
  });
}

module.exports = {
  mount, need, needDirector, current, byId, byEmail, all: () => accounts, save, publicView, displayName,
  isDirector, isOwner, seesAll, activeStaff, isDoctor, canVerifyPayments, has, STAFF_ROLES, ROLE_NAMES,
};
