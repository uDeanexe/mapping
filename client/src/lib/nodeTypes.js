export const DEFAULT_NODE_TYPES = [
  { id: 1, name: 'odc', label: 'ODC' },
  { id: 2, name: 'pon', label: 'PON' },
  { id: 3, name: 'box', label: 'Box / ODP' },
  { id: 4, name: 'pole', label: 'Tiang' },
  { id: 5, name: 'customer', label: 'Customer' },
  { id: 6, name: 'server', label: 'Server' },
  { id: 7, name: 'olc', label: 'OLC' }
];

export function typeColor(type) {
  switch (type) {
    case 'odc':
      return '#7c3aed';
    case 'pon':
      return '#2563eb';
    case 'box':
      return '#059669';
    case 'pole':
      return '#d97706';
    case 'customer':
      return '#111827';
    case 'server':
      return '#0f766e';
    case 'olc':
      return '#be123c';
    default:
      return '#111827';
  }
}

export function typeIconKey(type) {
  switch (type) {
    case 'box':
      return 'odp';
    case 'pole':
      return 'tiang';
    default:
      return type || 'node';
  }
}

export function googleMapsLink(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}
