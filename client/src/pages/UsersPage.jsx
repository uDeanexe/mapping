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

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">Akun User</h2>
          <p className="mt-1 text-sm text-slate-500">Kelola user dan role akses sistem.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Tambah User
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Belum ada user.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{u.email}</td>
                    <td className="px-4 py-3 text-slate-700">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        <button
                          className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors"
                          onClick={() => {
                            setEditing(u);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
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
                      </div>
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
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { ...values };
          if (initial && !payload.password) delete payload.password;
          onSubmit(payload);
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Nama</label>
            <input className={inputClass} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Email</label>
            <input className={inputClass} type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Password {initial ? '(kosongkan jika tidak diganti)' : ''}</label>
            <input className={inputClass} type="password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} required={!initial} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Role</label>
            <select className={inputClass} value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}>
              {ROLES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Status</label>
          <select className={inputClass} value={values.is_active} onChange={(e) => setValues((v) => ({ ...v, is_active: Number(e.target.value) }))}>
            <option value={1}>Aktif</option>
            <option value={0}>Nonaktif</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </button>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
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
