// Signed-in features: notifications & messages, doctor profile approvals, video consultations,
// lab bookings/results/reports (with the lab email bridge), and service requests.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const store = require('./store');
const mailer = require('./mailer');
const acc = require('./accounts');
const labpdf = require('./labpdf');

const now = () => new Date().toISOString();
const rid = (p) => `${p}${crypto.randomBytes(5).toString('hex')}`;
const code = (p) => `${p}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').trim().slice(0, max);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const ymd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

const notes = store.read('notes', []);
const docEdits = store.read('docEdits', []);
const consults = store.read('consults', []);
const labOrders = store.read('labOrders', []);
const reports = store.read('reports', []);
const labInbox = store.read('labInbox', []);
const requests = store.read('requests', []);
const files = store.read('files', {});
const rooms = new Map(); // room → { msgs: [{ n, from, type, data }], n }

function mount(app, ctx) {
  const PRIVATE_DIR = ctx.privateDir;
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  const need = acc.need;
  const C = () => ctx.content();
  const site = () => ctx.siteUrl();
  const link = (hash, text) => (site() ? { text: text || 'Open', url: `${site()}/${hash}` } : null);

  // ----------------------------------------------------------- private files
  const privUpload = multer({
    storage: multer.diskStorage({
      destination: PRIVATE_DIR,
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${{ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[file.mimetype] || ''}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mimetype)),
  });
  function keepFile(f, access, by) {
    files[f.filename] = { name: clean(f.originalname, 120), type: f.mimetype, size: f.size, at: now(), by: by || '', access };
    store.write('files', files);
    return { file: f.filename, name: clean(f.originalname, 120), type: f.mimetype };
  }
  function canRead(a, rec) {
    if (!rec || !a) return false;
    const x = rec.access || {};
    if (acc.seesAll(a)) return true;
    if ((x.users || []).includes(a.id)) return true;
    if ((x.roles || []).some((r) => acc.has(a, r))) return true;
    if (a.type === 'staff' && a.status === 'active' && (x.staff || []).includes(a.staffRole)) return true;
    if (a.doctorId && acc.isDoctor(a) && (x.doctors || []).includes(a.doctorId)) return true;
    return false;
  }
  app.get('/api/p/file/:name', need, (req, res) => {
    const name = String(req.params.name);
    if (!/^[\w.-]+$/.test(name) || !files[name]) return res.status(404).json({ error: 'Not found' });
    if (!canRead(req.acct, files[name])) return res.status(403).json({ error: 'Not allowed' });
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.type(files[name].type);
    if (req.query.download) res.attachment(files[name].name || name);
    res.sendFile(path.join(PRIVATE_DIR, name));
  });

  // ----------------------------------------------------------- notifications
  function recipients(to) {
    const set = new Set(to.users || []);
    acc.all().forEach((a) => {
      if (a.status === 'disabled') return;
      if ((to.roles || []).some((r) => acc.has(a, r))) set.add(a.id);
      if (a.type === 'staff' && a.status === 'active') {
        if (to.allStaff) set.add(a.id);
        if ((to.staff || []).includes(a.staffRole)) set.add(a.id);
        if (a.doctorId && (to.doctors || []).includes(a.doctorId)) set.add(a.id);
      }
    });
    return [...set];
  }
  // to: { users:[], roles:[], staff:[], doctors:[], allStaff }   msg: { title, body, link, kind, from, email }
  function notify(to, msg) {
    const ids = recipients(to || {});
    if (!ids.length) return null;
    const n = { id: rid('N'), at: now(), kind: msg.kind || 'system', title: clean(msg.title, 160), body: clean(msg.body, 4000), link: clean(msg.link, 200),
      from: msg.from || null, to: to || {}, recipients: ids, readBy: {} };
    notes.push(n);
    if (notes.length > 5000) notes.splice(0, notes.length - 5000);
    store.write('notes', notes);
    if (msg.email !== false) {
      const bulk = ids.length > 3;
      ids.forEach((id) => {
        const a = acc.byId(id); if (!a) return;
        mailer.send(a.email, n.title, `${n.body}${msg.from ? `\n\n— ${msg.from.name}` : ''}`, { bulk, link: link(n.link || '#/dashboard', 'Open on the website') });
      });
    }
    return n;
  }
  ctx.notify = notify;
  ctx.unreadCount = (a) => notes.filter((n) => n.recipients.includes(a.id) && !n.readBy[a.id]).length;

  app.get('/api/p/notes', need, (req, res) => {
    const a = req.acct;
    const mine = notes.filter((n) => n.recipients.includes(a.id)).slice(-200).reverse()
      .map((n) => ({ id: n.id, at: n.at, kind: n.kind, title: n.title, body: n.body, link: n.link, from: n.from, read: !!n.readBy[a.id] }));
    const sent = acc.seesAll(a) ? notes.filter((n) => n.from && n.from.id === a.id).slice(-100).reverse()
      .map((n) => ({ id: n.id, at: n.at, kind: n.kind, title: n.title, body: n.body, to: n.to, count: n.recipients.length, readCount: Object.keys(n.readBy).length })) : [];
    res.json({ notes: mine, sent });
  });
  app.post('/api/p/notes/read', need, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    notes.forEach((n) => { if (n.recipients.includes(req.acct.id) && !n.readBy[req.acct.id] && (!ids || ids.includes(n.id))) n.readBy[req.acct.id] = now(); });
    store.write('notes', notes);
    res.json({ ok: true });
  });
  // Director / owner: messages to chosen people, and notices to chosen groups.
  app.post('/api/p/notes/send', need, (req, res) => {
    const a = req.acct, b = req.body || {};
    if (!acc.seesAll(a)) return res.status(403).json({ error: 'Only the Director or owner can send messages' });
    const to = {
      users: Array.isArray(b.users) ? b.users.map(String) : [],
      staff: Array.isArray(b.staff) ? b.staff.filter((r) => acc.STAFF_ROLES.includes(r)) : [],
      allStaff: !!b.allStaff,
    };
    if (!clean(b.title, 160)) return res.status(400).json({ error: 'Write a title' });
    const n = notify(to, { kind: b.kind === 'notice' ? 'notice' : 'message', title: b.title, body: b.body, link: b.link || '', from: { id: a.id, name: acc.displayName(a) } });
    if (!n) return res.status(400).json({ error: 'Choose at least one person or group' });
    res.json({ ok: true, count: n.recipients.length, emailsLeftToday: mailer.remaining() });
  });
  app.delete('/api/p/notes/:id', need, (req, res) => {
    const i = notes.findIndex((n) => n.id === req.params.id && n.from && n.from.id === req.acct.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    notes.splice(i, 1); store.write('notes', notes); res.json({ ok: true });
  });
  // People the Director can message
  app.get('/api/p/people', need, (req, res) => {
    const a = req.acct;
    const staffOnly = !acc.seesAll(a);
    if (staffOnly && !(acc.activeStaff(a, 'lab') || acc.activeStaff(a, 'management'))) return res.status(403).json({ error: 'Not allowed' });
    const q = String(req.query.q || '').toLowerCase();
    const type = String(req.query.type || '');
    const list = acc.all().filter((x) => x.status !== 'disabled' && x.type && (!type || x.type === type))
      .filter((x) => !q || `${x.profile?.name} ${x.email} ${x.profile?.phone}`.toLowerCase().includes(q))
      .slice(0, 300).map((x) => ({ id: x.id, name: x.profile?.name || x.email, email: x.email, type: x.type, staffRole: x.staffRole, status: x.status, age: x.profile?.age, gender: x.profile?.gender, phone: x.profile?.phone }));
    res.json(list);
  });

  // ------------------------------------------------- doctor profile edits
  const DOC_FIELDS = ['title', 'degrees', 'nmc', 'affiliation', 'gender', 'languages', 'focus', 'bio', 'photo', 'hours', 'scheduleNote'];
  function cleanDocFields(b) {
    const out = {};
    const bi = (v, max) => ({ en: clean(isObj(v) ? v.en : v, max), ne: clean(isObj(v) ? v.ne : '', max) });
    if (b.title !== undefined) out.title = bi(b.title, 120);
    if (b.degrees !== undefined) out.degrees = clean(b.degrees, 200);
    if (b.nmc !== undefined) out.nmc = clean(b.nmc, 20);
    if (b.affiliation !== undefined) out.affiliation = clean(b.affiliation, 160);
    if (b.gender !== undefined) out.gender = ['Male', 'Female', ''].includes(b.gender) ? b.gender : '';
    if (b.languages !== undefined) out.languages = (Array.isArray(b.languages) ? b.languages : String(b.languages).split(/[,\n]/)).map((x) => clean(x, 30)).filter(Boolean).slice(0, 8);
    if (b.focus !== undefined) out.focus = (Array.isArray(b.focus) ? b.focus : String(b.focus).split(/[,\n]/)).map((x) => clean(x, 60)).filter(Boolean).slice(0, 15);
    if (b.bio !== undefined) out.bio = bi(b.bio, 1500);
    if (b.photo !== undefined && (/^uploads\/[\w.-]+$/.test(b.photo) || b.photo === '')) out.photo = b.photo;
    if (b.hours !== undefined) out.hours = clean(b.hours, 60);
    if (b.scheduleNote !== undefined) out.scheduleNote = bi(b.scheduleNote, 120);
    return out;
  }
  app.get('/api/p/doctor-profile', need, (req, res) => {
    const a = req.acct;
    if (!a.doctorId) return res.status(400).json({ error: 'This account is not linked to a doctor' });
    const d = ctx.doctors().find((x) => x.id === a.doctorId);
    const pending = docEdits.filter((e) => e.accountId === a.id).slice(-5).reverse();
    res.json({ doctor: d || null, edits: pending, fields: DOC_FIELDS });
  });
  app.post('/api/p/doctor-profile', need, (req, res) => {
    const a = req.acct;
    if (a.staffRole !== 'doctor' || !a.doctorId) return res.status(400).json({ error: 'This account is not linked to a doctor' });
    const fields = cleanDocFields(req.body || {});
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to save' });
    // one open request per doctor: a new one replaces the old pending one
    docEdits.forEach((e) => { if (e.accountId === a.id && e.status === 'pending') { e.status = 'replaced'; e.decidedAt = now(); } });
    const e = { id: rid('E'), accountId: a.id, doctorId: a.doctorId, fields, status: 'pending', at: now() };
    docEdits.push(e); store.write('docEdits', docEdits);
    notify({ roles: ['director'] }, { title: `Doctor profile change to approve: ${acc.displayName(a)}`, body: 'A doctor updated their website profile. Review and approve it in Dashboard → Approvals.', link: '#/dashboard/approvals' });
    res.json({ ok: true, edit: e });
  });
  // public photo upload for doctors' profile photos (it becomes public only after approval)
  const pubUpload = multer({
    storage: multer.diskStorage({ destination: ctx.uploadDir, filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${{ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype]}`) }),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
  });
  app.post('/api/p/photo', need, pubUpload.single('file'), (req, res) => {
    if (!(acc.activeStaff(req.acct) || req.acct.staffRole === 'doctor' || acc.seesAll(req.acct))) return res.status(403).json({ error: 'Only staff can upload photos' });
    if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG or WEBP photo up to 6 MB' });
    res.json({ url: `uploads/${req.file.filename}` });
  });
  app.get('/api/p/approvals', acc.needDirector, (req, res) => {
    const pendingStaff = acc.all().filter((a) => a.type === 'staff' && a.status === 'pending').map((a) => acc.publicView(a));
    const edits = docEdits.filter((e) => e.status === 'pending').map((e) => Object.assign({}, e, { account: acc.publicView(acc.byId(e.accountId)), current: ctx.doctors().find((d) => d.id === e.doctorId) || null }));
    res.json({ staff: pendingStaff, edits });
  });
  app.post('/api/p/approvals/edit/:id', acc.needDirector, (req, res) => {
    const e = docEdits.find((x) => x.id === req.params.id && x.status === 'pending');
    if (!e) return res.status(404).json({ error: 'Not found' });
    e.decidedAt = now(); e.by = req.acct.id;
    if (req.body?.approve) {
      const next = JSON.parse(JSON.stringify(C()));
      let d = next.doctors.find((x) => x.id === e.doctorId);
      if (!d) { const m = ctx.doctors().find((x) => x.id === e.doctorId); if (!m) return res.status(404).json({ error: 'Doctor not found' }); d = JSON.parse(JSON.stringify(m)); next.doctors.push(d); }
      Object.assign(d, e.fields);
      d.lockFromForm = true; // the doctor's own approved edits win over the Google Form
      ctx.saveContent(next, `director:${req.acct.email}`);
      e.status = 'approved';
    } else e.status = 'rejected';
    e.note = clean(req.body?.note, 400);
    store.write('docEdits', docEdits);
    notify({ users: [e.accountId] }, { title: e.status === 'approved' ? 'Your profile changes are now on the website' : 'Your profile changes were not approved', body: e.note || (e.status === 'approved' ? 'Patients can now see your updated profile.' : 'Please check the details and send them again.'), link: '#/dashboard/profile' });
    res.json({ ok: true });
  });

  // --------------------------------------------------- video consultation
  const docById = (id) => ctx.doctors().find((d) => d.id === id && d.visible !== false);
  function feeFor(d) { const c = C().consult || {}; return String(d.degreeLevel || 'MD').toUpperCase() === 'DM' ? Number(c.feeDM || 950) : Number(c.feeMD || 700); }
  function consultTaken(doctorId, date, except) {
    return consults.filter((c) => c.doctorId === doctorId && c.date === date && !['cancelled', 'rejected'].includes(c.status) && c.id !== except).map((c) => c.time);
  }
  function consultView(c, a) {
    const v = Object.assign({}, c);
    v.joinUrl = c.room && c.status === 'confirmed' ? `#/room/${c.room}` : '';
    if (!(acc.seesAll(a) || acc.canVerifyPayments(a))) delete v.verifyNote;
    return v;
  }
  app.get('/api/p/consult/taken', (req, res) => {
    const d = docById(String(req.query.doctor || '')); if (!d) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ taken: consultTaken(d.id, String(req.query.date || '')), fee: feeFor(d) });
  });
  app.post('/api/p/consults', need, privUpload.single('receipt'), (req, res) => {
    const a = req.acct, b = req.body || {}, cs = C().consult || {};
    if (cs.enabled === false) return res.status(400).json({ error: 'Video consultation is closed at the moment' });
    if (a.type !== 'patient') return res.status(400).json({ error: 'Please sign in with a patient account to book' });
    const d = docById(b.doctorId);
    if (!d || d.videoConsult === false) return res.status(400).json({ error: 'Choose a doctor' });
    if (!ymd(b.date) || b.date < ctx.today()) return res.status(400).json({ error: 'Choose a date' });
    if (!ctx.schedule.availableOn(d, b.date, C().booking)) return res.status(400).json({ error: 'The doctor is not available on that date' });
    const slots = ctx.schedule.slots(d, Object.assign({}, C().booking, { slotMinutes: Number(cs.slotMinutes || 15) }));
    if (!slots.includes(b.time)) return res.status(400).json({ error: 'Choose a time' });
    if (consultTaken(d.id, b.date).includes(b.time)) return res.status(409).json({ error: 'That time was just booked. Please choose another time.' });
    if (!req.file) return res.status(400).json({ error: 'Upload the payment receipt (photo or PDF)' });
    const c = {
      id: rid('C'), code: code('VC'), createdAt: now(), status: 'payment_review',
      patientId: a.id, patientName: a.profile?.name || '', patientAge: a.profile?.age || '', patientGender: a.profile?.gender || '', patientEmail: a.email, phone: clean(b.phone || a.profile?.phone, 20),
      doctorId: d.id, doctorName: d.name.en, degreeLevel: String(d.degreeLevel || 'MD').toUpperCase(), fee: feeFor(d), date: b.date, time: b.time,
      reason: clean(b.reason, 1000), method: ['fonepay', 'esewa'].includes(b.method) ? b.method : 'fonepay', room: '', history: [{ at: now(), action: 'booked, receipt uploaded' }],
    };
    c.receipt = keepFile(req.file, { users: [a.id], roles: ['verifier'] }, a.id);
    consults.push(c); store.write('consults', consults);
    notify({ roles: ['owner', 'verifier'] }, { title: `Check payment: video consultation ${c.code} (Rs ${c.fee})`, body: `${c.patientName} paid Rs ${c.fee} by ${c.method} for a video consultation with ${c.doctorName} on ${c.date} at ${c.time}. Please check the receipt and confirm it.`, link: '#/dashboard/payments' });
    res.json({ ok: true, consult: consultView(c, a) });
  });
  app.get('/api/p/consults', need, (req, res) => {
    const a = req.acct;
    let list;
    if (acc.seesAll(a) || acc.canVerifyPayments(a)) list = consults;
    else if (acc.isDoctor(a)) list = consults.filter((c) => c.doctorId === a.doctorId && c.status !== 'payment_review' && c.status !== 'rejected');
    else list = consults.filter((c) => c.patientId === a.id);
    res.json(list.slice().reverse().slice(0, 500).map((c) => consultView(c, a)));
  });
  app.post('/api/p/consults/:id/verify', need, (req, res) => {
    const a = req.acct, c = consults.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (!acc.canVerifyPayments(a)) return res.status(403).json({ error: 'Only the owner or a payment checker can do this' });
    if (c.status !== 'payment_review') return res.status(400).json({ error: 'This booking was already checked' });
    c.verifiedBy = acc.displayName(a); c.verifiedAt = now(); c.verifyNote = clean(req.body?.note, 300);
    if (req.body?.ok) {
      c.status = 'confirmed'; c.room = crypto.randomBytes(9).toString('base64url');
      c.history.push({ at: now(), action: `payment confirmed by ${c.verifiedBy}` });
      const when = `${c.date} at ${c.time}`;
      notify({ roles: ['director', 'owner'], doctors: [c.doctorId] }, { title: `Video consultation ${c.code}: ${c.patientName}, ${when}`, body: `Doctor: ${c.doctorName}\nPatient: ${c.patientName}${c.patientAge ? ` (${c.patientAge}${c.patientGender ? ` ${c.patientGender}` : ''})` : ''}\nReason: ${c.reason || '—'}\n\nAt the time, open the consultation link and start the call.`, link: `#/room/${c.room}` });
      notify({ users: [c.patientId] }, { title: `Your video consultation is confirmed (${c.code})`, body: `Your video consultation with ${c.doctorName} is on ${when}.\nA few minutes before the time, open the link below on your phone or computer and allow the camera and microphone.`, link: `#/room/${c.room}` });
    } else {
      c.status = 'rejected';
      c.history.push({ at: now(), action: `payment not confirmed by ${c.verifiedBy}` });
      notify({ users: [c.patientId] }, { title: `We could not confirm your payment (${c.code})`, body: `${c.verifyNote || 'The receipt could not be matched with a payment.'}\nPlease call 057-520223 for help.`, link: '#/dashboard/consults' });
    }
    store.write('consults', consults);
    res.json({ ok: true, consult: consultView(c, a) });
  });
  function canRunConsult(a, c) { return acc.seesAll(a) || (acc.isDoctor(a) && a.doctorId === c.doctorId); }
  app.post('/api/p/consults/:id/remind', need, async (req, res) => {
    const c = consults.find((x) => x.id === req.params.id);
    if (!c || !canRunConsult(req.acct, c)) return res.status(404).json({ error: 'Not found' });
    if (c.status !== 'confirmed') return res.status(400).json({ error: 'This consultation is not confirmed' });
    const r = await mailer.send(c.patientEmail, `${c.doctorName} is waiting for you – join your video consultation`, `${c.doctorName} is ready for your video consultation now.\nTap the button to join. Allow the camera and microphone when asked.`, { link: link(`#/room/${c.room}`, 'Join the video call') });
    notify({ users: [c.patientId] }, { title: `${c.doctorName} is waiting for you`, body: 'Join your video consultation now.', link: `#/room/${c.room}`, email: false });
    c.history.push({ at: now(), action: 'join link sent to patient' }); store.write('consults', consults);
    res.json({ ok: true, emailed: !!r.ok });
  });
  app.post('/api/p/consults/:id/status', need, (req, res) => {
    const c = consults.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const s = req.body?.status;
    if (!['completed', 'cancelled', 'confirmed'].includes(s)) return res.status(400).json({ error: 'Bad status' });
    if (!canRunConsult(req.acct, c) && !(s === 'cancelled' && c.patientId === req.acct.id && c.status === 'payment_review')) return res.status(403).json({ error: 'Not allowed' });
    c.status = s; c.history.push({ at: now(), action: `${s} by ${acc.displayName(req.acct)}` });
    if (req.body?.notes !== undefined && canRunConsult(req.acct, c)) c.doctorNotes = clean(req.body.notes, 3000);
    store.write('consults', consults);
    res.json({ ok: true });
  });

  // ---------------------------------------------- video room (WebRTC signalling)
  function roomFor(a, room) {
    const c = consults.find((x) => x.room === room);
    if (!c) return null;
    let me = '';
    if (c.patientId === a.id) me = 'patient';
    else if (acc.isDoctor(a) && a.doctorId === c.doctorId) me = 'doctor';
    else if (acc.seesAll(a)) me = 'doctor';
    return me ? { c, me } : null;
  }
  app.get('/api/p/room/:room', need, (req, res) => {
    const r = roomFor(req.acct, req.params.room);
    if (!r) return res.status(404).json({ error: 'This consultation link is not for this account. Please sign in with the account that booked it.' });
    const c = r.c;
    res.json({ me: r.me, consult: { id: c.id, code: c.code, doctorName: c.doctorName, patientName: c.patientName, patientAge: c.patientAge, patientGender: c.patientGender, date: c.date, time: c.time, reason: c.reason, status: c.status, phone: r.me === 'doctor' ? c.phone : '' },
      ice: iceServers() });
  });
  function iceServers() {
    const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    if (process.env.TURN_URL) list.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
    return list;
  }
  app.post('/api/p/room/:room/signal', need, (req, res) => {
    const r = roomFor(req.acct, req.params.room);
    if (!r || r.c.status !== 'confirmed') return res.status(404).json({ error: 'Room closed' });
    const type = String(req.body?.type || '');
    if (!['join', 'offer', 'answer', 'ice', 'leave', 'chat'].includes(type)) return res.status(400).json({ error: 'Bad type' });
    const data = req.body?.data;
    if (JSON.stringify(data || '').length > 20000) return res.status(413).json({ error: 'Too large' });
    let room = rooms.get(req.params.room);
    if (!room) { room = { msgs: [], n: 0 }; rooms.set(req.params.room, room); }
    room.n += 1;
    room.msgs.push({ n: room.n, from: r.me, type, data, at: Date.now() });
    if (room.msgs.length > 400) room.msgs.splice(0, room.msgs.length - 400);
    if (type === 'join' && r.me === 'patient' && !r.c.patientJoinedAt) { r.c.patientJoinedAt = now(); store.write('consults', consults); }
    res.json({ ok: true, n: room.n });
  });
  app.get('/api/p/room/:room/signal', need, (req, res) => {
    const r = roomFor(req.acct, req.params.room);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const after = Number(req.query.after || 0);
    const room = rooms.get(req.params.room) || { msgs: [], n: 0 };
    res.set('Cache-Control', 'no-store');
    res.json({ n: room.n, msgs: room.msgs.filter((m) => m.n > after && m.from !== r.me) });
  });
  setInterval(() => { const cut = Date.now() - 6 * 3600e3; for (const [k, v] of rooms) if (!v.msgs.length || v.msgs[v.msgs.length - 1].at < cut) rooms.delete(k); }, 30 * 60e3).unref();

  // ---------------------------------------------------------------- lab
  const labStaff = (a) => acc.seesAll(a) || acc.activeStaff(a, 'lab');
  function testById(id) { return ((C().lab || {}).tests || []).find((t) => t.id === id && t.visible !== false); }
  app.post('/api/p/lab/orders', need, privUpload.single('receipt'), (req, res) => {
    const a = req.acct, b = req.body || {}, lab = C().lab || {};
    if (a.type !== 'patient') return res.status(400).json({ error: 'Please sign in with a patient account to book' });
    let ids = b.tests; try { if (typeof ids === 'string') ids = JSON.parse(ids); } catch (_) { ids = []; }
    const tests = (Array.isArray(ids) ? ids : []).map(testById).filter(Boolean);
    if (!tests.length) return res.status(400).json({ error: 'Choose at least one test' });
    if (!ymd(b.date) || b.date < ctx.today()) return res.status(400).json({ error: 'Choose a date for sample collection' });
    const address = clean(b.address, 300);
    if (address.length < 4) return res.status(400).json({ error: 'Enter the address for sample collection' });
    const phone = clean(b.phone || a.profile?.phone, 20);
    if (!/\d{7,}/.test(phone.replace(/\D/g, ''))) return res.status(400).json({ error: 'Enter a phone number' });
    const pay = b.payMethod === 'online' ? 'online' : 'onsite';
    if (pay === 'online' && !req.file) return res.status(400).json({ error: 'Upload the payment receipt, or choose “Pay when we come”' });
    const fee = Number(lab.homeCollectionFee || 0);
    const priced = tests.every((t) => Number(t.price) > 0);
    const o = {
      id: rid('L'), code: code('LB'), createdAt: now(), source: 'online', patientId: a.id, name: a.profile?.name || '', age: a.profile?.age || '', sex: a.profile?.gender || '',
      phone, email: a.email, address, date: b.date, slot: clean(b.slot, 40), note: clean(b.note, 500),
      tests: tests.map((t) => ({ id: t.id, name: t.name, price: Number(t.price) || 0 })), collectionFee: fee,
      total: priced ? tests.reduce((s, t) => s + Number(t.price), 0) + fee : null,
      payMethod: pay, payStatus: pay === 'online' ? 'review' : 'due', status: 'new', rows: [], history: [{ at: now(), action: 'booked online' }],
    };
    if (req.file) o.receipt = keepFile(req.file, { users: [a.id], roles: ['verifier'], staff: ['lab'] }, a.id);
    labOrders.push(o); store.write('labOrders', labOrders);
    notify({ staff: ['lab'], roles: ['director'] }, { title: `New home sample collection ${o.code}: ${o.name}`, body: `${o.tests.map((t) => t.name).join(', ')}\nDate: ${o.date} ${o.slot}\nAddress: ${o.address}\nPhone: ${o.phone}\nPayment: ${pay === 'online' ? 'paid online – receipt uploaded' : 'pay when collected'}`, link: '#/dashboard/lab' });
    if (pay === 'online') notify({ roles: ['owner', 'verifier'] }, { title: `Check payment: lab booking ${o.code}`, body: `${o.name} uploaded a payment receipt for lab tests${o.total ? ` (Rs ${o.total})` : ''}.`, link: '#/dashboard/payments' });
    res.json({ ok: true, order: o });
  });
  app.get('/api/p/lab/orders', need, (req, res) => {
    const a = req.acct;
    if (labStaff(a) || acc.canVerifyPayments(a)) {
      const online = labOrders.slice().reverse().slice(0, 400);
      const opd = labStaff(a) ? ctx.opd.labOrders() : [];
      return res.json({ online, opd });
    }
    res.json({ online: labOrders.filter((o) => o.patientId === a.id).reverse(), opd: [] });
  });
  app.patch('/api/p/lab/orders/:id', need, (req, res) => {
    const a = req.acct, o = labOrders.find((x) => x.id === req.params.id), b = req.body || {};
    if (!o) return res.status(404).json({ error: 'Not found' });
    if (b.payOk !== undefined) {
      if (!acc.canVerifyPayments(a) && !labStaff(a)) return res.status(403).json({ error: 'Not allowed' });
      o.payStatus = b.payOk ? 'paid' : 'problem'; o.history.push({ at: now(), action: `payment ${o.payStatus} (${acc.displayName(a)})` });
      if (!b.payOk) notify({ users: [o.patientId] }, { title: `Lab booking ${o.code}: payment not confirmed`, body: clean(b.note, 300) || 'Please call 057-520223.', link: '#/dashboard/lab' });
    }
    if (!labStaff(a)) { store.write('labOrders', labOrders); return res.json({ ok: true, order: o }); }
    if (b.status && ['new', 'scheduled', 'collected', 'processing', 'done', 'cancelled'].includes(b.status)) { o.status = b.status; o.history.push({ at: now(), action: `${b.status} (${acc.displayName(a)})` }); }
    if (Array.isArray(b.rows)) o.rows = cleanRows(b.rows);
    if (b.resultNote !== undefined) o.resultNote = clean(b.resultNote, 1000);
    if (b.payStatus && ['due', 'paid'].includes(b.payStatus)) o.payStatus = b.payStatus;
    if (b.status === 'done') {
      if (!o.rows.some((r) => r.val) && !o.reportFile) return res.status(400).json({ error: 'Enter results or attach the report PDF first' });
      o.resultAt = now();
      addReport({ patientId: o.patientId, title: `Lab report ${o.code}`, source: 'online', orderId: o.id, name: o.name, age: o.age, sex: o.sex, rows: o.rows, note: o.resultNote, file: o.reportFile || null, date: o.resultAt.slice(0, 10) });
    }
    store.write('labOrders', labOrders);
    res.json({ ok: true, order: o });
  });
  app.post('/api/p/lab/orders/:id/file', need, privUpload.single('file'), (req, res) => {
    const o = labOrders.find((x) => x.id === req.params.id);
    if (!o || !labStaff(req.acct)) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF or photo' });
    o.reportFile = keepFile(req.file, { users: [o.patientId], staff: ['lab'] }, req.acct.id);
    store.write('labOrders', labOrders);
    res.json({ ok: true, order: o });
  });
  function cleanRows(rows) {
    return rows.slice(0, 300).filter(isObj).map((r) => ({ panel: clean(r.panel, 80), param: clean(r.param, 120), val: clean(r.val, 120), unit: clean(r.unit, 40), ref: clean(r.ref, 80), flag: clean(r.flag, 12) })).filter((r) => r.param);
  }
  // OPD lab orders (sent from doctors' OPD cards)
  app.get('/api/p/lab/opd/:doc/:pid', need, (req, res) => {
    if (!labStaff(req.acct)) return res.status(403).json({ error: 'Not allowed' });
    const o = ctx.opd.labOrder(req.params.doc, req.params.pid);
    if (!o) return res.status(404).json({ error: 'This lab order no longer exists.' });
    res.json({ order: o });
  });
  app.put('/api/p/lab/opd/:doc/:pid', need, (req, res) => {
    if (!labStaff(req.acct)) return res.status(403).json({ error: 'Not allowed' });
    const r = ctx.opd.saveLab(req.params.doc, req.params.pid, req.body || {}, acc.displayName(req.acct));
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    if (r.done) {
      const o = r.order, match = matchPatient(`${o.name} age ${o.age}`, o.name, o.age);
      const doc = ctx.doctors().find((d) => d.id === req.params.doc);
      const rep = { patientId: match.length === 1 ? match[0].id : null, title: `Lab report – OPD ${doc ? doc.name.en : ''}`.trim(), source: 'opd', opdRef: { doc: req.params.doc, pid: req.params.pid }, name: o.name, age: o.age, sex: o.sex, rows: o.rows, note: o.note, date: (o.resultAt || now()).slice(0, 10), doctorName: doc ? doc.name.en : '' };
      if (rep.patientId) addReport(rep);
    }
    res.json({ ok: true, order: r.order, orderChanged: r.orderChanged });
  });

  // ---------------------------------------------------------------- reports
  function addReport(r) {
    const rep = Object.assign({ id: rid('R'), createdAt: now() }, r);
    reports.push(rep); store.write('reports', reports);
    if (rep.patientId) notify({ users: [rep.patientId] }, { title: 'Your lab report is ready', body: `${rep.title} is ready. You can view and download it as a PDF from your dashboard.`, link: '#/dashboard/reports' });
    return rep;
  }
  function canSeeReport(a, r) { return r.patientId === a.id || labStaff(a); }
  app.get('/api/p/reports', need, (req, res) => {
    const a = req.acct;
    const list = labStaff(a) ? reports.slice(-500) : reports.filter((r) => r.patientId === a.id);
    res.json(list.slice().reverse().map((r) => ({ id: r.id, title: r.title, date: r.date, source: r.source, name: r.name, age: r.age, patientId: r.patientId, hasFile: !!r.file, createdAt: r.createdAt })));
  });
  app.get('/api/p/reports/:id/pdf', need, (req, res) => {
    const r = reports.find((x) => x.id === req.params.id);
    if (!r || !canSeeReport(req.acct, r)) return res.status(404).json({ error: 'Not found' });
    res.set('Cache-Control', 'private, no-store');
    if (r.file && r.file.file) {
      res.type(r.file.type); res.attachment(r.file.name || `${r.title}.pdf`);
      return res.sendFile(path.join(PRIVATE_DIR, r.file.file));
    }
    res.type('application/pdf');
    res.attachment(`${r.title.replace(/[^\w -]/g, '')}.pdf`);
    labpdf.write(res, r, C());
  });

  // --------------------------------------------------- lab email bridge
  // The lab's own system emails reports to lab@… ; Cloudflare Email Routing hands each email to a small
  // worker (tools/cloudflare-email-worker.js) that posts it here. Reports are matched by patient name + age.
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function nameIn(text, name) {
    const parts = norm(name).split(' ').filter((p) => p.length > 1 && !['mr', 'mrs', 'ms', 'miss', 'dr', 'kumar', 'kumari', 'bahadur'].includes(p));
    if (!parts.length) return false;
    return new RegExp(`\\b${parts.join('\\b(?:\\s+\\w+){0,2}\\s+\\b')}\\b`).test(text);
  }
  function ageIn(text, age) {
    if (!age) return false;
    const n = Number(age);
    return [n, n + 1, n - 1].some((x, i) => {
      if (x <= 0) return false;
      const re = new RegExp(`(age\\D{0,14}\\b${x}\\b)|(\\b${x}\\s*(y|yr|yrs|year|years)\\b)|(\\b${x}\\s*y\\s*\\/)`);
      return re.test(text) && (i === 0 || true);
    });
  }
  function matchPatient(rawText, nameHint, ageHint) {
    const text = norm(rawText);
    const pts = acc.all().filter((a) => a.type === 'patient' && a.status === 'active' && a.profile && a.profile.name);
    const exact = pts.filter((p) => nameIn(text, p.profile.name) && ageIn(text, p.profile.age));
    if (exact.length) {
      // prefer exact age if more than one
      if (exact.length > 1) { const strict = exact.filter((p) => new RegExp(`\\b${Number(p.profile.age)}\\b`).test(text)); if (strict.length === 1) return strict; }
      return exact;
    }
    return [];
  }
  ctx.matchPatient = matchPatient;
  let pdfParse = null;
  try { pdfParse = require('pdf-parse/lib/pdf-parse.js'); } catch (_) { /* optional */ }
  app.post('/api/lab/inbound', require('express').json({ limit: '30mb' }), async (req, res) => {
    const secret = process.env.LAB_INBOUND_SECRET;
    if (!secret || req.get('X-Inbound-Secret') !== secret) return res.status(403).json({ error: 'Forbidden' });
    const b = req.body || {};
    const atts = (Array.isArray(b.attachments) ? b.attachments : []).filter((x) => x && x.content && /pdf|image/.test(x.contentType || '')).slice(0, 10);
    const head = `${clean(b.subject, 300)}\n${clean(b.text, 20000)}`;
    const results = [];
    const items = atts.length ? atts : [null];
    for (const att of items) {
      let saved = null, text = head;
      if (att) {
        const buf = Buffer.from(att.content, 'base64');
        if (buf.length > 15 * 1024 * 1024) continue;
        const ext = /pdf/.test(att.contentType) ? '.pdf' : /png/.test(att.contentType) ? '.png' : '.jpg';
        const fname = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        fs.writeFileSync(path.join(PRIVATE_DIR, fname), buf);
        saved = { file: fname, name: clean(att.filename || `report${ext}`, 120), type: /pdf/.test(att.contentType) ? 'application/pdf' : att.contentType };
        if (ext === '.pdf' && pdfParse) { try { text += `\n${(await pdfParse(buf)).text}`; } catch (e) { console.error('[lab inbound] pdf text', e.message); } }
      }
      const m = matchPatient(text);
      if (m.length === 1 && saved) {
        files[saved.file] = { name: saved.name, type: saved.type, at: now(), by: 'lab-email', access: { users: [m[0].id], staff: ['lab'] } }; store.write('files', files);
        const rep = addReport({ patientId: m[0].id, title: clean(b.subject, 120) || 'Lab report', source: 'email', name: m[0].profile.name, age: m[0].profile.age, file: saved, date: now().slice(0, 10) });
        results.push({ matched: m[0].id, report: rep.id });
      } else {
        const item = { id: rid('I'), at: now(), from: clean(b.from, 160), subject: clean(b.subject, 300), text: clean(text, 4000), file: saved, candidates: m.map((p) => p.id), status: 'unmatched' };
        if (saved) { files[saved.file] = { name: saved.name, type: saved.type, at: now(), by: 'lab-email', access: { staff: ['lab'] } }; store.write('files', files); }
        labInbox.push(item); store.write('labInbox', labInbox);
        results.push({ unmatched: item.id, candidates: m.length });
      }
    }
    if (results.some((r) => r.unmatched)) notify({ staff: ['lab'] }, { title: 'A lab report needs a patient', body: 'A report from the lab system could not be matched to one patient by name and age. Please choose the patient in Dashboard → Lab → Unmatched reports.', link: '#/dashboard/lab', email: false });
    res.json({ ok: true, results });
  });
  app.get('/api/p/lab/inbox', need, (req, res) => {
    if (!labStaff(req.acct)) return res.status(403).json({ error: 'Not allowed' });
    res.json(labInbox.filter((x) => x.status === 'unmatched').slice().reverse().map((x) => Object.assign({}, x, { candidates: x.candidates.map((id) => acc.publicView(acc.byId(id))).filter(Boolean) })));
  });
  app.post('/api/p/lab/inbox/:id', need, (req, res) => {
    if (!labStaff(req.acct)) return res.status(403).json({ error: 'Not allowed' });
    const x = labInbox.find((i) => i.id === req.params.id && i.status === 'unmatched');
    if (!x) return res.status(404).json({ error: 'Not found' });
    if (req.body?.discard) { x.status = 'discarded'; store.write('labInbox', labInbox); return res.json({ ok: true }); }
    const p = acc.byId(req.body?.patientId);
    if (!p || p.type !== 'patient') return res.status(400).json({ error: 'Choose a patient' });
    if (x.file) { files[x.file.file].access = { users: [p.id], staff: ['lab'] }; store.write('files', files); }
    addReport({ patientId: p.id, title: x.subject || 'Lab report', source: 'email', name: p.profile?.name, age: p.profile?.age, file: x.file, note: x.file ? '' : x.text, date: now().slice(0, 10) });
    x.status = 'assigned'; x.assignedTo = p.id; x.assignedBy = req.acct.id;
    store.write('labInbox', labInbox);
    res.json({ ok: true });
  });
  // Lab staff can also upload a report PDF straight to a patient
  app.post('/api/p/reports/upload', need, privUpload.single('file'), (req, res) => {
    if (!labStaff(req.acct)) return res.status(403).json({ error: 'Not allowed' });
    const p = acc.byId(req.body?.patientId);
    if (!p || p.type !== 'patient') return res.status(400).json({ error: 'Choose a patient' });
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF or photo' });
    const f = keepFile(req.file, { users: [p.id], staff: ['lab'] }, req.acct.id);
    addReport({ patientId: p.id, title: clean(req.body?.title, 120) || 'Lab report', source: 'upload', name: p.profile?.name, age: p.profile?.age, file: f, date: now().slice(0, 10) });
    res.json({ ok: true });
  });

  // ---------------------------------------------------- service requests
  // package (health check-up), refill (medicine refill), second (second opinion), grievance, incident
  const KINDS = { package: 'Health check-up booking', refill: 'Medicine refill', second: 'Second opinion', grievance: 'Grievance', incident: 'Incident report' };
  const WHO = { package: { staff: ['management'] }, refill: { staff: ['pharmacy'] }, second: { staff: [] }, grievance: { staff: ['management'] }, incident: {} };
  function canHandle(a, r) {
    if (acc.seesAll(a)) return true;
    if (r.kind === 'second') return acc.isDoctor(a) && (!r.doctorId || r.doctorId === a.doctorId);
    return a.type === 'staff' && a.status === 'active' && (WHO[r.kind].staff || []).includes(a.staffRole);
  }
  const reqLimiter = require('express-rate-limit')({ windowMs: 60 * 60e3, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please call us instead.' } });
  app.post('/api/p/requests', reqLimiter, (req, res, next) => privUpload.array('files', 5)(req, res, (err) => (err ? res.status(400).json({ error: 'Files must be JPG, PNG or PDF, up to 10 MB each' }) : next())), (req, res) => {
    const b = req.body || {}, kind = String(b.kind || '');
    if (!KINDS[kind]) return res.status(400).json({ error: 'Unknown request' });
    if (b.website) return res.json({ ok: true });
    const a = acc.current(req);
    if (['package', 'refill', 'second'].includes(kind) && !(a && a.type === 'patient')) return res.status(401).json({ error: 'Please sign in with a patient account first', login: true });
    if (a && req.get('X-Requested-With') !== 'niko-app') return res.status(403).json({ error: 'Bad request origin' });
    const r = {
      id: rid('Q'), code: code(kind === 'incident' ? 'IR' : kind === 'grievance' ? 'GR' : 'SR'), kind, at: now(), status: 'new',
      accountId: a ? a.id : null, name: clean(b.name || a?.profile?.name, 80), phone: clean(b.phone || a?.profile?.phone, 20), email: clean(b.email || a?.email, 120),
      age: clean(b.age || a?.profile?.age, 3), anonymous: kind === 'incident' && !!b.anonymous,
      data: {}, files: [], replies: [],
    };
    ['packageId', 'date', 'medicines', 'delivery', 'address', 'question', 'history', 'dept', 'subject', 'details', 'when', 'where', 'category', 'message'].forEach((k) => { if (b[k] !== undefined) r.data[k] = clean(b[k], 3000); });
    if (kind === 'second') r.doctorId = clean(b.doctorId, 20);
    if (kind === 'package') {
      const p = ((C().packages) || []).find((x) => x.id === r.data.packageId);
      if (!p) return res.status(400).json({ error: 'Choose a package' });
      r.data.packageName = p.name?.en || ''; r.data.price = p.price || '';
      if (!ymd(r.data.date) || r.data.date < ctx.today()) return res.status(400).json({ error: 'Choose a date' });
    }
    if (kind === 'refill' && !r.data.medicines && !(req.files || []).length) return res.status(400).json({ error: 'Write the medicines or upload the prescription' });
    if (kind === 'second' && (!r.data.question || r.data.question.length < 10)) return res.status(400).json({ error: 'Describe your question' });
    if ((kind === 'grievance' || kind === 'incident') && (!r.data.details || r.data.details.length < 10)) return res.status(400).json({ error: 'Please describe what happened' });
    if (kind === 'grievance' && !r.phone && !r.email) return res.status(400).json({ error: 'Give a phone number or email so we can reply' });
    if (r.anonymous) { r.name = ''; r.phone = ''; r.email = ''; r.accountId = null; }
    const access = Object.assign({ users: a && !r.anonymous ? [a.id] : [] }, WHO[kind], kind === 'second' && r.doctorId ? { doctors: [r.doctorId] } : {});
    r.files = (req.files || []).map((f) => keepFile(f, access, a ? a.id : ''));
    requests.push(r); store.write('requests', requests);
    const to = Object.assign({ roles: kind === 'incident' ? ['director', 'owner'] : ['director'] }, WHO[kind], kind === 'second' ? (r.doctorId ? { doctors: [r.doctorId] } : {}) : {});
    notify(to, { title: `${KINDS[kind]} ${r.code}${r.name ? `: ${r.name}` : ''}`, body: summary(r), link: '#/dashboard/requests' });
    res.json({ ok: true, code: r.code });
  });
  function summary(r) {
    const d = r.data;
    return [d.packageName && `Package: ${d.packageName}${d.price ? ` (Rs ${d.price})` : ''}`, d.date && `Date: ${d.date}`, d.medicines && `Medicines: ${d.medicines}`, d.delivery && `Delivery: ${d.delivery}`, d.address && `Address: ${d.address}`,
      d.subject && `Subject: ${d.subject}`, d.question && `Question: ${d.question}`, d.details && `Details: ${d.details}`, d.when && `When: ${d.when}`, d.where && `Where: ${d.where}`,
      r.phone && `Phone: ${r.phone}`, r.files.length && `${r.files.length} file(s) attached`].filter(Boolean).join('\n');
  }
  app.get('/api/p/requests', need, (req, res) => {
    const a = req.acct;
    const list = requests.filter((r) => r.accountId === a.id || canHandle(a, r)).slice().reverse().slice(0, 500)
      .map((r) => Object.assign({}, r, { mine: r.accountId === a.id, canHandle: canHandle(a, r), kindName: KINDS[r.kind] }));
    res.json(list);
  });
  app.post('/api/p/requests/:id', need, (req, res) => {
    const a = req.acct, r = requests.find((x) => x.id === req.params.id);
    if (!r || !canHandle(a, r)) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    if (b.status && ['new', 'in-progress', 'done', 'closed'].includes(b.status)) r.status = b.status;
    if (clean(b.reply, 4000)) {
      r.replies.push({ at: now(), by: acc.displayName(a), text: clean(b.reply, 4000) });
      if (r.accountId) notify({ users: [r.accountId] }, { title: `Reply to your ${KINDS[r.kind].toLowerCase()} (${r.code})`, body: clean(b.reply, 4000), link: '#/dashboard/requests' });
      else if (r.email) mailer.send(r.email, `NIKO Hospital – reply to your ${KINDS[r.kind].toLowerCase()} (${r.code})`, clean(b.reply, 4000));
    }
    store.write('requests', requests);
    res.json({ ok: true });
  });

  // --------------------------------------------------------- dashboard counts
  app.get('/api/p/overview', need, (req, res) => {
    const a = req.acct, t = ctx.today();
    const out = { unread: ctx.unreadCount(a) };
    if (acc.canVerifyPayments(a)) out.paymentsToCheck = consults.filter((c) => c.status === 'payment_review').length + labOrders.filter((o) => o.payStatus === 'review').length;
    if (acc.isDirector(a)) out.approvals = acc.all().filter((x) => x.type === 'staff' && x.status === 'pending').length + docEdits.filter((e) => e.status === 'pending').length;
    if (acc.isDoctor(a) || acc.seesAll(a)) out.consultsToday = consults.filter((c) => c.date === t && c.status === 'confirmed' && (acc.seesAll(a) || c.doctorId === a.doctorId)).length;
    if (labStaff(a)) { out.labOpen = labOrders.filter((o) => !['done', 'cancelled'].includes(o.status)).length + ctx.opd.labOrders().filter((o) => o.status === 'pending').length; out.labUnmatched = labInbox.filter((x) => x.status === 'unmatched').length; }
    out.requestsOpen = requests.filter((r) => canHandle(a, r) && ['new', 'in-progress'].includes(r.status)).length;
    if (acc.seesAll(a)) out.mail = mailer.status();
    res.json(out);
  });

  return { notify };
}

module.exports = { mount };
