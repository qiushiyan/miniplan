import type { Schedule, DateConstraint } from "./types";
import { runCPM } from "./cpm";

/**
 * Deep clone a schedule to avoid mutation of the original.
 */
export function cloneSchedule(schedule: Schedule): Schedule {
  return JSON.parse(JSON.stringify(schedule));
}

/**
 * Apply a duration change to an activity.
 * Returns a new schedule with CPM recalculated.
 */
export function applyDurationChange(
  schedule: Schedule,
  activityId: string,
  duration: number
): Schedule {
  const clone = cloneSchedule(schedule);
  const activity = clone.activities.find((a) => a.id === activityId);
  if (!activity) {
    throw new Error(`Activity '${activityId}' not found`);
  }
  if (duration <= 0) {
    throw new Error(`Duration must be positive, got ${duration}`);
  }
  activity.duration = duration;
  return runCPM(clone);
}

/**
 * Add a new Finish-to-Start dependency.
 * Returns a new schedule with CPM recalculated.
 */
export function applyNewDependency(
  schedule: Schedule,
  fromId: string,
  toId: string
): Schedule {
  const clone = cloneSchedule(schedule);

  // Verify both activities exist
  if (!clone.activities.find((a) => a.id === fromId)) {
    throw new Error(`Activity '${fromId}' not found`);
  }
  if (!clone.activities.find((a) => a.id === toId)) {
    throw new Error(`Activity '${toId}' not found`);
  }

  // Check for duplicate
  const exists = clone.dependencies.some(
    (d) => d.fromId === fromId && d.toId === toId
  );
  if (exists) {
    throw new Error(
      `Dependency from '${fromId}' to '${toId}' already exists`
    );
  }

  clone.dependencies.push({ fromId, toId, type: "FINISH_TO_START" });
  return runCPM(clone);
}

/**
 * Remove a dependency.
 * Returns a new schedule with CPM recalculated.
 */
export function applyRemoveDependency(
  schedule: Schedule,
  fromId: string,
  toId: string
): Schedule {
  const clone = cloneSchedule(schedule);
  const idx = clone.dependencies.findIndex(
    (d) => d.fromId === fromId && d.toId === toId
  );
  if (idx === -1) {
    throw new Error(
      `Dependency from '${fromId}' to '${toId}' not found`
    );
  }
  clone.dependencies.splice(idx, 1);
  return runCPM(clone);
}

/**
 * Apply a date constraint to an activity.
 * Returns a new schedule with CPM recalculated.
 */
export function applyDateConstraint(
  schedule: Schedule,
  activityId: string,
  day: number,
  type: DateConstraint["type"]
): Schedule {
  const clone = cloneSchedule(schedule);
  if (!clone.activities.find((a) => a.id === activityId)) {
    throw new Error(`Activity '${activityId}' not found`);
  }
  clone.constraints.push({ activityId, day, type });
  return runCPM(clone);
}
