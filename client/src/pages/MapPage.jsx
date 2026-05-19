import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiGet } from '../lib/api.js';
import { googleMapsLink, typeColor } from '../lib/nodeTypes.js';
import { ToastProvider, useToast } from '../components/Toast.jsx';

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.2));
  }, [map, points]);
  return null;
}

function markerIcon(type) {
  const color = typeColor(type);
  const html = `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: ${color};
      border: 2px solid #fff;
      box-shadow: 0 6px 16px rgba(0,0,0,.22);
    "></div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function MapInner() {
  const toast = useToast();
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const center = useMemo(() => {
    const withCoord = nodes.find((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude));
    return withCoord
      ? { lat: Number(withCoord.latitude), lng: Number(withCoord.longitude) }
      : { lat: -6.2615, lng: 107.1528 };
  }, [nodes]);

  const points = useMemo(() => {
    return nodes
      .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
      .map((n) => ({ lat: Number(n.latitude), lng: Number(n.longitude) }));
  }, [nodes]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const [n, l] = await Promise.all([apiGet('/api/nodes'), apiGet('/api/links')]);
        if (!alive) return;
        setNodes(n);
        setLinks(l);
      } catch (e) {
        toast.error(e.message || 'Gagal load data');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [toast]);

  const polylines = useMemo(() => {
    return links
      .filter(
        (l) =>
          Number.isFinite(l.source_latitude) &&
          Number.isFinite(l.source_longitude) &&
          Number.isFinite(l.target_latitude) &&
          Number.isFinite(l.target_longitude)
      )
      .map((l) => ({
        id: l.id,
        path: [
          [Number(l.source_latitude), Number(l.source_longitude)],
          [Number(l.target_latitude), Number(l.target_longitude)]
        ]
      }));
  }, [links]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Map View</div>
          <div className="muted">Marker + polyline berdasarkan koordinat GPS (OpenStreetMap).</div>
        </div>
        <div className="page-actions">
          <button
            className="button button-secondary"
            onClick={async () => {
              try {
                const [n, l] = await Promise.all([apiGet('/api/nodes'), apiGet('/api/links')]);
                setNodes(n);
                setLinks(l);
                toast.success('Data diperbarui');
              } catch (e) {
                toast.error(e.message || 'Gagal refresh');
              }
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="map-wrap">
        <MapContainer className="map" center={center} zoom={15} scrollWheelZoom>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={points} />

          {polylines.map((p) => (
            <Polyline
              key={p.id}
              positions={p.path}
              pathOptions={{
                color: '#111827',
                weight: 1.2,
                opacity: 0.65,
                dashArray: '6 8',
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          ))}

          {nodes
            .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
            .map((node) => (
              <Marker
                key={node.id}
                position={[Number(node.latitude), Number(node.longitude)]}
                icon={markerIcon(node.type)}
              >
                <Popup>
                  <div className="popup">
                    <div className="popup-title">{node.code}</div>
                    <div className="popup-row">
                      <span className="muted">Nama:</span> {node.name || '-'}
                    </div>
                    <div className="popup-row">
                      <span className="muted">Jenis:</span> {node.type || '-'}
                    </div>
                  <div className="popup-row">
                    <span className="muted">Koordinat:</span> {node.latitude}, {node.longitude}
                  </div>
                  {Number.isFinite(Number(node.latitude)) && Number.isFinite(Number(node.longitude)) ? (
                    <div className="popup-row">
                      <a
                        className="link"
                        href={googleMapsLink(Number(node.latitude), Number(node.longitude))}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka di Google Maps
                      </a>
                    </div>
                  ) : null}
                  <div className="popup-row">
                    <span className="muted">Alamat:</span> {node.address || '-'}
                  </div>
                    <div className="popup-row">
                      <span className="muted">Catatan:</span> {node.notes || '-'}
                    </div>
                    {node.photo_path ? (
                      <img className="popup-photo" alt={node.code} src={node.photo_path} />
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            ))}

          {loading ? (
            <div className="leaflet-overlay-status">
              <div className="card">Loading data...</div>
            </div>
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <ToastProvider>
      <MapInner />
    </ToastProvider>
  );
}
