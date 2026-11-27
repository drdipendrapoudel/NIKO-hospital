// Serves the template (stock) photos listed in content/template-photos.js at /stock/<key>.jpg.
// Each photo is fetched from Pexels once, saved under <uploads>/stock/, and served from disk after that,
// so visitors load every picture from our own address.
const fs = require('fs');
const path = require('path');
const T = require('../content/template-photos');

const MIN_BYTES = 4000; // anything smaller is not a real photo
const FALLBACK = '/img/ph/template.svg';

function mount(app, uploadDir) {
  const dir = path.join(uploadDir, 'stock');
  fs.mkdirSync(dir, { recursive: true });
  const busy = new Map();
  const failed = new Map(); // key → time of the last failed download

  const file = (key) => path.join(dir, `${key}.jpg`);
  const have = (key) => { try { return fs.statSync(file(key)).size > MIN_BYTES; } catch (_) { return false; } };

  function download(key) {
    if (busy.has(key)) return busy.get(key);
    const job = (async () => {
      const r = await fetch(T.cdnUrl(key), { headers: { 'User-Agent': 'Mozilla/5.0 (NIKO Hospital website)' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok || !/^image\/(jpeg|png|webp)/.test(r.headers.get('content-type') || '')) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length <= MIN_BYTES) throw new Error('empty image');
      const tmp = `${file(key)}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, buf);
      await fs.promises.rename(tmp, file(key));
      failed.delete(key);
      return true;
    })().catch((e) => { failed.set(key, Date.now()); console.error('[stock]', key, e.message); return false; })
      .finally(() => busy.delete(key));
    busy.set(key, job);
    return job;
  }

  app.get('/stock/:name', async (req, res) => {
    const key = String(req.params.name).replace(/\.jpg$/, '');
    if (!Object.prototype.hasOwnProperty.call(T.PHOTOS, key)) return res.redirect(302, FALLBACK);
    const recentlyFailed = failed.has(key) && Date.now() - failed.get(key) < 6 * 3600e3;
    if (!have(key) && !recentlyFailed) await download(key);
    // Could not fetch it from here: let the visitor's browser try the source (the page falls back to a local picture if that fails too).
    if (!have(key)) { res.set('Cache-Control', 'no-store'); return res.redirect(302, T.cdnUrl(key)); }
    res.set({ 'Cache-Control': 'public, max-age=604800', 'X-Content-Type-Options': 'nosniff' });
    res.type('jpg').sendFile(file(key));
  });

  // Fetch everything shortly after start, one at a time, so the first visitor does not wait.
  (async () => {
    for (const key of Object.keys(T.PHOTOS)) if (!have(key)) await download(key);
    const missing = Object.keys(T.PHOTOS).filter((k) => !have(k));
    console.log(`[stock] ${Object.keys(T.PHOTOS).length - missing.length}/${Object.keys(T.PHOTOS).length} template photos ready${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  })().catch(() => {});
}

module.exports = { mount };
