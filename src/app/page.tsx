"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat";
import { AONDiagram } from "@/components/aon-diagram";
import { ResourceBar } from "@/components/resource-bar";
import { ScheduleTable } from "@/components/schedule-table";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/lib/schedule/types";

const HIGHLIGHT_DURATION_MS = 1500;

export default function Home() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [undoing, setUndoing] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then(setSchedule);
  }, []);

  const handleScheduleUpdate = useCallback(
    (newSchedule: Schedule, changedActivityIds?: string[]) => {
      setSchedule(newSchedule);

      if (changedActivityIds && changedActivityIds.length > 0) {
        clearTimeout(highlightTimerRef.current);
        setHighlightedIds(new Set(changedActivityIds));
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedIds(new Set());
        }, HIGHLIGHT_DURATION_MS);
      }
    },
    []
  );

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    try {
      const res = await fetch("/api/undo", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        handleScheduleUpdate(data.schedule);
      }
    } finally {
      setUndoing(false);
    }
  }, [handleScheduleUpdate]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold">MiniPlan</h1>
          <span className="ml-2 text-sm text-muted-foreground">
            AI Schedule Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          {schedule && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {schedule.projectDuration} days
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            aria-label="Undo last schedule change"
            onClick={handleUndo}
            disabled={undoing}
          >
            {undoing ? "Undoing..." : "Undo"}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - Left */}
        <div className="flex w-2/5 flex-col border-r">
          <ChatPanel onScheduleUpdate={handleScheduleUpdate} />
        </div>

        {/* Visualization Panel - Right */}
        <div className="flex w-3/5 flex-col overflow-auto">
          {/* AON Diagram */}
          <div className="h-[400px] border-b">
            <AONDiagram schedule={schedule} highlightedIds={highlightedIds} />
          </div>

          {/* Resource Bar + Table */}
          <div className="space-y-6 p-6">
            <ResourceBar schedule={schedule} highlightedIds={highlightedIds} />
            <ScheduleTable schedule={schedule} highlightedIds={highlightedIds} />
          </div>
        </div>
      </div>
    </div>
  );
}
