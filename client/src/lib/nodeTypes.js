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
    // Core infra
    case 'odc':
      // Ungu (ODC)
      return '#7c3aed';
    case 'pon':
      // Kuning/amber (PON)
      return '#d97706';
    case 'box':
      // Hijau (ODP/BOX)
      return '#16a34a';
    case 'pole':
      // Coklat/orange (Tiang)
      return '#9a3412';
    case 'customer':
      // Abu gelap (Customer)
      return '#334155';
    case 'server':
      // Biru (Server)
      return '#2563eb';
    case 'olc':
      // Merah (OLC)
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
