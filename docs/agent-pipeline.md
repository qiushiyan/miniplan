# Agent Pipeline

The AI pipeline is the product's core: it translates natural language into schedule operations through visible, typed stages. The pipeline uses Vercel AI SDK v6's `ToolLoopAgent` — the model decides which tools to call, but the system prompt guides it through a fixed sequence for mutations.

## Why Pipeline Tools Instead of One Big Tool

The original design had a single `executeScheduleCode` tool where the model bundled intent analysis, code generation, and execution into one call. This was simpler but made the pipeline invisible — the user saw an opaque tool call with code and results, not the three stages PlanLab's architecture centers on.

The current design exposes five tools that map to pipeline stages. Each produces a typed artifact rendered in the UI. The model is still autonomous — it chooses tools — but the system prompt establishes a predictable sequence: read → analyze → generate → execute → summarize.

This is the demo's strongest selling point: it shows the planner exactly how the AI reasoned, not just what it did.

## The Five Tools

**getScheduleSnapshot** — Read-only. Returns the full schedule state. The model calls this first to understand what it's working with. No artifact produced; the output is context for the model's reasoning.

**analyzeIntent** — The model externalizes its understanding of the user's request into a structured `IntentArtifact`. This is not computation — the model fills in the fields, the server validates the shape and starts a `PendingPipelineRun`. If the model sets `intentClearEnough: false`, it includes `clarificationOptions` with concrete alternatives and tradeoffs. The system prompt guides this behavior: propose options, don't ask open-ended questions.

**generateScheduleCode** — The model writes JavaScript code using the Schedule SDK. The code is styled to look like TypeScript but executes as JS via `new Function()`. The server validates that `sdkCalls` only references approved SDK function names. The `CodeArtifact` is rendered in the UI as a syntax-highlighted code block.

**executeScheduleCode** — The only tool that does real work. Takes the generated code, runs it against a schedule clone with SDK bindings, validates the result, and commits on success. Returns an `ExecutionArtifact` with before/after diff, warnings, and the full updated schedule snapshot. The tool response includes targeted nudges ("Critical path changed — highlight this to the user") to guide the model's summary.

**undoLastChange** — Restores the previous schedule snapshot. Callable by the model ("undo that") or by the UI's undo button via a separate API endpoint.

## Prompt Architecture

The prompt uses three surfaces, each for what it does best. This follows the principle that system prompt rules are for general reasoning, tool descriptions are for usage patterns, and tool responses are for moment-specific guidance.

**System prompt** — establishes the agent's thinking framework. Organized as XML sections:

- `<domain>` — scheduling knowledge the model needs for judgment calls: what critical path means for planners, why float matters, how resource conflicts affect real projects. Without this, the model follows procedures but can't reason about tradeoffs.
- `<thinking>` — reasoning framework applied before each action: is this read or modify? Is the intent clear? Will this affect the critical path? Are there resource implications?
- `<workflow>` — the pipeline stage sequence as behavioral guidance, not a rigid checklist. Explains why each stage matters and when to deviate (informational queries skip the pipeline).
- `<clarification>` — when to proceed vs. when to propose options, with good/avoid examples. The key behavioral rule: propose concrete scheduling interpretations with tradeoffs, never ask open-ended questions.
- `<summarization>` — how to report changes in planner-useful terms. Examples show the expected depth: what changed, why it matters for the schedule, what the planner should watch for.
- `<failure-handling>` — how to explain rejections in domain language and suggest alternatives.
- `<code-generation>` — SDK function signatures and activity IDs. Practical reference, not architecture explanation.

**Tool descriptions** — shape how the model decides when and how to use each tool. Key descriptions:
- `analyzeIntent`: "makes your reasoning visible in the UI" — teaches the model this isn't just a formality
- `generateScheduleCode`: "description in scheduling terms, not programming terms" — steers the model toward planner-facing language
- `executeScheduleCode`: "summarize for the planner in scheduling terms" — sets expectations for what comes after

**Tool response nudges** — moment-specific guidance at the exact point the model needs to decide what to tell the planner:
- Duration change: "Project duration increased by 2 days. Explain why: was the changed activity on the critical path?"
- Critical path shift: "Explain which activities are now critical that weren't before"
- Near-critical detection: flags activities with <=2 days float as risk areas
- Resource warnings: "Present each warning clearly with its scheduling consequence"

These nudges are more effective than system prompt rules because they fire at the moment of decision, not hundreds of tokens earlier.

## Clarification UX

When the user's request is ambiguous, the model proposes concrete interpretations with tradeoffs instead of asking an open-ended question. Example pattern:

- "I think you may mean one of these."
- "Option A: shorten critical path durations — directly reduces project length"
- "Option B: resequence dependencies — changes the logical structure"
- "Tradeoff: A compresses time but may be physically infeasible, B enables parallelism but changes the plan's logic"

This demonstrates scheduling judgment, not just question-asking. The `clarificationOptions` field in `IntentArtifact` structures this for both UI rendering and eval.

## Code Execution

Generated code runs via `new Function()` with SDK bindings as parameters. The execution engine (`src/lib/ai/execution.ts`):

1. Clones the current schedule
2. Creates SDK bindings against the clone (with auto-recompute after each mutation)
3. Runs the generated code
4. Checks for circular dependencies explicitly after execution
5. Returns success with the mutated schedule, or failure with a structured error

The `isCircularDependency` flag in the result distinguishes cycles from other errors, enabling the tool to return a domain-specific explanation rather than a generic failure.

## Eval Readiness

Each turn assembles a `PipelineRun` record as artifacts flow through the pipeline:

1. `analyzeIntent` creates a `PendingPipelineRun` with the user message and schedule-before snapshot
2. `generateScheduleCode` adds the code artifact to the pending run
3. `executeScheduleCode` finalizes it with the execution artifact and schedule-after, then persists via `setPipelineRun()`

The pipeline run captures machine-checkable fields: `intentClearEnough`, `operationType`, `targetActivityIds`, `generatedSdkCalls`, `executionSucceeded`, `projectDurationBefore/After`. No eval system is built yet, but these records are the raw material for planner review, rubric scoring, or automated heuristics.

## Critical Files

- `src/lib/ai/agent.ts` — ToolLoopAgent definition, exported `ScheduleAgentUIMessage` type
- `src/lib/ai/tools.ts` — all five tool definitions with Zod schemas
- `src/lib/ai/prompts.ts` — system prompt content
- `src/lib/ai/execution.ts` — `new Function()` executor with cycle detection
- `src/app/api/chat/route.ts` — API route using `createAgentUIStreamResponse`
