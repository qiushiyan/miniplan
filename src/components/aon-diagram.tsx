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

export function AONDiagram({
  schedule,
  highlightedIds = new Set(),
}: {
  schedule: Schedule | null;
  highlightedIds?: Set<string>;
}) {
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
        isHighlighted: highlightedIds.has(a.id),
      },
    }));

    // Build edges — an edge is critical only if both nodes are on the critical path
    // AND the dependency is tight (source finishes exactly when target starts)
    const actMap = new Map(schedule.activities.map((a) => [a.id, a]));
    const rawEdges: Edge[] = schedule.dependencies.map((dep) => {
      const source = actMap.get(dep.fromId);
      const target = actMap.get(dep.toId);
      const isCriticalEdge =
        criticalSet.has(dep.fromId) &&
        criticalSet.has(dep.toId) &&
        source != null &&
        target != null &&
        source.ef === target.es;
      return {
        id: `${dep.fromId}-${dep.toId}`,
        source: dep.fromId,
        target: dep.toId,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCriticalEdge
            ? "var(--color-destructive)"
            : "var(--color-muted-foreground)",
        },
        style: {
          stroke: isCriticalEdge
            ? "var(--color-destructive)"
            : "var(--color-muted-foreground)",
          strokeWidth: isCriticalEdge ? 2.5 : 1.5,
        },
      };
    });

    return getLayoutedElements(rawNodes, rawEdges);
  }, [schedule, highlightedIds]);

  if (!schedule) return null;

  const ariaLabel = `Activity-on-Node network diagram. ${schedule.activities.length} activities. Critical path: ${schedule.criticalPath.join(", ")}. Project duration: ${schedule.projectDuration} days.`;

  return (
    <div className="h-full w-full" role="img" aria-label={ariaLabel}>
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
