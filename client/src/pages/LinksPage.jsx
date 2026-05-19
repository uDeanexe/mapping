import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import { apiDelete, apiGet, apiPostJson } from '../lib/api.js';

function LinksInner() {
  const toast = useToast();
  const [links, setLinks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    const [l, n] = await Promise.all([apiGet('/api/links'), apiGet('/api/nodes')]);
    setLinks(l);
    setNodes(n);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message || 'Gagal load data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return links;
    return links.filter((l) => {
      return (
        String(l.source_code || '').toLowerCase().includes(qq) ||
        String(l.target_code || '').toLowerCase().includes(qq) ||
        String(l.cable_type || '').toLowerCase().includes(qq) ||
        String(l.notes || '').toLowerCase().includes(qq)
      );
    });
  }, [links, q]);

  async function submit(values) {
    try {
      setSubmitting(true);
      await apiPostJson('/api/links', values);
      toast.success('Link dibuat');
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e.message || 'Gagal simpan link');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Data Link</div>
          <div className="muted">Hubungan source → target + informasi kabel/core.</div>
        </div>
        <div className="page-actions">
          <button className="button button-primary" onClick={() => setOpen(true)}>
            Tambah Link
          </button>
        </div>
      </div>

      {nodes.length < 2 ? (
        <div className="card">
          <div className="muted">Minimal butuh 2 node untuk membuat link.</div>
        </div>
      ) : null}

      <div className="toolbar">
        <input className="input" placeholder="Search source/target/cable/notes..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="button button-secondary"
          onClick={() => load().then(() => toast.success('Data diperbarui')).catch((e) => toast.error(e.message))}
        >
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Target</th>
                <th>Jenis Kabel</th>
                <th>Core</th>
                <th>Catatan</th>
                <th className="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Belum ada link.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id}>
                    <td data-label="Source" className="mono">{l.source_code}</td>
                    <td data-label="Target" className="mono">{l.target_code}</td>
                    <td data-label="Kabel">{l.cable_type || '-'}</td>
                    <td data-label="Core" className="mono">
                      {l.core_count ? `${l.core_count}` : '-'} {l.core_number ? `(${l.core_number})` : ''}
                    </td>
                    <td data-label="Catatan">{l.notes || '-'}</td>
                    <td data-label="Aksi" className="right">
                      <button
                        className="button button-danger"
                        onClick={async () => {
                          if (!confirm(`Hapus link ${l.source_code} -> ${l.target_code}?`)) return;
                          try {
                            await apiDelete(`/api/links/${l.id}`);
                            toast.success('Link dihapus');
                            await load();
                          } catch (e) {
                            toast.error(e.message || 'Gagal hapus');
                          }
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LinkFormModal
        open={open}
        onClose={() => {
          if (submitting) return;
          setOpen(false);
        }}
        nodes={nodes}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}

function LinkFormModal({ open, onClose, nodes, onSubmit, submitting }) {
  const [values, setValues] = useState(() => ({
    source_node_id: '',
    target_node_id: '',
    cable_type: '',
    core_count: '',
    core_number: '',
    pon_name: '',
    odc_name: '',
    notes: ''
  }));

  useEffect(() => {
    if (!open) return;
    setValues({
      source_node_id: '',
      target_node_id: '',
      cable_type: '',
      core_count: '',
      core_number: '',
      pon_name: '',
      odc_name: '',
      notes: ''
    });
  }, [open]);

  return (
    <Modal open={open} title="Tambah Link" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...values,
            source_node_id: Number(values.source_node_id),
            target_node_id: Number(values.target_node_id),
            core_count: values.core_count ? Number(values.core_count) : null
          });
        }}
      >
        {nodes.length < 2 ? (
          <div className="card">
            <div className="muted">Tambahkan minimal 2 node dulu di menu Data Node.</div>
          </div>
        ) : null}

        <div className="grid2">
          <div className="field">
            <label>Source Node</label>
            <select className="input" value={values.source_node_id} onChange={(e) => setValues((v) => ({ ...v, source_node_id: e.target.value }))} required>
              <option value="">Pilih node...</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} ({n.type})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Target Node</label>
            <select className="input" value={values.target_node_id} onChange={(e) => setValues((v) => ({ ...v, target_node_id: e.target.value }))} required>
              <option value="">Pilih node...</option>
              {nodes
                .filter((n) => !values.source_node_id || String(n.id) !== String(values.source_node_id))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.code} ({n.type})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="grid3">
          <div className="field">
            <label>Jenis Kabel</label>
            <input className="input" value={values.cable_type} onChange={(e) => setValues((v) => ({ ...v, cable_type: e.target.value }))} />
          </div>
          <div className="field">
            <label>Jumlah Core</label>
            <input className="input" value={values.core_count} onChange={(e) => setValues((v) => ({ ...v, core_count: e.target.value }))} />
          </div>
          <div className="field">
            <label>Nomor Core</label>
            <input className="input" value={values.core_number} onChange={(e) => setValues((v) => ({ ...v, core_number: e.target.value }))} />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label>Nama PON (opsional)</label>
            <input className="input" value={values.pon_name} onChange={(e) => setValues((v) => ({ ...v, pon_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Nama ODC (opsional)</label>
            <input className="input" value={values.odc_name} onChange={(e) => setValues((v) => ({ ...v, odc_name: e.target.value }))} />
          </div>
        </div>

        <div className="field">
          <label>Catatan</label>
          <textarea className="input" rows={3} value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} />
        </div>

        <div className="form-actions">
          <button className="button button-primary" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button type="button" className="button button-ghost" onClick={onClose} disabled={submitting}>
            Batal
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function LinksPage() {
  return (
    <ToastProvider>
      <LinksInner />
    </ToastProvider>
  );
}
