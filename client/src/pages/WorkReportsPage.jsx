import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPostForm } from '../lib/api.js';
import { ToastProvider, useToast } from '../components/Toast.jsx';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors';

function WorkReportsInner() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [q, setQ] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const params = new URLSearchParams(window.location.search);

  const [form, setForm] = useState(() => ({
    incident_id: params.get('incident_id') || '',
    node_id: '',
    technician_name: '',
    report_title: '',
    description: '',
    photo: null
  }));

  async function load() {
    const [r, i, n] = await Promise.all([apiGet('/api/work-reports'), apiGet('/api/incidents'), apiGet('/api/nodes')]);
    setReports(r);
    setIncidents(i);
    setNodes(n);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message || 'Gagal load data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.incident_id) return;
    const incident = incidents.find((it) => String(it.id) === String(form.incident_id));
    if (!incident) return;
    setForm((cur) => ({
      ...cur,
      node_id: cur.node_id || incident.node_id || '',
      technician_name: cur.technician_name || incident.technician_name || '',
      report_title: cur.report_title || `Pekerjaan selesai - ${incident.title}`
    }));
  }, [incidents, form.incident_id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((r) => {
      return (
        String(r.report_title || '').toLowerCase().includes(needle) ||
        String(r.description || '').toLowerCase().includes(needle) ||
        String(r.technician_name || '').toLowerCase().includes(needle) ||
        String(r.node_code || '').toLowerCase().includes(needle) ||
        String(r.incident_title || '').toLowerCase().includes(needle)
      );
    });
  }, [reports, q]);

  async function submit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        fd.append(key, value);
      });
      await apiPostForm('/api/work-reports', fd);
      toast.success('Rekam kerja disimpan');
      setForm({
        incident_id: '',
        node_id: '',
        technician_name: '',
        report_title: '',
        description: '',
        photo: null
      });
      await load();
    } catch (err) {
      toast.error(err.message || 'Gagal simpan rekam kerja');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">Rekam Kerja</h2>
          <p className="mt-1 text-sm text-slate-500">Laporan penyelesaian teknisi dengan bukti foto dan keterangan pekerjaan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            href="/gangguan"
          >
            Kembali ke Gangguan
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <form className="rounded-xl bg-white shadow-sm border border-slate-200 p-6 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Gangguan Terkait</label>
              <select className={inputClass} value={form.incident_id} onChange={(e) => setForm((f) => ({ ...f, incident_id: e.target.value }))}>
                <option value="">Tidak ada</option>
                {incidents.map((it) => (
                  <option key={it.id} value={it.id}>
                    #{it.id} - {it.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Node</label>
              <select className={inputClass} value={form.node_id} onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value }))}>
                <option value="">Tidak ada</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.code} ({n.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Nama Teknisi</label>
              <input className={inputClass} value={form.technician_name} onChange={(e) => setForm((f) => ({ ...f, technician_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Foto Bukti</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-[7px] text-sm text-slate-900 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 transition-colors"
                type="file"
                accept="image/*"
                onChange={(e) => setForm((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Judul Laporan</label>
            <input className={inputClass} value={form.report_title} onChange={(e) => setForm((f) => ({ ...f, report_title: e.target.value }))} required />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Keterangan Pekerjaan</label>
            <textarea
              className={inputClass}
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Contoh: Perbaikan selesai, konektor diganti, redaman normal, layanan user sudah aktif kembali."
              required
            />
          </div>

          <div className="pt-2">
            <button
              className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : 'Simpan Rekam Kerja'}
            </button>
          </div>
        </form>

        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              className={inputClass}
              placeholder="Search laporan/node/teknisi..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
              onClick={() => load().then(() => toast.success('Data diperbarui')).catch((e) => toast.error(e.message))}
              type="button"
            >
              Refresh
            </button>
          </div>

          <div className="p-4">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500">Belum ada rekam kerja.</div>
            ) : (
              <div className="space-y-4">
                {filtered.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-200 hover:shadow-sm transition">
                    <div className="flex gap-4">
                      {r.photo_path ? (
                        <img className="h-20 w-24 rounded-lg border border-slate-200 object-cover" src={r.photo_path} alt={r.report_title} />
                      ) : (
                        <div className="h-20 w-24 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{r.report_title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {r.technician_name || '-'} | {r.node_code || '-'} | {r.incident_title || 'Tanpa gangguan'}
                        </div>
                        <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{r.description}</div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {r.photo_path ? (
                            <a
                              className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors"
                              href={r.photo_path}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Lihat Foto
                            </a>
                          ) : null}
                          <button
                            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
                            onClick={async () => {
                              if (!confirm(`Hapus rekam kerja: ${r.report_title}?`)) return;
                              try {
                                await apiDelete(`/api/work-reports/${r.id}`);
                                toast.success('Rekam kerja dihapus');
                                await load();
                              } catch (err) {
                                toast.error(err.message || 'Gagal hapus');
                              }
                            }}
                            type="button"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkReportsPage() {
  return (
    <ToastProvider>
      <WorkReportsInner />
    </ToastProvider>
  );
}
