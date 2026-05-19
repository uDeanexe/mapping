import React, { useEffect, useMemo, useState } from 'react';
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

function NodesInner() {
  const toast = useToast();
  const [nodes, setNodes] = useState([]);
  const [nodeTypes, setNodeTypes] = useState(DEFAULT_NODE_TYPES);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [types, list] = await Promise.all([
      apiGet('/api/node-types').catch(() => DEFAULT_NODE_TYPES),
      apiGet('/api/nodes')
    ]);
    setNodeTypes(types);
    setNodes(list);
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
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Data Node</div>
          <div className="muted">CRUD node + upload foto + GPS.</div>
        </div>
        <div className="page-actions">
          <button
            className="button button-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Tambah Node
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search kode/nama/alamat..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Semua jenis</option>
          {nodeTypes.map((t) => (
            <option key={t.id} value={t.name}>
              {t.label}
            </option>
          ))}
        </select>
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
                <th>Kode</th>
                <th>Jenis</th>
                <th>Nama</th>
                <th>Koordinat</th>
                <th>Alamat</th>
                <th className="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                filtered.map((n) => (
                  <tr key={n.id}>
                    <td data-label="Kode" className="mono">{n.code}</td>
                    <td data-label="Jenis">{n.type_label || n.type}</td>
                    <td data-label="Nama">{n.name || '-'}</td>
                    <td data-label="Koordinat" className="mono">
                      {Number.isFinite(n.latitude) && Number.isFinite(n.longitude) ? `${n.latitude}, ${n.longitude}` : '-'}
                    </td>
                    <td data-label="Alamat">{n.address || '-'}</td>
                    <td data-label="Aksi" className="right">
                      {Number.isFinite(n.latitude) && Number.isFinite(n.longitude) ? (
                        <a
                          className="button button-ghost"
                          href={googleMapsLink(Number(n.latitude), Number(n.longitude))}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Maps
                        </a>
                      ) : null}
                      <button
                        className="button button-ghost"
                        onClick={() => {
                          setEditing(n);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-danger"
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
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <div className="nodeform-split">
          <div className="nodeform-left">
            <div className="field">
              <label>Peta</label>
              <LocationPicker
                value={locValue}
                onChange={({ lat, lng }) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
                height={420}
              />
            </div>

            <div className="nodeform-point card">
              <div className="nodeform-point-title">Maps Point</div>
              <div className="nodeform-point-row">
                <span className="muted">Latitude:</span>{' '}
                <span className="mono">
                  {values.latitude === '' ? '-' : String(values.latitude)}
                </span>
              </div>
              <div className="nodeform-point-row">
                <span className="muted">Longitude:</span>{' '}
                <span className="mono">
                  {values.longitude === '' ? '-' : String(values.longitude)}
                </span>
              </div>
            </div>
          </div>

          <div className="nodeform-right">
            <div className="grid2">
              <div className="field">
                <label>Jenis Node</label>
                <select
                  className="input"
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
              <div className="field">
                <label>Kode</label>
                <input
                  className="input"
                  value={values.code}
                  onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid2">
              <div className="field">
                <label>Nama</label>
                <input
                  className="input"
                  value={values.name}
                  onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Foto (opsional)</label>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setValues((v) => ({ ...v, photo: e.target.files?.[0] || null }))}
                />
              </div>
            </div>

            <div className="grid3">
              <div className="field">
                <label>Latitude</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={values.latitude}
                  onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Longitude</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={values.longitude}
                  onChange={(e) => setValues((v) => ({ ...v, longitude: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>&nbsp;</label>
                <button type="button" className="button button-secondary" onClick={fillGps}>
                  Ambil GPS
                </button>
              </div>
            </div>

            <div className="field">
              <label>Alamat</label>
              <textarea
                className="input"
                rows={3}
                value={values.address}
                onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Catatan</label>
              <textarea
                className="input"
                rows={4}
                value={values.notes}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              />
            </div>
          </div>
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

export default function NodesPage() {
  return (
    <ToastProvider>
      <NodesInner />
    </ToastProvider>
  );
}
