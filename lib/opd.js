// OPD card system (taken from Dr. Dipendra Poudel's own OPD system) for every doctor.
// Each doctor has their own patient files: <OPD_DIR>/<doctorId>/patients/patient_<id>.json
// A doctor sees only their own patients. The Director and owner (and anyone the Director gives access) can open any doctor's OPD.
// Lab orders written on an OPD card go to the Lab staff dashboard; results come back into the card.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const acc = require('./accounts');

function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function uid() { return crypto.randomBytes(8).toString('hex'); }
function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function validId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(id); }
function writeJsonAtomic(file, obj) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}

const BOOT_AT = new Date().toISOString();

function create(ctx) {
  const ROOT = ctx.opdDir;
  fs.mkdirSync(ROOT, { recursive: true });
  const clinics = new Map(); // doctorId → { dir, index, touched, deleted, settings }

  function clinic(doctorId) {
    if (!validId(doctorId)) return null;
    if (clinics.has(doctorId)) return clinics.get(doctorId);
    const dir = path.join(ROOT, doctorId);
    const c = { id: doctorId, dir, pat: path.join(dir, 'patients'), trash: path.join(dir, 'trash'), settingsFile: path.join(dir, 'settings.json'), auditFile: path.join(dir, 'audit.log'), index: {}, touched: {}, deleted: [], settings: {} };
    [c.dir, c.pat, c.trash].forEach((d) => fs.mkdirSync(d, { recursive: true }));
    fs.readdirSync(c.pat).forEach((f) => {
      const m = /^patient_([A-Za-z0-9_-]{1,32})\.json$/.exec(f);
      if (!m) return;
      try { const rec = JSON.parse(fs.readFileSync(path.join(c.pat, f), 'utf8')); if (rec && rec.id === m[1] && isObj(rec.current)) c.index[rec.id] = indexEntry(rec); }
      catch (e) { console.error(`[opd] skipping unreadable ${doctorId}/${f}: ${e.message}`); }
    });
    try { if (fs.existsSync(c.settingsFile)) c.settings = JSON.parse(fs.readFileSync(c.settingsFile, 'utf8')) || {}; } catch (e) { c.settings = {}; }
    clinics.set(doctorId, c);
    return c;
  }
  // load every doctor's clinic at start so the lab sees all open orders
  try { fs.readdirSync(ROOT).forEach((d) => { if (validId(d) && fs.statSync(path.join(ROOT, d)).isDirectory()) clinic(d); }); } catch (_) { /* first run */ }

  const patFile = (c, id) => path.join(c.pat, `patient_${id}.json`);
  function readPatient(c, id) { const f = patFile(c, id); if (!fs.existsSync(f)) return null; return JSON.parse(fs.readFileSync(f, 'utf8')); }
  function writePatient(c, rec) { writeJsonAtomic(patFile(c, rec.id), rec); c.index[rec.id] = indexEntry(rec); c.touched[rec.id] = new Date().toISOString(); }
  function forgetPatient(c, id) { delete c.index[id]; delete c.touched[id]; c.deleted.push({ id, at: new Date().toISOString() }); if (c.deleted.length > 1000) c.deleted = c.deleted.slice(-1000); }
  function audit(c, who, action, id) { try { fs.appendFileSync(c.auditFile, `${new Date().toISOString()}\t${who || '-'}\t${action}\t${id || ''}\n`); } catch (_) { /* never block care */ } }
  function auditTail(c, maxLines) {
    try {
      if (!fs.existsSync(c.auditFile)) return [];
      const size = fs.statSync(c.auditFile).size, len = Math.min(size, 48 * 1024);
      const buf = Buffer.alloc(len), fd = fs.openSync(c.auditFile, 'r'); fs.readSync(fd, buf, 0, len, size - len); fs.closeSync(fd);
      const lines = buf.toString('utf8').split('\n').filter(Boolean); if (len < size) lines.shift();
      return lines.slice(-maxLines).reverse().map((l) => { const p = l.split('\t'); return { at: p[0], role: p[1], action: p[2], id: p[3] || '' }; });
    } catch (e) { return []; }
  }
  function nextNumericId(c) { let max = 100; Object.keys(c.index).forEach((k) => { if (/^\d+$/.test(k)) max = Math.max(max, parseInt(k, 10)); }); return String(max + 1); }

  function indexEntry(rec) {
    const c = rec.current || {};
    const lab = (c.lab && c.lab.orderText) ? c.lab : null;
    const labState = lab ? (lab.status === 'done' ? 'done' : 'pending') : '';
    return {
      id: rec.id, name: str(c.name, 120), age: str(c.age, 20), sex: str(c.sex, 12), phone: str(c.phone, 30),
      visitDate: isYmd(c.visitDate) ? c.visitDate : '', visitType: str(c.visitType, 20), diagnosis: str(c.diagnosis, 140),
      updatedAt: rec.updatedAt || '', visits: (Array.isArray(rec.history) ? rec.history.length : 0) + 1,
      labState, labStatus: labState === 'done' ? 'Lab Ready' : (labState === 'pending' ? 'Sent to Lab' : ((c.labLines && c.labLines.length) ? 'Lab Ready' : '')),
      labResultAt: labState === 'done' ? (lab.resultAt || '') : '', labOrderedAt: lab ? (lab.orderedAt || '') : '', labOrderText: lab ? lab.orderText : '',
      followUpDate: (isObj(c.followUp) && c.followUp.choice !== 'none' && isYmd(c.followUp.date)) ? c.followUp.date : '',
      intakeDate: '', intakeAt: '', intakeBy: '', intakePending: false, intakeOnly: false,
      admissions: 0, admitted: false,
    };
  }

  // ---------------------------------------------------------- lab orders
  function cleanRows(rows, withValues) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 300).filter(isObj).map((r) => {
      const o = { panel: str(r.panel, 80), param: str(r.param, 120), unit: str(r.unit, 40), ref: str(r.ref, 80) };
      if (withValues) { o.val = str(r.val, 120); o.flag = str(r.flag, 12); if (r.extra) o.extra = true; }
      return o;
    }).filter((r) => r.param);
  }
  const rowKey = (r) => `${r.panel || ''}|${r.param || ''}`.toLowerCase();
  function mergeLab(prev, orderText, orderRows, now) {
    orderText = str(orderText, 2000);
    if (!orderText) return (prev && prev.resultAt) ? prev : null;
    prev = prev || { rows: [] };
    const old = {}, used = {};
    (prev.rows || []).forEach((r) => { old[rowKey(r)] = r; });
    const rows = orderRows.map((o) => { const p = old[rowKey(o)]; if (p) used[rowKey(o)] = true; return { panel: o.panel, param: o.param, unit: (p && p.unit) || o.unit, ref: (p && p.ref) || o.ref, val: p ? (p.val || '') : '', flag: p ? (p.flag || '') : '' }; });
    (prev.rows || []).forEach((r) => { if (!used[rowKey(r)] && r.val) rows.push(Object.assign({}, r, { extra: true })); });
    const changed = orderText !== prev.orderText;
    const missing = rows.some((r) => !r.val);
    return { orderText, rows, orderedAt: (changed || !prev.orderedAt) ? now : prev.orderedAt, resultAt: prev.resultAt || '', status: (prev.status === 'done' && !(changed && missing)) ? 'done' : 'pending', note: prev.note || '' };
  }
  function labOrderView(c, rec) {
    const cur = rec.current, lab = cur.lab;
    const d = ctx.doctors().find((x) => x.id === c.id);
    // The lab sees identity and the order only — never history, examination, diagnosis or prescriptions.
    return { doctorId: c.id, doctorName: d ? d.name.en : c.id, id: rec.id, name: str(cur.name, 120), age: str(cur.age, 20), sex: str(cur.sex, 12), visitDate: isYmd(cur.visitDate) ? cur.visitDate : '',
      orderText: lab.orderText, rows: lab.rows || [], note: lab.note || '', status: lab.status === 'done' ? 'done' : 'pending', orderedAt: lab.orderedAt || '', resultAt: lab.resultAt || '' };
  }
  function labOrders() {
    const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
    const out = [];
    for (const c of clinics.values()) {
      const d = ctx.doctors().find((x) => x.id === c.id);
      Object.values(c.index).filter((e) => e.labState === 'pending' || (e.labState === 'done' && (e.labResultAt || '') >= cutoff))
        .forEach((e) => out.push({ doctorId: c.id, doctorName: d ? d.name.en : c.id, id: e.id, name: e.name, age: e.age, sex: e.sex, visitDate: e.visitDate, orderText: e.labOrderText, orderedAt: e.labOrderedAt, resultAt: e.labResultAt, status: e.labState }));
    }
    return out.sort((a, b) => String(b.orderedAt).localeCompare(String(a.orderedAt)));
  }
  function labOrder(doctorId, pid) {
    const c = clinic(doctorId); if (!c || !validId(pid)) return null;
    const rec = readPatient(c, pid);
    if (!rec || !rec.current || !rec.current.lab || !rec.current.lab.orderText) return null;
    return labOrderView(c, rec);
  }
  function saveLab(doctorId, pid, b, by) {
    const c = clinic(doctorId); if (!c || !validId(pid)) return { error: 'Invalid order', status: 400 };
    const rec = readPatient(c, pid);
    if (!rec || !rec.current || !rec.current.lab || !rec.current.lab.orderText) return { error: 'This lab order no longer exists.', status: 404 };
    const cur = rec.current.lab, now = new Date().toISOString();
    const rows = cleanRows(b.rows, true), have = {};
    rows.forEach((r) => { have[rowKey(r)] = true; });
    let orderChanged = false;
    (cur.rows || []).forEach((r) => { if (r.extra || have[rowKey(r)]) return; rows.push({ panel: r.panel, param: r.param, unit: r.unit || '', ref: r.ref || '', val: r.val || '', flag: r.flag || '' }); if (!r.val) orderChanged = true; });
    cur.rows = rows; cur.note = str(b.note, 600);
    let done = false;
    if ((b.done || cur.status === 'done') && !orderChanged) {
      if (!rows.some((r) => r.val)) return { error: 'Enter at least one result before sending.', status: 400 };
      done = cur.status !== 'done' || !!b.done; cur.status = 'done'; cur.resultAt = now;
    } else cur.status = 'pending';
    rec.updatedAt = now;
    writePatient(c, rec);
    audit(c, `lab:${by}`, cur.status === 'done' ? 'lab-results' : 'lab-draft', pid);
    if (cur.status === 'done') {
      const d = ctx.doctors().find((x) => x.id === c.id);
      const doctorAcct = acc.all().find((a) => a.doctorId === c.id && a.status === 'active');
      if (doctorAcct && ctx.notify && b.done) ctx.notify({ users: [doctorAcct.id] }, { title: `Lab results ready: #${pid} ${rec.current.name}`, body: `Results for ${rec.current.name} are in your OPD card.`, link: '/opd.html', email: false });
      void d;
    }
    return { ok: true, done, orderChanged, order: labOrderView(c, rec) };
  }

  // ------------------------------------------------------------ access
  function scope(req, res, next) {
    const a = acc.current(req);
    if (!a) return res.status(401).json({ error: 'Please sign in', login: true });
    if (req.method !== 'GET' && req.get('X-Requested-With') !== 'niko-app') return res.status(403).json({ error: 'Bad request origin' });
    const asked = String(req.query.doctor || '');
    const own = acc.isDoctor(a) ? a.doctorId : '';
    const may = (id) => id && (id === own || acc.seesAll(a) || (a.opdAccess || []).includes('all') || (a.opdAccess || []).includes(id));
    const id = asked || own;
    if (!id) return res.status(400).json({ error: 'Choose a doctor', chooseDoctor: true });
    if (!may(id)) return res.status(403).json({ error: 'You can only open your own OPD patients.' });
    if (!ctx.doctors().find((d) => d.id === id)) return res.status(404).json({ error: 'Doctor not found' });
    req.acct = a; req.clinic = clinic(id); req.who = acc.displayName(a);
    next();
  }
  function identity(doctorId) {
    const d = ctx.doctors().find((x) => x.id === doctorId) || { name: { en: '' } };
    const dept = (ctx.content().departments || []).find((x) => x.id === d.dept);
    const h = ctx.content().hospital || {};
    return {
      docName: d.name.en, docDeg: d.degrees || '', docSpec: (d.title && d.title.en) || '', docReg: d.nmc ? `NMC ${d.nmc}` : '',
      hospName: ((h.name && h.name.en) || 'NIKO Hospital Pvt. Ltd.').toUpperCase(), hospSub: dept ? `Department of ${dept.name.en.replace(/^Department of /i, '')}` : '',
      hospAddr: `${(h.address && h.address.en) || 'Hetauda-2, Makawanpur'} · ${[h.phone24].concat(h.phones || []).filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(', ')}${h.email ? ` · ${h.email}` : ''}`,
    };
  }
  function settingsFor(c) {
    const s = JSON.parse(JSON.stringify(c.settings || {}));
    const id = identity(c.id);
    // The doctor's own name and degrees always come from their website profile; the rest they can change.
    s.clinicConfig = Object.assign({ hospName: id.hospName, hospSub: id.hospSub, hospAddr: id.hospAddr }, s.clinicConfig || {}, { docName: id.docName, docDeg: id.docDeg || (s.clinicConfig || {}).docDeg || '', docSpec: id.docSpec || (s.clinicConfig || {}).docSpec || '', docReg: id.docReg || (s.clinicConfig || {}).docReg || '' });
    return s;
  }
  function appointments(c) {
    const from = new Date(Date.now() - 36 * 3600e3 + 345 * 60e3).toISOString().slice(0, 10);
    return ctx.bookings().filter((b) => b.doctorId === c.id && b.date >= from && !['cancelled', 'done', 'no-show'].includes(b.status))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 100)
      .map((b) => ({ id: b.code, token: b.code, date: b.date, time: b.time, name: b.name, age: b.age, phone: b.phone, complaint: b.reason, status: b.status === 'new' ? 'pending' : b.status === 'arrived' ? 'confirmed' : b.status, patientId: b.opdPatientId || '' }));
  }

  const r = express.Router();
  r.use(express.json({ limit: '25mb' }));
  r.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  r.use(scope);

  r.get('/me', (req, res) => {
    const a = req.acct, docs = ctx.doctors();
    const all = acc.seesAll(a) || (a.opdAccess || []).includes('all');
    const list = docs.filter((d) => all || d.id === a.doctorId || (a.opdAccess || []).includes(d.id)).map((d) => ({ id: d.id, name: d.name.en }));
    res.json({ doctorId: req.clinic.id, viewer: req.who, own: req.clinic.id === a.doctorId, doctors: list });
  });
  r.get('/bootstrap', (req, res) => {
    const c = req.clinic;
    res.json({ settings: settingsFor(c), now: new Date().toISOString(), index: Object.values(c.index), appointments: appointments(c), labAccess: true, spellList: [], labUnits: [] });
  });
  r.get('/index', (req, res) => {
    const c = req.clinic, since = typeof req.query.since === 'string' ? req.query.since : '', now = new Date().toISOString(), ids = Object.keys(c.index);
    if (!since || since < BOOT_AT) return res.json({ full: true, now, index: ids.map((k) => c.index[k]), appointments: appointments(c) });
    res.json({ full: false, now, total: ids.length, index: ids.filter((k) => (c.touched[k] || '') >= since).map((k) => c.index[k]), deleted: c.deleted.filter((d) => d.at >= since).map((d) => d.id), appointments: appointments(c) });
  });
  r.put('/settings', (req, res) => {
    const c = req.clinic, s = (req.body || {}).settings;
    if (!isObj(s)) return res.status(400).json({ error: 'No settings were sent.' });
    if (JSON.stringify(s).length > 6000000) return res.status(413).json({ error: 'Settings are too large. Use a smaller logo image.' });
    const next = Object.assign({}, c.settings);
    if (isObj(s.clinicConfig)) next.clinicConfig = s.clinicConfig;
    ['formulary', 'ccTemplates', 'examTemplates', 'labSubsets', 'rxGroups', 'dxSets', 'advicePresets'].forEach((k) => { if (Array.isArray(s[k])) next[k] = s[k]; });
    next.updatedAt = new Date().toISOString();
    writeJsonAtomic(c.settingsFile, next); c.settings = next;
    res.json({ ok: true, updatedAt: next.updatedAt });
  });
  r.get('/patients/:id', (req, res) => {
    const c = req.clinic, id = req.params.id;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid patient ID.' });
    const rec = readPatient(c, id); if (!rec) return res.status(404).json({ error: 'Patient not found.' });
    res.json({ patient: rec.current, intake: null, history: (rec.history || []).map((h, i) => ({ n: i, visitDate: isYmd(h.visitDate) ? h.visitDate : '', visitType: str(h.visitType, 20), diagnosis: str(h.diagnosis, 140), updatedAt: h.updatedAt || '' })) });
  });
  r.get('/patients/:id/full', (req, res) => {
    const c = req.clinic, id = req.params.id;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid patient ID.' });
    const rec = readPatient(c, id); if (!rec) return res.status(404).json({ error: 'Patient not found.' });
    res.json({ current: rec.current, history: rec.history || [], intake: null, admissions: [] });
  });
  r.get('/patients/:id/visits/:n', (req, res) => {
    const c = req.clinic, id = req.params.id, n = parseInt(req.params.n, 10);
    if (!validId(id)) return res.status(400).json({ error: 'Invalid patient ID.' });
    const rec = readPatient(c, id); if (!rec || !rec.history || !rec.history[n]) return res.status(404).json({ error: 'Visit not found.' });
    res.json({ visit: rec.history[n] });
  });
  r.get('/patients/:id/lab', (req, res) => {
    const c = req.clinic, id = req.params.id;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid patient ID.' });
    const rec = readPatient(c, id); if (!rec) return res.status(404).json({ error: 'Patient not found.' });
    res.json({ visitId: rec.current.visitId || '', lab: rec.current.lab || null });
  });
  r.put('/patients/:id', (req, res) => {
    const c = req.clinic, id = req.params.id, b = req.body || {}, p = b.patient;
    if (!validId(id)) return res.status(400).json({ error: 'Patient ID may only contain letters, numbers, - and _ (up to 32 characters).' });
    if (!isObj(p)) return res.status(400).json({ error: 'No patient record was sent.' });
    if (!str(p.name, 120)) return res.status(400).json({ error: 'Patient name is required.' });
    if (JSON.stringify(p).length > 800000) return res.status(413).json({ error: 'This card is too large to save.' });
    const now = new Date().toISOString();
    let rec = readPatient(c, id);
    if (!p.visitId || typeof p.visitId !== 'string') p.visitId = (rec && rec.current && rec.current.visitId) || `v_${uid()}`;
    p.visitId = str(p.visitId, 64);
    const sameVisit = !!(rec && rec.current && rec.current.visitId === p.visitId);
    if (rec && b.expectNew && !sameVisit) return res.status(409).json({ error: `Patient ID ${id} is already in use.`, existingName: str(rec.current.name, 120), suggestedId: nextNumericId(c) });
    delete p.lab; delete p.history; delete p.current;
    p.id = id; p.updatedAt = now;
    if (!isYmd(p.visitDate)) p.visitDate = '';
    if (!rec) rec = { id, createdAt: now, current: null, history: [] };
    if (!Array.isArray(rec.history)) rec.history = [];
    let action = rec.current ? 'save' : 'create';
    let prevLab = sameVisit ? (rec.current.lab || null) : null;
    if (rec.current && !sameVisit) {
      if (typeof b.inheritLabFrom === 'string' && b.inheritLabFrom === rec.current.visitId && rec.current.lab && rec.current.lab.orderText) {
        prevLab = rec.current.lab; rec.current.lab = Object.assign({}, rec.current.lab, { carriedForward: true });
      }
      rec.history.push(rec.current);
      if (rec.history.length > 500) rec.history = rec.history.slice(-500);
      action = 'new-visit';
    }
    const lab = mergeLab(prevLab, p.invOrder, cleanRows(b.labOrderRows, false), now);
    if (lab) p.lab = lab;
    const newOrder = lab && lab.status === 'pending' && (!prevLab || prevLab.orderText !== lab.orderText);
    rec.current = p; rec.updatedAt = now;
    writePatient(c, rec);
    audit(c, req.who, action, id);
    if (newOrder && ctx.notify) ctx.notify({ staff: ['lab'] }, { title: `New lab order: ${p.name} (${identity(c.id).docName})`, body: lab.orderText, link: '#/dashboard/lab', email: false });
    res.json({ ok: true, updatedAt: now, visits: rec.history.length + 1, lab, index: c.index[id] });
  });
  r.delete('/patients/:id', (req, res) => {
    const c = req.clinic, id = req.params.id;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid patient ID.' });
    if (!fs.existsSync(patFile(c, id))) { if (c.index[id]) forgetPatient(c, id); return res.status(404).json({ error: 'Patient not found.' }); }
    fs.renameSync(patFile(c, id), path.join(c.trash, `patient_${id}_${Date.now()}.json`));
    forgetPatient(c, id); audit(c, req.who, 'delete', id);
    res.json({ ok: true });
  });
  r.put('/appointments/:id', (req, res) => {
    const b = req.body || {};
    const map = { pending: 'new', confirmed: 'confirmed', completed: 'done', cancelled: 'cancelled' };
    const ok = ctx.updateBooking(req.params.id, req.clinic.id, { status: map[b.status], opdPatientId: validId(b.patientId) ? b.patientId : undefined });
    if (!ok) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ ok: true });
  });
  r.get('/export', (req, res) => {
    const c = req.clinic, patients = [];
    Object.keys(c.index).forEach((id) => { try { const x = readPatient(c, id); if (x) patients.push(x); } catch (e) { /* skip */ } });
    audit(c, req.who, 'backup-download', String(patients.length));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="OPD_${c.id}_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.end(JSON.stringify({ kind: 'opd-backup', doctorId: c.id, exportedAt: new Date().toISOString(), settings: c.settings, patients }));
  });
  r.post('/import', (req, res) => {
    const c = req.clinic, b = req.body || {}, list = Array.isArray(b.patients) ? b.patients.slice(0, 200) : [];
    const out = { imported: 0, skipped: 0, invalid: 0 }, now = new Date().toISOString();
    const normVisit = (v, id) => { v = JSON.parse(JSON.stringify(v)); delete v.history; delete v.current; v.id = id; if (!v.visitId || typeof v.visitId !== 'string') v.visitId = `v_${uid()}`; if (!isYmd(v.visitDate)) v.visitDate = ''; return v; };
    list.forEach((item) => {
      if (!isObj(item)) { out.invalid++; return; }
      const id = String(item.id == null ? '' : item.id).trim(), body = isObj(item.current) ? item.current : item;
      if (!validId(id) || !str(body.name, 120)) { out.invalid++; return; }
      if (fs.existsSync(patFile(c, id)) && !b.overwrite) { out.skipped++; return; }
      let rec;
      if (isObj(item.current)) rec = { id, createdAt: str(item.createdAt, 40) || now, updatedAt: /^\d{4}-\d{2}-\d{2}T/.test(item.updatedAt || '') ? item.updatedAt : now, current: normVisit(item.current, id), history: (Array.isArray(item.history) ? item.history : []).filter(isObj).slice(-500).map((h) => normVisit(h, id)) };
      else {
        const cur = normVisit(item, id);
        if (!cur.lab && str(cur.invOrder, 2000) && !(Array.isArray(cur.labLines) && cur.labLines.length)) cur.lab = { orderText: str(cur.invOrder, 2000), rows: [], orderedAt: now, resultAt: '', status: 'pending', note: '' };
        rec = { id, createdAt: now, updatedAt: now, current: cur, history: [] };
      }
      writePatient(c, rec); out.imported++;
    });
    audit(c, req.who, 'import', String(out.imported));
    res.json(out);
  });
  r.get('/audit', (req, res) => res.json({ lines: auditTail(req.clinic, 200) }));

  return { router: r, labOrders, labOrder, saveLab };
}

module.exports = { create };
