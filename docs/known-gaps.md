# Known Gaps

Honest accounting of current limitations, tech debt, and incomplete implementations. Ordered by impact.

## Incomplete Implementations

**Circular dependency rejection path.** The execution engine detects cycles and sets `isCircularDependency: true`, but the tool response doesn't yet produce the same structured validation artifact used for other rejected mutations. The planner gets a text explanation but not the full before/after diff format. Fix: branch on `isCircularDependency` in `executeScheduleCode` and build a proper `ExecutionArtifact` with the rejection reason.

Entry point: `src/lib/ai/tools.ts`, the `executeScheduleCode` tool's failure branch.

**Eval pipeline run assembly.** The `PipelineRun` is now assembled incrementally across tool calls (`beginPipelineRun` → `setPendingIntent` → `setPendingCode` → `setPipelineRun`), but this chain is fragile. If the model skips a stage or calls tools out of order, the pending run may have null fields that should have been populated. The data shape is correct; the assembly path needs hardening for non-happy-path sequences.

Entry point: `src/lib/schedule/state.ts`, the pending pipeline run functions.

## Tech Debt

**Vendored prompt-input with `@ts-nocheck`.** The ai-elements `prompt-input.tsx` has type incompatibilities with the installed `@base-ui/react` version. It's currently suppressed with `@ts-nocheck`, which disables all type checking for that file. The component is interaction-heavy (textarea, submit, keyboard shortcuts). Fix options: write a minimal local wrapper around the subset of behavior we use, or pin `@base-ui/react` to a compatible version.

Entry point: `src/components/ai-elements/prompt-input.tsx`

**Server-side mutable singleton.** The schedule state is a module-level `let` in `state.ts`. This works for a single-user demo but is technically shared across requests in a long-running Next.js server. Not a problem for the demo's scope, but the architecture would need a session-scoped state layer for multi-user scenarios.

## Scope Limitations (by design)

These are intentional constraints, not gaps:

- **No automated resource leveling.** Resources are tracked and warned. The system flags conflicts but never resolves them. This matches the spec.
- **Single-level undo.** Only the last mutation can be reverted. No undo stack, no redo.
- **No persistence.** Everything resets on page refresh. The state layer has `resetState()` for this purpose.
- **No tests yet.** Vitest is installed. CPM calculations were verified manually against expected values. A test suite covering CPM, validation, execution, and undo is the next priority.
- **Fixed six-activity schedule.** No ability to add or remove activities. The demo operates on the mock schedule only.

## What to Build Next

Priority order based on interview focus ("70% of time should be on evals"):

1. **Eval instrumentation** — Build a lightweight harness that reads `PipelineRun` records and scores them against rubrics: did intent analysis correctly parse the query, did code generation produce valid SDK calls, did execution maintain schedule integrity.
2. **Test suite** — CPM baseline verification, cycle rejection, resource conflict detection, undo behavior, end-to-end SDK code execution.
3. **Clarification UX refinement** — Evaluate whether the model actually follows the "propose options with tradeoffs" pattern consistently, tune the prompt if not.
