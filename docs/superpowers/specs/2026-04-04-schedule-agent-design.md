# Schedule AI Agent — Implementation Design

## Overview

A minimal AI-powered construction schedule editor. Users interact through a chat interface in natural language. An agentic AI pipeline translates requests into schedule operations through three visible stages — intent analysis, code generation, and execution — using the Vercel AI SDK's `ToolLoopAgent`. Results are visualized in real-time via an AON diagram.

Built as a demo for a PlanLab interview, replicating their core architecture: natural language -> intent analysis -> code generation -> schedule execution -> visualization.

## Product Contract

- The assistant auto-applies successful schedule edits immediately.
- Every successful mutation creates a single-step undo snapshot.
- There is no separate review/approval step before apply.
- The schedule is limited to six named activities in the mock schedule.
- Dependency type support is Finish-to-Start only.
- Resources are tracked and validated, but not leveled automatically.
- Date constraints use a fixed demo project start date (`2026-01-05`, a Monday) and are internally converted to integer day offsets.
- No working-day, holiday, or calendar logic.

## Phasing

Five phases, ordered by dependency. Phases 1-3 produce a working end-to-end demo. Phase 4 adds visual polish. Phase 5 ties loose ends.

| Phase | Deliverable | Core Files |
|-------|------------|------------|
| 1. Schedule Engine | Types, CPM, SDK, mock data, validation | `src/lib/schedule/` |
| 2. Agent + API Route | ToolLoopAgent, pipeline tools, system prompt, API route | `src/lib/ai/`, `src/app/api/chat/route.ts` |
| 3. Chat UI + Tool Display | Chat panel with pipeline stage visualization | `src/app/page.tsx`, `src/components/` |
| 4. AON Diagram + Resource Bar | @xyflow/react visualization | `src/components/aon-*.tsx`, `src/components/resource-bar.tsx` |
| 5. Undo + Polish | Undo system, empty states, error handling | Various |

---

## Phase 1: Schedule Engine

### Files

- `src/lib/schedule/types.ts` — Core domain types including pipeline artifacts
- `src/lib/schedule/cpm.ts` — Forward pass, backward pass, critical path, float
- `src/lib/schedule/engine.ts` — Pure schedule functions: apply mutations, return new snapshots
- `src/lib/schedule/sdk.ts` — SDK function bindings for code execution scope
- `src/lib/schedule/mock-data.ts` — The 6-activity construction schedule
- `src/lib/schedule/validation.ts` — Circular dependency detection, resource conflict detection, negative float detection
- `src/lib/schedule/state.ts` — Thin runtime state: current snapshot, previous snapshot, last pipeline run

### Types

```typescript
// --- Domain types ---

type Activity = {
  id: string;
  name: string;
  duration: number;
  resources: ResourceRequirement[];
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
}

type Dependency = {
  fromId: string;
  toId: string;
  type: 'FINISH_TO_START';
}

type ResourceRequirement = { resourceId: string; quantity: number }
type Resource = { id: string; name: string; available: number }

type DateConstraint = {
  activityId: string;
  day: number;            // integer offset from project start
  type: 'START_AFTER' | 'FINISH_BEFORE';
}

type Schedule = {
  activities: Activity[];
  dependencies: Dependency[];
  resources: Resource[];
  constraints: DateConstraint[];
  projectDuration: number;
  criticalPath: string[];
}

// --- Pipeline artifact types ---

type IntentArtifact = {
  intentClearEnough: boolean;
  clarificationAsked: boolean;
  clarificationOptions?: { label: string; description: string }[];
  operationType?: 'modify_duration' | 'add_dependency' | 'remove_dependency'
    | 'apply_constraint' | 'query_info';
  targetActivityIds?: string[];
  parameters?: Record<string, unknown>;
  summary: string;
}

type CodeArtifact = {
  code: string;
  description: string;
  sdkCalls: string[];     // names of SDK functions used
}

type ExecutionArtifact = {
  success: boolean;
  error?: string;
  warnings: string[];
  projectDurationBefore: number;
  projectDurationAfter: number;
  criticalPathBefore: string[];
  criticalPathAfter: string[];
  changedActivities: { id: string; field: string; before: unknown; after: unknown }[];
}

type PipelineRun = {
  userMessage: string;
  scheduleBefore: Schedule;
  intent: IntentArtifact | null;
  code: CodeArtifact | null;
  execution: ExecutionArtifact | null;
  scheduleAfter: Schedule;
}

// --- Runtime state ---

type ScheduleState = {
  current: Schedule;
  previous: Schedule | null;
  lastPipelineRun: PipelineRun | null;
}
```

### CPM Algorithm

Standard two-pass. Forward pass computes ES/EF in topological order. Backward pass computes LS/LF from the max EF. Float = LS - ES. Critical path = activities where float === 0.

### Engine (Pure Functions)

The schedule engine is pure. Functions take a Schedule snapshot as input and return a new snapshot plus validation results. No side effects, no mutable state.

```typescript
// Apply a mutation to a schedule, return the new schedule
function applyDurationChange(schedule: Schedule, activityId: string, duration: number): Schedule
function applyNewDependency(schedule: Schedule, fromId: string, toId: string): Schedule
function applyRemoveDependency(schedule: Schedule, fromId: string, toId: string): Schedule
function applyDateConstraint(schedule: Schedule, activityId: string, day: number, type: ConstraintType): Schedule

// Recalculate CPM on a schedule
function runCPM(schedule: Schedule): Schedule

// Validate a schedule, return warnings
function validate(schedule: Schedule): ValidationResult
```

### SDK Bindings

Standalone functions that operate on a mutable schedule clone during code execution. These are the functions injected into the `new Function()` scope.

```typescript
// Reading
getActivity(id: string): Activity
getAllActivities(): Activity[]
getActivityByName(name: string): Activity | undefined
getPredecessors(activityId: string): Activity[]
getSuccessors(activityId: string): Activity[]
getCriticalPath(): Activity[]
getActivityFloat(activityId: string): number

// Modifying (mutate the clone in place)
setActivityDuration(activityId: string, duration: number, unit: 'days'): void
createDependency(fromId: string, toId: string, type: 'FINISH_TO_START'): void
removeDependency(fromId: string, toId: string): void
applyDateConstraint(activityId: string, day: number, type: 'START_AFTER' | 'FINISH_BEFORE'): void
```

### Date Constraints

Fixed demo project start date: `2026-01-05` (a Monday).

- The model writes natural dates in code (e.g., `applyDateConstraint("COM", 15, "START_AFTER")` for day 15).
- The system prompt maps calendar dates to day offsets (e.g., "January 20th = day 15").
- CPM operates entirely on integer day values.

### State Layer

Thin wrapper. Holds `current`, `previous`, and `lastPipelineRun`. Exposes `commit(newSchedule)` which shifts current to previous and sets the new schedule. Exposes `undo()` which restores previous.

### Mock Schedule

```
Activities:
- EXC: Excavation, 5 days, requires 2 excavators
- FND: Foundation, 8 days, requires 1 crane, depends on EXC
- STL: Structural Steel, 10 days, requires 2 cranes, depends on FND
- ELC: Electrical Installation, 6 days, no special resource, depends on FND
- CPR: Concrete Pour, 4 days, requires 1 crane, depends on STL
- COM: Commissioning, 3 days, no special resource, depends on CPR AND ELC

Resources: Excavators (3 available), Cranes (2 available)
Project start: 2026-01-05

Expected CPM results:
- Critical path: EXC -> FND -> STL -> CPR -> COM = 30 days
- ELC has 8 days of float (ES=13, LS=21)
```

### Validation

After every mutation:
- Recalculate CPM
- Reject circular dependencies (topological sort)
- Detect resource over-allocation (sum requirements of overlapping activities per time period)
- Detect negative float conditions caused by date constraints
- Return warnings even when the change is accepted
- Resource conflicts warn, never auto-resolve

---

## Phase 2: Agent + API Route

### Files

- `src/lib/ai/agent.ts` — ToolLoopAgent definition, exported UIMessage type
- `src/lib/ai/tools.ts` — Pipeline tool definitions
- `src/lib/ai/prompts.ts` — System prompt content
- `src/lib/ai/execution.ts` — Code executor (new Function with SDK bindings in scope)
- `src/app/api/chat/route.ts` — API route

### Agent

```typescript
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const scheduleAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  instructions: systemPrompt,
  tools: scheduleTools,
});

export type ScheduleAgentUIMessage = InferAgentUIMessage<typeof scheduleAgent>;
```

### Tools — Pipeline Stage Tools

The tools map to visible pipeline stages. The agent is guided by the system prompt to follow the pipeline sequence for mutations, but retains flexibility for informational queries.

**Read tool:**
- `getScheduleSnapshot()` — returns the full current schedule snapshot (all activities with CPM values, dependencies, resources, project duration, critical path, project start date).

**Intent analysis tool:**
- `analyzeIntent(userRequest: string, analysisResult: IntentArtifact)` — the model externalizes its reasoning about what the user wants. The `analysisResult` is the model's structured analysis: is the intent clear enough, what operation type, which activities, what parameters. If unclear, includes `clarificationOptions` with concrete alternatives and tradeoffs.

  This tool doesn't compute anything server-side — it receives the model's analysis, validates the shape, and returns it for UI rendering. The value is making intent analysis a visible, typed artifact.

**Code generation tool:**
- `generateScheduleCode(code: string, description: string, sdkCalls: string[])` — the model writes JavaScript code (TypeScript-compatible style) using the Schedule SDK. `description` is a human-readable summary. `sdkCalls` lists which SDK functions the code uses. Returns the code artifact for UI rendering.

  Like `analyzeIntent`, this is primarily an externalization tool. The server validates that `sdkCalls` only contains approved SDK function names.

**Execution tool:**
- `executeScheduleCode(code: string)` — runs the generated code against the schedule engine. Follows commit-on-success semantics:
  1. Clone current schedule
  2. Create SDK bindings against the clone
  3. Execute via `new Function(...sdkNames, code)(...sdkBindings)`
  4. Run CPM recalculation on the clone
  5. Validate (circular deps, resource conflicts, negative float)
  6. If valid: commit new schedule, store undo snapshot, return success with diff
  7. If invalid: preserve current state, return failure with errors
  
  Returns: `ExecutionArtifact` plus the full updated schedule snapshot (for client visualization).

**Undo tool:**
- `undoLastChange()` — restores the previous schedule snapshot. Returns the restored schedule.

### Code Execution

The model generates JavaScript code in a TypeScript-compatible style. Executed via `new Function()` with SDK bindings in scope. The code should only call approved SDK functions — the system prompt constrains this, and the `sdkCalls` field in the code artifact makes it auditable.

### System Prompt

Structured with XML tags. Follows prompting guide principles: positive framing, explicit trigger/action/skip conditions, examples with anti-patterns, no developer-facing framing, no aggressive language.

```
<role>
You are a construction scheduling assistant. You help planners modify and
understand project schedules through natural language.
</role>

<workflow>
For schedule modifications, follow these stages:

1. Read the schedule — call getScheduleSnapshot to understand the current state.
2. Analyze intent — call analyzeIntent to externalize your understanding of what
   the user wants. If the request is vague, include clarification options with
   concrete alternatives and tradeoffs.
3. Generate code — call generateScheduleCode with JavaScript code using the
   Schedule SDK functions.
4. Execute — call executeScheduleCode to run the code and apply changes.
5. Summarize — report what changed: new project duration, critical path shifts,
   and any resource warnings.

For informational queries (e.g., "what's the critical path?"), read the schedule
and answer directly — skip the code generation pipeline.
</workflow>

<clarification>
When the request could be interpreted multiple ways, propose concrete options
with tradeoffs instead of asking an open-ended question.

Proceed directly when:
- The user names a specific activity and operation ("make excavation 7 days")
- The intent maps to a single unambiguous SDK operation

Propose options when:
- The user doesn't specify which activities ("make it faster")
- The change amount is missing ("extend the foundation")
- Multiple approaches exist ("speed up the project")

<examples>
<example type="good">User: "Speed up the project"
Intent analysis: intent not clear enough. Clarification options:
- Option A: Shorten critical path activity durations — directly reduces project
  length but may require more resources
- Option B: Remove or resequence dependencies — changes the logical structure
- Option C: Apply a finish-before constraint — forces a deadline, may create
  negative float
Which approach fits your situation?</example>
<example type="good">User: "Make excavation 7 days"
Intent analysis: clear. Operation: modify_duration. Target: EXC. Parameter: 7 days.
Proceed to code generation.</example>
<example type="avoid">User: "Make excavation 7 days"
Response: "Just to confirm, you want to change Excavation from 5 to 7 days?"
Reason: unnecessary — the request is unambiguous.</example>
</examples>
</clarification>

<code-generation>
Write JavaScript code using these SDK functions. The code runs in a sandboxed
scope where these functions are available:

Reading:
  getActivity(id: string): Activity
  getAllActivities(): Activity[]
  getPredecessors(activityId: string): Activity[]
  getSuccessors(activityId: string): Activity[]
  getCriticalPath(): Activity[]
  getActivityFloat(activityId: string): number

Modifying:
  setActivityDuration(activityId: string, duration: number, unit: 'days'): void
  createDependency(fromId: string, toId: string, type: 'FINISH_TO_START'): void
  removeDependency(fromId: string, toId: string): void
  applyDateConstraint(activityId: string, day: number,
    type: 'START_AFTER' | 'FINISH_BEFORE'): void

Activity IDs: EXC (Excavation), FND (Foundation), STL (Structural Steel),
ELC (Electrical Installation), CPR (Concrete Pour), COM (Commissioning)

Project starts on 2026-01-05 (day 0). Convert calendar dates to day offsets
(e.g., January 20th = day 15).
</code-generation>
```

Tool response nudges provide moment-specific guidance in tool results:
- `executeScheduleCode` returns targeted messages like "Resource conflict detected on Cranes during days 13-23 — inform the user" or "Critical path changed — ELC is now critical."
- `analyzeIntent` returns "Intent unclear — present the clarification options to the user before proceeding."

### API Route

```typescript
export async function POST(request: Request) {
  const { messages } = await request.json();
  return createAgentUIStreamResponse({
    agent: scheduleAgent,
    uiMessages: messages,
  });
}
```

### Eval Readiness

Each mutation turn produces a `PipelineRun` record stored in `state.lastPipelineRun`. This record captures: user message, schedule before/after, and all three pipeline artifacts with machine-checkable fields (`intentClearEnough`, `operationType`, `targetActivityIds`, `generatedSdkCalls`, `executionSucceeded`, `warnings`, `projectDurationBefore`, `projectDurationAfter`).

No eval system is built now. The typed artifacts and pipeline run records make it trivial to add later: planner review, manual rubric scoring, or lightweight heuristics.

---

## Phase 3: Chat UI + Tool Display

### Files

- `src/app/page.tsx` — Main layout: split-pane (chat ~40% left, visualization ~60% right)
- `src/components/chat.tsx` — Chat panel using ai-elements
- `src/components/tool-display.tsx` — Custom rendering for pipeline stage tool parts
- `src/app/api/schedule/route.ts` — GET endpoint for initial schedule state

### Layout

Split-pane layout. Left: chat. Right: visualization placeholder in Phase 3 (simple schedule table), replaced by AON diagram in Phase 4.

### Chat Panel

Uses ai-elements components:
- `Conversation` / `ConversationContent` / `ConversationScrollButton` — message container with auto-scroll
- `Message` / `MessageContent` / `MessageResponse` — message bubbles with markdown rendering
- `PromptInput` / `PromptInputTextarea` / `PromptInputSubmit` — user input

Connected to agent via:
```typescript
const { messages, sendMessage, status } = useChat<ScheduleAgentUIMessage>({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
```

### Pipeline Stage Rendering

Each pipeline tool maps to a distinct visual treatment in the UI. After each assistant response, the tool parts form a collapsible pipeline panel showing all three stages.

- **`tool-getScheduleSnapshot`** — Collapsed by default. Brief "Read schedule state" header. Minimal output summary.

- **`tool-analyzeIntent`** — Expanded when clarification is needed. Shows:
  - Whether intent was clear
  - Operation type and target activities
  - If unclear: the clarification options with labels and tradeoff descriptions
  
  Uses `Tool` + `ToolHeader` + `ToolContent`. When `intentClearEnough: false`, the options render as a structured list.

- **`tool-generateScheduleCode`** — Expanded by default. Shows:
  - Human-readable description of what the code does
  - Generated code in a `CodeBlock` (syntax-highlighted JavaScript)
  - List of SDK functions used

- **`tool-executeScheduleCode`** — Expanded by default. Shows:
  - Success/failure status via `ToolHeader` state
  - Before/after diff: changed activities, project duration change, critical path change
  - Any warnings (resource conflicts, constraint violations)
  - Rendered as markdown via `MessageResponse`

- **`tool-undoLastChange`** — Collapsed by default. Brief "Undid last change" header.

### State Flow

```
User message -> useChat -> /api/chat -> agent calls pipeline tools -> stream response
  -> client receives typed tool parts for each pipeline stage
  -> executeScheduleCode output includes full schedule snapshot
  -> React state updates -> visualization re-renders
```

Initial schedule state fetched via `GET /api/schedule` on page load.

---

## Phase 4: AON Diagram + Resource Bar

### Files

- `src/components/aon-diagram.tsx` — ReactFlow canvas with dagre layout
- `src/components/aon-node.tsx` — Custom AON node component
- `src/components/resource-bar.tsx` — Resource usage bar chart

### AON Node

Standard CPM grid layout per node:

```
+-----+------------+-----+
| ES  |   Name     | EF  |
+-----+------------+-----+
|     | Duration   |     |
+-----+------------+-----+
| LS  |   Float    | LF  |
+-----+------------+-----+
```

Critical path nodes: red border + subtle red tint. Non-critical: neutral.

### Layout

Dagre with `rankdir: 'LR'` (left-to-right). Activities at the same dependency level in the same column.

### Edges

`smoothstep` edges with `MarkerType.ArrowClosed`. Critical path edges: red, thicker. Non-critical: gray.

### Resource Bar

Below the AON diagram. Div-based bar chart (no charting library). X-axis: days. One row per resource type. Red highlight when usage exceeds availability.

For each day, sum resource requirements of activities active during that period (ES <= day < EF).

### ReactFlow Config

- `fitView` enabled
- `<Background>` with dots
- `<Controls>` for zoom
- Nodes not draggable (display-only)

### Data

Receives `Schedule` as a prop. Re-renders when schedule updates via tool call results.

---

## Phase 5: Undo + Polish

### Undo

- `undoLastChange` tool already defined in Phase 2 — user says "undo that", model calls it
- Undo button in visualization panel header — calls `POST /api/undo`, returns restored schedule
- Single-level undo only

### Polish

- `ConversationEmptyState` with intro + suggested prompts ("What's the critical path?", "Make excavation 7 days", "Speed up the project")
- Disable submit while streaming, status indicators on tool calls
- Error handling in code execution — tool result includes error, model explains or retries
- `maxDuration = 60` on API route

### Not in Scope

- Multi-level undo
- Persistent storage
- Multiple schedules or sessions
- Automated resource leveling
- Calendar/working days logic
- Complex dependency types (only FS)
- Full eval system (architecture is eval-ready, system is not built)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (app router) |
| AI | Vercel AI SDK v6 (`ToolLoopAgent`, `createAgentUIStreamResponse`) |
| Model | Anthropic Claude via `@ai-sdk/anthropic` |
| Chat UI | ai-elements (Conversation, Message, PromptInput, Tool, CodeBlock) |
| Visualization | @xyflow/react + @dagrejs/dagre |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Package Manager | pnpm |

## Key Design Principles

1. **Transparency over magic** — every pipeline stage produces a typed, visible artifact in the UI
2. **Clarification over assumption** — propose concrete options with tradeoffs, not open-ended questions
3. **Validation after every mutation** — reject circular deps, flag resource conflicts, detect negative float
4. **Separation of concerns** — pure schedule engine, thin state layer, AI tools as pipeline stages, UI renders artifacts
5. **Eval-ready** — typed `PipelineRun` records with machine-checkable fields, ready for future instrumentation
