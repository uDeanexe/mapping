import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';

function buildQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = (v ?? '').toString().trim();
    if (!s) continue;
    q.set(k, s);
  }
  return q.toString();
}

export default function SuratJalanModal({ open, onClose, node, incident }) {
  const [form, setForm] = useState(() => ({
    tujuan: '',
    keperluan: '',
    kerusakan: '',
    teknisi: '',
    kendaraan: ''
  }));

  const qs = useMemo(() => buildQuery(form), [form]);
  const base = incident?.id
    ? `/api/incidents/${incident.id}/surat-jalan.pdf`
    : node?.id
      ? `/api/nodes/${node.id}/surat-jalan.pdf`
      : '';
  const src = qs ? `${base}?${qs}` : base;
  const title = incident
    ? `Surat Jalan Gangguan #${incident.id}`
    : node
      ? `Surat Jalan: ${node.code}`
      : 'Surat Jalan';

  return (
    <Modal open={open} onClose={onClose} title={title} width={1100}>
      {!base ? (
        <div className="card">Data surat jalan tidak dipilih.</div>
      ) : (
        <div className="sj-layout">
          <div className="sj-form card">
            {incident ? (
              <div className="card">
                <div className="report-title">{incident.title}</div>
                <div className="muted">
                  {incident.category === 'internet_mati' ? 'Internet Mati' : 'Kerusakan'} | {incident.node_code || '-'}
                </div>
                {incident.photo_path ? (
                  <a className="link" href={incident.photo_path} target="_blank" rel="noreferrer">
                    Lihat foto gangguan
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="field">
              <label>Tujuan</label>
              <input className="input" value={form.tujuan} onChange={(e) => setForm((f) => ({ ...f, tujuan: e.target.value }))} placeholder={incident?.title || 'Contoh: Perbaikan ODP Gang Mawar'} />
            </div>
            <div className="field">
              <label>Keperluan</label>
              <textarea className="input" rows={3} value={form.keperluan} onChange={(e) => setForm((f) => ({ ...f, keperluan: e.target.value }))} placeholder={incident?.work_order_notes || 'Contoh: pengecekan jalur, penarikan kabel, penggantian splitter...'} />
            </div>
            <div className="field">
              <label>Keterangan Kerusakan (opsional)</label>
              <textarea className="input" rows={3} value={form.kerusakan} onChange={(e) => setForm((f) => ({ ...f, kerusakan: e.target.value }))} placeholder={incident?.description || 'Contoh: ODP rusak, pintu patah, konektor longgar...'} />
            </div>
            <div className="grid2">
              <div className="field">
                <label>Teknisi (opsional)</label>
                <input className="input" value={form.teknisi} onChange={(e) => setForm((f) => ({ ...f, teknisi: e.target.value }))} placeholder={incident?.technician_name || 'Nama teknisi'} />
              </div>
              <div className="field">
                <label>Kendaraan (opsional)</label>
                <input className="input" value={form.kendaraan} onChange={(e) => setForm((f) => ({ ...f, kendaraan: e.target.value }))} placeholder="Contoh: Motor / Mobil / No Polisi" />
              </div>
            </div>

            <div className="form-actions">
              <a className="button button-secondary" href={src} target="_blank" rel="noreferrer">
                Buka Tab
              </a>
              <a className="button button-primary" href={`${src}${qs ? '&' : '?'}download=1`} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            </div>
          </div>

          <div className="sj-preview card">
            <div className="sj-preview-title">Preview</div>
            <iframe className="sj-iframe" title="Surat Jalan Preview" src={src} />
          </div>
        </div>
      )}
    </Modal>
  );
}
