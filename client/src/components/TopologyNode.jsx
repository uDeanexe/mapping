import React from 'react';
import { Handle, Position } from 'reactflow';
import { typeColor, typeIconKey } from '../lib/nodeTypes.js';

function Icon({ type }) {
  const key = typeIconKey(type);
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' };
  const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

  switch (key) {
    case 'odc':
      return (
        <svg {...common}>
          <path {...stroke} d="M4 7h16M6 7v10m12-10v10M4 17h16" />
          <path {...stroke} d="M8 11h8" />
        </svg>
      );
    case 'pon':
      return (
        <svg {...common}>
          <path {...stroke} d="M7 7h10v10H7z" />
          <path {...stroke} d="M7 12h10" />
          <path {...stroke} d="M12 7v10" />
        </svg>
      );
    case 'odp':
      return (
        <svg {...common}>
          <path {...stroke} d="M6 8h12v12H6z" />
          <path {...stroke} d="M9 8V6h6v2" />
          <path {...stroke} d="M9 14h6" />
        </svg>
      );
    case 'tiang':
      return (
        <svg {...common}>
          <path {...stroke} d="M12 3v18" />
          <path {...stroke} d="M9 21h6" />
          <path {...stroke} d="M7 7h10" />
        </svg>
      );
    case 'server':
      return (
        <svg {...common}>
          <path {...stroke} d="M6 6h12v5H6z" />
          <path {...stroke} d="M6 13h12v5H6z" />
          <path {...stroke} d="M9 9h.01M9 16h.01" />
        </svg>
      );
    case 'olc':
      return (
        <svg {...common}>
          <path {...stroke} d="M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6Z" />
          <path {...stroke} d="M9 9h6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path {...stroke} d="M12 3v18M3 12h18" />
        </svg>
      );
  }
}

export default function TopologyNode({ data }) {
  const color = typeColor(data?.type);
  return (
    <div className="t-node">
      {/* hanya 2 sisi koneksi: kiri (target/masuk) dan kanan (source/keluar) */}
      <Handle type="target" position={Position.Left} className="t-handle" style={{ borderColor: color }} />
      <Handle type="source" position={Position.Right} className="t-handle" style={{ borderColor: color }} />

      <div className="t-node-badge" style={{ background: color }} title={data?.type || 'node'}>
        <Icon type={data?.type} />
      </div>
      <div className="t-node-title">{data?.label}</div>
      <div className="t-node-sub text-slate-500">{(data?.type || '').toUpperCase()}</div>
    </div>
  );
}
