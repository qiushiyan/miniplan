import type { Activity, Schedule } from "./types";
import { runCPM } from "./cpm";

/**
 * Creates SDK function bindings that operate on a mutable schedule clone.
 * These functions are injected into the `new Function()` scope during code execution.
 *
 * After each mutating call, CPM is recomputed and derived state (maps, critical path)
 * is rebuilt so that subsequent reads in the same execution block see fresh data.
 */
export function createSdkBindings(schedule: Schedule) {
  let activityMap = new Map(schedule.activities.map((a) => [a.id, a]));
  let predecessorMap = new Map<string, string[]>();
  let successorMap = new Map<string, string[]>();

  function rebuildDerivedState() {
    // Recompute CPM in place — mutates schedule.activities, .projectDuration, .criticalPath
    const updated = runCPM(schedule);
    schedule.activities = updated.activities;
    schedule.projectDuration = updated.projectDuration;
    schedule.criticalPath = updated.criticalPath;

    // Rebuild maps
    activityMap = new Map(schedule.activities.map((a) => [a.id, a]));
    predecessorMap = new Map<string, string[]>();
    successorMap = new Map<string, string[]>();
    for (const a of schedule.activities) {
      predecessorMap.set(a.id, []);
      successorMap.set(a.id, []);
    }
    for (const dep of schedule.dependencies) {
      predecessorMap.get(dep.toId)?.push(dep.fromId);
      successorMap.get(dep.fromId)?.push(dep.toId);
    }
  }

  // Initial build
  rebuildDerivedState();

  // --- Reading functions ---

  function getActivity(id: string): Activity {
    const a = activityMap.get(id);
    if (!a) throw new Error(`Activity '${id}' not found`);
    return a;
  }

  function getAllActivities(): Activity[] {
    return schedule.activities;
  }

  function getActivityByName(name: string): Activity | undefined {
    return schedule.activities.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
  }

  function getPredecessors(activityId: string): Activity[] {
    const predIds = predecessorMap.get(activityId);
    if (!predIds) throw new Error(`Activity '${activityId}' not found`);
    return predIds.map((id) => activityMap.get(id)!);
  }

  function getSuccessors(activityId: string): Activity[] {
    const succIds = successorMap.get(activityId);
    if (!succIds) throw new Error(`Activity '${activityId}' not found`);
    return succIds.map((id) => activityMap.get(id)!);
  }

  function getCriticalPath(): Activity[] {
    return schedule.criticalPath.map((id) => activityMap.get(id)!);
  }

  function getActivityFloat(activityId: string): number {
    const a = activityMap.get(activityId);
    if (!a) throw new Error(`Activity '${activityId}' not found`);
    return a.float;
  }

  // --- Modifying functions (mutate + recompute) ---

  function setActivityDuration(
    activityId: string,
    duration: number,
    _unit: "days"
  ): void {
    const a = activityMap.get(activityId);
    if (!a) throw new Error(`Activity '${activityId}' not found`);
    if (duration <= 0)
      throw new Error(`Duration must be positive, got ${duration}`);
    a.duration = duration;
    rebuildDerivedState();
  }

  function createDependency(
    fromId: string,
    toId: string,
    _type: "FINISH_TO_START"
  ): void {
    if (!activityMap.has(fromId))
      throw new Error(`Activity '${fromId}' not found`);
    if (!activityMap.has(toId))
      throw new Error(`Activity '${toId}' not found`);

    const exists = schedule.dependencies.some(
      (d) => d.fromId === fromId && d.toId === toId
    );
    if (exists)
      throw new Error(
        `Dependency from '${fromId}' to '${toId}' already exists`
      );

    schedule.dependencies.push({ fromId, toId, type: "FINISH_TO_START" });
    rebuildDerivedState();
  }

  function removeDependency(fromId: string, toId: string): void {
    const idx = schedule.dependencies.findIndex(
      (d) => d.fromId === fromId && d.toId === toId
    );
    if (idx === -1)
      throw new Error(
        `Dependency from '${fromId}' to '${toId}' not found`
      );
    schedule.dependencies.splice(idx, 1);
    rebuildDerivedState();
  }

  function applyDateConstraint(
    activityId: string,
    day: number,
    type: "START_AFTER" | "FINISH_BEFORE"
  ): void {
    if (!activityMap.has(activityId))
      throw new Error(`Activity '${activityId}' not found`);
    schedule.constraints.push({ activityId, day, type });
    rebuildDerivedState();
  }

  return {
    getActivity,
    getAllActivities,
    getActivityByName,
    getPredecessors,
    getSuccessors,
    getCriticalPath,
    getActivityFloat,
    setActivityDuration,
    createDependency,
    removeDependency,
    applyDateConstraint,
  };
}

/** Names of all SDK functions — used for new Function() parameter injection */
export const SDK_FUNCTION_NAMES = [
  "getActivity",
  "getAllActivities",
  "getActivityByName",
  "getPredecessors",
  "getSuccessors",
  "getCriticalPath",
  "getActivityFloat",
  "setActivityDuration",
  "createDependency",
  "removeDependency",
  "applyDateConstraint",
] as const;
