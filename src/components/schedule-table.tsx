"use client";

import type { Schedule } from "@/lib/schedule/types";

export function ScheduleTable({ schedule }: { schedule: Schedule | null }) {
  if (!schedule) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Project Duration: {schedule.projectDuration} days
        </h3>
        <span className="text-xs text-muted-foreground">
          Critical: {schedule.criticalPath.join(" → ")}
        </span>
      </div>
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Activity</th>
              <th className="px-3 py-2 text-right">Dur</th>
              <th className="px-3 py-2 text-right">ES</th>
              <th className="px-3 py-2 text-right">EF</th>
              <th className="px-3 py-2 text-right">LS</th>
              <th className="px-3 py-2 text-right">LF</th>
              <th className="px-3 py-2 text-right">Float</th>
            </tr>
          </thead>
          <tbody>
            {schedule.activities.map((a) => {
              const isCritical = schedule.criticalPath.includes(a.id);
              return (
                <tr
                  key={a.id}
                  className={
                    isCritical
                      ? "border-b bg-red-50 dark:bg-red-950/20"
                      : "border-b"
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.duration}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.es}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.ef}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.ls}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.lf}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {a.float === 0 ? (
                      <span className="text-red-600 font-medium">0</span>
                    ) : (
                      a.float
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
