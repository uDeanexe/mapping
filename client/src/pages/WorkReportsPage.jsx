import React, { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPostForm } from '../lib/api.js';
import { ToastProvider, useToast } from '../components/Toast.jsx';

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
    const [r, i, n] = await Promise.all([
      apiGet('/api/work-reports'),
      apiGet('/api/incidents'),
      apiGet('/api/nodes')
    ]);
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
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Rekam Kerja</div>
          <div className="muted">Laporan penyelesaian teknisi dengan bukti foto dan keterangan pekerjaan.</div>
        </div>
      </div>

      <div className="mobile-quick-actions">
        <a className="button button-secondary" href="/gangguan">Kembali ke Gangguan</a>
      </div>

      <div className="work-layout">
        <form className="card form" onSubmit={submit}>
          <div className="grid2">
            <div className="field">
              <label>Gangguan Terkait</label>
              <select
                className="input"
                value={form.incident_id}
                onChange={(e) => setForm((f) => ({ ...f, incident_id: e.target.value }))}
              >
                <option value="">Tidak ada</option>
                {incidents.map((it) => (
                  <option key={it.id} value={it.id}>
                    #{it.id} - {it.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Node</label>
              <select
                className="input"
                value={form.node_id}
                onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value }))}
              >
                <option value="">Tidak ada</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.code} ({n.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label>Nama Teknisi</label>
              <input
                className="input"
                value={form.technician_name}
                onChange={(e) => setForm((f) => ({ ...f, technician_name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Foto Bukti</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setForm((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
              />
            </div>
          </div>

          <div className="field">
            <label>Judul Laporan</label>
            <input
              className="input"
              value={form.report_title}
              onChange={(e) => setForm((f) => ({ ...f, report_title: e.target.value }))}
              required
            />
          </div>

          <div className="field">
            <label>Keterangan Pekerjaan</label>
            <textarea
              className="input"
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Contoh: Perbaikan selesai, konektor diganti, redaman normal, layanan user sudah aktif kembali."
              required
            />
          </div>

          <div className="form-actions">
            <button className="button button-primary" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Rekam Kerja'}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="toolbar compact-toolbar">
            <input
              className="input"
              placeholder="Search laporan/node/teknisi..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="button button-secondary"
              onClick={() => load().then(() => toast.success('Data diperbarui')).catch((e) => toast.error(e.message))}
            >
              Refresh
            </button>
          </div>

          <div className="report-list">
            {filtered.length === 0 ? (
              <div className="muted">Belum ada rekam kerja.</div>
            ) : (
              filtered.map((r) => (
                <div className="report-item" key={r.id}>
                  {r.photo_path ? <img className="report-photo" src={r.photo_path} alt={r.report_title} /> : null}
                  <div className="report-body">
                    <div className="report-title">{r.report_title}</div>
                    <div className="muted">
                      {r.technician_name || '-'} | {r.node_code || '-'} | {r.incident_title || 'Tanpa gangguan'}
                    </div>
                    <div className="report-desc">{r.description}</div>
                    <div className="report-actions">
                      {r.photo_path ? (
                        <a className="button button-ghost" href={r.photo_path} target="_blank" rel="noreferrer">
                          Lihat Foto
                        </a>
                      ) : null}
                      <button
                        className="button button-danger"
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
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))
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
