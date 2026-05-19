import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function pinIcon() {
  return L.divIcon({
    html: `
      <div style="
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #111827;
        border: 2px solid #fff;
        box-shadow: 0 6px 16px rgba(0,0,0,.22);
      "></div>
    `,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function ClickToSet({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

export default function LocationPicker({
  value,
  onChange,
  height = 260,
  defaultCenter = { lat: -6.2615, lng: 107.1528 }
}) {
  const [dragging, setDragging] = useState(false);

  const center = useMemo(() => {
    if (value && Number.isFinite(value.lat) && Number.isFinite(value.lng)) return value;
    return defaultCenter;
  }, [value, defaultCenter]);

  useEffect(() => {
    // no-op: keeps component predictable when mounted/unmounted
  }, []);

  return (
    <div className="locpicker">
      <div className="locpicker-help muted">
        Klik peta untuk set koordinat. Marker bisa di-drag. {dragging ? 'Sedang drag…' : ''}
      </div>
      <div className="locpicker-map" style={{ height }}>
        <MapContainer className="map" center={center} zoom={16} scrollWheelZoom>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToSet onPick={onChange} />
          {value && Number.isFinite(value.lat) && Number.isFinite(value.lng) ? (
            <Marker
              position={[value.lat, value.lng]}
              draggable
              icon={pinIcon()}
              eventHandlers={{
                dragstart: () => setDragging(true),
                dragend: (e) => {
                  setDragging(false);
                  const m = e.target;
                  const p = m.getLatLng();
                  onChange({ lat: p.lat, lng: p.lng });
                }
              }}
            />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}

