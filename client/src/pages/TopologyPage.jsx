import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
  useUpdateNodeInternals,
  ConnectionMode,
  addEdge,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Link } from 'react-router-dom';
import { apiDownload, apiGet, apiPatchJson, apiPostJson } from '../lib/api.js';
import { ToastProvider, useToast } from '../components/Toast.jsx';
import TopologyNode from '../components/TopologyNode.jsx';

const NODE_TYPES = { topologyNode: TopologyNode };

function mergePositions(serverNodes, currentFlowNodes) {
  const byId = new Map(currentFlowNodes.map((n) => [String(n.id), n]));
  return serverNodes.map((n) => {
    const existing = byId.get(String(n.id));
    const position = existing?.position ?? {
      x: Number(n.topology_x ?? 100),
      y: Number(n.topology_y ?? 100)
    };
    return {
      id: String(n.id),
      position,
      data: { label: n.code, type: n.type },
      type: 'topologyNode',
      style: {
        width: 190
      }
    };
  });
}

function TopologyInner() {
  const toast = useToast();
  const [nodesRaw, setNodesRaw] = useState([]);
  const [linksRaw, setLinksRaw] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const lastSavedRef = React.useRef(new Map());
  const updateNodeInternals = useUpdateNodeInternals();

  async function downloadTopologyPdf() {
    try {
      await apiDownload('/api/topology/report.pdf', `topology-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF topology berhasil diunduh');
    } catch (e) {
      toast.error(e.message || 'Gagal unduh PDF topology');
    }
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const [n, l] = await Promise.all([apiGet('/api/nodes'), apiGet('/api/links')]);
        if (!alive) return;
        setNodesRaw(n);
        setLinksRaw(l);
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

  const flowEdges = useMemo(
    () =>
      linksRaw.map((l) => ({
        id: `e-${l.id}`,
        source: String(l.source_node_id),
        target: String(l.target_node_id),
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#111827' },
        label: (() => {
          const a = l.cable_type ? String(l.cable_type) : '';
          const b = l.core_count ? `core ${l.core_count}` : '';
          const c = l.core_number ? String(l.core_number) : '';
          return [a, b, c].filter(Boolean).join(' • ');
        })(),
        animated: false,
        style: { stroke: '#111827', strokeWidth: 1.0, strokeDasharray: '6 8' },
        labelStyle: { fill: '#111827', fontWeight: 800 },
        labelBgStyle: { fill: 'rgba(255,255,255,0.92)', stroke: '#e5e7eb', strokeWidth: 1 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 8
      })),
    [linksRaw]
  );

  useEffect(() => {
    setNodes((cur) => mergePositions(nodesRaw, cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesRaw]);

  useEffect(() => {
    setEdges((cur) => {
      const temp = cur.filter((e) => String(e.id).startsWith('temp-'));
      return [...temp, ...flowEdges];
    });
  }, [flowEdges, setEdges]);

  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e })));
  }, [nodes, setEdges]);

  useEffect(() => {
    if (!nodes.length) return;
    for (const n of nodes) updateNodeInternals(n.id);
  }, [nodes, updateNodeInternals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Topology View
          </h2>
          <p className="mt-1 text-sm text-slate-500">Drag node untuk menyusun diagram seperti Packet Tracer sederhana.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors border border-slate-200"
            to="/nodes"
          >
            Tambah Node
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors border border-slate-200"
            to="/links"
          >
            Tambah Link
          </Link>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={downloadTopologyPdf}
          >
            Export PDF
          </button>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={async () => {
              try {
                const [n, l] = await Promise.all([apiGet('/api/nodes'), apiGet('/api/links')]);
                setNodesRaw(n);
                setLinksRaw(l);
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

      <div className="relative rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden min-h-[520px] h-[72vh]">
        {loading ? (
          <div className="p-6 text-sm font-semibold text-slate-600">Loading topology…</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={async (connection) => {
              const sourceId = connection.source ? Number(connection.source) : NaN;
              const targetId = connection.target ? Number(connection.target) : NaN;
              if (!Number.isFinite(sourceId) || !Number.isFinite(targetId)) return;
              if (sourceId === targetId) {
                toast.error('Node asal dan tujuan tidak boleh sama');
                return;
              }

              const exists = linksRaw.some(
                (l) => Number(l.source_node_id) === sourceId && Number(l.target_node_id) === targetId
              );
              if (exists) {
                toast.info('Link sudah ada');
                return;
              }

              const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
              setEdges((eds) =>
                addEdge(
                  {
                    ...connection,
                    id: tempId,
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#111827' },
                    style: { stroke: '#111827', strokeWidth: 1.0, strokeDasharray: '6 8' }
                  },
                  eds
                )
              );

              try {
                const created = await apiPostJson('/api/links', {
                  source_node_id: sourceId,
                  target_node_id: targetId
                });
                const newId = created?.id;
                if (Number.isFinite(Number(newId))) {
                  setLinksRaw((prev) => [
                    { id: Number(newId), source_node_id: sourceId, target_node_id: targetId },
                    ...prev
                  ]);
                } else {
                  setLinksRaw(await apiGet('/api/links'));
                }
                toast.success('Link dibuat');
              } catch (e) {
                setEdges((eds) => eds.filter((ed) => String(ed.id) !== tempId));
                toast.error(e.message || 'Gagal simpan link');
              }
            }}
            onNodeClick={(evt, node) => {
              const found = nodesRaw.find((n) => String(n.id) === String(node.id));
              setSelected(found || null);
            }}
            onNodeDragStop={async (evt, node) => {
              try {
                updateNodeInternals(node.id);
                const prev = lastSavedRef.current.get(String(node.id));
                const nextX = Math.round(node.position.x);
                const nextY = Math.round(node.position.y);
                if (prev && prev.x === nextX && prev.y === nextY) return;

                await apiPatchJson(`/api/nodes/${node.id}/position`, {
                  topology_x: nextX,
                  topology_y: nextY
                });
                lastSavedRef.current.set(String(node.id), { x: nextX, y: nextY });
              } catch (e) {
                toast.error(e.message || 'Gagal simpan posisi');
              }
            }}
            nodesDraggable
            nodesConnectable
            panOnDrag
            selectionOnDrag
            snapToGrid
            snapGrid={[10, 10]}
            connectionMode={ConnectionMode.Loose}
            fitView
          >
            <MiniMap nodeStrokeColor={(n) => n.style?.borderColor || '#111827'} nodeColor={() => '#ffffff'} />
            <Controls />
            <Background variant="dots" gap={18} size={1.2} />
          </ReactFlow>
        )}

        {selected ? (
          <div className="absolute top-4 right-4 w-[min(380px,calc(100%-2rem))] max-h-[60vh] overflow-auto rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg shadow-slate-900/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{selected.code}</div>
                <div className="mt-0.5 text-xs text-slate-500">Detail node</div>
              </div>
              <button
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                onClick={() => setSelected(null)}
                aria-label="Tutup"
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <span className="text-slate-500">Jenis:</span> {selected.type || '-'}
              </div>
              <div>
                <span className="text-slate-500">Nama:</span> {selected.name || '-'}
              </div>
              <div>
                <span className="text-slate-500">Alamat:</span> {selected.address || '-'}
              </div>
              <div>
                <span className="text-slate-500">Catatan:</span> {selected.notes || '-'}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TopologyPage() {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <TopologyInner />
      </ReactFlowProvider>
    </ToastProvider>
  );
}
