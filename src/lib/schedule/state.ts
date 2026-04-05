import type { Schedule, ScheduleState, PipelineRun } from "./types";
import { createMockSchedule } from "./mock-data";
import { cloneSchedule } from "./engine";

let state: ScheduleState = {
  current: createMockSchedule(),
  previous: null,
  lastPipelineRun: null,
};

export function getScheduleState(): ScheduleState {
  return state;
}

export function getCurrentSchedule(): Schedule {
  return state.current;
}

/**
 * Commit a new schedule. Shifts current to previous for undo.
 */
export function commit(newSchedule: Schedule): void {
  state = {
    current: newSchedule,
    previous: cloneSchedule(state.current),
    lastPipelineRun: state.lastPipelineRun,
  };
}

/**
 * Undo the last change. Returns the restored schedule, or null if nothing to undo.
 */
export function undo(): Schedule | null {
  if (!state.previous) return null;
  state = {
    current: state.previous,
    previous: null,
    lastPipelineRun: state.lastPipelineRun,
  };
  return state.current;
}

/**
 * Store the last pipeline run for eval readiness.
 */
export function setPipelineRun(run: PipelineRun): void {
  state = { ...state, lastPipelineRun: run };
}

/**
 * Reset to initial mock data state.
 */
export function resetState(): void {
  state = {
    current: createMockSchedule(),
    previous: null,
    lastPipelineRun: null,
  };
}
