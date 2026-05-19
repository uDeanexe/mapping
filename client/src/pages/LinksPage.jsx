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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">Data Link</h2>
          <p className="mt-1 text-sm text-slate-500">Hubungan antar node (source &rarr; target) beserta informasi kabel/core.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors" onClick={() => setOpen(true)}>
            Tambah Link
          </button>
        </div>
      </div>

      {nodes.length < 2 ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm font-medium text-amber-800 border border-amber-200">
          Minimal butuh 2 node yang terdaftar untuk dapat membuat link.
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <input className="w-full sm:flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" placeholder="Search source/target/kabel/catatan..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
          onClick={() => load().then(() => toast.success('Data diperbarui')).catch((e) => toast.error(e.message))}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Source</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Target</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Jenis Kabel</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Core</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Catatan</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Belum ada link.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{l.source_code}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-emerald-700">{l.target_code}</td>
                    <td className="px-4 py-3 text-slate-700">{l.cable_type || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {l.core_count ? `${l.core_count}` : '-'} {l.core_number ? `(${l.core_number})` : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={l.notes}>{l.notes || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="inline-flex items-center justify-center rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100"
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
                      </div>
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
    <Modal open={open} title="Tambah Link" onClose={onClose} width={720}>
      <form
        className="space-y-5"
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
          <div className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800 border border-amber-200">
            Tambahkan minimal 2 node terlebih dahulu di menu Data Node.
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Source Node</label>
            <select className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.source_node_id} onChange={(e) => setValues((v) => ({ ...v, source_node_id: e.target.value }))} required>
              <option value="">Pilih node...</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} ({n.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Target Node</label>
            <select className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.target_node_id} onChange={(e) => setValues((v) => ({ ...v, target_node_id: e.target.value }))} required>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Jenis Kabel</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.cable_type} onChange={(e) => setValues((v) => ({ ...v, cable_type: e.target.value }))} placeholder="Drop Core, Feeder" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Jumlah Core</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" type="number" value={values.core_count} onChange={(e) => setValues((v) => ({ ...v, core_count: e.target.value }))} placeholder="Misal: 12" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Nomor Core</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.core_number} onChange={(e) => setValues((v) => ({ ...v, core_number: e.target.value }))} placeholder="1-4" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Nama PON (opsional)</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.pon_name} onChange={(e) => setValues((v) => ({ ...v, pon_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Nama ODC (opsional)</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.odc_name} onChange={(e) => setValues((v) => ({ ...v, odc_name: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Catatan</label>
          <textarea className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" rows={3} value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button type="button" className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border border-transparent" onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
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
