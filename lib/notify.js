// Sends booking / feedback notifications by email, WhatsApp (Meta Cloud API) and SMS (Sparrow SMS).
// Every channel is optional — fill the matching values in .env to switch it on.
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* optional */ }

const env = process.env;
let transporter = null;
if (nodemailer && env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    secure: String(env.SMTP_SECURE || 'true') === 'true',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

// Nepali mobile numbers → international format 97798XXXXXXXX
function intl(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('977')) return d;
  if (d.length === 10 && d.startsWith('9')) return `977${d}`;
  return d;
}

async function email(to, subject, text) {
  if (!transporter && to && env.BREVO_API_KEY) { const r = await require('./mailer').send(to, subject, text); return { channel: 'email', ok: !!r.ok }; }
  if (!transporter || !to) return { channel: 'email', skipped: true };
  try {
    await transporter.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, text });
    return { channel: 'email', ok: true };
  } catch (e) { console.error('[email]', e.message); return { channel: 'email', ok: false, error: e.message }; }
}

// WhatsApp Cloud API. Messages to patients must use an approved template
// (WHATSAPP_TEMPLATE, with body parameters {{1}}..{{n}}). Messages to the hospital's own
// number can be plain text once that number has messaged the business in the last 24h,
// so a template is used for both when set.
async function whatsapp(to, text, params) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID || !to) return { channel: 'whatsapp', skipped: true };
  const body = env.WHATSAPP_TEMPLATE && params
    ? { messaging_product: 'whatsapp', to: intl(to), type: 'template',
        template: { name: env.WHATSAPP_TEMPLATE, language: { code: env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: String(p).slice(0, 200) })) }] } }
    : { messaging_product: 'whatsapp', to: intl(to), type: 'text', text: { body: text } };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error?.message || `HTTP ${res.status}`);
    return { channel: 'whatsapp', ok: true };
  } catch (e) { console.error('[whatsapp]', e.message); return { channel: 'whatsapp', ok: false, error: e.message }; }
}

// Sparrow SMS (Nepal). https://docs.sparrowsms.com
async function sms(to, text) {
  if (!env.SPARROW_TOKEN || !to) return { channel: 'sms', skipped: true };
  try {
    const res = await fetch('https://api.sparrowsms.com/v2/sms/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: env.SPARROW_TOKEN, from: env.SPARROW_FROM || 'Demo', to: String(to).replace(/\D/g, '').slice(-10), text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { channel: 'sms', ok: true };
  } catch (e) { console.error('[sms]', e.message); return { channel: 'sms', ok: false, error: e.message }; }
}

function bookingText(b, hospitalName, phone, kind = 'confirmed') {
  const head = kind === 'cancelled' ? 'Appointment CANCELLED' : kind === 'rescheduled' ? 'Appointment RESCHEDULED' : 'Appointment booked';
  return `${hospitalName}: ${head}\nCode: ${b.code}\nPatient: ${b.name}\nDoctor: ${b.doctorName}\nDate: ${b.date} ${b.time || ''}\n` +
    (kind === 'cancelled' ? '' : 'Please arrive 15 minutes early with previous reports.\n') + `Help: ${phone}`;
}

async function booking(b, content, kind = 'confirmed') {
  const name = content.hospital.shortName.en;
  const phone = content.hospital.phone24;
  const text = bookingText(b, name, phone, kind);
  const params = [b.name, b.doctorName, `${b.date} ${b.time || ''}`.trim(), b.code];
  const hospitalEmail = content.booking.notifyEmail || env.NOTIFY_EMAIL;
  const hospitalWa = content.booking.notifyWhatsApp || env.NOTIFY_WHATSAPP;
  const staffText = `NEW ${kind.toUpperCase()} booking\n${text}\nPhone: ${b.phone}${b.email ? `\nEmail: ${b.email}` : ''}${b.reason ? `\nReason: ${b.reason}` : ''}`;
  const jobs = [
    email(hospitalEmail, `[Website] ${kind} booking ${b.code} – ${b.doctorName} ${b.date}`, staffText),
    whatsapp(hospitalWa, staffText, params),
  ];
  if (b.notify?.includes('email')) jobs.push(email(b.email, `${name} – appointment ${kind} (${b.code})`, text));
  if (b.notify?.includes('whatsapp')) jobs.push(whatsapp(b.phone, text, params));
  if (b.notify?.includes('sms')) jobs.push(sms(b.phone, text));
  return Promise.all(jobs);
}

async function staff(content, subject, text) {
  const to = content.booking.notifyEmail || env.NOTIFY_EMAIL;
  return Promise.all([email(to, subject, text), whatsapp(content.booking.notifyWhatsApp || env.NOTIFY_WHATSAPP, `${subject}\n${text}`)]);
}

module.exports = { booking, staff, email, whatsapp, sms, configured: () => ({
  email: !!(transporter || env.BREVO_API_KEY), whatsapp: !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID), sms: !!env.SPARROW_TOKEN }) };
