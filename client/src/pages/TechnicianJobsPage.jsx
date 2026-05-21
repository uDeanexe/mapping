import React, { useEffect, useMemo, useState } from 'react';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { apiGet, apiPatchJson } from '../lib/api.js';
import { getStoredUser } from '../lib/auth.js';

function statusLabel(status) {
  switch (status) {
    case 'reported':
      return 'Available';
    case 'assigned':
      return 'Assigned';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'closed':
      return 'Closed';
    default:
      return status || '-';
  }
}

function categoryLabel(category) {
  return category === 'internet_mati' ? 'Internet Mati' : 'Kerusakan';
}

function toMapsUrl(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${a},${b}`)}`;
}

function TechnicianJobsInner() {
  const toast = useToast();
  const user = getStoredUser();
  const canActAsTech = user?.role === 'teknisi';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState(() => localStorage.getItem('tech_phone') || '');
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneItem, setDoneItem] = useState(null);
  const [doneReport, setDoneReport] = useState('');
  const [savingDone, setSavingDone] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const rows = await apiGet('/api/tech/jobs');
      setItems(rows);
    } catch (e) {
      toast.error(e.message || 'Gagal load pekerjaan');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const available = items.filter((x) => x.status === 'assigned');
    const inProgress = items.filter((x) => x.status === 'in_progress');
    const done = items.filter((x) => x.status === 'completed' || x.status === 'closed');
    return { assigned: available, inProgress, done };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:tracking-tight">Pekerjaan Teknisi</h2>
          <p className="mt-1 text-sm text-slate-500">
            {canActAsTech ? 'Ambil job dari NOC, kerjakan, lalu kirim laporan selesai.' : 'Monitoring pekerjaan teknisi.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canActAsTech ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">WA/HP</div>
              <input
                className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder="08xxxx / 62xxxx"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  localStorage.setItem('tech_phone', e.target.value);
                }}
              />
            </div>
          ) : null}
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <JobColumn
          title="Assigned"
          subtitle="Surat jalan masuk"
          items={grouped.assigned}
          empty="Belum ada surat jalan masuk."
          onStart={canActAsTech ? async (it) => {
            try {
              await apiPatchJson(`/api/incidents/${it.id}/start`, { status: 'in_progress' });
              toast.success('Mulai dikerjakan');
              await load();
            } catch (e) {
              toast.error(e.message || 'Gagal mulai');
            }
          } : null}
        />
        <JobColumn
          title="In Progress"
          subtitle="Sedang dikerjakan"
          items={grouped.inProgress}
          empty="Tidak ada pekerjaan berjalan."
          onDone={canActAsTech ? (it) => {
            setDoneItem(it);
            setDoneReport(it?.technician_report || '');
            setDoneOpen(true);
          } : null}
        />
        <JobColumn title="Done" subtitle="Selesai" items={grouped.done.slice(0, 30)} empty="Belum ada yang selesai." />
      </div>

      <Modal
        open={doneOpen}
        onClose={() => {
          if (savingDone) return;
          setDoneOpen(false);
          setDoneItem(null);
        }}
        title={doneItem ? `Laporan Selesai #${doneItem.id}` : 'Laporan Selesai'}
        width={760}
      >
        {!doneItem ? (
          <div className="text-sm text-slate-600">Job tidak dipilih.</div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setSavingDone(true);
                await apiPatchJson(`/api/incidents/${doneItem.id}/complete`, {
                  technician_report: doneReport,
                  status: 'completed'
                });
                toast.success('Laporan dikirim');
                setDoneOpen(false);
                setDoneItem(null);
                await load();
              } catch (err) {
                toast.error(err.message || 'Gagal kirim laporan');
              } finally {
                setSavingDone(false);
              }
            }}
          >
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900">{doneItem.title}</div>
              <div className="text-xs text-slate-500">
                {categoryLabel(doneItem.category)} • Node {doneItem.node_code || '-'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label>Hasil Perbaikan</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition-colors"
                rows={6}
                value={doneReport}
                onChange={(e) => setDoneReport(e.target.value)}
                required
                placeholder="Contoh: ganti dropcore, splicing ulang, konektor dibersihkan, internet normal."
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-sky-600 text-white shadow-sm hover:bg-sky-500 disabled:opacity-70"
                disabled={savingDone}
              >
                {savingDone ? 'Menyimpan…' : 'Kirim Selesai'}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                onClick={() => {
                  if (savingDone) return;
                  setDoneOpen(false);
                  setDoneItem(null);
                }}
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function JobColumn({ title, subtitle, items, empty, onTake, onStart, onDone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">{subtitle}</div>
          </div>
          <div className="text-xs font-semibold text-slate-500">{items.length}</div>
        </div>
      </div>
      <div className="p-3 space-y-3 max-h-[70vh] overflow-auto">
        {items.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-sm text-slate-600">{empty}</div>
        ) : (
          items.map((it) => (
            <JobCard key={it.id} item={it} onTake={onTake} onStart={onStart} onDone={onDone} />
          ))
        )}
      </div>
    </div>
  );
}

function JobCard({ item, onTake, onStart, onDone }) {
  const mapsUrl = toMapsUrl(item.node_latitude, item.node_longitude);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-sky-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">#{item.id} • {item.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {categoryLabel(item.category)} • {statusLabel(item.status)} • Node {item.node_code || '-'}
          </div>
        </div>
      </div>

      {item.work_order_notes ? (
        <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">{item.work_order_notes}</div>
      ) : null}

      {item.node_address ? <div className="mt-2 text-xs text-slate-500 line-clamp-2">{item.node_address}</div> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mapsUrl ? (
          <a
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Maps
          </a>
        ) : null}

        {typeof onTake === 'function' ? (
          <button
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => onTake(item)}
          >
            Ambil
          </button>
        ) : null}

        {typeof onStart === 'function' ? (
          <button
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500"
            onClick={() => onStart(item)}
          >
            Mulai
          </button>
        ) : null}

        {typeof onDone === 'function' ? (
          <button
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => onDone(item)}
          >
            Selesai
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function TechnicianJobsPage() {
  return (
    <ToastProvider>
      <TechnicianJobsInner />
    </ToastProvider>
  );
}
