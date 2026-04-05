import type { Schedule } from "../schedule/types";
import { cloneSchedule } from "../schedule/engine";
import { detectCircularDependencies } from "../schedule/validation";
import { createSdkBindings, SDK_FUNCTION_NAMES } from "../schedule/sdk";

export type ExecutionResult = {
  success: boolean;
  resultSchedule: Schedule;
  error?: string;
  isCircularDependency?: boolean;
};

/**
 * Execute generated JavaScript code against a schedule clone.
 * Creates SDK bindings (which auto-recompute CPM after each mutation),
 * runs the code via new Function(), then validates the result.
 */
export function executeCode(
  code: string,
  schedule: Schedule
): ExecutionResult {
  const clone = cloneSchedule(schedule);
  const bindings = createSdkBindings(clone);

  try {
    const fn = new Function(...SDK_FUNCTION_NAMES, code);

    fn(
      bindings.getActivity,
      bindings.getAllActivities,
      bindings.getActivityByName,
      bindings.getPredecessors,
      bindings.getSuccessors,
      bindings.getCriticalPath,
      bindings.getActivityFloat,
      bindings.setActivityDuration,
      bindings.createDependency,
      bindings.removeDependency,
      bindings.applyDateConstraint
    );

    // Check for circular dependencies after execution
    const activityIds = clone.activities.map((a) => a.id);
    if (detectCircularDependencies(activityIds, clone.dependencies)) {
      return {
        success: false,
        resultSchedule: schedule,
        error: "Circular dependency detected — change rejected.",
        isCircularDependency: true,
      };
    }

    // clone already has CPM recomputed by SDK bindings
    return { success: true, resultSchedule: clone };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      resultSchedule: schedule,
      error: message,
      isCircularDependency: message.includes("Circular dependency"),
    };
  }
}
