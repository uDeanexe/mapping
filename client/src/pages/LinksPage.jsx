import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import { apiDelete, apiDownload, apiGet, apiPostJson } from '../lib/api.js';

function escapeCsv(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (inQuotes) {
      if (char === '"') {
        if (line[idx + 1] === '"') {
          current += '"';
          idx += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else if (char === '"') {
      inQuotes = true;
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCsv(text) {
  const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return rows.filter((row) => row.trim() !== '').map(parseCsvLine);
}

function LinksInner() {
  const toast = useToast();
  const importInputRef = useRef(null);
  const [links, setLinks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [labelPreset, setLabelPreset] = useState('a4_3x8');

  async function load() {
    const [l, n] = await Promise.all([apiGet('/api/links'), apiGet('/api/nodes')]);
    setLinks(l);
    setNodes(n);
  }

  async function downloadLinksPdf() {
    try {
      await apiDownload('/api/links/report.pdf', `links-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF link berhasil diunduh');
    } catch (e) {
      toast.error(e.message || 'Gagal unduh PDF link');
    }
  }

  async function downloadLabelsPdf() {
    try {
      const ids = filtered.map((l) => l.id).filter(Boolean);
      if (ids.length === 0) {
        toast.error('Tidak ada link untuk dibuat label');
        return;
      }
      const qs = `?ids=${encodeURIComponent(ids.join(','))}&preset=${encodeURIComponent(labelPreset)}`;
      await apiDownload(`/api/links/labels.pdf${qs}`, `link-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Label barcode/QR berhasil diunduh');
    } catch (e) {
      toast.error(e.message || 'Gagal unduh label');
    }
  }

  function downloadCsv() {
    const headers = ['source_node_id', 'source_code', 'target_node_id', 'target_code', 'cable_type', 'core_count', 'core_number', 'pon_name', 'odc_name', 'notes'];
    const rows = [headers.join(',')];
    links.forEach((link) => {
      rows.push(
        [
          link.source_node_id,
          link.source_code,
          link.target_node_id,
          link.target_code,
          link.cable_type,
          link.core_count,
          link.core_number,
          link.pon_name,
          link.odc_name,
          link.notes
        ]
          .map(escapeCsv)
          .join(',')
      );
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `links-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function importCsvFile(file) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) throw new Error('CSV kosong atau tidak valid');

    const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const sourceIndex = headerRow.indexOf('source_node_id') >= 0 ? headerRow.indexOf('source_node_id') : headerRow.indexOf('source_code');
    const targetIndex = headerRow.indexOf('target_node_id') >= 0 ? headerRow.indexOf('target_node_id') : headerRow.indexOf('target_code');
    if (sourceIndex === -1 || targetIndex === -1) {
      throw new Error('CSV harus berisi kolom source_node_id/source_code dan target_node_id/target_code');
    }

    const sourceByCode = Object.fromEntries(nodes.map((node) => [String(node.code || '').toLowerCase(), node.id]));
    const targetByCode = sourceByCode;
    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.every((cell) => String(cell || '').trim() === '')) {
        results.skipped += 1;
        continue;
      }
      const data = Object.fromEntries(headerRow.map((key, index) => [key, String(row[index] ?? '').trim()]));

      const sourceNodeId = data.source_node_id || sourceByCode[String(data.source_code || '').toLowerCase()];
      const targetNodeId = data.target_node_id || targetByCode[String(data.target_code || '').toLowerCase()];
      if (!sourceNodeId || !targetNodeId) {
        results.errors.push(`Baris ${i + 1}: source atau target tidak valid`);
        continue;
      }
      if (sourceNodeId === targetNodeId) {
        results.errors.push(`Baris ${i + 1}: source dan target tidak boleh sama`);
        continue;
      }

      try {
        await apiPostJson('/api/links', {
          source_node_id: Number(sourceNodeId),
          target_node_id: Number(targetNodeId),
          cable_type: data.cable_type || null,
          core_count: data.core_count ? Number(data.core_count) : null,
          core_number: data.core_number || null,
          pon_name: data.pon_name || null,
          odc_name: data.odc_name || null,
          notes: data.notes || null
        });
        results.created += 1;
      } catch (error) {
        results.errors.push(`Baris ${i + 1}: ${error.message || 'Gagal simpan'}`);
      }
    }

    if (results.created === 0 && results.errors.length > 0) {
      throw new Error(results.errors.join('; '));
    }
    return results;
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const results = await importCsvFile(file);
      await load();
      toast.success(`Import selesai: ${results.created} baris dibuat${results.errors.length ? `, ${results.errors.length} baris gagal` : ''}`);
    } catch (error) {
      toast.error(error.message || 'Gagal import CSV');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  }

  function openImportDialog() {
    importInputRef.current?.click();
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
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={openImportDialog}
            disabled={importing}
          >
            {importing ? 'Import...' : 'Import CSV'}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={downloadCsv}
          >
            Export CSV
          </button>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={downloadLinksPdf}
          >
            Export PDF
          </button>
          <select
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
            value={labelPreset}
            onChange={(e) => setLabelPreset(e.target.value)}
            title="Preset ukuran stiker"
          >
            <option value="a4_3x8">Stiker A4 3x8 (default)</option>
            <option value="a4_3x8_tight">Stiker A4 3x8 (tight)</option>
          </select>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={downloadLabelsPdf}
            title="Buat label barcode/QR untuk link yang tampil (sesuai filter search)"
          >
            Label Barcode
          </button>
          <button className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors" onClick={() => setOpen(true)}>
            Tambah Link
          </button>
        </div>
      </div>
      <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportChange} />

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
