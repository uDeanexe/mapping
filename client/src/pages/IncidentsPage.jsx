import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import SuratJalanModal from '../components/SuratJalanModal.jsx';
import { apiDelete, apiGet, apiPatchJson, apiPostForm, apiPostJson } from '../lib/api.js';
import { getStoredUser } from '../lib/auth.js';

function statusLabel(status) {
  switch (status) {
    case 'reported':
      return 'Laporan User';
    case 'assigned':
      return 'Surat Jalan';
    case 'in_progress':
      return 'Dikerjakan';
    case 'completed':
      return 'Selesai';
    case 'closed':
      return 'Ditutup';
    default:
      return status || '-';
  }
}

function categoryLabel(category) {
  return category === 'internet_mati' ? 'Internet Mati' : 'Kerusakan';
}

function buildIncidentMessage(item) {
  const lines = [
    `Laporan ${categoryLabel(item.category)}`,
    `Judul: ${item.title || '-'}`,
    `Status: ${statusLabel(item.status)}`,
    `Node: ${item.node_code || '-'}`,
    item.description ? `Keluhan User: ${item.description}` : null,
    item.work_order_notes ? `Instruksi NOC: ${item.work_order_notes}` : null,
    item.technician_name ? `Teknisi: ${item.technician_name}` : null,
    item.technician_contact ? `Kontak Teknisi: ${item.technician_contact}` : null,
    item.technician_report ? `Laporan Balik: ${item.technician_report}` : null
  ];
  return lines.filter(Boolean).join('\n');
}

function waNumber(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

function whatsappUrl(item) {
  const number = waNumber(item.technician_contact);
  const text = encodeURIComponent(buildIncidentMessage(item));
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

function telegramShareUrl(item) {
  return `https://t.me/share/url?text=${encodeURIComponent(buildIncidentMessage(item))}`;
}

function buildNocTicketMessage(item, node) {
  const lines = [
    `TIKET GANGGUAN #${item.id}`,
    `Kategori: ${categoryLabel(item.category)}`,
    `Judul: ${item.title || '-'}`,
    `Status: ${statusLabel(item.status)}`,
    `Node: ${item.node_code || '-'}`,
    node?.latitude && node?.longitude ? `Koordinat: ${node.latitude}, ${node.longitude}` : null,
    node?.address ? `Alamat: ${node.address}` : null,
    item.description ? `Keluhan: ${item.description}` : null,
    item.work_order_notes ? `Instruksi NOC: ${item.work_order_notes}` : null,
    item.technician_name ? `Teknisi: ${item.technician_name}` : null,
    item.technician_contact ? `Kontak: ${item.technician_contact}` : null
  ];
  return lines.filter(Boolean).join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ''));
    return true;
  } catch (_) {
    return false;
  }
}

function incidentFormData(values) {
  const fd = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    fd.append(key, value);
  });
  return fd;
}

function IncidentsInner() {
  const toast = useToast();
  const user = getStoredUser();
  const canActAsTech = user?.role === 'teknisi';
  const canAssignTech = ['superadmin', 'admin', 'supervisor_noc'].includes(user?.role);
  const [items, setItems] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState('');
  const [sjOpen, setSjOpen] = useState(false);
  const [sjNode, setSjNode] = useState(null);
  const [sjIncident, setSjIncident] = useState(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendItem, setSendItem] = useState(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeItem, setCompleteItem] = useState(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [telegramItem, setTelegramItem] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignItem, setAssignItem] = useState(null);

  async function load() {
    const promises = [apiGet('/api/incidents'), apiGet('/api/nodes')];
    if (canAssignTech) promises.push(apiGet('/api/technicians'));
    const [inc, n, techs] = await Promise.all(promises);
    setItems(inc);
    setNodes(n);
    if (canAssignTech) setTechnicians(Array.isArray(techs) ? techs : []);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message || 'Gagal load data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest('[data-incident-menu]')) return;
      setOpenMenuId(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [String(n.id), n])), [nodes]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((it) => {
      return (
        String(it.title || '').toLowerCase().includes(qq) ||
        String(it.category || '').toLowerCase().includes(qq) ||
        String(it.node_code || '').toLowerCase().includes(qq) ||
        String(it.description || '').toLowerCase().includes(qq)
      );
    });
  }, [items, q]);

  async function submit(values) {
    try {
      setSubmitting(true);
      const path = editing ? `/api/incidents/${editing.id}` : '/api/incidents';
      await apiPostForm(path, incidentFormData(values), editing ? 'PUT' : 'POST');
      toast.success(editing ? 'Gangguan diupdate' : 'Gangguan dibuat');
      setOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Gagal simpan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:tracking-tight">Gangguan</div>
          <div className="text-sm text-slate-500">Enduser lapor ke NOC, NOC buat surat jalan, teknisi lapor balik setelah selesai.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Tambah Gangguan
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" placeholder="Search judul/node/kategori..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div />
        <button className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200" onClick={() => load().then(() => toast.success('Data diperbarui')).catch((e) => toast.error(e.message))}>
          Refresh
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Judul</th>
                <th>Node</th>
                <th>Status</th>
                <th>Foto</th>
                <th>Pelapor / Teknisi</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-sm text-slate-500">
                    Belum ada gangguan.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id}>
                    <td data-label="Kategori">{categoryLabel(it.category)}</td>
                    <td data-label="Judul">{it.title}</td>
                    <td data-label="Node" className="font-mono text-xs font-semibold">{it.node_code || '-'}</td>
                    <td data-label="Status">{statusLabel(it.status)}</td>
                    <td data-label="Foto">
                      {it.photo_path ? (
                        <a className="link" href={it.photo_path} target="_blank" rel="noreferrer">
                          Lihat
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td data-label="Pelapor">
                      <div>{it.reporter_name || '-'}</div>
                      <div className="text-sm text-slate-500">{it.technician_name ? `Teknisi: ${it.technician_name}` : 'Teknisi belum diisi'}</div>
                    </td>
                    <td data-label="Aksi" className="text-right">
                      <div className="flex flex-wrap justify-end gap-2" data-incident-menu>
                        <button
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                          onClick={() => {
                            setEditing(it);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </button>

                        {canActAsTech &&
                        it.status === 'assigned' &&
                        String(it.technician_email || '').toLowerCase() === String(user?.email || '').toLowerCase() ? (
                          <button
                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-sky-600 text-white hover:bg-sky-500"
                            onClick={async () => {
                              try {
                                await apiPatchJson(`/api/incidents/${it.id}/start`, { status: 'in_progress' });
                                toast.success('Mulai dikerjakan');
                                await load();
                              } catch (e) {
                                toast.error(e.message || 'Gagal mulai');
                              }
                            }}
                          >
                            Mulai
                          </button>
                        ) : null}

                        {canAssignTech && it.status === 'reported' ? (
                          <button
                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-emerald-600 text-white hover:bg-emerald-500"
                            onClick={() => {
                              setAssignItem(it);
                              setAssignOpen(true);
                            }}
                          >
                            Assign Teknisi
                          </button>
                        ) : null}

                        <button
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                          onClick={() => {
                            const node = it.node_id ? nodeById.get(String(it.node_id)) : null;
                            setSjNode(node || null);
                            setSjIncident(it);
                            setSjOpen(true);
                          }}
                        >
                          Surat Jalan
                        </button>

                        <button
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500"
                          onClick={() => {
                            setCompleteItem(it);
                            setCompleteOpen(true);
                          }}
                        >
                          Laporan Balik
                        </button>

                        <a
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                          href={`/rekam-kerja?incident_id=${it.id}`}
                        >
                          Rekam Kerja
                        </a>

                        {/* Kirim (komunikasi) */}
                        <div className="relative">
                          <button
                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                            onClick={() => setOpenMenuId(openMenuId === `send:${it.id}` ? null : `send:${it.id}`)}
                            type="button"
                          >
                            Kirim
                          </button>
                          {openMenuId === `send:${it.id}` ? (
                            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setSendItem(it);
                                  setSendOpen(true);
                                }}
                              >
                                Email
                              </button>
                              <a
                                className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                href={whatsappUrl(it)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setOpenMenuId(null)}
                              >
                                WhatsApp
                              </a>
                              <a
                                className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                href={telegramShareUrl(it)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setOpenMenuId(null)}
                              >
                                Telegram
                              </a>
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setTelegramItem(it);
                                  setTelegramOpen(true);
                                }}
                              >
                                Bot TG
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {/* Tools NOC */}
                        <div className="relative">
                          <button
                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                            onClick={() => setOpenMenuId(openMenuId === `noc:${it.id}` ? null : `noc:${it.id}`)}
                            type="button"
                          >
                            NOC
                          </button>
                          {openMenuId === `noc:${it.id}` ? (
                            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  const ok = await copyText(buildIncidentMessage(it));
                                  ok ? toast.success('Teks gangguan disalin') : toast.error('Gagal copy teks');
                                }}
                              >
                                Copy teks gangguan
                              </button>
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  const node = it.node_id ? nodeById.get(String(it.node_id)) : null;
                                  const ok = await copyText(buildNocTicketMessage(it, node));
                                  ok ? toast.success('Template tiket disalin') : toast.error('Gagal copy template');
                                }}
                              >
                                Copy template tiket NOC
                              </button>
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  const node = it.node_id ? nodeById.get(String(it.node_id)) : null;
                                  if (!node?.latitude || !node?.longitude) return toast.error('Koordinat node belum ada');
                                  const ok = await copyText(`${node.latitude}, ${node.longitude}`);
                                  ok ? toast.success('Koordinat disalin') : toast.error('Gagal copy koordinat');
                                }}
                              >
                                Copy koordinat node
                              </button>
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  const node = it.node_id ? nodeById.get(String(it.node_id)) : null;
                                  if (!node?.latitude || !node?.longitude) return toast.error('Koordinat node belum ada');
                                  window.open(`https://www.google.com/maps?q=${encodeURIComponent(`${node.latitude},${node.longitude}`)}`, '_blank');
                                }}
                              >
                                Buka Google Maps
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <button
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors bg-red-600 text-white hover:bg-red-500"
                          onClick={async () => {
                            if (!confirm(`Hapus gangguan: ${it.title}?`)) return;
                            try {
                              await apiDelete(`/api/incidents/${it.id}`);
                              toast.success('Gangguan dihapus');
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

      <IncidentModal
        open={open}
        onClose={() => {
          if (submitting) return;
          setOpen(false);
          setEditing(null);
        }}
        nodes={nodes}
        initial={editing}
        submitting={submitting}
        onSubmit={submit}
      />

      <SuratJalanModal
        open={sjOpen}
        node={sjNode}
        incident={sjIncident}
        onClose={() => {
          setSjOpen(false);
          setSjNode(null);
          setSjIncident(null);
        }}
      />
      <SendEmailModal open={sendOpen} item={sendItem} onClose={() => { setSendOpen(false); setSendItem(null); }} />
      <CompleteModal
        open={completeOpen}
        item={completeItem}
        onClose={() => {
          setCompleteOpen(false);
          setCompleteItem(null);
        }}
        onDone={load}
      />
      <TelegramBotModal
        open={telegramOpen}
        item={telegramItem}
        onClose={() => {
          setTelegramOpen(false);
          setTelegramItem(null);
        }}
      />

      <AssignTechModal
        open={assignOpen}
        item={assignItem}
        technicians={technicians}
        onClose={() => {
          setAssignOpen(false);
          setAssignItem(null);
        }}
        onDone={load}
      />
    </div>
  );
}

function AssignTechModal({ open, onClose, item, technicians, onDone }) {
  const toast = useToast();
  const [techId, setTechId] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTechId('');
    setContact('');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={item ? `Assign Teknisi #${item.id}` : 'Assign Teknisi'} width={760}>
      {!item ? (
        <div className="text-sm text-slate-600">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSaving(true);
              await apiPatchJson(`/api/incidents/${item.id}/assign`, {
                technician_user_id: techId,
                technician_contact: contact || null
              });
              toast.success('Teknisi ditugaskan (Surat Jalan)');
              await onDone?.();
              onClose();
            } catch (err) {
              toast.error(err.message || 'Gagal assign teknisi');
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">{item.title}</div>
            <div className="text-xs text-slate-500">Status: {statusLabel(item.status)}</div>
          </div>

          <div className="space-y-1.5">
            <label>Pilih Teknisi</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
              value={techId}
              onChange={(e) => setTechId(e.target.value)}
              required
            >
              <option value="">-- pilih teknisi --</option>
              {(technicians || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label>Kontak Teknisi (opsional)</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="08xxxx / 62xxxx"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-70" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Assign'}
            </button>
            <button type="button" className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200" onClick={onClose} disabled={saving}>
              Batal
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function IncidentModal({ open, onClose, nodes, initial, onSubmit, submitting }) {
  const [values, setValues] = useState(() => ({
    node_id: initial?.node_id || '',
    category: initial?.category || 'kerusakan',
    title: initial?.title || '',
    description: initial?.description || '',
    reporter_name: initial?.reporter_name || '',
    reporter_contact: initial?.reporter_contact || '',
    noc_admin_name: initial?.noc_admin_name || '',
    technician_name: initial?.technician_name || '',
    technician_contact: initial?.technician_contact || '',
    technician_email: initial?.technician_email || '',
    work_order_notes: initial?.work_order_notes || '',
    technician_report: initial?.technician_report || '',
    photo: null,
    status: initial?.status || 'reported'
  }));

  useEffect(() => {
    setValues({
      node_id: initial?.node_id || '',
      category: initial?.category || 'kerusakan',
      title: initial?.title || '',
      description: initial?.description || '',
      reporter_name: initial?.reporter_name || '',
      reporter_contact: initial?.reporter_contact || '',
      noc_admin_name: initial?.noc_admin_name || '',
      technician_name: initial?.technician_name || '',
      technician_contact: initial?.technician_contact || '',
      technician_email: initial?.technician_email || '',
      work_order_notes: initial?.work_order_notes || '',
      technician_report: initial?.technician_report || '',
      photo: null,
      status: initial?.status || 'reported'
    });
  }, [initial, open]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit Gangguan #${initial.id}` : 'Tambah Gangguan'} width={860}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...values,
            node_id: values.node_id ? Number(values.node_id) : null
          });
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label>Kategori</label>
            <select className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.category} onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))} required>
              <option value="kerusakan">Kerusakan</option>
              <option value="internet_mati">Internet Mati</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label>Node (opsional)</label>
            <select className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.node_id} onChange={(e) => setValues((v) => ({ ...v, node_id: e.target.value }))}>
              <option value="">Tidak ada</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} ({n.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label>Nama Admin NOC</label>
          <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.noc_admin_name} onChange={(e) => setValues((v) => ({ ...v, noc_admin_name: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <label>Judul</label>
          <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} required />
        </div>

        <div className="space-y-1.5">
          <label>Deskripsi</label>
          <textarea className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" rows={4} value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label>Nama Pelapor</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.reporter_name} onChange={(e) => setValues((v) => ({ ...v, reporter_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label>Kontak Pelapor</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.reporter_contact} onChange={(e) => setValues((v) => ({ ...v, reporter_contact: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label>Gambar Gangguan (opsional)</label>
          <input
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
            type="file"
            accept="image/*"
            onChange={(e) => setValues((v) => ({ ...v, photo: e.target.files?.[0] || null }))}
          />
          {initial?.photo_path ? (
            <div className="mt-2 text-xs text-slate-500">
              Foto saat ini: <a className="link" href={initial.photo_path} target="_blank" rel="noreferrer">lihat gambar</a>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label>Teknisi Lapangan</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.technician_name} onChange={(e) => setValues((v) => ({ ...v, technician_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label>WhatsApp Teknisi</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.technician_contact} onChange={(e) => setValues((v) => ({ ...v, technician_contact: e.target.value }))} placeholder="Contoh: 0812..." />
          </div>
        </div>

        <div className="space-y-1.5">
          <label>Email Teknisi</label>
          <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.technician_email} onChange={(e) => setValues((v) => ({ ...v, technician_email: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <label>Instruksi NOC / Catatan Surat Jalan</label>
          <textarea className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" rows={3} value={values.work_order_notes} onChange={(e) => setValues((v) => ({ ...v, work_order_notes: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <label>Laporan Balik Teknisi</label>
          <textarea className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" rows={3} value={values.technician_report} onChange={(e) => setValues((v) => ({ ...v, technician_report: e.target.value }))} />
        </div>

        <div className="space-y-1.5">
          <label>Status</label>
          <select className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))} required>
            <option value="reported">Laporan User</option>
            <option value="assigned">Surat Jalan ke Teknisi</option>
            <option value="in_progress">Dikerjakan Teknisi</option>
            <option value="completed">Selesai</option>
            <option value="closed">Ditutup</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button type="button" className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200" onClick={onClose} disabled={submitting}>
            Batal
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SendEmailModal({ open, onClose, item }) {
  const toast = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(item?.technician_email || '');
    setSubject(item ? `[Surat Jalan] ${categoryLabel(item.category)} - ${item.title}` : '');
    setMessage(item ? buildIncidentMessage(item) : '');
  }, [open, item]);

  return (
    <Modal open={open} onClose={onClose} title={item ? `Kirim Email Gangguan #${item.id}` : 'Kirim Email'} width={760}>
      {!item ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSending(true);
              await apiPostJson(`/api/incidents/${item.id}/send-email`, { to, subject, message, tujuan: item.title });
              toast.success('Email terkirim');
              onClose();
            } catch (err) {
              toast.error(err.message || 'Gagal kirim email');
            } finally {
              setSending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label>To</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={to} onChange={(e) => setTo(e.target.value)} placeholder="contoh: admin@company.com" required />
          </div>
          <div className="space-y-1.5">
            <label>Subject (opsional)</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label>Pesan (opsional)</label>
            <textarea className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500" disabled={sending}>
              {sending ? 'Mengirim...' : 'Kirim'}
            </button>
            <button type="button" className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200" onClick={onClose} disabled={sending}>
              Batal
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Lampiran: Surat Jalan PDF otomatis dari data gangguan.
          </div>
        </form>
      )}
    </Modal>
  );
}

function CompleteModal({ open, onClose, item, onDone }) {
  const toast = useToast();
  const [report, setReport] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReport(item?.technician_report || '');
  }, [open, item]);

  return (
    <Modal open={open} onClose={onClose} title={item ? `Laporan Balik Teknisi #${item.id}` : 'Laporan Balik'} width={760}>
      {!item ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSaving(true);
              await apiPatchJson(`/api/incidents/${item.id}/complete`, {
                technician_report: report,
                status: 'completed'
              });
              toast.success('Laporan selesai disimpan');
              await onDone?.();
              onClose();
            } catch (err) {
              toast.error(err.message || 'Gagal simpan laporan');
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label>Hasil Perbaikan</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
              rows={6}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Contoh: Kabel drop diganti, konektor dibersihkan, internet sudah normal."
              required
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Selesai'}
            </button>
            <button type="button" className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200" onClick={onClose} disabled={saving}>
              Batal
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function TelegramBotModal({ open, onClose, item }) {
  const toast = useToast();
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChatId('');
    setMessage(item ? buildIncidentMessage(item) : '');
  }, [open, item]);

  return (
    <Modal open={open} onClose={onClose} title={item ? `Kirim Telegram Bot #${item.id}` : 'Kirim Telegram Bot'} width={760}>
      {!item ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSending(true);
              await apiPostJson(`/api/incidents/${item.id}/send-telegram`, {
                chat_id: chatId,
                message
              });
              toast.success('Telegram terkirim');
              onClose();
            } catch (err) {
              toast.error(err.message || 'Gagal kirim Telegram');
            } finally {
              setSending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label>Chat ID Telegram</label>
            <input className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" value={chatId} onChange={(e) => setChatId(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label>Pesan</label>
            <textarea className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500" disabled={sending}>
              {sending ? 'Mengirim...' : 'Kirim Telegram'}
            </button>
            <button type="button" className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200" onClick={onClose} disabled={sending}>
              Batal
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Pastikan TELEGRAM_BOT_TOKEN sudah diisi di server/.env.
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function IncidentsPage() {
  return (
    <ToastProvider>
      <IncidentsInner />
    </ToastProvider>
  );
}

