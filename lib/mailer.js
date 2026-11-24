// Sends the website's own emails (sign-up codes, alerts, notices).
// Railway's Hobby plan blocks SMTP, so the default is Brevo's HTTPS API (free: 300 emails a day).
//   BREVO_API_KEY=...            from brevo.com → SMTP & API → API keys
//   MAIL_FROM=no-reply@nikoaspatal.com.np   (a sender verified in Brevo)
//   MAIL_FROM_NAME=NIKO Hospital
//   MAIL_DAILY_LIMIT=290         stay under Brevo's free 300/day
// If SMTP_HOST is set (e.g. on a paid plan) SMTP is used instead. With neither, emails are only logged.
const store = require('./store');

const env = process.env;
const LIMIT = Number(env.MAIL_DAILY_LIMIT || 290);
const RESERVE = 40; // kept free for sign-up codes and urgent alerts; bulk notices stop before this

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* optional */ }
let smtp = null;
if (nodemailer && env.SMTP_HOST) {
  smtp = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465), secure: String(env.SMTP_SECURE || 'true') === 'true', auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } });
}

function nepalDay() { return new Date(Date.now() + 345 * 60e3).toISOString().slice(0, 10); }
const state = store.read('mailstate', { day: '', sent: 0, digest: {} });
function counter() { if (state.day !== nepalDay()) { state.day = nepalDay(); state.sent = 0; } return state; }
function remaining() { return LIMIT - counter().sent; }
function configured() { return !!(smtp || env.BREVO_API_KEY); }

function escHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function toHtml(text, link) {
  const body = escHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14213a;max-width:560px">
<div style="background:#1f5fae;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:bold">${escHtml(env.MAIL_FROM_NAME || 'NIKO Hospital')}</div>
<div style="border:1px solid #dbe4f0;border-top:0;padding:18px;border-radius:0 0 10px 10px">${body}${link ? `<p style="margin-top:18px"><a href="${escHtml(link.url)}" style="background:#f2711c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${escHtml(link.text)}</a></p>` : ''}</div>
<p style="font-size:12px;color:#6b7a90">NIKO Hospital, Hetauda-2, Makawanpur · 057-520223</p></div>`;
}

async function deliver(to, subject, text, link) {
  if (smtp) {
    await smtp.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, text: text + (link ? `\n\n${link.text}: ${link.url}` : ''), html: toHtml(text, link) });
    return;
  }
  if (env.BREVO_API_KEY) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.MAIL_FROM || 'no-reply@nikoaspatal.com.np', name: env.MAIL_FROM_NAME || 'NIKO Hospital' },
        to: [{ email: to }], subject, textContent: text + (link ? `\n\n${link.text}: ${link.url}` : ''), htmlContent: toHtml(text, link),
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || `Brevo HTTP ${r.status}`); }
    return;
  }
  console.log(`[mail – not configured] to=${to} subject=${subject}\n${text}${link ? `\n${link.url}` : ''}`);
}

// opts.bulk: a notice or message to many people. If the day's emails are nearly used up it is saved
// and sent in one summary email the next day (it is always visible on the dashboard straight away).
async function send(to, subject, text, opts = {}) {
  to = String(to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, skipped: true };
  const left = remaining();
  if (left <= 0 || (opts.bulk && left <= RESERVE)) {
    if (opts.bulk) {
      (state.digest[to] = state.digest[to] || []).push({ subject, text: text.slice(0, 600), at: new Date().toISOString() });
      store.write('mailstate', state);
      return { ok: false, queued: true };
    }
    console.error('[mail] daily limit reached, not sent:', subject);
    return { ok: false, limit: true };
  }
  try {
    await deliver(to, subject, text, opts.link);
    if (configured()) { counter().sent += 1; store.write('mailstate', state); }
    return { ok: true };
  } catch (e) {
    console.error('[mail]', e.message);
    return { ok: false, error: e.message };
  }
}

// Once a day, send each person one summary of the notices that waited.
async function flushDigests(siteUrl) {
  const people = Object.keys(state.digest || {});
  for (const to of people) {
    if (remaining() <= RESERVE) break;
    const items = state.digest[to] || [];
    if (!items.length) { delete state.digest[to]; continue; }
    const text = `You have ${items.length} new message(s) on the NIKO Hospital website:\n\n` +
      items.map((i) => `• ${i.subject}\n${i.text}`).join('\n\n');
    const r = await send(to, `NIKO Hospital – ${items.length} new message(s)`, text, { link: siteUrl ? { text: 'Open my dashboard', url: `${siteUrl}/#/dashboard` } : null });
    if (r.ok) delete state.digest[to];
  }
  store.write('mailstate', state);
}

module.exports = { send, flushDigests, remaining, configured, LIMIT, status: () => ({ configured: configured(), via: smtp ? 'smtp' : env.BREVO_API_KEY ? 'brevo' : 'none', sentToday: counter().sent, limit: LIMIT, waiting: Object.keys(state.digest || {}).length }) };
