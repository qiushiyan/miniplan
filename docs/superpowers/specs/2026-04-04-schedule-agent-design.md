# Schedule AI Agent — Implementation Design

## Overview

A minimal AI-powered construction schedule editor. Users interact through a chat interface in natural language. An agentic AI pipeline translates requests into schedule operations using the Vercel AI SDK's `ToolLoopAgent`, executes them against a CPM schedule engine, and visualizes results in real-time via an AON diagram.

Built as a demo for a PlanLab interview, replicating their core architecture: natural language -> agent with tools -> code generation -> schedule execution -> visualization.

## Phasing

Five phases, ordered by dependency. Phases 1-3 produce a working end-to-end demo. Phase 4 adds visual polish. Phase 5 ties loose ends.

| Phase | Deliverable | Core Files |
|-------|------------|------------|
| 1. Schedule Engine | Types, CPM, SDK, mock data, validation | `src/lib/schedule/` |
| 2. Agent + API Route | ToolLoopAgent, tools, system prompt, API route | `src/lib/ai/`, `src/app/api/chat/route.ts` |
| 3. Chat UI + Tool Display | Chat panel with tool visualization | `src/app/page.tsx`, `src/components/` |
| 4. AON Diagram + Resource Bar | @xyflow/react visualization | `src/components/aon-*.tsx`, `src/components/resource-bar.tsx` |
| 5. Undo + Polish | Undo system, empty states, error handling | Various |

---

## Phase 1: Schedule Engine

### Files

- `src/lib/schedule/types.ts` — Core domain types
- `src/lib/schedule/cpm.ts` — Forward pass, backward pass, critical path, float
- `src/lib/schedule/schedule.ts` — Schedule state manager with SDK functions
- `src/lib/schedule/mock-data.ts` — The 6-activity construction schedule
- `src/lib/schedule/validation.ts` — Circular dependency detection, resource conflict detection
- `src/lib/schedule/state.ts` — Server-side singleton holding current schedule + history for undo

### Types

```typescript
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
  date: number;
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
```

### CPM Algorithm

Standard two-pass. Forward pass computes ES/EF in topological order. Backward pass computes LS/LF from the max EF. Float = LS - ES. Critical path = activities where float === 0.

### Schedule State Manager

Exposes SDK functions that operate on a Schedule object. After any mutation, `runCPM()` is called automatically. Maintains a `previous: Schedule | null` reference for single-level undo.

### SDK Functions

```typescript
// Reading
getActivity(id: string): Activity
getAllActivities(): Activity[]
getActivityByName(name: string): Activity | undefined
getPredecessors(activityId: string): Activity[]
getSuccessors(activityId: string): Activity[]
getCriticalPath(): Activity[]
getActivityFloat(activityId: string): number

// Modifying
setActivityDuration(activityId: string, duration: number, unit: 'days'): void
createDependency(fromId: string, toId: string, type: 'FINISH_TO_START'): void
removeDependency(fromId: string, toId: string): void
applyDateConstraint(activityId: string, day: number, type: 'START_AFTER' | 'FINISH_BEFORE'): void
```

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

Expected CPM results:
- Critical path: EXC -> FND -> STL -> CPR -> COM = 30 days
- ELC has 8 days of float (ES=13, LS=21)
```

### Validation

- Circular dependency detection via topological sort — reject if cycle found
- Resource conflict detection — for each time period, sum resource requirements of overlapping activities (based on ES/EF), flag when sum exceeds availability

---

## Phase 2: Agent + API Route

### Files

- `src/lib/ai/agent.ts` — ToolLoopAgent definition, exported UIMessage type
- `src/lib/ai/tools.ts` — Tool definitions
- `src/lib/ai/prompts.ts` — System prompt content
- `src/lib/ai/execution.ts` — Code executor (new Function with SDK in scope)
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

### Tools

Two categories:

**Query tools** (read-only):
- `getScheduleState()` — returns the full schedule (all activities with CPM values, dependencies, resources, project duration, critical path). Single comprehensive read instead of many small getters.
- `getActivityDetails(activityId: string)` — returns one activity with predecessors, successors, float.

**Mutation tool:**
- `executeScheduleCode(code: string, description: string)` — the model writes TypeScript code using SDK functions. `description` is a human-readable summary shown in the UI. Returns: success/failure, before/after diff, new project duration, new critical path, warnings (resource conflicts, constraint violations), full updated schedule state.

### Code Execution Engine

```typescript
function executeScheduleCode(code: string, schedule: Schedule): ExecutionResult {
  // 1. Snapshot current state (for undo + diff)
  // 2. Create SDK functions bound to the schedule
  // 3. new Function(...sdkNames, code)(...sdkFunctions)
  // 4. Run CPM recalculation
  // 5. Run validation
  // 6. Compute diff
  // 7. Return { success, diff, warnings, schedule }
}
```

### System Prompt

Structured with XML tags. Follows prompting guide principles: positive framing, explicit trigger/action/skip conditions, examples with anti-patterns, no developer-facing framing.

Sections:
- `<role>` — identity as a construction scheduling assistant
- `<workflow>` — read schedule, clarify if needed, generate code, report results
- `<clarification>` — when to ask vs. when to proceed, with good/avoid examples
- `<code-generation>` — SDK function signatures and activity IDs

Tool response nudges for moment-specific guidance (e.g., "Resource conflict detected on Cranes — inform the user" in executeScheduleCode results).

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

### Schedule State Management

Server-side in-memory singleton (`src/lib/schedule/state.ts`). Tools read/write this singleton. Schedule state is included in `executeScheduleCode` tool results so the client can update visualization without a separate fetch.

---

## Phase 3: Chat UI + Tool Display

### Files

- `src/app/page.tsx` — Main layout: split-pane (chat ~40% left, visualization ~60% right)
- `src/components/chat.tsx` — Chat panel using ai-elements
- `src/components/tool-display.tsx` — Custom rendering for schedule tool parts

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

### Tool Part Rendering

Each tool type gets appropriate visual treatment:

- **`tool-getScheduleState`** — Collapsed by default. Brief "Read schedule state" header. Minimal output summary.
- **`tool-getActivityDetails`** — Collapsed by default. Shows activity ID in header.
- **`tool-executeScheduleCode`** — Expanded by default. Two sections:
  1. Generated code rendered with `CodeBlock` (syntax-highlighted TypeScript)
  2. Execution result: diff, new duration, critical path changes, warnings — rendered as markdown via `MessageResponse`

Uses ai-elements `Tool`, `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput` and `CodeBlock` components.

### State Flow

```
User message -> useChat -> /api/chat -> agent calls tools -> stream response
  -> client receives tool parts with schedule state in output
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

- `undoLastChange()` on schedule state manager (history snapshot from Phase 1)
- `undo` tool on the agent — user says "undo that", model calls it
- Undo button in visualization panel header — calls `POST /api/undo`
- Single-level undo only

### Polish

- `ConversationEmptyState` with intro + suggested prompts ("What's the critical path?", "Make excavation 7 days")
- Disable submit while streaming, status indicators on tool calls
- Error handling in code execution — tool result includes error, model explains or retries
- `maxDuration = 60` on API route

### Not in Scope

- Multi-level undo
- Persistent storage
- Multiple schedules or sessions
- Automated resource leveling
- Testing (future session)
- Calendar/working days logic
- Complex dependency types (only FS)

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

1. **Transparency over magic** — show generated code, execution results, and reasoning in the UI
2. **Clarification over assumption** — ask when ambiguous, proceed when clear
3. **Validation after every mutation** — check for circular deps, resource conflicts, constraint violations
4. **Separation of concerns** — schedule engine knows nothing about AI, AI knows nothing about rendering
