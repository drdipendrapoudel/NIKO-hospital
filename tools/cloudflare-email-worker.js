/*
 * Cloudflare Email Worker — passes lab reports emailed to lab@nikoaspatal.com.np to the website.
 *
 * Setup (Cloudflare dashboard, free):
 *  1. Workers & Pages → Create → Worker → name it "niko-lab-email" → paste this file → Deploy.
 *     In the worker's Settings → Variables add:
 *        SITE_URL        = https://nikoaspatal.com.np        (or the Railway address)
 *        INBOUND_SECRET  = the same value as LAB_INBOUND_SECRET in Railway (a long random text)
 *     In Settings → Bindings nothing else is needed. The worker uses the "postal-mime" package:
 *     with the dashboard editor, use the version below that imports it from esm.sh, or deploy with
 *     Wrangler and `npm i postal-mime`.
 *  2. Email → Email Routing → enable it for nikoaspatal.com.np (Cloudflare adds the MX records).
 *  3. Email Routing → Routing rules → Custom address: lab@nikoaspatal.com.np → Action: Send to a Worker → niko-lab-email.
 *  4. In the lab's own system, set it to email each finished report (PDF) to lab@nikoaspatal.com.np.
 *
 * The website matches each report to a patient by name + age. Reports it cannot match to exactly one
 * patient wait in Dashboard → Lab → “Unmatched reports” for lab staff to choose the patient.
 */
import PostalMime from 'postal-mime';

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    const mail = await PostalMime.parse(raw);
    const attachments = (mail.attachments || [])
      .filter((a) => /pdf|image/.test(a.mimeType || ''))
      .map((a) => ({ filename: a.filename || 'report.pdf', contentType: a.mimeType, content: toBase64(a.content) }));
    const res = await fetch(`${env.SITE_URL.replace(/\/$/, '')}/api/lab/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Inbound-Secret': env.INBOUND_SECRET },
      body: JSON.stringify({ from: message.from, subject: mail.subject || '', text: mail.text || '', attachments }),
    });
    if (!res.ok) message.setReject(`Website did not accept the report (HTTP ${res.status})`);
  },
};
