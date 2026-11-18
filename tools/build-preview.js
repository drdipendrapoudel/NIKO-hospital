// Builds two single-file previews that open without a server (dist/):
//   niko-website-preview.html  — the public website
//   niko-admin-preview.html    — the admin panel with live preview (password: demo)
// Bookings and edits in these previews are not saved anywhere.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pub = (p) => path.join(root, 'public', p);
const read = (p) => fs.readFileSync(pub(p), 'utf8');
const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const dataUri = (rel) => `data:${mime[path.extname(rel)]};base64,${fs.readFileSync(pub(rel)).toString('base64')}`;
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1');

const content = JSON.parse(JSON.stringify(require('../content/default-content')));
let json = JSON.stringify(content);
json = json.replace(/"(img\/[\w./-]+\.(svg|png|jpg))"/g, (m, rel) => `"${dataUri(rel)}"`);
const logo = dataUri('img/logo.png');

const site = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NIKO Hospital — website preview</title><meta name="theme-color" content="#1f487c"><link rel="icon" href="${logo}">
<style>${read('assets/site.css')}</style></head><body>
<script>window.NIKO_DEFAULT=${safe(json)};</script>
<script>${safe(read('assets/schedule.js'))}</script>
<script>${safe(read('assets/i18n.js'))}</script>
<script>${safe(read('assets/site.js'))}</script>
</body></html>`;

const admin = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NIKO Hospital — admin preview</title><link rel="icon" href="${logo}"><style>${read('assets/admin.css')}</style></head><body>
<div id="app"></div>
<script>window.NIKO_DEFAULT=${safe(json)};window.NIKO_PREVIEW_SRCDOC=${safe(JSON.stringify(site))};</script>
<script>${safe(read('assets/i18n.js'))}</script>
<script>${safe(read('assets/admin.js').split('img/logo.png').join(logo))}</script>
</body></html>`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'niko-website-preview.html'), site);
fs.writeFileSync(path.join(root, 'dist', 'niko-admin-preview.html'), admin);
console.log('dist/niko-website-preview.html', (site.length / 1024).toFixed(0) + ' KB');
console.log('dist/niko-admin-preview.html', (admin.length / 1024).toFixed(0) + ' KB');
