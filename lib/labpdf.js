// Makes a simple, printable PDF lab report from result rows.
const path = require('path');
const fs = require('fs');
let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (_) { /* optional */ }

function write(res, r, content) {
  if (!PDFDocument) { res.type('text/plain').send('PDF library is not installed on the server.'); return; }
  const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: r.title || 'Lab report', Author: 'NIKO Hospital' } });
  doc.pipe(res);
  const h = (content && content.hospital) || {};
  const blue = '#1f5fae';
  const logo = path.join(__dirname, '..', 'public', 'img', 'logo.png');
  if (fs.existsSync(logo)) { try { doc.image(logo, 42, 36, { width: 46 }); } catch (_) { /* ignore */ } }
  doc.fillColor(blue).fontSize(17).font('Helvetica-Bold').text((h.name && h.name.en) || 'NIKO Hospital Pvt. Ltd.', 98, 38);
  doc.fillColor('#333').fontSize(9).font('Helvetica').text(`${(h.address && h.address.en) || 'Hetauda-2, Makawanpur'} · ${h.phone24 || '057-520223'}`, 98, 60);
  doc.fillColor(blue).fontSize(12).font('Helvetica-Bold').text('LABORATORY REPORT', 98, 74);
  doc.moveTo(42, 96).lineTo(553, 96).strokeColor(blue).lineWidth(1.2).stroke();

  doc.fillColor('#000').fontSize(10).font('Helvetica');
  const y0 = 106;
  const left = [['Patient', r.name || '—'], ['Age / Sex', `${r.age || '—'}${r.sex ? ` / ${r.sex}` : ''}`]];
  const right = [['Report date', r.date || ''], ['Reference', r.title || '']];
  if (r.doctorName) right.push(['Requested by', r.doctorName]);
  left.forEach((x, i) => { doc.font('Helvetica-Bold').text(`${x[0]}:`, 42, y0 + i * 15, { continued: true }).font('Helvetica').text(` ${x[1]}`); });
  right.forEach((x, i) => { doc.font('Helvetica-Bold').text(`${x[0]}:`, 310, y0 + i * 15, { continued: true }).font('Helvetica').text(` ${x[1]}`); });

  let y = y0 + Math.max(left.length, right.length) * 15 + 14;
  const cols = [42, 250, 360, 420, 553];
  function headerRow() {
    doc.rect(42, y, 511, 18).fill('#eaf1fb');
    doc.fillColor(blue).font('Helvetica-Bold').fontSize(9.5);
    ['Test', 'Result', 'Unit', 'Reference range'].forEach((t, i) => doc.text(t, cols[i] + 4, y + 5, { width: cols[i + 1] - cols[i] - 8 }));
    y += 22; doc.fillColor('#000').font('Helvetica').fontSize(9.5);
  }
  headerRow();
  let panel = null;
  (r.rows || []).forEach((row) => {
    if (y > 760) { doc.addPage(); y = 50; headerRow(); }
    if (row.panel && row.panel !== panel) {
      panel = row.panel;
      doc.font('Helvetica-Bold').fillColor('#333').text(panel.toUpperCase(), 46, y); y += 14; doc.font('Helvetica').fillColor('#000');
    }
    const flagged = /h|l|abn|\*/i.test(row.flag || '');
    const cells = [row.param, `${row.val || ''}${row.flag ? ` ${row.flag}` : ''}`, row.unit || '', row.ref || ''];
    const hgt = Math.max(...cells.map((c, i) => doc.heightOfString(String(c), { width: cols[i + 1] - cols[i] - 8 })));
    cells.forEach((c, i) => { doc.font(i === 1 && flagged ? 'Helvetica-Bold' : 'Helvetica').fillColor(i === 1 && flagged ? '#b42318' : '#000').text(String(c), cols[i] + 4, y, { width: cols[i + 1] - cols[i] - 8 }); });
    y += hgt + 5;
    doc.moveTo(42, y - 2).lineTo(553, y - 2).strokeColor('#e4e9f1').lineWidth(0.5).stroke();
  });
  if (!(r.rows || []).length) { doc.text('See the attached report.', 46, y); y += 16; }
  if (r.note) { y += 8; doc.font('Helvetica-Bold').fillColor('#000').text('Note:', 42, y); doc.font('Helvetica').text(r.note, 42, y + 13, { width: 511 }); }
  doc.fontSize(8).fillColor('#666').text('This report was produced electronically by NIKO Hospital. Please discuss your results with your doctor.', 42, 790, { width: 511, align: 'center' });
  doc.end();
}

module.exports = { write };
