// Generates numbered placeholder photos (public/img/ph/P##.svg and D##.svg).
// Staff take a real photo of each numbered spot and upload it in Admin.
const fs = require('fs');
const path = require('path');
const content = require('../content/default-content.js');

const out = path.join(__dirname, '..', 'public', 'img', 'ph');
fs.mkdirSync(out, { recursive: true });

const PHOTOS = {
  P02: 'Reception / help desk',
  P03: 'Emergency room',
  P04: 'Inpatient ward',
  P05: 'HDU',
  P06: 'Operation theatre (OT)',
  P07: 'Laboratory',
  P08: 'Pharmacy (24 hours)',
  P09: 'ECG',
  P10: '2D Echo',
  P11: 'Ultrasound',
  P12: 'X-ray',
  P13: 'NPL (ENT endoscopy)',
  P14: 'PFT (lung function test)',
  P15: 'Visiting specialist event',
  P16: 'Doctors & staff team photo',
  P17: 'Director portrait',
  P18: 'Health camp / community event',
  P19: 'Spare photo',
  P20: 'Spare photo',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function wide(no, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="Placeholder photo ${no}: ${esc(label)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f487c"/><stop offset="1" stop-color="#3b82c4"/></linearGradient>
<pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M34 22h12v12h12v12H46v12H34V46H22V34h12z" fill="#fff" fill-opacity=".05"/></pattern></defs>
<rect width="1600" height="900" fill="url(#g)"/><rect width="1600" height="900" fill="url(#p)"/>
<rect x="560" y="250" width="480" height="280" rx="36" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>
<text x="800" y="450" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="190" fill="#fff">${no}</text>
<text x="800" y="620" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="58" fill="#fff">${esc(label)}</text>
<text x="800" y="700" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="34" fill="#fff" fill-opacity=".85">Placeholder — replace with real photo no. ${no}</text>
</svg>`;
}

function portrait(no, name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" width="600" height="720" role="img" aria-label="Placeholder portrait ${no}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3ecf7"/><stop offset="1" stop-color="#c3d5ec"/></linearGradient></defs>
<rect width="600" height="720" fill="url(#g)"/>
<circle cx="300" cy="250" r="110" fill="#1f487c" fill-opacity=".18"/>
<path d="M90 720c0-130 95-215 210-215s210 85 210 215z" fill="#1f487c" fill-opacity=".18"/>
<rect x="190" y="300" width="220" height="120" rx="24" fill="#1f487c"/>
<text x="300" y="390" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="88" fill="#fff">${no}</text>
<text x="300" y="470" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="30" fill="#163559">${esc(name)}</text>
<text x="300" y="512" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="#163559" fill-opacity=".8">Portrait placeholder ${no}</text>
</svg>`;
}

for (const [no, label] of Object.entries(PHOTOS)) fs.writeFileSync(path.join(out, `${no}.svg`), wide(no, label));
for (const d of content.doctors) fs.writeFileSync(path.join(out, `${d.id}.svg`), portrait(d.id, d.name.en));

// Photo guide for staff
const lines = ['# Photo guide — NIKO Hospital website', '',
  'Every placeholder picture on the website shows a number in the middle (for example **P06** or **D05**).',
  'Take a real photo of that place or person, name the file with the same number (for example `P06.jpg`),',
  'then upload it in **Admin → the matching section → Upload photo**. The website resizes photos automatically.', '',
  '**Tips:** landscape photos (wide) for P-numbers, portrait (tall) for D-numbers. Good light, clean background,',
  'no patients’ faces without written consent.', '',
  '## Places (landscape, at least 1600 × 900)', '',
  '| No. | What to photograph | Where it is used |', '|---|---|---|',
  '| P01 | Hospital building front | **Already done** — your photo is used in the slideshow and About page |'];
const usedIn = {};
for (const f of content.facilities) usedIn[f.photoNo] = `Facilities → ${f.name.en}`;
Object.assign(usedIn, { P15: 'Slideshow 2, News & events', P16: 'Slideshow 3', P17: 'Director’s message', P18: 'News', P06: 'Slideshow 4, Facilities → Operation Theatre' });
for (const [no, label] of Object.entries(PHOTOS)) lines.push(`| ${no} | ${label} | ${usedIn[no] || 'Spare — use anywhere'} |`);
lines.push('', '## Doctor portraits (portrait, at least 600 × 720, plain background)', '', '| No. | Doctor |', '|---|---|');
for (const d of content.doctors) lines.push(`| ${d.id} | ${d.name.en} (${d.name.ne}) |`);
lines.push('', 'Doctors who fill in the Google Form upload their own portrait, which replaces the placeholder automatically.');
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'PHOTO-GUIDE.md'), lines.join('\n') + '\n');
console.log('placeholders written:', fs.readdirSync(out).length);
