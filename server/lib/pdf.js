const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

function mmToPt(mm) {
  return (Number(mm) || 0) * 2.834645669291339; // 72 / 25.4
}

function escapeText(value) {
  if (value === undefined || value === null) return '-';
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s ? s : '-';
}

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
    navy: '#0B1220',
    ink: '#0F172A',
    muted: '#475569',
    border: '#CBD5E1',
    soft: '#F8FAFC',
    accent: '#1D4ED8'
  };

  const companyName = 'PT. JASA ONLINE NUSANTARA ';

  const docNo = String(extras.doc_no || `SJ-${String(node.id).padStart(6, '0')}`);
  const ticketNo = String(extras.ticket_no || '-');
  const createdText = formatDateId(createdAt);
  const statusText = 'Dokumen Resmi NOC';

  const lat = Number.isFinite(Number(node.latitude)) ? Number(node.latitude).toFixed(6) : null;
  const lng = Number.isFinite(Number(node.longitude)) ? Number(node.longitude).toFixed(6) : null;
  const gps = lat && lng ? `${lat}, ${lng}` : '-';
  const maps = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : '-';
  const mapsQrPng = extras.maps_qr_png || null;

  const locationName = clipText(node.name || node.code || '-', 80);
  const addressFull = String(node.address || '-').trim();

  const nocAdmin = clipText(extras.noc_admin || '-', 80);
  const damage = String(extras.kerusakan || extras.damage || '-').trim();
  const instruction = String(extras.keperluan || extras.purpose || '-').trim();

  function hline(y) {
    doc.save();
    doc.moveTo(40, y).lineTo(pageW - 40, y).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
  }

  function box(x, y, w, h, title) {
    doc.save();
    doc.roundedRect(x, y, w, h, 12).fill('#FFFFFF');
    doc.roundedRect(x, y, w, h, 12).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
    if (title) {
      doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(10).text(title, x + 14, y + 12);
    }
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

  function kv(x, y, label, value, w) {
    doc.fillColor(palette.muted).font('Helvetica-Bold').fontSize(8).text(label, x, y);
    doc.fillColor(palette.ink).font('Helvetica').fontSize(10);
    const v = fitText(value, w, 9999);
    doc.text(v, x, y + 12, { width: w, lineGap: 2 });
    doc.fillColor(palette.ink);
  }

  function kvFit(x, y, label, value, w, maxHeight, opts = {}) {
    doc.fillColor(palette.muted).font('Helvetica-Bold').fontSize(8).text(label, x, y);
    doc.fillColor(palette.ink).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size ?? 10);
    const v = fitText(value, w, maxHeight, { lineGap: opts.lineGap ?? 2 });
    doc.text(v, x, y + 12, { width: w, lineGap: opts.lineGap ?? 2 });
    doc.fillColor(palette.ink);
  }

  function normalizeAddress(value) {
    const s = String(value || '').replace(/\r?\n+/g, ', ').replace(/\s+/g, ' ').trim();
    return s || '-';
  }

  // HEADER (A)
  doc.save();
  doc.rect(0, 0, pageW, 96).fill(palette.navy);
  doc.fillColor('#FFFFFF');
  doc.font('Helvetica-Bold').fontSize(14).text(companyName, 40, 20);
  doc.font('Helvetica-Bold').fontSize(16).text('SURAT JALAN / WORK ORDER LAPANGAN', 40, 44);
  doc.font('Helvetica').fontSize(9).fillColor('#CBD5E1').text(statusText, 40, 70);

  doc.fillColor('#FFFFFF');
  doc.font('Helvetica').fontSize(9).text(`Nomor Dokumen: ${docNo}`, pageW - 260, 22, { width: 220, align: 'right' });
  doc.font('Helvetica').fontSize(9).text(`Nomor Tiket: ${ticketNo}`, pageW - 260, 38, { width: 220, align: 'right' });
  doc.font('Helvetica').fontSize(9).text(`Waktu: ${createdText}`, pageW - 260, 54, { width: 220, align: 'right' });
  doc.restore();

  // BODY LAYOUT (tighter vertical spacing for 1-page fit)
  const bodyTop = 104;
  const contentW = pageW - 80;

  // Section B: Location
  const boxB = { x: 40, y: bodyTop, w: contentW, h: 130 };
  box(boxB.x, boxB.y, boxB.w, boxB.h, 'B. INFORMASI LOKASI PERBAIKAN');

  const col1W = 250;
  kvFit(boxB.x + 14, boxB.y + 36, 'Nama Lokasi/Node', locationName, col1W, 16, { bold: true });
  kvFit(boxB.x + 14, boxB.y + 74, 'Koordinat GPS', gps, col1W, 16, { size: 10, lineGap: 1 });

  // Link Maps -> QR Code (scan di lapangan). URL tidak ditampilkan (lebih clean).
  const rightX = boxB.x + 280;
  const rightW = boxB.w - 294;
  doc.fillColor(palette.muted).font('Helvetica-Bold').fontSize(8).text('Link Maps (QR Code)', rightX, boxB.y + 36);
  if (mapsQrPng && Buffer.isBuffer(mapsQrPng) && gps !== '-') {
    const qrSize = 62;
    const qrX = rightX + rightW - qrSize;
    const qrY = boxB.y + 52;
    doc.image(mapsQrPng, qrX, qrY, { width: qrSize, height: qrSize });

    const textW = rightW - qrSize - 10;
    doc.fillColor(palette.muted).font('Helvetica').fontSize(8).text('Scan untuk buka Maps', rightX, qrY + 0, {
      width: rightW - qrSize - 10,
      lineGap: 1
    });
    doc.fillColor(palette.ink).font('Helvetica').fontSize(9).text(gps, rightX, qrY + 14, {
      width: textW,
      lineGap: 1
    });

    // Alamat diposisikan di kiri QR (tidak overlap)
    kvFit(rightX, boxB.y + 74, 'Alamat Lengkap', normalizeAddress(addressFull), textW, 48, { size: 9 });
  } else {
    doc.fillColor(palette.ink).font('Helvetica').fontSize(9).text('-', rightX, boxB.y + 56, {
      width: rightW,
      lineGap: 1
    });
  }
  if (!(mapsQrPng && Buffer.isBuffer(mapsQrPng) && gps !== '-')) {
    kvFit(rightX, boxB.y + 74, 'Alamat Lengkap', normalizeAddress(addressFull), rightW, 48, { size: 9 });
  }

  // Section C: Task/Instruction
  const boxC = { x: 40, y: boxB.y + boxB.h + 10, w: contentW, h: 172 };
  box(boxC.x, boxC.y, boxC.w, boxC.h, 'C. DETAIL TUGAS & INSTRUKSI PEKERJAAN (NOC KE TEKNISI)');
  kvFit(boxC.x + 14, boxC.y + 36, 'Admin NOC Pengirim', nocAdmin, 250, 16, { bold: true });
  kvFit(boxC.x + 14, boxC.y + 74, 'Jenis Kerusakan', damage, boxC.w - 28, 34, { size: 10 });
  kvFit(boxC.x + 14, boxC.y + 112, 'Instruksi Tugas', instruction, boxC.w - 28, 54, { size: 10 });

  // Section D + Personil (two columns)
  const boxD = { x: 40, y: boxC.y + boxC.h + 10, w: (contentW - 12) / 2, h: 146 };
  const boxP = { x: boxD.x + boxD.w + 12, y: boxD.y, w: boxD.w, h: boxD.h };
  box(boxD.x, boxD.y, boxD.w, boxD.h, 'D. CHECKLIST SOP LAPANGAN');
  box(boxP.x, boxP.y, boxP.w, boxP.h, 'PERSONIL & KENDARAAN');

  // Checklist
  doc.fillColor(palette.ink).font('Helvetica').fontSize(9);
  const cX = boxD.x + 14;
  let cY = boxD.y + 36;
  function checkbox(text, opts = {}) {
    doc.save();
    doc.rect(cX, cY + 2, 11, 11).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
    doc.text(text, cX + 18, cY - 1, { width: boxD.w - 34, lineGap: 1 });
    cY += opts.step ?? 18;
  }
  checkbox('Penggantian Patchcord / Dropcore');
  checkbox('Pengukuran Redaman / LOSS', { step: 16 });
  checkbox('Nilai dBm:  ________', { step: 18 });
  checkbox('Dokumentasi Foto (Before & After)');
  checkbox('Update Status & Laporan ke NOC');

  // Personil placeholders
  doc.fillColor(palette.muted).font('Helvetica-Bold').fontSize(8);
  const pX = boxP.x + 14;
  let pY = boxP.y + 36;
  function lineField(labelText) {
    doc.text(labelText, pX, pY);
    doc.save();
    doc.moveTo(pX, pY + 18).lineTo(boxP.x + boxP.w - 14, pY + 18).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
    pY += 32;
  }
  lineField('Nama Teknisi Lapangan:');
  lineField('Kontak / No. HP:');
  lineField('Kendaraan / No. Polisi:');

  // Footer legal + signatures
  const footerTop = boxD.y + boxD.h + 10;
  const footerH = pageH - 28 - footerTop - 18;
  box(40, footerTop, contentW, footerH, 'LEGALITAS & TANDA TANGAN');
  const legalText =
    'Dokumen ini adalah perintah kerja resmi dari NOC untuk pelaksanaan pekerjaan lapangan. Berlaku untuk 1 (satu) tiket pekerjaan dan wajib dibawa saat eksekusi. Setiap perubahan pekerjaan di lapangan harus dikonfirmasi dan disetujui oleh NOC.';
  doc.fillColor(palette.ink).font('Helvetica').fontSize(9).text(legalText, 54, footerTop + 36, {
    width: contentW - 28,
    lineGap: 2
  });

  const signY = footerTop + footerH - 78;
  const signW = (contentW - 18 * 2) / 3;
  const s1 = 40;
  const s2 = s1 + signW + 18;
  const s3 = s2 + signW + 18;

  function signBox(x, title) {
    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(9).text(title, x + 10, signY);
    doc.save();
    doc.roundedRect(x, signY + 14, signW, 52, 10).lineWidth(1).strokeColor(palette.border).stroke();
    doc.restore();
    doc.fillColor(palette.muted).font('Helvetica').fontSize(8).text('Nama Jelas / Tanggal / Tanda Tangan', x + 10, signY + 14 + 52 - 14);
  }

  signBox(s1, 'Dibuat Oleh (NOC)');
  signBox(s2, 'Diterima Oleh (Teknisi)');
  signBox(s3, 'Disetujui Oleh (Supervisor)');

  // Watermark / system footer (bottom-most, small muted text)
  const bottomLimit = pageH - (doc.page.margins?.bottom || 0);
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5).text(
    'Generated by Sistem Mapping Jaringan JONUSA',
    40,
    bottomLimit - 10
  );

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
  return new Promise(async (resolve, reject) => {
    try {
      const next = { ...(opts || {}), extras: { ...((opts || {}).extras || {}) } };
      const node = next.node || {};
      const lat = Number.isFinite(Number(node.latitude)) ? Number(node.latitude).toFixed(6) : null;
      const lng = Number.isFinite(Number(node.longitude)) ? Number(node.longitude).toFixed(6) : null;
      const maps = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;

      if (maps && !next.extras.maps_qr_png) {
        next.extras.maps_qr_png = await QRCode.toBuffer(maps, {
          type: 'png',
          errorCorrectionLevel: 'M',
          margin: 1,
          scale: 4,
          color: { dark: '#0B1220', light: '#FFFFFF' }
        });
      }

      const doc = buildSuratJalanPdf(next);
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

function buildLinkLabelsPdf(
  {
    title = 'Label Link',
    links = [],
    publicBaseUrl = '',
    layout = {
      cols: 3,
      rows: 8,
      marginXmm: 6,
      marginYmm: 10,
      gapXmm: 3,
      gapYmm: 3,
      cutMarks: true,
      cutMarkLenMm: 4,
      cutMarkInsetMm: 1.2
    }
  } = {}
) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  const pageW = 595.28;
  const pageH = 841.89;

  const palette = {
    ink: '#0F172A',
    muted: '#475569',
    border: '#CBD5E1',
    soft: '#F8FAFC'
  };

  const cols = Math.max(1, Math.floor(Number(layout?.cols || 3)));
  const rows = Math.max(1, Math.floor(Number(layout?.rows || 8)));
  const marginX = mmToPt(layout?.marginXmm ?? 6);
  const marginY = mmToPt(layout?.marginYmm ?? 10);
  const gapX = mmToPt(layout?.gapXmm ?? 3);
  const gapY = mmToPt(layout?.gapYmm ?? 3);
  const cutMarks = Boolean(layout?.cutMarks ?? true);
  const cutMarkLen = mmToPt(layout?.cutMarkLenMm ?? 4);
  const cutMarkInset = mmToPt(layout?.cutMarkInsetMm ?? 1.2);

  const labelW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
  const labelH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;

  const qrSize = Math.min(mmToPt(18), labelH - mmToPt(10));

  function drawCutMarks(x, y) {
    if (!cutMarks) return;
    const x0 = x + cutMarkInset;
    const y0 = y + cutMarkInset;
    const x1 = x + labelW - cutMarkInset;
    const y1 = y + labelH - cutMarkInset;

    doc.save();
    doc.lineWidth(0.6).strokeColor('#9CA3AF');

    // top-left
    doc.moveTo(x0, y0 + cutMarkLen).lineTo(x0, y0).lineTo(x0 + cutMarkLen, y0).stroke();
    // top-right
    doc.moveTo(x1 - cutMarkLen, y0).lineTo(x1, y0).lineTo(x1, y0 + cutMarkLen).stroke();
    // bottom-left
    doc.moveTo(x0, y1 - cutMarkLen).lineTo(x0, y1).lineTo(x0 + cutMarkLen, y1).stroke();
    // bottom-right
    doc.moveTo(x1 - cutMarkLen, y1).lineTo(x1, y1).lineTo(x1, y1 - cutMarkLen).stroke();

    doc.restore();
  }

  function drawLabel(x, y, link) {
    doc.save();
    doc.roundedRect(x, y, labelW, labelH, 8).fill('#FFFFFF');
    doc.roundedRect(x, y, labelW, labelH, 8).lineWidth(1).strokeColor(palette.border).stroke();
    drawCutMarks(x, y);

    // Subtle header strip
    doc.save();
    doc.roundedRect(x, y, labelW, mmToPt(6), 8).fill(palette.soft);
    doc.restore();

    const pad = mmToPt(2.5);
    const rightPad = pad;
    const leftX = x + pad;
    const topY = y + pad;

    const qrX = x + labelW - rightPad - qrSize;
    const qrY = y + (labelH - qrSize) / 2;

    // Text area
    const textW = Math.max(10, qrX - leftX - mmToPt(2));

    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(9);
    doc.text(`${escapeText(link.source_code)} \u2192 ${escapeText(link.target_code)}`, leftX, topY + mmToPt(1), {
      width: textW,
      lineGap: 1
    });

    doc.fillColor(palette.muted).font('Helvetica').fontSize(7.5);
    const cable = escapeText(link.cable_type);
    const coreCount = escapeText(link.core_count);
    const coreNo = escapeText(link.core_number);
    doc.text(`Kabel: ${cable} | Core: ${coreCount} | No: ${coreNo}`, leftX, topY + mmToPt(6.5), {
      width: textW,
      lineGap: 1
    });

    const pon = escapeText(link.pon_name);
    const odc = escapeText(link.odc_name);
    doc.text(`PON: ${pon} | ODC: ${odc}`, leftX, topY + mmToPt(11), { width: textW, lineGap: 1 });

    const notes = escapeText(link.notes);
    doc.text(`Ket: ${notes}`, leftX, topY + mmToPt(15), { width: textW, height: mmToPt(10), lineGap: 1 });

    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(7.5);
    doc.text(`LINK#${escapeText(link.id)}`, leftX, y + labelH - pad - mmToPt(4.5), {
      width: textW,
      lineGap: 1
    });

    if (link._qr_png && Buffer.isBuffer(link._qr_png)) {
      doc.image(link._qr_png, qrX, qrY, { width: qrSize, height: qrSize });
    } else {
      doc.save();
      doc.rect(qrX, qrY, qrSize, qrSize).lineWidth(1).strokeColor(palette.border).stroke();
      doc.restore();
      doc.fillColor(palette.muted).font('Helvetica').fontSize(6.5).text('QR', qrX, qrY + qrSize / 2 - 4, {
        width: qrSize,
        align: 'center'
      });
    }

    doc.restore();
  }

  // Title (hidden margin area - for debug/metadata)
  doc.info.Title = String(title || 'Label Link');

  let i = 0;
  for (const link of links || []) {
    const pageIndex = Math.floor(i / (cols * rows));
    const indexInPage = i % (cols * rows);
    if (i > 0 && indexInPage === 0) doc.addPage();

    const col = indexInPage % cols;
    const row = Math.floor(indexInPage / cols);
    const x = marginX + col * (labelW + gapX);
    const y = marginY + row * (labelH + gapY);
    drawLabel(x, y, link);
    i += 1;
  }

  // If empty, still render a single helpful page
  if (!links || links.length === 0) {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(palette.ink).text('Tidak ada data link untuk dibuat label.', 40, 60);
    doc.font('Helvetica').fontSize(10).fillColor(palette.muted).text(
      `Pastikan data link sudah ada. Endpoint label: /api/links/labels.pdf (opsional ?ids=1,2,3).`,
      40,
      86,
      { width: pageW - 80 }
    );
    if (publicBaseUrl) {
      doc.moveDown(0.5);
      doc.text(`Scan URL base: ${publicBaseUrl}`, 40, doc.y, { width: pageW - 80 });
    }
  }

  return doc;
}

function buildLinkLabelsPdfBuffer(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const links = Array.isArray(opts?.links) ? opts.links : [];
      const publicBaseUrl = String(opts?.publicBaseUrl || '').replace(/\/+$/g, '');
      const layout = opts?.layout || undefined;

      // Pre-generate QR PNGs (sequential: predictable memory)
      for (const link of links) {
        const id = link?.id;
        if (!id || !publicBaseUrl) continue;
        const url = `${publicBaseUrl}/scan/link/${encodeURIComponent(String(id))}`;
        // eslint-disable-next-line no-await-in-loop
        link._qr_png = await QRCode.toBuffer(url, {
          type: 'png',
          errorCorrectionLevel: 'M',
          margin: 1,
          scale: 4,
          color: { dark: '#0B1220', light: '#FFFFFF' }
        });
      }

      const doc = buildLinkLabelsPdf({ title: opts?.title, links, publicBaseUrl, layout });
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

module.exports = {
  buildSuratJalanPdf,
  buildSuratJalanPdfBuffer,
  buildTopologyPdf,
  buildLinkLabelsPdf,
  buildLinkLabelsPdfBuffer
};
