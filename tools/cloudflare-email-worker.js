/*
 * Cloudflare Email Worker "niko-lab-email" — passes lab reports emailed to lab@nikoaspatal.com.np to the website.
 * No packages needed: paste this file into the Cloudflare dashboard editor.
 *
 * Worker settings → Variables and secrets:
 *   SITE_URL        (text)   https://nikoaspatal.com.np   (or https://niko-hospital-production.up.railway.app)
 *   INBOUND_SECRET  (secret) the same value as LAB_INBOUND_SECRET in Railway
 * Email → Email Routing → Routing rules: lab@nikoaspatal.com.np → Send to a Worker → niko-lab-email.
 *
 * The website matches each report to a patient by name + age. Reports that do not match exactly one
 * patient wait in Dashboard → Lab → “Unmatched reports” for lab staff.
 */
const MAX_BYTES = 20 * 1024 * 1024;

function splitHead(part) {
  const i = part.search(/\r?\n\r?\n/);
  if (i < 0) return { head: part, body: '' };
  const m = part.slice(i).match(/^\r?\n\r?\n/);
  return { head: part.slice(0, i), body: part.slice(i + m[0].length) };
}
function headers(head) {
  const out = {};
  head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach((line) => {
    const k = line.indexOf(':');
    if (k > 0) out[line.slice(0, k).trim().toLowerCase()] = line.slice(k + 1).trim();
  });
  return out;
}
function param(value, name) {
  const m = (value || '').match(new RegExp(`${name}\\*?=(?:"([^"]*)"|([^;\\s]*))`, 'i'));
  return m ? decodeURIComponent((m[1] || m[2] || '').replace(/^utf-8''/i, '')) : '';
}
function decodeWords(s) {
  return String(s || '').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (all, cs, enc, txt) => {
    try {
      const bytes = enc.toUpperCase() === 'B' ? Uint8Array.from(atob(txt), (c) => c.charCodeAt(0))
        : Uint8Array.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0));
      return new TextDecoder(cs).decode(bytes);
    } catch (e) { return txt; }
  });
}
function textOf(body, enc) {
  enc = (enc || '').toLowerCase();
  if (enc === 'base64') { try { return new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\s+/g, '')), (c) => c.charCodeAt(0))); } catch (e) { return ''; } }
  if (enc === 'quoted-printable') return body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16)));
  return body;
}
// Walks a MIME message and collects the plain text and the PDF / image attachments (kept as base64).
function walk(raw, out) {
  const { head, body } = splitHead(raw);
  const h = headers(head);
  const type = (h['content-type'] || 'text/plain').toLowerCase();
  if (type.startsWith('multipart/')) {
    const b = param(h['content-type'], 'boundary');
    if (!b) return;
    body.split(`--${b}`).slice(1).forEach((p) => { if (!p.startsWith('--')) walk(p.replace(/^\r?\n/, ''), out); });
    return;
  }
  const name = decodeWords(param(h['content-disposition'], 'filename') || param(h['content-type'], 'name'));
  const enc = (h['content-transfer-encoding'] || '').toLowerCase();
  if (/application\/pdf|image\/|application\/octet-stream/.test(type) && (name || type !== 'text/plain')) {
    if (enc === 'base64' && (/pdf|image/.test(type) || /\.(pdf|jpe?g|png)$/i.test(name))) {
      out.attachments.push({ filename: name || 'report.pdf', contentType: /pdf/.test(type) || /\.pdf$/i.test(name) ? 'application/pdf' : type.split(';')[0], content: body.replace(/\s+/g, '') });
    }
  } else if (type.startsWith('text/plain') && !name) out.text += `${textOf(body, enc)}\n`;
  else if (type.startsWith('text/html') && !name && !out.text) out.text += textOf(body, enc).replace(/<[^>]+>/g, ' ');
}

export default {
  async email(message, env) {
    if (message.rawSize > MAX_BYTES) { message.setReject('Message too large'); return; }
    const raw = await new Response(message.raw).text();
    const out = { text: '', attachments: [] };
    walk(raw, out);
    const subject = decodeWords(message.headers.get('subject') || '');
    const res = await fetch(`${String(env.SITE_URL).replace(/\/$/, '')}/api/lab/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Inbound-Secret': env.INBOUND_SECRET },
      body: JSON.stringify({ from: message.from, subject, text: out.text.slice(0, 20000), attachments: out.attachments }),
    });
    if (!res.ok) message.setReject(`Website did not accept the report (HTTP ${res.status})`);
  },
};
