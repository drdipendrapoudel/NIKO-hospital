// Doctors' own setup: everything the website shows about a doctor, filled in by the doctor after sign-in.
// - First-time details (and later changes to photo, text, qualification) wait for the Director's approval.
// - Days off, visit dates and hours go live at once once the account is approved; the Director is told.
// - Visiting specialists choose visit dates; patients book by token number with no limit.
// - "Available now" switch for Consult right now.
const store = require('./store');
const acc = require('./accounts');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const now = () => new Date().toISOString();
const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, ' ').trim().slice(0, max);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const ymd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const HOURS_RE = /^\s*\d{1,2}[:.]\d{2}\s*-\s*\d{1,2}[:.]\d{2}(\s*,\s*\d{1,2}[:.]\d{2}\s*-\s*\d{1,2}[:.]\d{2})*\s*$/;
const AGREEMENT = 'I will see NIKO Hospital patients only through NIKO Hospital. I will not ask a patient who came through NIKO Hospital or its website to visit or pay me at home, at a private clinic or at another hospital, and I will not share my personal phone number, email or social media with them. I understand that video calls and chats on this website are logged and can be reviewed by the hospital.';
const AGREEMENT_VERSION = 1;

const nowState = store.read('doctorNow', {}); // doctorId → { on: true, at, day }

function mount(app, ctx) {
  const need = acc.need;
  const C = () => ctx.content();
  const S = ctx.schedule;
  const nepalTime = () => new Date(Date.now() + 345 * 60e3).toISOString().slice(11, 16);
  const docOf = (id) => ctx.doctors().find((d) => d.id === id);
  const isManager = (a) => acc.seesAll(a) || acc.has(a, 'scheduler');
  const pendingFor = (a) => ctx.docEdits.find((e) => e.accountId === a.id && e.status === 'pending');

  // ---- cleaning what a doctor sends
  function biText(v, max) { return { en: clean(isObj(v) ? v.en : v, max), ne: clean(isObj(v) ? v.ne : '', max) }; }
  function list(v, each, max) { return (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map((x) => clean(x, each)).filter(Boolean).slice(0, max); }
  function cleanDates(v, max) { return [...new Set((Array.isArray(v) ? v : []).filter(ymd))].sort().slice(0, max || 200); }
  function cleanDayHours(v) {
    if (!isObj(v)) return null;
    const out = {};
    for (const d of DAYS) { if (v[d] === undefined || v[d] === null) continue; const h = clean(v[d], 80); if (h && !HOURS_RE.test(h)) throw new Error(`Hours for ${d} must look like 07:00-09:00, 16:00-19:00`); out[d] = h.replace(/\./g, ':').replace(/\s+/g, ' '); }
    return out;
  }
  function profileFields(b) {
    const o = {};
    if (b.name !== undefined && isObj(b.name) && clean(b.name.ne, 80)) o.nameNe = clean(b.name.ne, 80);
    if (b.title !== undefined) o.title = biText(b.title, 120);
    if (b.degrees !== undefined) o.degrees = clean(b.degrees, 200);
    if (b.nmc !== undefined) o.nmc = clean(b.nmc, 20);
    if (b.affiliation !== undefined) o.affiliation = clean(b.affiliation, 160);
    if (b.website !== undefined) { const w = clean(b.website, 120); if (w && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(w)) throw new Error('Website: enter an address like drname.com.np'); o.website = w; }
    if (b.gender !== undefined) o.gender = ['Male', 'Female', ''].includes(b.gender) ? b.gender : '';
    if (b.languages !== undefined) o.languages = list(b.languages, 30, 8);
    if (b.focus !== undefined) o.focus = list(b.focus, 60, 15);
    if (b.experience !== undefined) o.experience = clean(b.experience, 40);
    if (b.bio !== undefined) o.bio = biText(b.bio, 1500);
    if (b.photo !== undefined && (/^uploads\/[\w.-]+$/.test(b.photo) || b.photo === '')) o.photo = b.photo;
    return o;
  }
  // schedule part: what the doctor may set for himself
  function scheduleFields(b, d) {
    const o = {};
    const visiting = d.employment === 'visiting';
    if (visiting) {
      if (b.visitDates !== undefined) o.visitDates = cleanDates(b.visitDates, 60).filter((x) => x >= ctx.today() || (d.visitDates || []).includes(x));
    } else {
      if (b.days !== undefined) o.days = DAYS.filter((x) => (Array.isArray(b.days) ? b.days : []).includes(x));
      if (b.useStandard !== undefined && d.employment === 'part' && b.useStandard) { o.dayHours = null; o.hours = ''; }
      else if (b.dayHours !== undefined) { const dh = cleanDayHours(b.dayHours); if (dh) { o.dayHours = dh; o.days = DAYS.filter((x) => (o.days || d.days || []).includes(x) && /\d/.test(dh[x] === undefined ? 'x1' : dh[x])); } }
      if (b.off !== undefined) o.off = cleanDates(b.off, 200).filter((x) => x >= ctx.today());
      if (b.videoConsult !== undefined && d.dept !== 'anaesthesiology') o.videoConsult = !!b.videoConsult;
    }
    if (b.scheduleNote !== undefined) o.scheduleNote = biText(b.scheduleNote, 120);
    if (isObj(b.private)) o.private = { phone: clean(b.private.phone, 20), address: clean(b.private.address, 200) };
    return o;
  }
  function describeSchedule(d) {
    if (d.employment === 'visiting') return { en: (d.visitDates || []).length ? 'On visit dates (see next visit)' : 'Visit dates to be announced', ne: (d.visitDates || []).length ? 'भ्रमण मितिमा' : 'भ्रमण मिति पछि जानकारी गराइनेछ' };
    const days = d.days || [];
    if (days.length === 7) return { en: 'Every day', ne: 'प्रत्येक दिन' };
    return { en: days.join(', '), ne: '' };
  }
  function missing(v) {
    const m = [];
    if (!/^uploads\//.test(v.photo || '')) m.push('photo'); // a real photo uploaded by the doctor or the hospital
    if (!v.degrees) m.push('qualification');
    if (!v.nmc) m.push('NMC number');
    if (v.employment === 'visiting' ? !(v.visitDates || []).length : !(v.days || []).length) m.push(v.employment === 'visiting' ? 'visit dates' : 'OPD days');
    return m;
  }

  // ---- what happens to patients when a day is closed
  function closeDay(d, dates, by) {
    const lines = [];
    dates.forEach((date) => {
      const bs = ctx.bookings().filter((b) => b.doctorId === d.id && b.date === date && !['cancelled', 'done', 'no-show'].includes(b.status));
      bs.forEach((b) => {
        b.history.push({ at: now(), action: `doctor not available on this day (${by}) – patient asked to reschedule` });
        b.needsReschedule = true;
        if (b.email) ctx.mailer.send(b.email, `Please choose a new date: ${d.name.en} is not available on ${date}`, `We are sorry. ${d.name.en} will not be available at NIKO Hospital on ${date}, the day of your appointment (code ${b.code}).\n\nPlease choose a new date on our website with your booking code and phone number, or call 057-520223.`, { link: ctx.siteUrl() ? { text: 'Choose a new date', url: `${ctx.siteUrl()}/#/my-booking` } : null });
        lines.push(`${date}  ${b.time || ''}  ${b.name}  ${b.phone}  (${b.code})${b.email ? '  – emailed' : '  – NO EMAIL, please phone'}`);
      });
      ctx.consults.filter((c) => c.doctorId === d.id && c.date === date && ['confirmed', 'payment_review'].includes(c.status)).forEach((c) => {
        if (c.patientId) ctx.notify({ users: [c.patientId] }, { title: `Please choose a new time: ${d.name.en} is not available on ${date}`, body: `${d.name.en} will not be available on ${date}. Please book a new time for your video consultation (${c.code}) or call 057-520223.`, link: '#/consult' });
        lines.push(`${date}  ${c.time}  ${c.patientName}  video consultation ${c.code}`);
      });
      if (bs.length) ctx.saveBookings();
    });
    return lines;
  }
  function applyLive(d0, fields, by, a) {
    const next = JSON.parse(JSON.stringify(C()));
    let d = next.doctors.find((x) => x.id === d0.id);
    if (!d) { d = JSON.parse(JSON.stringify(d0)); next.doctors.push(d); }
    const before = JSON.parse(JSON.stringify(d));
    Object.keys(fields).forEach((k) => { if (fields[k] === null) delete d[k]; else d[k] = fields[k]; });
    if (!('scheduleNote' in fields) && (fields.days || fields.visitDates)) d.scheduleNote = describeSchedule(d);
    if (d.employment === 'visiting' || d.dept === 'anaesthesiology') d.videoConsult = false;
    d.lockFromForm = true;
    ctx.saveContent(next, by);
    // days that were bookable before and are closed now
    const closed = [];
    const start = new Date(`${ctx.today()}T00:00:00Z`);
    for (let i = 0; i < 130; i++) {
      const s = new Date(start.getTime() + i * 864e5).toISOString().slice(0, 10);
      if (S.availableOn(before, s, C().booking) && !S.availableOn(d, s, C().booking)) closed.push(s);
    }
    const lines = closed.length ? closeDay(d, closed, by) : [];
    const what = [];
    if (fields.off) what.push(`Days off: ${(d.off || []).join(', ') || 'none'}`);
    if (fields.visitDates) what.push(`Visit dates: ${(d.visitDates || []).join(', ') || 'none'}`);
    if (fields.days) what.push(`OPD days: ${(d.days || []).join(', ') || 'none'}`);
    if ('dayHours' in fields) what.push(`Hours: ${d.dayHours ? DAYS.filter((x) => d.dayHours[x]).map((x) => `${x} ${d.dayHours[x]}`).join('; ') : 'standard part-time hours'}`);
    if ('videoConsult' in fields) what.push(`Video consultation: ${d.videoConsult === false ? 'no' : 'yes'}`);
    if ('videoHours' in fields) what.push(`Video-only hours (from home): ${DAYS.filter((x) => (d.videoHours || {})[x]).map((x) => `${x} ${d.videoHours[x]}`).join('; ') || 'none'}`);
    if ('employment' in fields) what.push(`Type: ${d.employment}`);
    if (what.length && !(a && acc.isDirector(a))) ctx.notify({ roles: ['director'] }, { title: `Schedule changed: ${d.name.en}`, body: `${what.join('\n')}\nChanged by ${by}. It is already live on the website.${lines.length ? `\n\nPatients already booked on closed days (${lines.length}) – they were asked to choose a new date:\n${lines.join('\n')}` : ''}`, link: '#/dashboard/doctors', cat: 'schedule' });
    else if (lines.length) ctx.notify({ roles: ['director'] }, { title: `Patients to reschedule: ${d.name.en}`, body: lines.join('\n'), link: '#/dashboard/doctors', cat: 'schedule' });
    return { doctor: d, affected: lines.length };
  }

  ctx.afterDocApprove = (d, fields) => { if (!('scheduleNote' in fields) && (fields.days || fields.visitDates)) d.scheduleNote = describeSchedule(d); };

  // ------------------------------------------------------------ doctor's own setup
  function mine(req, res) {
    const a = req.acct;
    if (a.staffRole !== 'doctor' || !a.doctorId) { res.status(400).json({ error: 'This account is not linked to a doctor' }); return null; }
    const d = docOf(a.doctorId);
    if (!d) { res.status(404).json({ error: 'Doctor profile not found. Please contact the Director.' }); return null; }
    return d;
  }
  app.get('/api/d/setup', need, (req, res) => {
    const d = mine(req, res); if (!d) return;
    const a = req.acct, pend = pendingFor(a), last = ctx.docEdits.filter((e) => e.accountId === a.id).slice(-1)[0];
    const v = Object.assign({}, d, pend ? pend.fields : {});
    if (v.nameNe) { v.name = { en: d.name.en, ne: v.nameNe }; }
    res.set('Cache-Control', 'no-store');
    res.json({ doctor: v, live: d, pending: pend ? { at: pend.at, fields: Object.keys(pend.fields) } : null, rejected: last && last.status === 'rejected' ? { note: last.note || '' } : null,
      missing: missing(v), setupDone: !!a.setupDone, active: a.status === 'active', boss: acc.seesAll(a), agreed: !!(a.agreement && a.agreement.version === AGREEMENT_VERSION), agreement: AGREEMENT,
      partTime: (C().booking || {}).partTime || null, noVideo: d.dept === 'anaesthesiology' || d.employment === 'visiting', now: isNow(d.id), today: ctx.today(),
      bookings: bookingCounts(d) });
  });
  function bookingCounts(d) {
    const out = {};
    ctx.bookings().forEach((b) => { if (b.doctorId === d.id && b.date >= ctx.today() && b.status !== 'cancelled') out[b.date] = (out[b.date] || 0) + 1; });
    return out;
  }
  // Save one step (or everything). Profile text and photo wait for approval; the schedule is live once the account is approved.
  app.post('/api/d/setup', need, (req, res) => {
    const d = mine(req, res); if (!d) return;
    const a = req.acct, b = req.body || {};
    let prof, sched;
    try { prof = profileFields(b); sched = scheduleFields(b, d); } catch (e) { return res.status(400).json({ error: e.message }); }
    if (b.agree === true) a.agreement = { at: now(), version: AGREEMENT_VERSION, text: AGREEMENT, ip: clean(req.ip, 60) };
    const live = a.status === 'active' && (a.setupDone || acc.seesAll(a)) && !pendingFirst(a);
    // nothing changed? then nothing to approve
    const same = (k, v) => JSON.stringify(v) === JSON.stringify(k === 'nameNe' ? (d.name || {}).ne : d[k]);
    Object.keys(prof).forEach((k) => { if (same(k, prof[k])) delete prof[k]; });
    let affected = 0;
    if (live) {
      Object.keys(sched).forEach((k) => { if (JSON.stringify(sched[k]) === JSON.stringify(d[k] === undefined ? null : d[k])) delete sched[k]; });
      if (Object.keys(sched).length) affected = applyLive(d, sched, acc.displayName(a), a).affected;
    } else Object.assign(prof, sched);
    const old = pendingFor(a);
    if (Object.keys(prof).length || old) {
      const fields = Object.assign({}, old ? old.fields : {}, prof);
      if (old) { old.status = 'replaced'; old.decidedAt = now(); }
      if (fields.nameNe) { fields.name = { en: d.name.en, ne: fields.nameNe }; }
      const e = { id: `E${require('crypto').randomBytes(5).toString('hex')}`, accountId: a.id, doctorId: d.id, fields, status: 'pending', at: now(), first: !a.setupDone || (old && old.first) || undefined, quiet: !b.finish };
      ctx.docEdits.push(e); ctx.saveDocEdits();
    }
    const pend = pendingFor(a);
    const v = Object.assign({}, docOf(d.id), pend ? pend.fields : {});
    const miss = missing(v);
    const agreed = !!(a.agreement && a.agreement.version === AGREEMENT_VERSION);
    let finished = false;
    if (b.finish) {
      if (miss.length) { acc.save(); return res.status(400).json({ error: `Please fill in: ${miss.join(', ')}`, missing: miss }); }
      if (!agreed) { acc.save(); return res.status(400).json({ error: 'Please tick the agreement to finish.' }); }
      if (!a.setupDone) { a.setupDone = now(); finished = true; }
      if (pend) {
        pend.quiet = false; ctx.saveDocEdits();
        ctx.notify({ roles: ['director'] }, { title: `Doctor details to approve: ${d.name.en}`, body: `${d.name.en} filled in their details for the website (${Object.keys(pend.fields).filter((k) => k !== 'nameNe').join(', ')}).\nPatients see them only after you approve: Dashboard → Approvals.`, link: '#/dashboard/approvals', cat: 'account' });
      }
    }
    acc.save();
    res.json({ ok: true, finished, missing: miss, pending: !!pend, live, affected, account: acc.publicView(a) });
  });
  const pendingFirst = (a) => { const p = pendingFor(a); return !!(p && p.first); };

  // The doctor's pending details, so the doctor (only) sees them on the website before approval.
  app.get('/api/d/preview', need, (req, res) => {
    const a = req.acct, p = a.doctorId ? pendingFor(a) : null;
    res.set('Cache-Control', 'no-store');
    res.json({ doctorId: a.doctorId || '', fields: p ? p.fields : null });
  });

  // ------------------------------------------------------------- Available now
  function isNow(id) {
    const s = nowState[id];
    if (!s || !s.on || s.day !== ctx.today()) return false;
    const d = docOf(id);
    return !!d && d.videoConsult !== false && S.inHoursNow(d, C().booking, ctx.today(), nepalTime());
  }
  ctx.doctorNow = isNow;
  app.get('/api/d/now', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ doctors: Object.keys(nowState).filter(isNow) });
  });
  app.post('/api/d/now', need, (req, res) => {
    const a = req.acct, b = req.body || {};
    const id = isManager(a) && b.doctorId ? String(b.doctorId) : a.doctorId;
    const d = id && docOf(id);
    if (!d || !(acc.isDoctor(a) && a.doctorId === id || isManager(a))) return res.status(403).json({ error: 'Not allowed' });
    if (b.on) {
      if (d.videoConsult === false || d.employment === 'visiting' || d.dept === 'anaesthesiology') return res.status(400).json({ error: 'Video consultation is not switched on for this doctor.' });
      if (!S.inHoursNow(d, C().booking, ctx.today(), nepalTime())) return res.status(400).json({ error: 'You can switch this on only during your clinic hours (or the video hours the Director has set for you).' });
      nowState[id] = { on: true, at: now(), day: ctx.today() };
    } else delete nowState[id];
    store.write('doctorNow', nowState);
    res.json({ ok: true, on: isNow(id) });
  });

  // -------------------------------------------- Director / chosen staff: all doctors
  app.get('/api/d/doctors', need, (req, res) => {
    const a = req.acct;
    if (!isManager(a)) return res.status(403).json({ error: 'Not allowed' });
    const full = acc.seesAll(a);
    res.set('Cache-Control', 'no-store');
    res.json({ today: ctx.today(), full, partTime: (C().booking || {}).partTime || null,
      doctors: ctx.doctors().filter((d) => full || d.employment === 'visiting').map((d) => {
        const ac = acc.all().find((x) => x.doctorId === d.id && x.staffRole === 'doctor' && x.status !== 'rejected' && x.status !== 'disabled');
        return { id: d.id, no: d.no || null, name: d.name, dept: d.dept, employment: d.employment || 'part', days: d.days || [], dayHours: d.dayHours || null, hours: d.hours || '', off: d.off || [], visitDates: d.visitDates || [], videoConsult: d.videoConsult !== false, videoHours: d.videoHours || {}, degreeLevel: d.degreeLevel || 'MD',
          private: full ? d.private || {} : undefined, account: ac ? { email: full ? ac.email : '', status: ac.status, setupDone: !!ac.setupDone, agreedAt: (ac.agreement || {}).at || '' } : null, now: isNow(d.id), bookings: bookingCounts(d) };
      }) });
  });
  app.post('/api/d/doctors/:id', need, (req, res) => {
    const a = req.acct, b = req.body || {}, d = docOf(req.params.id);
    if (!isManager(a)) return res.status(403).json({ error: 'Not allowed' });
    if (!d) return res.status(404).json({ error: 'Doctor not found' });
    const full = acc.seesAll(a);
    if (!full && d.employment !== 'visiting') return res.status(403).json({ error: 'You can set visit dates for visiting specialists only' });
    const f = {};
    try {
      if (full && ['full', 'part', 'visiting'].includes(b.employment)) f.employment = b.employment;
      const dd = Object.assign({}, d, f);
      if (b.visitDates !== undefined) f.visitDates = cleanDates(b.visitDates, 60);
      if (full) {
        if (b.days !== undefined) f.days = DAYS.filter((x) => (Array.isArray(b.days) ? b.days : []).includes(x));
        if (b.useStandard) { f.dayHours = null; f.hours = ''; } else if (b.dayHours !== undefined) f.dayHours = cleanDayHours(b.dayHours);
        if (b.off !== undefined) f.off = cleanDates(b.off, 200);
        if (b.videoHours !== undefined) { const vh = cleanDayHours(b.videoHours) || {}; Object.keys(vh).forEach((k) => { if (!vh[k]) delete vh[k]; }); f.videoHours = vh; }
        if (b.videoConsult !== undefined) f.videoConsult = !!b.videoConsult && dd.employment !== 'visiting' && d.dept !== 'anaesthesiology';
        if (['MD', 'DM'].includes(b.degreeLevel)) f.degreeLevel = b.degreeLevel;
        if (dd.employment === 'visiting' && !Array.isArray(f.visitDates) && !Array.isArray(d.visitDates)) f.visitDates = [];
      }
    } catch (e) { return res.status(400).json({ error: e.message }); }
    if (!Object.keys(f).length) return res.status(400).json({ error: 'Nothing to save' });
    const r = applyLive(d, f, acc.displayName(a), a);
    if (!acc.isDirector(a)) ctx.notify({ doctors: [d.id] }, { title: 'Your schedule on the website was updated', body: `${acc.displayName(a)} updated your schedule on the NIKO Hospital website. Please check it in your dashboard.`, link: '#/dashboard/schedule', cat: 'schedule' });
    res.json({ ok: true, affected: r.affected });
  });
}

module.exports = { mount, AGREEMENT };
