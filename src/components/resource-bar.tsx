"use client";

import type { Schedule } from "@/lib/schedule/types";

type ResourceUsage = {
  resourceId: string;
  resourceName: string;
  available: number;
  days: { day: number; used: number; overAllocated: boolean }[];
};

function computeResourceUsage(schedule: Schedule): ResourceUsage[] {
  return schedule.resources.map((resource) => {
    const days = [];
    for (let day = 0; day < schedule.projectDuration; day++) {
      let used = 0;
      for (const activity of schedule.activities) {
        if (day >= activity.es && day < activity.ef) {
          for (const req of activity.resources) {
            if (req.resourceId === resource.id) {
              used += req.quantity;
            }
          }
        }
      }
      days.push({
        day,
        used,
        overAllocated: used > resource.available,
      });
    }
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      available: resource.available,
      days,
    };
  });
}

export function ResourceBar({
  schedule,
  highlightedIds = new Set(),
}: {
  schedule: Schedule | null;
  highlightedIds?: Set<string>;
}) {
  if (!schedule || schedule.projectDuration === 0) return null;

  const usages = computeResourceUsage(schedule);
  const hasHighlight = highlightedIds.size > 0;

  return (
    <div
      className={`space-y-3 rounded-lg transition-[box-shadow] duration-1000 ease-out ${hasHighlight ? "ring-2 ring-primary/50 p-3 -m-3 motion-reduce:ring-0" : ""}`}
      role="region"
      aria-label="Resource usage chart"
    >
      <h3 className="text-sm font-medium text-muted-foreground">
        Resource Usage
      </h3>
      {usages.map((usage) => {
        const maxVal = Math.max(usage.available, ...usage.days.map((d) => d.used));
        return (
          <div key={usage.resourceId} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>{usage.resourceName}</span>
              <span className="text-muted-foreground">
                {usage.available} available
              </span>
            </div>
            <div className="flex h-6 gap-px overflow-hidden rounded">
              {usage.days.map((d) => {
                const heightPct =
                  maxVal > 0 ? (d.used / maxVal) * 100 : 0;
                return (
                  <div
                    key={d.day}
                    className="relative flex flex-1 items-end"
                    title={`Day ${d.day}: ${d.used}/${usage.available}`}
                  >
                    <div
                      className={`w-full transition-[background-color] ${
                        d.overAllocated
                          ? "bg-red-500"
                          : d.used > 0
                            ? "bg-blue-400 dark:bg-blue-600"
                            : "bg-zinc-100 dark:bg-zinc-800"
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: d.used > 0 ? 2 : 0 }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Capacity line — positioned relative to bar container above */}
            <div className="pointer-events-none relative -mt-6 h-6">
              <div
                className="absolute left-0 right-0 border-t border-dashed border-zinc-400 dark:border-zinc-500"
                style={{
                  bottom: `${(usage.available / maxVal) * 100}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
