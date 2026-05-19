import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { typeColor } from '../lib/nodeTypes.js';

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
    const withCoord = nodes.find((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude));
    return withCoord
      ? { lat: Number(withCoord.latitude), lng: Number(withCoord.longitude) }
      : { lat: -6.2615, lng: 107.1528 };
  }, [nodes]);

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="muted">Ringkasan jaringan, gangguan, dan pekerjaan lapangan.</div>
        </div>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="card dashboard-map-card" style={{ marginBottom: 24, overflow: 'hidden', padding: 0 }}>
        <div style={{ height: 420, width: '100%' }}>
          <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {nodes
              .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
              .map((node) => (
                <Marker key={node.id} position={[Number(node.latitude), Number(node.longitude)]} icon={markerIcon(node.type)}>
                  <Popup>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{node.code}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{node.name || '-'}</div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="muted">Data Node</div>
            <svg width="20" height="20" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
          </div>
          <div className="stat-value">{totals.nodes ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="muted">Data Link</div>
            <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </div>
          <div className="stat-value">{totals.links ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="muted">Gangguan</div>
            <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="stat-value">{totals.incidents ?? '-'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="muted">Rekam Kerja</div>
            <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <div className="stat-value">{totals.work_reports ?? '-'}</div>
        </div>
      </div>

      <div className="mobile-quick-actions">
        <Link className="button button-primary" to="/gangguan">Buka Gangguan</Link>
        <Link className="button button-secondary" to="/rekam-kerja">Rekam Kerja</Link>
        <Link className="button button-ghost" to="/map">Lihat Map</Link>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Status Gangguan</h3>
          <div className="report-list">
            {(data?.incident_by_status || []).length === 0 ? (
              <div className="muted">Belum ada gangguan.</div>
            ) : (
              data.incident_by_status.map((row) => (
                <div className="status-row" key={row.status}>
                  <span>{row.status}</span>
                  <strong>{row.total}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3>Gangguan Terbaru</h3>
          <div className="report-list">
            {(data?.latest_incidents || []).length === 0 ? (
              <div className="muted">Belum ada gangguan.</div>
            ) : (
              data.latest_incidents.map((row) => (
                <div className="status-row" key={row.id}>
                  <span>
                    #{row.id} {row.title}
                    <span className="muted"> | {row.node_code || '-'}</span>
                  </span>
                  <strong>{row.status}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
