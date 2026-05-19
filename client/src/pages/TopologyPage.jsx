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
import { apiGet, apiPatchJson, apiPostJson } from '../lib/api.js';
import { typeColor } from '../lib/nodeTypes.js';
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

  const flowNodes = useMemo(
    () =>
      mergePositions(nodesRaw, nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesRaw]
  );

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
    // Keep edges in sync with server links, but preserve any temp edges
    setEdges((cur) => {
      const temp = cur.filter((e) => String(e.id).startsWith('temp-'));
      return [...temp, ...flowEdges];
    });
  }, [flowEdges, setEdges]);

  useEffect(() => {
    // Force edges to recompute their path after node position changes
    // (helps when endpoints look stale after dragging)
    setEdges((eds) => eds.map((e) => ({ ...e })));
  }, [nodes, setEdges]);

  useEffect(() => {
    if (!nodes.length) return;
    // Ensure React Flow recalculates handle positions for default nodes
    for (const n of nodes) updateNodeInternals(n.id);
  }, [nodes, updateNodeInternals]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Topology View</div>
          <div className="muted">Drag node untuk menyusun diagram seperti Packet Tracer sederhana.</div>
        </div>
        <div className="page-actions">
          <Link className="button button-ghost" to="/nodes">
            Tambah Node
          </Link>
          <Link className="button button-ghost" to="/links">
            Tambah Link
          </Link>
          <button
            className="button button-secondary"
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

      <div className="topology-wrap">
        {loading ? (
          <div className="card">Loading topology...</div>
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
                    {
                      id: Number(newId),
                      source_node_id: sourceId,
                      target_node_id: targetId
                    },
                    ...prev
                  ]);
                } else {
                  const l = await apiGet('/api/links');
                  setLinksRaw(l);
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
          <div className="sidepanel">
            <div className="sidepanel-title">{selected.code}</div>
            <div className="sidepanel-row">
              <span className="muted">Jenis:</span> {selected.type || '-'}
            </div>
            <div className="sidepanel-row">
              <span className="muted">Nama:</span> {selected.name || '-'}
            </div>
            <div className="sidepanel-row">
              <span className="muted">Alamat:</span> {selected.address || '-'}
            </div>
            <div className="sidepanel-row">
              <span className="muted">Catatan:</span> {selected.notes || '-'}
            </div>
            <button className="button button-ghost" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setSelected(null)}>
              Tutup
            </button>
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
