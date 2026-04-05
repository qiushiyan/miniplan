import type { Schedule } from "../schedule/types";
import { cloneSchedule } from "../schedule/engine";
import { runCPM } from "../schedule/cpm";
import { createSdkBindings, SDK_FUNCTION_NAMES } from "../schedule/sdk";

export type ExecutionResult = {
  success: boolean;
  resultSchedule: Schedule;
  error?: string;
};

/**
 * Execute generated JavaScript code against a schedule clone.
 * Creates SDK bindings, runs the code via new Function(), then recalculates CPM.
 * Returns the mutated schedule or an error.
 */
export function executeCode(
  code: string,
  schedule: Schedule
): ExecutionResult {
  const clone = cloneSchedule(schedule);
  const bindings = createSdkBindings(clone);

  try {
    // Create a function with SDK bindings as parameters
    const fn = new Function(...SDK_FUNCTION_NAMES, code);

    // Call with the bound SDK functions
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

    // Recalculate CPM after mutations
    const resultSchedule = runCPM(clone);

    return { success: true, resultSchedule };
  } catch (err) {
    return {
      success: false,
      resultSchedule: schedule,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
