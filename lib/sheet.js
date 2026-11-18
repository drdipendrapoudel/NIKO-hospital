// Reads the doctors' Google Form responses from a Google Sheet published as CSV
// (File → Share → Publish to web → choose the "Form responses" sheet → CSV).
// The site refreshes it every few seconds, so a new form entry appears on the website automatically.

let cache = { rows: [], doctors: [], fetchedAt: null, error: null, url: '' };

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
    i++;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// Column header → field. Matching is by keywords so small wording changes in the form still work.
const COLS = [
  ['nameNe', /nepali|नेपाली/i],
  ['name', /full name|^name|नाम/i],
  ['title', /title|designation|पद/i],
  ['dept', /department|speciality|specialty|विभाग/i],
  ['nmc', /nmc|council|registration/i],
  ['degrees', /degree|qualification|शैक्षिक/i],
  ['affiliation', /affiliat|institution|hospital you/i],
  ['bio', /about|details|bio|patients will see|परिचय/i],
  ['focus', /focus|conditions|treat|expert/i],
  ['languages', /language|भाषा/i],
  ['gender', /gender|लिङ्ग/i],
  ['days', /days|दिन/i],
  ['hours', /hours|time|समय/i],
  ['photo', /photo|picture|portrait|फोटो/i],
  ['approved', /approved|publish/i],
  ['timestamp', /timestamp/i],
];

function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    for (const [key, re] of COLS) {
      if (map[key] === undefined && re.test(h)) {
        if (key === 'name' && /nepali|नेपाली/i.test(h)) continue;
        if (key === 'hours' && /timestamp/i.test(h)) continue;
        if (key === 'nmc' && /photo/i.test(h)) continue;
        map[key] = idx; break;
      }
    }
  });
  return map;
}

function driveImage(url) {
  if (!url) return '';
  const first = url.split(/[,\s]+/).find(Boolean) || '';
  const m = first.match(/[?&]id=([\w-]+)/) || first.match(/\/d\/([\w-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : first;
}

const DAY_WORDS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
  'आइत': 'Sun', 'सोम': 'Mon', 'मंगल': 'Tue', 'बुध': 'Wed', 'बिही': 'Thu', 'शुक्र': 'Fri', 'शनि': 'Sat' };

function parseDays(text) {
  if (!text) return [];
  if (/every\s*day|daily|प्रत्येक दिन|all days/i.test(text)) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [];
  for (const [w, d] of Object.entries(DAY_WORDS)) if (text.toLowerCase().includes(w) && !days.includes(d)) days.push(d);
  return days;
}

function deptId(text, departments) {
  if (!text) return '';
  const low = text.toLowerCase();
  const exact = departments.find((d) => d.name.en.toLowerCase() === low || d.id === low);
  if (exact) return exact.id;
  const partial = departments.find((d) => low.includes(d.name.en.toLowerCase().split(/[ (&]/)[0]) || d.name.en.toLowerCase().includes(low));
  return partial ? partial.id : '';
}

function rowsToDoctors(rows, departments, autoPublish) {
  if (rows.length < 2) return [];
  const map = mapHeaders(rows[0]);
  const get = (r, k) => (map[k] !== undefined ? (r[map[k]] || '').trim() : '');
  const byKey = new Map();
  for (const r of rows.slice(1)) {
    const name = get(r, 'name');
    if (!name) continue;
    if (!autoPublish && !/^(y|yes|true|1|हो)$/i.test(get(r, 'approved'))) continue;
    const dayText = get(r, 'days');
    const monthly = /first saturday|पहिलो शनि/i.test(dayText);
    const days = parseDays(dayText.replace(/first saturday of every month|पहिलो शनिवार/ig, ''));
    const doc = {
      source: 'form',
      name: { en: /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`, ne: get(r, 'nameNe') },
      title: { en: get(r, 'title'), ne: '' },
      dept: deptId(get(r, 'dept'), departments),
      degrees: get(r, 'degrees'),
      nmc: get(r, 'nmc').replace(/[^\d]/g, ''),
      affiliation: get(r, 'affiliation'),
      bio: { en: get(r, 'bio'), ne: '' },
      focus: get(r, 'focus').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean),
      languages: get(r, 'languages').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean),
      gender: get(r, 'gender'),
      days,
      monthlyWeek: monthly ? 1 : 0,
      monthlyDay: monthly ? 'Sat' : '',
      scheduleNote: { en: days.length === 7 ? 'Every day' : dayText, ne: days.length === 7 ? 'प्रत्येक दिन' : '' },
      hours: get(r, 'hours'),
      photo: driveImage(get(r, 'photo')),
    };
    // Later submissions from the same doctor replace earlier ones.
    byKey.set(doc.nmc || doc.name.en.toLowerCase(), doc);
  }
  return [...byKey.values()];
}

async function refresh(url, departments, autoPublish) {
  if (!url) { cache = { rows: [], doctors: [], fetchedAt: null, error: null, url: '' }; return cache; }
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Sheet returned HTTP ${res.status}`);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error('The link returned a web page, not CSV. Use File → Share → Publish to web → CSV.');
    const rows = parseCSV(text);
    cache = { rows, doctors: rowsToDoctors(rows, departments, autoPublish), fetchedAt: new Date().toISOString(), error: null, url };
  } catch (e) {
    cache = { ...cache, error: e.message, fetchedAt: new Date().toISOString(), url };
  }
  return cache;
}

// Merge form doctors into the admin list. Match by NMC number, then by name.
// Non-empty form answers overwrite; admin-only settings (featured, visible, id) are kept.
function merge(adminDoctors, formDoctors) {
  const list = adminDoctors.map((d) => ({ ...d }));
  const norm = (s) => String(s || '').toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-zऀ-ॿ]/g, '');
  let n = list.length;
  for (const f of formDoctors) {
    let target = list.find((d) => f.nmc && d.nmc === f.nmc) || list.find((d) => norm(d.name.en) === norm(f.name.en));
    if (!target) {
      n += 1;
      target = { id: `F${String(n).padStart(2, '0')}`, name: { en: '', ne: '' }, title: { en: '', ne: '' }, bio: { en: '', ne: '' },
        scheduleNote: { en: '', ne: '' }, focus: [], languages: [], days: [], monthlyWeek: 0, monthlyDay: '', featured: false, visible: true };
      list.push(target);
    }
    if (target.lockFromForm) continue;
    for (const [k, v] of Object.entries(f)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        // If the English text changed and no Nepali was given, drop the old (now outdated) Nepali text.
        if (v.en && !v.ne && target[k] && target[k].en !== v.en) target[k] = { en: v.en, ne: '' };
        target[k] = { ...(target[k] || {}) };
        for (const [lk, lv] of Object.entries(v)) if (lv) target[k][lk] = lv;
      } else if (Array.isArray(v) ? v.length : v) target[k] = v;
    }
    target.monthlyWeek = f.monthlyWeek; target.monthlyDay = f.monthlyDay;
    target.fromForm = true;
  }
  return list;
}

module.exports = { refresh, merge, parseCSV, rowsToDoctors, status: () => ({ ...cache, rows: undefined, rowCount: Math.max(0, cache.rows.length - 1), doctorCount: cache.doctors.length }), current: () => cache };
