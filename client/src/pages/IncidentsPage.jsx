import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import SuratJalanModal from '../components/SuratJalanModal.jsx';
import { apiDelete, apiGet, apiPatchJson, apiPostForm, apiPostJson } from '../lib/api.js';

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
  const [items, setItems] = useState([]);
  const [nodes, setNodes] = useState([]);
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

  async function load() {
    const [inc, n] = await Promise.all([apiGet('/api/incidents'), apiGet('/api/nodes')]);
    setItems(inc);
    setNodes(n);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message || 'Gagal load data'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Gangguan</div>
          <div className="muted">Enduser lapor ke NOC, NOC buat surat jalan, teknisi lapor balik setelah selesai.</div>
        </div>
        <div className="page-actions">
          <button
            className="button button-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Tambah Gangguan
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Search judul/node/kategori..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div />
        <button className="button button-secondary" onClick={() => load().then(() => toast.success('Data diperbarui')).catch((e) => toast.error(e.message))}>
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Judul</th>
                <th>Node</th>
                <th>Status</th>
                <th>Foto</th>
                <th>Pelapor / Teknisi</th>
                <th className="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Belum ada gangguan.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id}>
                    <td data-label="Kategori">{categoryLabel(it.category)}</td>
                    <td data-label="Judul">{it.title}</td>
                    <td data-label="Node" className="mono">{it.node_code || '-'}</td>
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
                      <div className="muted">{it.technician_name ? `Teknisi: ${it.technician_name}` : 'Teknisi belum diisi'}</div>
                    </td>
                    <td data-label="Aksi" className="right">
                      <button
                        className="button button-ghost"
                        onClick={() => {
                          setEditing(it);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-ghost"
                        onClick={() => {
                          const node = it.node_id ? nodes.find((n) => Number(n.id) === Number(it.node_id)) : null;
                          setSjNode(node);
                          setSjIncident(it);
                          setSjOpen(true);
                        }}
                      >
                        Surat Jalan
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setSendItem(it);
                          setSendOpen(true);
                        }}
                      >
                        Email
                      </button>
                      <a className="button button-ghost" href={whatsappUrl(it)} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                      <a className="button button-ghost" href={telegramShareUrl(it)} target="_blank" rel="noreferrer">
                        Telegram
                      </a>
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setTelegramItem(it);
                          setTelegramOpen(true);
                        }}
                      >
                        Bot TG
                      </button>
                      <button
                        className="button button-primary"
                        onClick={() => {
                          setCompleteItem(it);
                          setCompleteOpen(true);
                        }}
                      >
                        Laporan Balik
                      </button>
                      <a className="button button-ghost" href={`/rekam-kerja?incident_id=${it.id}`}>
                        Rekam Kerja
                      </a>
                      <button
                        className="button button-danger"
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
    </div>
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
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...values,
            node_id: values.node_id ? Number(values.node_id) : null
          });
        }}
      >
        <div className="grid2">
          <div className="field">
            <label>Kategori</label>
            <select className="input" value={values.category} onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))} required>
              <option value="kerusakan">Kerusakan</option>
              <option value="internet_mati">Internet Mati</option>
            </select>
          </div>
          <div className="field">
            <label>Node (opsional)</label>
            <select className="input" value={values.node_id} onChange={(e) => setValues((v) => ({ ...v, node_id: e.target.value }))}>
              <option value="">Tidak ada</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} ({n.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Nama Admin NOC</label>
          <input className="input" value={values.noc_admin_name} onChange={(e) => setValues((v) => ({ ...v, noc_admin_name: e.target.value }))} />
        </div>

        <div className="field">
          <label>Judul</label>
          <input className="input" value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} required />
        </div>

        <div className="field">
          <label>Deskripsi</label>
          <textarea className="input" rows={4} value={values.description} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
        </div>

        <div className="grid2">
          <div className="field">
            <label>Nama Pelapor</label>
            <input className="input" value={values.reporter_name} onChange={(e) => setValues((v) => ({ ...v, reporter_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>Kontak Pelapor</label>
            <input className="input" value={values.reporter_contact} onChange={(e) => setValues((v) => ({ ...v, reporter_contact: e.target.value }))} />
          </div>
        </div>

        <div className="field">
          <label>Gambar Gangguan (opsional)</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setValues((v) => ({ ...v, photo: e.target.files?.[0] || null }))}
          />
          {initial?.photo_path ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Foto saat ini: <a className="link" href={initial.photo_path} target="_blank" rel="noreferrer">lihat gambar</a>
            </div>
          ) : null}
        </div>

        <div className="grid2">
          <div className="field">
            <label>Teknisi Lapangan</label>
            <input className="input" value={values.technician_name} onChange={(e) => setValues((v) => ({ ...v, technician_name: e.target.value }))} />
          </div>
          <div className="field">
            <label>WhatsApp Teknisi</label>
            <input className="input" value={values.technician_contact} onChange={(e) => setValues((v) => ({ ...v, technician_contact: e.target.value }))} placeholder="Contoh: 0812..." />
          </div>
        </div>

        <div className="field">
          <label>Email Teknisi</label>
          <input className="input" value={values.technician_email} onChange={(e) => setValues((v) => ({ ...v, technician_email: e.target.value }))} />
        </div>

        <div className="field">
          <label>Instruksi NOC / Catatan Surat Jalan</label>
          <textarea className="input" rows={3} value={values.work_order_notes} onChange={(e) => setValues((v) => ({ ...v, work_order_notes: e.target.value }))} />
        </div>

        <div className="field">
          <label>Laporan Balik Teknisi</label>
          <textarea className="input" rows={3} value={values.technician_report} onChange={(e) => setValues((v) => ({ ...v, technician_report: e.target.value }))} />
        </div>

        <div className="field">
          <label>Status</label>
          <select className="input" value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))} required>
            <option value="reported">Laporan User</option>
            <option value="assigned">Surat Jalan ke Teknisi</option>
            <option value="in_progress">Dikerjakan Teknisi</option>
            <option value="completed">Selesai</option>
            <option value="closed">Ditutup</option>
          </select>
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
        <div className="card">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="form"
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
          <div className="field">
            <label>To</label>
            <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="contoh: admin@company.com" required />
          </div>
          <div className="field">
            <label>Subject (opsional)</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Pesan (opsional)</label>
            <textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="form-actions">
            <button className="button button-primary" disabled={sending}>
              {sending ? 'Mengirim...' : 'Kirim'}
            </button>
            <button type="button" className="button button-ghost" onClick={onClose} disabled={sending}>
              Batal
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
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
        <div className="card">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="form"
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
          <div className="field">
            <label>Hasil Perbaikan</label>
            <textarea
              className="input"
              rows={6}
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Contoh: Kabel drop diganti, konektor dibersihkan, internet sudah normal."
              required
            />
          </div>
          <div className="form-actions">
            <button className="button button-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Selesai'}
            </button>
            <button type="button" className="button button-ghost" onClick={onClose} disabled={saving}>
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
        <div className="card">Gangguan tidak dipilih.</div>
      ) : (
        <form
          className="form"
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
          <div className="field">
            <label>Chat ID Telegram</label>
            <input className="input" value={chatId} onChange={(e) => setChatId(e.target.value)} required />
          </div>
          <div className="field">
            <label>Pesan</label>
            <textarea className="input" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button className="button button-primary" disabled={sending}>
              {sending ? 'Mengirim...' : 'Kirim Telegram'}
            </button>
            <button type="button" className="button button-ghost" onClick={onClose} disabled={sending}>
              Batal
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
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
