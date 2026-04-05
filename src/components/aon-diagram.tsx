"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { Schedule } from "@/lib/schedule/types";
import { AONNode, type AONNodeType } from "./aon-node";

const nodeTypes = { aon: AONNode };

const NODE_WIDTH = 160;
const NODE_HEIGHT = 90;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 60 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function AONDiagram({ schedule }: { schedule: Schedule | null }) {
  const { nodes, edges } = useMemo(() => {
    if (!schedule) return { nodes: [], edges: [] };

    const criticalSet = new Set(schedule.criticalPath);

    // Build nodes
    const rawNodes: AONNodeType[] = schedule.activities.map((a) => ({
      id: a.id,
      type: "aon" as const,
      position: { x: 0, y: 0 },
      data: {
        activityName: a.name,
        activityId: a.id,
        duration: a.duration,
        es: a.es,
        ef: a.ef,
        ls: a.ls,
        lf: a.lf,
        totalFloat: a.float,
        isCritical: criticalSet.has(a.id),
      },
    }));

    // Build edges
    const rawEdges: Edge[] = schedule.dependencies.map((dep) => {
      const isCriticalEdge =
        criticalSet.has(dep.fromId) && criticalSet.has(dep.toId);
      return {
        id: `${dep.fromId}-${dep.toId}`,
        source: dep.fromId,
        target: dep.toId,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCriticalEdge ? "#ef4444" : "#94a3b8",
        },
        style: {
          stroke: isCriticalEdge ? "#ef4444" : "#94a3b8",
          strokeWidth: isCriticalEdge ? 2.5 : 1.5,
        },
      };
    });

    return getLayoutedElements(rawNodes, rawEdges);
  }, [schedule]);

  if (!schedule) return null;

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
