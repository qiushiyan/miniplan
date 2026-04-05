"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { memo } from "react";

export type AONNodeData = {
  activityName: string;
  activityId: string;
  duration: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  isCritical: boolean;
};

export type AONNodeType = Node<AONNodeData, "aon">;

export const AONNode = memo(function AONNode({
  data,
}: NodeProps<AONNodeType>) {
  const isCritical = data.isCritical;

  return (
    <div
      className={`rounded-md border-2 bg-white text-xs shadow-sm dark:bg-zinc-900 ${
        isCritical
          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
          : "border-zinc-300 dark:border-zinc-600"
      }`}
      style={{ minWidth: 160 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />

      {/* Row 1: ES | Name | EF */}
      <div className="grid grid-cols-[40px_1fr_40px] border-b border-zinc-200 dark:border-zinc-700">
        <div className="border-r border-zinc-200 px-2 py-1.5 text-center font-mono text-muted-foreground dark:border-zinc-700">
          {data.es}
        </div>
        <div className="px-2 py-1.5 text-center font-medium truncate">
          {data.activityName}
        </div>
        <div className="border-l border-zinc-200 px-2 py-1.5 text-center font-mono text-muted-foreground dark:border-zinc-700">
          {data.ef}
        </div>
      </div>

      {/* Row 2: | Duration | */}
      <div className="grid grid-cols-[40px_1fr_40px] border-b border-zinc-200 dark:border-zinc-700">
        <div className="border-r border-zinc-200 dark:border-zinc-700" />
        <div className="px-2 py-1 text-center font-mono">
          {data.duration}d
        </div>
        <div className="border-l border-zinc-200 dark:border-zinc-700" />
      </div>

      {/* Row 3: LS | Float | LF */}
      <div className="grid grid-cols-[40px_1fr_40px]">
        <div className="border-r border-zinc-200 px-2 py-1.5 text-center font-mono text-muted-foreground dark:border-zinc-700">
          {data.ls}
        </div>
        <div
          className={`px-2 py-1.5 text-center font-mono ${
            data.totalFloat === 0
              ? "font-medium text-red-600"
              : "text-muted-foreground"
          }`}
        >
          {data.totalFloat}
        </div>
        <div className="border-l border-zinc-200 px-2 py-1.5 text-center font-mono text-muted-foreground dark:border-zinc-700">
          {data.lf}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
    </div>
  );
});
