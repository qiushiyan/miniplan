# Schedule Engine

The schedule engine is the data foundation. It knows nothing about AI, UI, or HTTP — it takes a schedule snapshot, applies mutations, and returns a new snapshot with CPM recalculated and validation results attached.

## Mental Model

A schedule is a directed acyclic graph of activities connected by Finish-to-Start dependencies. The Critical Path Method (CPM) computes timing values for each activity:

- **Forward pass** (topological order): Early Start = max(Early Finish of all predecessors). Early Finish = Early Start + duration.
- **Backward pass** (reverse topological order): Late Finish = min(Late Start of all successors). Late Start = Late Finish - duration.
- **Float** = Late Start - Early Start. Activities with zero float are on the **critical path** — any delay to them delays the entire project.

The mock schedule has a critical path of 30 days (EXC → FND → STL → CPR → COM) and one non-critical activity (ELC, 8 days of float).

## Two Layers: Engine vs. SDK

There are two distinct interfaces to the schedule, serving different consumers.

**Engine functions** (`src/lib/schedule/engine.ts`) — Pure functions used by the application. Take a schedule, return a new schedule. Used by tools that need deterministic, testable mutations.

**SDK bindings** (`src/lib/schedule/sdk.ts`) — Mutable functions injected into generated code via `new Function()`. These operate on a schedule clone and recompute CPM after every mutation. The key design choice: `rebuildDerivedState()` runs after each mutating call, so reads within the same execution block always see fresh CPM values. Without this, code like `setActivityDuration("EXC", 7, "days"); getCriticalPath()` would return stale data.

The SDK function signatures are what the model sees in the system prompt and generates code against. They are intentionally simpler than the engine functions — no return values from mutations, string-based activity IDs, a `unit` parameter for readability.

## State Semantics

Runtime state is a thin layer at `src/lib/schedule/state.ts`:

- `current` — the live schedule snapshot
- `previous` — the snapshot before the last committed mutation (for undo)
- `lastPipelineRun` — the most recent complete pipeline run (for eval)
- `pendingPipelineRun` — accumulates artifacts as the pipeline stages execute

**Commit-on-success**: the execution tool clones the current schedule, runs generated code against the clone, validates the result. Only if validation passes does it call `commit()`, which shifts current → previous and installs the new schedule. On failure, the current schedule is untouched.

**Single-level undo**: `undo()` restores `previous` to `current` and clears `previous`. There is no undo stack — one level is sufficient for a demo.

## Validation

After every mutation, the engine checks:

1. **Circular dependencies** — detected via topological sort. If sorting produces fewer nodes than exist, there's a cycle. The change is rejected.
2. **Resource over-allocation** — for each day in the project, sums resource requirements of all active activities (ES <= day < EF). Flags when the sum exceeds availability. Warns but does not reject.
3. **Negative float** — activities where Late Start < Early Start, caused by date constraints creating infeasible timing. Warns but does not reject.

Validation produces a structured `ValidationResult` with typed warnings. These flow through to the execution tool's response and into the pipeline run record.

## Date Constraints

The project has a fixed start date of 2026-01-05. Date constraints use integer day offsets from this start. The system prompt tells the model to convert calendar dates to offsets (e.g., "January 20th = day 15"). The engine operates entirely on integers — no date parsing, no calendars.

## Critical Files

- `src/lib/schedule/types.ts` — all domain, artifact, and state types
- `src/lib/schedule/cpm.ts` — topological sort, forward/backward pass, `runCPM()`
- `src/lib/schedule/sdk.ts` — SDK bindings with auto-recompute after mutations
- `src/lib/schedule/engine.ts` — pure mutation functions
- `src/lib/schedule/state.ts` — runtime state with commit/undo/pipeline-run tracking
- `src/lib/schedule/validation.ts` — cycle, resource, and float checks
- `src/lib/schedule/mock-data.ts` — the 6-activity construction schedule
