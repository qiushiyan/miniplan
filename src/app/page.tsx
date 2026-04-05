"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat";
import { AONDiagram } from "@/components/aon-diagram";
import { ResourceBar } from "@/components/resource-bar";
import { ScheduleTable } from "@/components/schedule-table";
import { Button } from "@/components/ui/button";
import type { Schedule } from "@/lib/schedule/types";

export default function Home() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then(setSchedule);
  }, []);

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    try {
      const res = await fetch("/api/undo", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule);
      }
    } finally {
      setUndoing(false);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold">MiniPlan</h1>
          <span className="ml-2 text-sm text-muted-foreground">
            AI Schedule Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          {schedule && (
            <span className="text-xs text-muted-foreground">
              {schedule.projectDuration} days
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
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
          <ChatPanel onScheduleUpdate={setSchedule} />
        </div>

        {/* Visualization Panel - Right */}
        <div className="flex w-3/5 flex-col overflow-auto">
          {/* AON Diagram */}
          <div className="h-[400px] border-b">
            <AONDiagram schedule={schedule} />
          </div>

          {/* Resource Bar + Table */}
          <div className="space-y-6 p-6">
            <ResourceBar schedule={schedule} />
            <ScheduleTable schedule={schedule} />
          </div>
        </div>
      </div>
    </div>
  );
}
