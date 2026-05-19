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

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors';

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
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
          Data surat jalan tidak dipilih.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {incident ? (
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">{incident.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {incident.category === 'internet_mati' ? 'Internet Mati' : 'Kerusakan'} | {incident.node_code || '-'}
                </div>
                {incident.photo_path ? (
                  <a className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline" href={incident.photo_path} target="_blank" rel="noreferrer">
                    Lihat foto gangguan
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Tujuan</label>
                <input
                  className={inputClass}
                  value={form.tujuan}
                  onChange={(e) => setForm((f) => ({ ...f, tujuan: e.target.value }))}
                  placeholder={incident?.title || 'Contoh: Perbaikan ODP Gang Mawar'}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Keperluan</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.keperluan}
                  onChange={(e) => setForm((f) => ({ ...f, keperluan: e.target.value }))}
                  placeholder={incident?.work_order_notes || 'Contoh: pengecekan jalur, penarikan kabel, penggantian splitter...'}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Keterangan Kerusakan (opsional)</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.kerusakan}
                  onChange={(e) => setForm((f) => ({ ...f, kerusakan: e.target.value }))}
                  placeholder={incident?.description || 'Contoh: ODP rusak, pintu patah, konektor longgar...'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Teknisi (opsional)</label>
                  <input
                    className={inputClass}
                    value={form.teknisi}
                    onChange={(e) => setForm((f) => ({ ...f, teknisi: e.target.value }))}
                    placeholder={incident?.technician_name || 'Nama teknisi'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Kendaraan (opsional)</label>
                  <input
                    className={inputClass}
                    value={form.kendaraan}
                    onChange={(e) => setForm((f) => ({ ...f, kendaraan: e.target.value }))}
                    placeholder="Contoh: Motor / Mobil / No Polisi"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka Tab
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
                  href={`${src}${qs ? '&' : '?'}download=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">Preview</div>
            <div className="h-[60vh] min-h-[520px]">
              <iframe className="w-full h-full" title="Surat Jalan Preview" src={src} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
