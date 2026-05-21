const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function formatDateId(date = new Date()) {
  // yyyy-mm-dd hh:mm
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function clipText(value, max = 1400) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function tryResolveUploadPath(photoPath, uploadDirAbs) {
  if (!photoPath || typeof photoPath !== 'string') return null;
  if (!photoPath.startsWith('/uploads/')) return null;
  const rel = photoPath.replace(/^\/uploads\//, '').replace(/\.\.(\/|\\)/g, '');
  const abs = path.resolve(uploadDirAbs, rel);
  try {
    if (fs.existsSync(abs)) return abs;
  } catch (_) {}
  return null;
}

function buildSuratJalanPdf({ node, createdAt = new Date(), extras = {}, uploadDirAbs }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 28, bottom: 28, left: 40, right: 40 } });
  const pageW = 595.28;
  const pageH = 841.89;

  const palette = {
    ink: '#0F172A',
    muted: '#64748B',
    border: '#CBD5E1'
  };

  const companyName = clipText(extras.company_name || process.env.COMPANY_NAME || 'PT. JONUSA NETWORK', 80);
  const companyAddr = clipText(extras.company_address || process.env.COMPANY_ADDRESS || 'Alamat Perusahaan', 140);
  const companyPhone = clipText(extras.company_phone || process.env.COMPANY_PHONE || '-', 60);

  function hline(x1, x2, y) {
    doc.save();
    doc.moveTo(x1, y).lineTo(x2, y).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
  }

  function fitText(text, width, maxHeight, opts = {}) {
    const value = String(text ?? '').trim();
    if (!value) return '-';
    const lineGap = opts.lineGap ?? 2;
    const suffix = opts.suffix ?? '…';
    const measure = (s) => doc.heightOfString(String(s), { width, lineGap });
    if (measure(value) <= maxHeight) return value;
    let lo = 0;
    let hi = value.length;
    let best = '';
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const cand = `${value.slice(0, mid).trim()}${suffix}`;
      if (measure(cand) <= maxHeight) {
        best = cand;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best || `${value.slice(0, 20)}${suffix}`;
  }

  function box(x, y, w, h, r = 10) {
    doc.save();
    doc.roundedRect(x, y, w, h, r).fill('#FFFFFF');
    doc.roundedRect(x, y, w, h, r).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
  }

  function formatCoord(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(6);
  }

  const lat = formatCoord(node.latitude);
  const lng = formatCoord(node.longitude);
  const coordText = lat && lng ? `${lat}, ${lng}` : '-';
  const mapsLink = lat && lng ? `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}` : '-';

  const docNo = `SJ-${String(node.id).padStart(6, '0')}`;
  const ticketNo = extras.ticket_no ? clipText(extras.ticket_no, 32) : '-';
  const tanggal = formatDateId(createdAt);

  // Header (rapi, legal)
  const headerY = 28;
  doc.fillColor(palette.ink);
  doc.font('Helvetica-Bold').fontSize(13).text(companyName, 40, headerY);
  doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text(companyAddr, 40, headerY + 16, { width: 360 });
  doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text(`Telp/WA: ${companyPhone}`, 40, headerY + 30);
  doc.fillColor(palette.ink);

  const rightMetaX = pageW - 240;
  doc.font('Helvetica-Bold').fontSize(12).text('SURAT JALAN / WORK ORDER LAPANGAN', rightMetaX, headerY, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text(`No Dokumen: ${docNo}`, rightMetaX, headerY + 18, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text(`No Tiket: ${ticketNo}`, rightMetaX, headerY + 32, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text(`Tanggal: ${tanggal}`, rightMetaX, headerY + 46, { width: 200, align: 'right' });
  doc.fillColor(palette.ink);
  hline(40, pageW - 40, headerY + 64);

  // Panels
  const topY = headerY + 78;
  const gapX = 14;
  const colW = (pageW - 80 - gapX) / 2;
  const leftX = 40;
  const rightX = leftX + colW + gapX;
  const panelH = 308;
  box(leftX, topY, colW, panelH, 12);
  box(rightX, topY, colW, panelH, 12);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.ink).text('INFORMASI LOKASI / NODE', leftX + 14, topY + 12);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.ink).text('INSTRUKSI PEKERJAAN (NOC)', rightX + 14, topY + 12);
  doc.fillColor(palette.ink);

  function fieldPair(xLabel, xValue, y, labelText, valueText, wValue, hValue, opts = {}) {
    doc.fillColor(palette.muted).font('Helvetica-Bold').fontSize(9).text(labelText, xLabel, y);
    doc.fillColor(palette.ink).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size ?? 9);
    const t = fitText(valueText, wValue, hValue, { lineGap: opts.lineGap ?? 2 });
    doc.text(t, xValue, y, { width: wValue, lineGap: opts.lineGap ?? 2 });
    doc.fillColor(palette.ink);
    return hValue + (opts.gap ?? 8);
  }

  const nodeType = node.type_label || node.type || '-';
  const rowW = colW - 126;
  const lx1 = leftX + 14;
  const lv1 = leftX + 116;
  let y = topY + 36;
  y += fieldPair(lx1, lv1, y, 'Kode', node.code || '-', rowW, 14, { bold: true, gap: 6 });
  y += fieldPair(lx1, lv1, y, 'Nama', node.name || '-', rowW, 14, { gap: 6 });
  y += fieldPair(lx1, lv1, y, 'Jenis', nodeType, rowW, 14, { gap: 6 });
  y += fieldPair(lx1, lv1, y, 'Koordinat', coordText, rowW, 14, { size: 9, gap: 6, lineGap: 1 });
  y += fieldPair(lx1, lv1, y, 'Alamat', node.address || '-', rowW, 42, { size: 9, gap: 8 });
  y += fieldPair(lx1, lv1, y, 'Catatan', node.notes || '-', rowW, 32, { size: 9, gap: 8 });
  y += fieldPair(lx1, lv1, y, 'Maps', mapsLink, rowW, 22, { size: 8, gap: 0, lineGap: 1 });

  const photoAbs = uploadDirAbs ? tryResolveUploadPath(extras.photo_path || node.photo_path, uploadDirAbs) : null;
  if (photoAbs) {
    const imgW = 136;
    const imgH = 88;
    const imgX = leftX + colW - imgW - 14;
    const imgY = topY + panelH - imgH - 14;
    doc.save();
    doc.roundedRect(imgX, imgY, imgW, imgH, 10).lineWidth(1).strokeColor(palette.border).stroke();
    try {
      doc.image(photoAbs, imgX + 1, imgY + 1, { fit: [imgW - 2, imgH - 2], align: 'center', valign: 'center' });
    } catch (_) {}
    doc.restore();
  }

  const tujuan = clipText(extras.tujuan || extras.destination || '-', 140);
  const keperluanRaw = String(extras.keperluan || extras.purpose || '-').trim();
  const kerusakanRaw = String(extras.kerusakan || extras.damage || '-').trim();
  const nocAdmin = clipText(extras.noc_admin || '-', 140);
  const teknisi = clipText(extras.teknisi || extras.technician || '-', 140);
  const techContact = clipText(extras.technician_contact || '-', 140);
  const kendaraan = clipText(extras.kendaraan || extras.vehicle || '-', 140);

  const rx1 = rightX + 14;
  const rv1 = rightX + 116;
  let ry = topY + 36;
  const panelBottom = topY + panelH - 14;
  const checklistBlockH = 78;
  const checklistTop = panelBottom - checklistBlockH;

  // Reserve space for checklist at the bottom of the right panel.
  // Keep fields above it by allocating dynamic heights.
  ry += fieldPair(rx1, rv1, ry, 'Tujuan', tujuan, rowW, 14, { bold: true, gap: 6 });

  // Remaining vertical space for Keperluan + Kerusakan blocks.
  // Reserve space for the small fields below them.
  const smallRowUnit = 14 + 6;
  const reservedForSmall = smallRowUnit * 4 + 8; // Admin, Teknisi, Kontak, Kendaraan + spacing
  const availableForBig = Math.max(60, checklistTop - ry - reservedForSmall);
  const keperluanH = Math.max(34, Math.min(72, Math.floor(availableForBig * 0.58)));
  const kerusakanH = Math.max(28, Math.min(56, availableForBig - keperluanH));

  ry += fieldPair(rx1, rv1, ry, 'Keperluan', keperluanRaw || '-', rowW, keperluanH, { gap: 8 });
  ry += fieldPair(rx1, rv1, ry, 'Kerusakan', kerusakanRaw || '-', rowW, kerusakanH, { gap: 8 });
  ry += fieldPair(rx1, rv1, ry, 'Admin NOC', nocAdmin, rowW, 14, { gap: 6 });
  ry += fieldPair(rx1, rv1, ry, 'Teknisi', teknisi, rowW, 14, { gap: 6 });
  ry += fieldPair(rx1, rv1, ry, 'Kontak', techContact, rowW, 14, { gap: 6 });
  ry += fieldPair(rx1, rv1, ry, 'Kendaraan', kendaraan, rowW, 14, { gap: 6 });

  doc.fillColor(palette.muted).font('Helvetica-Bold').fontSize(9).text('Checklist SOP (centang manual)', rx1, checklistTop);
  doc.fillColor(palette.ink).font('Helvetica').fontSize(9);
  const checks = ['Patchcord', 'Redaman/LOSS', 'Dokumentasi foto', 'Update ke NOC'];
  let cy = checklistTop + 14;
  for (const c of checks) {
    doc.save();
    doc.rect(rx1, cy + 2, 10, 10).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
    doc.text(c, rx1 + 14, cy, { width: colW - 28 });
    cy += 16;
  }

  // Legal + signatures
  const lowerY = topY + panelH + 12;
  box(40, lowerY, pageW - 80, 150, 12);
  doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(10).text('LEGALITAS / KETENTUAN', 54, lowerY + 12);
  doc.fillColor(palette.ink).font('Helvetica').fontSize(9).text(
    'Dokumen ini adalah perintah kerja resmi dari NOC untuk pelaksanaan pekerjaan lapangan. Dokumen berlaku untuk 1 (satu) tiket/pekerjaan dan wajib dibawa saat eksekusi. Setiap perubahan pekerjaan harus dikonfirmasi ke NOC.',
    54,
    lowerY + 30,
    { width: pageW - 108, lineGap: 2 }
  );

  const signY = lowerY + 88;
  const signW = (pageW - 80 - 18 * 2) / 3;
  const s1 = 40;
  const s2 = s1 + signW + 18;
  const s3 = s2 + signW + 18;
  const boxH = 54;

  function signBox(x, title) {
    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(9).text(title, x + 10, signY);
    doc.save();
    doc.roundedRect(x, signY + 14, signW, boxH, 10).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
    doc.fillColor(palette.muted).font('Helvetica').fontSize(8).text('Nama / Tanggal / TTD', x + 10, signY + 14 + boxH - 14);
    doc.fillColor(palette.ink);
  }

  signBox(s1, 'Dibuat oleh (NOC)');
  signBox(s2, 'Diterima oleh (Teknisi)');
  signBox(s3, 'Disetujui (Supervisor)');

  const footerY = pageH - 26;
  doc.fillColor(palette.muted).font('Helvetica').fontSize(8).text('Generated by Sistem Mapping Jaringan', 40, footerY);
  doc.fillColor(palette.muted).font('Helvetica').fontSize(8).text(`No Dokumen: ${docNo} • Halaman 1/1`, 40, footerY, { width: pageW - 80, align: 'right' });

  return doc;
}

function buildTopologyPdf({ title = 'Topology Report', nodes = [], links = [] }) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const pageW = 595.28;

  doc.save();
  doc.rect(0, 0, pageW, 86).fill('#0B1220');
  doc.fillColor('#FFFFFF');
  doc.font('Helvetica-Bold').fontSize(17).text(title, 40, 24, { align: 'center' });
  doc.font('Helvetica').fontSize(10).text('Sistem Mapping Jaringan', 40, 52, { align: 'center' });
  doc.restore();

  doc.fillColor('#111827');
  doc.moveDown(3.5);
  doc.font('Helvetica-Bold').fontSize(11).text('Ringkasan', { continued: false });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).text(`Jumlah node: ${nodes.length}`);
  doc.font('Helvetica').fontSize(9).text(`Jumlah link: ${links.length}`);
  doc.moveDown(1);

  if (nodes.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).text('Daftar Node');
    doc.moveDown(0.5);
    nodes.forEach((node, index) => {
      const label = node.type_label || node.type || '-';
      const coord = Number.isFinite(node.latitude) && Number.isFinite(node.longitude) ? `${node.latitude}, ${node.longitude}` : '-';
      doc.font('Helvetica-Bold').fontSize(9).text(`${index + 1}. ${node.code} (${label})`, { continued: false });
      doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`    Nama: ${node.name || '-'} | Lokasi: ${coord}`);
      doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`    Alamat: ${node.address || '-'}${node.notes ? ` | Catatan: ${clipText(node.notes, 160)}` : ''}`);
      doc.fillColor('#111827');
      doc.moveDown(0.5);
    });
    doc.moveDown(0.5);
  }

  if (links.length > 0) {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).text('Daftar Link');
    doc.moveDown(0.5);
    links.forEach((link, index) => {
      const label = link.cable_type ? `${link.cable_type}` : '-';
      const core = link.core_count ? `core ${link.core_count}` : '-';
      doc.font('Helvetica-Bold').fontSize(9).text(`${index + 1}. ${link.source_code} -> ${link.target_code}`, { continued: false });
      doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`    Kabel: ${label} | ${core} ${link.core_number ? `(${link.core_number})` : ''}`);
      doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text(`    PON: ${link.pon_name || '-'} | ODC: ${link.odc_name || '-'} | Catatan: ${link.notes || '-'}`);
      doc.fillColor('#111827');
      doc.moveDown(0.5);
    });
  }

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text('Dokumen ini di-generate otomatis oleh Sistem Mapping.', 40, doc.y, {
    align: 'left'
  });

  return doc;
}

function buildSuratJalanPdfBuffer(opts) {
  return new Promise((resolve, reject) => {
    try {
      const doc = buildSuratJalanPdf(opts);
      const chunks = [];
      doc.on('data', (d) => chunks.push(d));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { buildSuratJalanPdf, buildSuratJalanPdfBuffer, buildTopologyPdf };
