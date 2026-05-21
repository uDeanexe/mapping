import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { typeColor } from '../lib/nodeTypes.js';

function toValidCoord(node) {
  const lat = Number(node?.latitude);
  const lng = Number(node?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function markerIcon(type) {
  const color = typeColor(type);
  const html = `
    <div style="
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid #fff;
      box-shadow: 0 4px 10px rgba(0,0,0,.3);
    "></div>
  `;
  return L.divIcon({ html, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/api/dashboard')
      .then(setData)
      .catch((err) => setError(err.message || 'Gagal load dashboard'));

    apiGet('/api/nodes')
      .then(setNodes)
      .catch(() => {});
  }, []);

  const totals = data?.totals || {};

  const center = useMemo(() => {
    const withCoord = nodes.find((n) => toValidCoord(n));
    return withCoord
      ? { lat: Number(withCoord.latitude), lng: Number(withCoord.longitude) }
      : { lat: -6.2615, lng: 107.1528 };
  }, [nodes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Ringkasan Jaringan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pantau status operasional, gangguan, dan pekerjaan lapangan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/gangguan" className="inline-flex items-center justify-center rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors">
            Buka Gangguan
          </Link>
          <Link to="/rekam-kerja" className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors">
            Rekam Kerja
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-200">
          {error}
        </div>
      ) : null}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col rounded-xl bg-white p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:border-sky-300 hover:scale-[1.01] transform-gpu">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Data Node</h3>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{totals.nodes ?? '-'}</div>
        </div>
        
        <div className="flex flex-col rounded-xl bg-white p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:border-emerald-300 hover:scale-[1.01] transform-gpu">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Data Link</h3>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{totals.links ?? '-'}</div>
        </div>

        <div className="flex flex-col rounded-xl bg-white p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:border-red-300 hover:scale-[1.01] transform-gpu">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Gangguan Aktif</h3>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{totals.incidents ?? '-'}</div>
        </div>

        <div className="flex flex-col rounded-xl bg-white p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:border-amber-300 hover:scale-[1.01] transform-gpu">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Rekam Kerja</h3>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-slate-900">{totals.work_reports ?? '-'}</div>
        </div>
      </div>

      {/* Map Container */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden relative z-10 h-[50vh] min-h-[400px]">
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="w-full h-full">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {nodes
            .map((node) => {
              const coord = toValidCoord(node);
              if (!coord) return null;
              return (
                <Marker key={node.id} position={[coord.lat, coord.lng]} icon={markerIcon(node.type)}>
                <Popup className="rounded-xl">
                  <div className="font-semibold text-slate-900">{node.code}</div>
                  <div className="text-xs text-slate-500 mt-1">{node.name || '-'}</div>
                </Popup>
                </Marker>
              );
            })
            .filter(Boolean)}
        </MapContainer>
      </div>

      {/* Tables / Lists Section */}
      <div className="space-y-6">
        {/* Status Gangguan */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Status Gangguan</h3>
          </div>
          <div className="p-6 flex-1">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-left text-sm">
                <tbody>
                  {(data?.incident_by_status || []).length === 0 ? (
                    <tr><td className="text-slate-500 py-2">Belum ada gangguan.</td></tr>
                  ) : (
                    data.incident_by_status.map((row) => (
                      <tr key={row.status} className="border-b border-slate-50 last:border-0">
                        <td className="py-3 pr-4 font-medium text-slate-700 capitalize">{String(row.status).replace('_', ' ')}</td>
                        <td className="py-3 pl-4 text-right">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                            {row.total}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Gangguan Terbaru */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Gangguan Terbaru</h3>
          </div>
          <div className="p-6 flex-1">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-left text-sm">
                <tbody>
                  {(data?.latest_incidents || []).length === 0 ? (
                    <tr><td className="text-slate-500 py-2">Belum ada laporan terbaru.</td></tr>
                  ) : (
                    data.latest_incidents.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-800">#{row.id} - {row.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{row.node_code || 'Tanpa Node'}</div>
                        </td>
                        <td className="py-3 pl-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
                            ${row.status === 'reported' ? 'bg-red-100 text-red-800' : ''}
                            ${row.status === 'assigned' ? 'bg-amber-100 text-amber-800' : ''}
                            ${row.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : ''}
                            ${row.status === 'completed' || row.status === 'closed' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${!['reported','assigned','in_progress','completed','closed'].includes(row.status) ? 'bg-slate-100 text-slate-800' : ''}
                          `}>
                            {String(row.status).replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
