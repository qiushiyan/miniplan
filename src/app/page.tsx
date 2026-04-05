"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat";
import { ScheduleTable } from "@/components/schedule-table";
import type { Schedule } from "@/lib/schedule/types";

export default function Home() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then(setSchedule);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center border-b px-6 py-3">
        <h1 className="text-lg font-semibold">MiniPlan</h1>
        <span className="ml-2 text-sm text-muted-foreground">
          AI Schedule Assistant
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel - Left */}
        <div className="flex w-2/5 flex-col border-r">
          <ChatPanel onScheduleUpdate={setSchedule} />
        </div>

        {/* Visualization Panel - Right */}
        <div className="flex w-3/5 flex-col overflow-auto p-6">
          <ScheduleTable schedule={schedule} />
        </div>
      </div>
    </div>
  );
}
