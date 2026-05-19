import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { apiDelete, apiGet, apiPostJson, apiPutJson } from '../lib/api.js';
import { roleLabel } from '../lib/auth.js';
import { ToastProvider, useToast } from '../components/Toast.jsx';

const ROLES = [
  ['superadmin', 'Superadmin'],
  ['admin', 'Admin'],
  ['supervisor_noc', 'Supervisor NOC'],
  ['teknisi', 'Teknisi']
];

function UsersInner() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const rows = await apiGet('/api/users');
    setUsers(rows);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message || 'Gagal load user'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(values) {
    try {
      setSaving(true);
      if (editing) await apiPutJson(`/api/users/${editing.id}`, values);
      else await apiPostJson('/api/users', values);
      toast.success(editing ? 'User diupdate' : 'User dibuat');
      setOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Gagal simpan user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Akun User</div>
          <div className="muted">Kelola user dan role akses sistem.</div>
        </div>
        <button
          className="button button-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Tambah User
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">Belum ada user.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nama">{u.name}</td>
                    <td data-label="Email" className="mono">{u.email}</td>
                    <td data-label="Role">{roleLabel(u.role)}</td>
                    <td data-label="Status">{u.is_active ? 'Aktif' : 'Nonaktif'}</td>
                    <td data-label="Aksi" className="right">
                      <button className="button button-ghost" onClick={() => { setEditing(u); setOpen(true); }}>
                        Edit
                      </button>
                      <button
                        className="button button-danger"
                        onClick={async () => {
                          if (!confirm(`Hapus user ${u.email}?`)) return;
                          try {
                            await apiDelete(`/api/users/${u.id}`);
                            toast.success('User dihapus');
                            await load();
                          } catch (err) {
                            toast.error(err.message || 'Gagal hapus user');
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

      <UserModal
        open={open}
        initial={editing}
        saving={saving}
        onClose={() => {
          if (saving) return;
          setOpen(false);
          setEditing(null);
        }}
        onSubmit={submit}
      />
    </div>
  );
}

function UserModal({ open, onClose, initial, onSubmit, saving }) {
  const [values, setValues] = useState(() => ({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    role: initial?.role || 'teknisi',
    is_active: initial ? (initial.is_active ? 1 : 0) : 1
  }));

  useEffect(() => {
    setValues({
      name: initial?.name || '',
      email: initial?.email || '',
      password: '',
      role: initial?.role || 'teknisi',
      is_active: initial ? (initial.is_active ? 1 : 0) : 1
    });
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit User: ${initial.email}` : 'Tambah User'} width={720}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { ...values };
          if (initial && !payload.password) delete payload.password;
          onSubmit(payload);
        }}
      >
        <div className="grid2">
          <div className="field">
            <label>Nama</label>
            <input className="input" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} required />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label>Password {initial ? '(kosongkan jika tidak diganti)' : ''}</label>
            <input className="input" type="password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} required={!initial} />
          </div>
          <div className="field">
            <label>Role</label>
            <select className="input" value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}>
              {ROLES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Status</label>
          <select className="input" value={values.is_active} onChange={(e) => setValues((v) => ({ ...v, is_active: Number(e.target.value) }))}>
            <option value={1}>Aktif</option>
            <option value={0}>Nonaktif</option>
          </select>
        </div>

        <div className="form-actions">
          <button className="button button-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button type="button" className="button button-ghost" onClick={onClose} disabled={saving}>Batal</button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  return (
    <ToastProvider>
      <UsersInner />
    </ToastProvider>
  );
}
