import type {
  CodeArtifact,
  IntentArtifact,
  PendingPipelineRun,
  PipelineRun,
  Schedule,
  ScheduleState,
} from "./types";
import { createMockSchedule } from "./mock-data";
import { cloneSchedule } from "./engine";

let state: ScheduleState = {
  current: createMockSchedule(),
  previous: null,
  lastPipelineRun: null,
  pendingPipelineRun: null,
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
    pendingPipelineRun: state.pendingPipelineRun,
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
    pendingPipelineRun: state.pendingPipelineRun,
  };
  return state.current;
}

/**
 * Store the last pipeline run for eval readiness.
 */
export function setPipelineRun(run: PipelineRun): void {
  state = { ...state, lastPipelineRun: run, pendingPipelineRun: null };
}

export function beginPipelineRun(userMessage: string): PendingPipelineRun {
  const pendingPipelineRun: PendingPipelineRun = {
    userMessage,
    scheduleBefore: cloneSchedule(state.current),
    intent: null,
    code: null,
  };
  state = { ...state, pendingPipelineRun };
  return pendingPipelineRun;
}

export function setPendingIntent(intent: IntentArtifact): PendingPipelineRun {
  const pendingPipelineRun = state.pendingPipelineRun ?? beginPipelineRun("");
  const nextPendingPipelineRun: PendingPipelineRun = {
    ...pendingPipelineRun,
    intent,
  };
  state = { ...state, pendingPipelineRun: nextPendingPipelineRun };
  return nextPendingPipelineRun;
}

export function setPendingCode(code: CodeArtifact): PendingPipelineRun {
  const pendingPipelineRun = state.pendingPipelineRun ?? beginPipelineRun("");
  const nextPendingPipelineRun: PendingPipelineRun = {
    ...pendingPipelineRun,
    code,
  };
  state = { ...state, pendingPipelineRun: nextPendingPipelineRun };
  return nextPendingPipelineRun;
}

export function getPendingPipelineRun(): PendingPipelineRun | null {
  return state.pendingPipelineRun;
}

export function clearPendingPipelineRun(): void {
  state = { ...state, pendingPipelineRun: null };
}

/**
 * Reset to initial mock data state.
 */
export function resetState(): void {
  state = {
    current: createMockSchedule(),
    previous: null,
    lastPipelineRun: null,
    pendingPipelineRun: null,
  };
}
