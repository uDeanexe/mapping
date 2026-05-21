import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiGet } from '../lib/api.js';
import { googleMapsLink, typeColor } from '../lib/nodeTypes.js';
import { ToastProvider, useToast } from '../components/Toast.jsx';

function EnsureLeafletSize() {
  const map = useMap();
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;

    const invalidate = () => map.invalidateSize({ pan: false });

    raf1 = requestAnimationFrame(() => {
      invalidate();
      raf2 = requestAnimationFrame(invalidate);
    });

    const onResize = () => invalidate();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [map]);
  return null;
}

function toValidCoord(node) {
  const lat = Number(node?.latitude);
  const lng = Number(node?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    const spanLat = Math.abs(bounds.getNorth() - bounds.getSouth());
    const spanLng = Math.abs(bounds.getEast() - bounds.getWest());

    // Guardrail: if a single outlier point exists, fitBounds can zoom out to world view.
    // Default behavior: fit only when the cluster is reasonably local.
    if (spanLat > 5 || spanLng > 5) return;

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
    const withCoord = nodes.find((n) => toValidCoord(n));
    return withCoord
      ? { lat: Number(withCoord.latitude), lng: Number(withCoord.longitude) }
      : { lat: -6.2615, lng: 107.1528 };
  }, [nodes]);

  const points = useMemo(() => {
    return nodes.map((n) => toValidCoord(n)).filter(Boolean);
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
    const byId = new Map(nodes.map((n) => [String(n.id), n]));
    return links
      .map((l) => {
        const a = byId.get(String(l.source_node_id));
        const b = byId.get(String(l.target_node_id));
        if (!a || !b) return null;
        const ac = toValidCoord(a);
        const bc = toValidCoord(b);
        if (!ac || !bc) return null;
        return {
          id: l.id,
          path: [
            [ac.lat, ac.lng],
            [bc.lat, bc.lng]
          ]
        };
      })
      .filter(Boolean);
  }, [links, nodes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Map View
          </h2>
          <p className="mt-1 text-sm text-slate-500">Marker + polyline berdasarkan koordinat GPS (OpenStreetMap).</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
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

      <div className="relative rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden h-[70vh] min-h-[420px]">
        <MapContainer className="w-full h-full" center={center} zoom={15} scrollWheelZoom>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <EnsureLeafletSize />
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
            .map((node) => {
              const coord = toValidCoord(node);
              if (!coord) return null;
              return (
                <Marker key={node.id} position={[coord.lat, coord.lng]} icon={markerIcon(node.type)}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{node.code}</div>
                    <div className="text-sm text-slate-700">
                      <span className="text-slate-500">Nama:</span> {node.name || '-'}
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="text-slate-500">Jenis:</span> {node.type || '-'}
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="text-slate-500">Koordinat:</span> {node.latitude}, {node.longitude}
                    </div>
                    {Number.isFinite(Number(node.latitude)) && Number.isFinite(Number(node.longitude)) ? (
                      <div className="pt-1">
                        <a
                          className="text-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline"
                          href={googleMapsLink(Number(node.latitude), Number(node.longitude))}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Buka di Google Maps
                        </a>
                      </div>
                    ) : null}
                    <div className="text-sm text-slate-700">
                      <span className="text-slate-500">Alamat:</span> {node.address || '-'}
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="text-slate-500">Catatan:</span> {node.notes || '-'}
                    </div>
                    {node.photo_path ? (
                      <img className="mt-2 w-full max-w-[220px] rounded-lg border border-slate-200" alt={node.code} src={node.photo_path} />
                    ) : null}
                  </div>
                </Popup>
              </Marker>
              );
            })
            .filter(Boolean)}
        </MapContainer>

        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center p-4">
            <div className="pointer-events-auto rounded-xl bg-white border border-slate-200 shadow-lg px-4 py-2 text-sm font-semibold text-slate-700">
              Loading data…
            </div>
          </div>
        ) : null}
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
