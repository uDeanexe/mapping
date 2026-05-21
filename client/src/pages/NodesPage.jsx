import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { apiDelete, apiGet, apiPostForm } from '../lib/api.js';
import { DEFAULT_NODE_TYPES, googleMapsLink } from '../lib/nodeTypes.js';

function toFormData(values) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (v instanceof File) fd.append(k, v);
    else fd.append(k, String(v));
  });
  return fd;
}

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

function NodesInner() {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [nodeTypes, setNodeTypes] = useState(DEFAULT_NODE_TYPES);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function load() {
    const [types, list] = await Promise.all([
      apiGet('/api/node-types').catch(() => DEFAULT_NODE_TYPES),
      apiGet('/api/nodes')
    ]);
    setNodeTypes(types);
    setNodes(list);
  }

  function downloadCsv() {
    const headers = ['node_type_id', 'node_type_label', 'code', 'name', 'latitude', 'longitude', 'address', 'notes'];
    const rows = [headers.join(',')];
    nodes.forEach((node) => {
      rows.push(
        [
          node.node_type_id,
          node.type_label || node.type,
          node.code,
          node.name,
          node.latitude,
          node.longitude,
          node.address,
          node.notes
        ]
          .map(escapeCsv)
          .join(',')
      );
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nodes-${new Date().toISOString().slice(0, 10)}.csv`;
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
    const required = ['code'];
    const missing = required.filter((name) => !headerRow.includes(name));
    const hasTypeValue = headerRow.includes('node_type_id') || headerRow.includes('node_type_label');
    if (!hasTypeValue) {
      missing.push('node_type_id atau node_type_label');
    }
    if (missing.length > 0) {
      throw new Error(`Kolom CSV harus berisi: ${missing.join(', ')}`);
    }

    const typeById = Object.fromEntries(nodeTypes.map((t) => [String(t.id), t.id]));
    const typeByLabel = Object.fromEntries(nodeTypes.map((t) => [String(t.label).toLowerCase(), t.id]));
    const typeByName = Object.fromEntries(nodeTypes.map((t) => [String(t.name).toLowerCase(), t.id]));

    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.every((cell) => String(cell || '').trim() === '')) {
        results.skipped += 1;
        continue;
      }
      const data = Object.fromEntries(headerRow.map((key, index) => [key, String(row[index] ?? '').trim()]));
      let nodeTypeId = data.node_type_id;
      const typeLabel = String(data.node_type_label || '').trim().toLowerCase();
      if (!nodeTypeId && typeLabel) {
        nodeTypeId = typeByLabel[typeLabel] || typeByName[typeLabel] || '';
      }
      if (!nodeTypeId) {
        results.errors.push(`Baris ${i + 1}: jenis node tidak valid`);
        continue;
      }
      if (!data.code) {
        results.errors.push(`Baris ${i + 1}: kode node kosong`);
        continue;
      }
      const values = {
        node_type_id: nodeTypeId,
        code: data.code,
        name: data.name || null,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        address: data.address || null,
        notes: data.notes || null
      };

      try {
        await apiPostForm('/api/nodes', toFormData(values), 'POST');
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
    fileInputRef.current?.click();
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message || 'Gagal load data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return nodes.filter((n) => {
      if (typeFilter && n.type !== typeFilter) return false;
      if (!qq) return true;
      return (
        String(n.code || '').toLowerCase().includes(qq) ||
        String(n.name || '').toLowerCase().includes(qq) ||
        String(n.address || '').toLowerCase().includes(qq)
      );
    });
  }, [nodes, q, typeFilter]);

  async function submit(formValues) {
    try {
      setSubmitting(true);
      const fd = toFormData(formValues);
      const path = editing ? `/api/nodes/${editing.id}` : '/api/nodes';
      const method = editing ? 'PUT' : 'POST';
      await apiPostForm(path, fd, method);
      toast.success(editing ? 'Node diupdate' : 'Node dibuat');
      setOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Gagal simpan node');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">Data Node</h2>
          <p className="mt-1 text-sm text-slate-500">Manajemen titik node jaringan, upload foto, dan koordinat GPS.</p>
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
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Tambah Node
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportChange}
      />
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <input
          className="w-full sm:flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
          placeholder="Search kode/nama/alamat..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="w-full sm:w-auto rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Semua jenis</option>
          {nodeTypes.map((t) => (
            <option key={t.id} value={t.name}>
              {t.label}
            </option>
          ))}
        </select>
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
                <th className="px-4 py-3 font-semibold text-slate-700">Kode</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Jenis</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Koordinat</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Alamat</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                filtered.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-sky-700">{n.code}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                        {n.type_label || n.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{n.name || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {Number.isFinite(n.latitude) && Number.isFinite(n.longitude) ? `${n.latitude}, ${n.longitude}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={n.address}>{n.address || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {Number.isFinite(n.latitude) && Number.isFinite(n.longitude) ? (
                          <a
                            className="inline-flex items-center justify-center rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
                            href={googleMapsLink(Number(n.latitude), Number(n.longitude))}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Maps
                          </a>
                        ) : null}
                        <button
                          className="inline-flex items-center justify-center rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
                          onClick={() => {
                            setEditing(n);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center justify-center rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100"
                          onClick={async () => {
                            if (!confirm(`Hapus node ${n.code}?`)) return;
                            try {
                              await apiDelete(`/api/nodes/${n.id}`);
                              toast.success('Node dihapus');
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

      <NodeFormModal
        open={open}
        onClose={() => {
          if (submitting) return;
          setOpen(false);
          setEditing(null);
        }}
        nodeTypes={nodeTypes}
        initial={editing}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}

function NodeFormModal({ open, onClose, nodeTypes, initial, onSubmit, submitting }) {
  const toast = useToast();
  const [values, setValues] = useState(() => ({
    node_type_id: initial?.node_type_id || 4,
    code: initial?.code || '',
    name: initial?.name || '',
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
    address: initial?.address || '',
    notes: initial?.notes || '',
    photo: null
  }));

  useEffect(() => {
    setValues({
      node_type_id: initial?.node_type_id || 4,
      code: initial?.code || '',
      name: initial?.name || '',
      latitude: initial?.latitude ?? '',
      longitude: initial?.longitude ?? '',
      address: initial?.address || '',
      notes: initial?.notes || '',
      photo: null
    });
  }, [initial, open]);

  async function fillGps() {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung geolocation');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValues((v) => ({ ...v, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      },
      (err) => toast.error(`Gagal mengambil lokasi: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  const locValue = useMemo(() => {
    const lat = values.latitude === '' ? null : Number(values.latitude);
    const lng = values.longitude === '' ? null : Number(values.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [values.latitude, values.longitude]);

  return (
    <Modal
      open={open}
      title={initial ? `Edit Node: ${initial.code}` : 'Tambah Node'}
      onClose={onClose}
      width={1040}
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[40%] flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Peta Lokasi</label>
              <LocationPicker
                value={locValue}
                onChange={({ lat, lng }) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
                height={380}
              />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="text-sm font-bold text-slate-800 mb-2">Koordinat Terpilih</div>
              <div className="flex justify-between text-sm py-1 border-b border-slate-200 last:border-0">
                <span className="text-slate-500">Latitude:</span>{' '}
                <span className="font-mono text-slate-800">
                  {values.latitude === '' ? '-' : String(values.latitude)}
                </span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b border-slate-200 last:border-0">
                <span className="text-slate-500">Longitude:</span>{' '}
                <span className="font-mono text-slate-800">
                  {values.longitude === '' ? '-' : String(values.longitude)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[60%] flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Jenis Node</label>
                <select
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                  value={values.node_type_id}
                  onChange={(e) => setValues((v) => ({ ...v, node_type_id: Number(e.target.value) }))}
                  required
                >
                  {nodeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Kode Node</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                  value={values.code}
                  onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
                  required
                  placeholder="Contoh: ODC-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Nama (Opsional)</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                  value={values.name}
                  onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Foto Lapangan</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-[7px] text-sm text-slate-900 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 transition-colors"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setValues((v) => ({ ...v, photo: e.target.files?.[0] || null }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Latitude</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                  type="number"
                  step="any"
                  value={values.latitude}
                  onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Longitude</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                  type="number"
                  step="any"
                  value={values.longitude}
                  onChange={(e) => setValues((v) => ({ ...v, longitude: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <button type="button" className="w-full inline-flex items-center justify-center rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-300 transition-colors" onClick={fillGps}>
                  Ambil GPS
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Alamat</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                rows={3}
                value={values.address}
                onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Catatan</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                rows={3}
                value={values.notes}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              />
            </div>
          </div>
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

export default function NodesPage() {
  return (
    <ToastProvider>
      <NodesInner />
    </ToastProvider>
  );
}
