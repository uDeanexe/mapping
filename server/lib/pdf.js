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
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const title = 'SURAT JALAN / WORK ORDER LAPANGAN';
  const metaLeftX = 52;
  const metaRightX = 340;
  const pageW = 595.28;

  // Header band
  doc.save();
  doc.rect(0, 0, pageW, 86).fill('#0B1220');
  doc.fillColor('#FFFFFF');
  doc.font('Helvetica-Bold').fontSize(17).text(title, 40, 24, { align: 'center' });
  doc.font('Helvetica').fontSize(10).text('Sistem Mapping Jaringan', 40, 52, { align: 'center' });
  doc.restore();

  doc.fillColor('#111827');
  doc.moveDown(4.2);

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`Tanggal: ${formatDateId(createdAt)}`, metaLeftX, doc.y, { continued: false });

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`No Dokumen: SJ-${String(node.id).padStart(6, '0')}`, metaRightX, doc.y - 10, {
      continued: false
    });

  doc.moveDown(0.8);

  // Cards layout
  const cardY = doc.y;
  const cardH = 220;
  const leftX = 40;
  const rightX = 315;
  const cardW = 240;

  function card(x, y, w, h, titleText) {
    doc.save();
    doc.roundedRect(x, y, w, h, 12).fill('#FFFFFF');
    doc.roundedRect(x, y, w, h, 12).lineWidth(1).stroke('#E5E7EB');
    doc.fillColor('#111827');
    doc.font('Helvetica-Bold').fontSize(11).text(titleText, x + 14, y + 12);
    doc.restore();
  }

  card(leftX, cardY, cardW, cardH, 'Detail Lokasi / Node');
  card(rightX, cardY, cardW, cardH, 'Tujuan / Pekerjaan');

  // Node detail text
  const rows = [
    ['Kode', node.code || '-'],
    ['Nama', node.name || '-'],
    ['Jenis', node.type_label || node.type || '-'],
    [
      'Koordinat',
      Number.isFinite(node.latitude) && Number.isFinite(node.longitude)
        ? `${node.latitude}, ${node.longitude}`
        : '-'
    ],
    ['Alamat', node.address || '-']
  ];

  const nodeNotes = clipText(node.notes || '-', 380);

  let y = cardY + 38;
  doc.font('Helvetica').fontSize(9);
  for (const [k, v] of rows) {
    doc
      .fillColor('#6B7280')
      .font('Helvetica-Bold')
      .text(`${k}`, leftX + 14, y, { width: 70 })
      .fillColor('#111827')
      .font('Helvetica')
      .text(String(v), leftX + 86, y, { width: cardW - 100 });
    y += 18;
  }
  doc
    .fillColor('#6B7280')
    .font('Helvetica-Bold')
    .text('Catatan', leftX + 14, y, { width: 70 })
    .fillColor('#111827')
    .font('Helvetica')
    .text(nodeNotes, leftX + 86, y, { width: cardW - 100 });

  // Optional photo thumbnail
  const photoAbs = uploadDirAbs ? tryResolveUploadPath(extras.photo_path || node.photo_path, uploadDirAbs) : null;
  if (photoAbs) {
    const imgBoxX = leftX + 14;
    const imgBoxY = cardY + cardH - 86;
    const imgBoxW = 90;
    const imgBoxH = 62;
    doc.save();
    doc.roundedRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH, 10).lineWidth(1).stroke('#E5E7EB');
    try {
      doc.image(photoAbs, imgBoxX + 1, imgBoxY + 1, { fit: [imgBoxW - 2, imgBoxH - 2], align: 'center', valign: 'center' });
    } catch (_) {}
    doc.restore();
  }

  // Work order details
  const tujuan = clipText(extras.tujuan || extras.destination || '-', 300);
  const keperluan = clipText(extras.keperluan || extras.purpose || '-', 400);
  const kerusakan = clipText(extras.kerusakan || extras.damage || '-', 500);
  const teknisi = clipText(extras.teknisi || extras.technician || '-', 140);
  const kendaraan = clipText(extras.kendaraan || extras.vehicle || '-', 140);
  const mapsLink =
    Number.isFinite(node.latitude) && Number.isFinite(node.longitude)
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${node.latitude},${node.longitude}`)}`
      : '-';

  const workRows = [
    ['Tujuan', tujuan],
    ['Keperluan', keperluan],
    ['Kerusakan', kerusakan],
    ['Admin NOC', clipText(extras.noc_admin || '-', 140)],
    ['Teknisi', teknisi],
    ['Kendaraan', kendaraan],
    ['Google Maps', mapsLink]
  ];

  let wy = cardY + 38;
  doc.font('Helvetica').fontSize(9);
  for (const [k, v] of workRows) {
    doc
      .fillColor('#6B7280')
      .font('Helvetica-Bold')
      .text(`${k}`, rightX + 14, wy, { width: 78 })
      .fillColor('#111827')
      .font('Helvetica')
      .text(String(v), rightX + 96, wy, { width: cardW - 110 });
    wy += k === 'Kerusakan' ? 34 : 18;
  }

  doc.y = cardY + cardH + 20;
  doc.font('Helvetica-Bold').fontSize(12).text('Tanda Tangan', 40, doc.y);
  doc.moveDown(0.8);

  const startY = doc.y;
  const colW = 160;
  const gap = 18;
  const x1 = 40;
  const x2 = x1 + colW + gap;
  const x3 = x2 + colW + gap;

  function signatureBox(x, label) {
    doc.font('Helvetica').fontSize(10).text(label, x, startY);
    doc
      .rect(x, startY + 18, colW, 80)
      .lineWidth(1)
      .strokeColor('#D1D5DB')
      .stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280').text('Nama / Tanggal', x + 10, startY + 90);
    doc.fillColor('#111827');
  }

  signatureBox(x1, 'Dibuat oleh (Admin)');
  signatureBox(x2, 'Diterima oleh (Teknisi)');
  signatureBox(x3, 'Disetujui oleh (Supervisor)');

  doc.moveDown(10);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#6B7280')
    .text('Dokumen ini di-generate otomatis oleh Sistem Mapping.', 40, 800, { align: 'left' });

  doc.fillColor('#111827');
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

module.exports = { buildSuratJalanPdf, buildSuratJalanPdfBuffer };
