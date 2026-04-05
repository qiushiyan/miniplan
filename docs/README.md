# MiniPlan — Architecture Overview

MiniPlan is a demo AI-powered construction schedule editor built for a PlanLab interview. It replicates PlanLab's core architecture: natural language → visible AI pipeline → schedule execution → real-time visualization.

## Why This Exists

PlanLab builds "an AI programmer that has access to scheduling tools." Their product translates planner intent into code that runs against a schedule SDK inside a sandboxed VM. The demo proves we understand this architecture by building a working version from scratch.

The product bet: **transparency over magic**. Every pipeline stage — intent analysis, code generation, execution — produces a visible artifact in the UI. The planner sees what the AI understood, what code it wrote, and what the execution changed. Trust comes from visibility.

## System Shape

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────────┐ │
│  │   Chat Panel     │    │   Visualization Panel      │ │
│  │                  │    │                            │ │
│  │  useChat ←──────────────── schedule state          │ │
│  │  (AI SDK v6)     │    │                            │ │
│  │                  │    │  AON Diagram (xyflow)      │ │
│  │  Tool parts:     │    │  Resource Bar              │ │
│  │  - Intent        │    │  Schedule Table            │ │
│  │  - Code          │    │                            │ │
│  │  - Execution     │    │                            │ │
│  └────────┬─────────┘    └────────────────────────────┘ │
│           │                                             │
└───────────┼─────────────────────────────────────────────┘
            │ POST /api/chat
            ▼
┌─────────────────────────────────────────────────────────┐
│                     Next.js Server                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              ToolLoopAgent (AI SDK v6)            │   │
│  │                                                  │   │
│  │  Tools (pipeline stages):                        │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │  │ getSchedule     │  │ analyzeIntent        │   │   │
│  │  │ Snapshot        │  │ (structured intent)  │   │   │
│  │  └─────────────────┘  └─────────────────────┘   │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │  │ generateSchedule│  │ executeScheduleCode  │   │   │
│  │  │ Code            │  │ (run + validate)     │   │   │
│  │  └─────────────────┘  └─────────────────────┘   │   │
│  │  ┌─────────────────┐                            │   │
│  │  │ undoLastChange   │                            │   │
│  │  └─────────────────┘                            │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │              Schedule Engine (pure)               │   │
│  │                                                  │   │
│  │  CPM algorithm ← SDK bindings ← new Function()  │   │
│  │                                                  │   │
│  │  State: { current, previous, lastPipelineRun }   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

**Pipeline tools, not one opaque tool.** The agent has five tools that map to visible pipeline stages. An early design used a single `executeScheduleCode` tool that bundled intent analysis, code generation, and execution. That was simpler but hid the pipeline — the thing we're demonstrating. Splitting into `analyzeIntent` → `generateScheduleCode` → `executeScheduleCode` makes each stage a typed artifact rendered in the UI.

**Agentic orchestration with guided sequence.** The system prompt guides the model through the pipeline stages in order, but it's still a `ToolLoopAgent` — the model decides when to call tools. For informational queries ("what's the critical path?"), it reads the schedule and answers directly without the mutation pipeline.

**Pure engine, thin state.** The schedule engine is a set of pure functions: schedule in, schedule out. The state layer is a minimal wrapper — current schedule, previous schedule, last pipeline run. Mutations follow commit-on-success semantics: clone → mutate → validate → commit or reject.

**Eval-ready by design.** Each turn produces a typed `PipelineRun` record capturing all artifacts with machine-checkable fields. No eval system is built yet, but the data shape is there for later instrumentation.

## Module Map

| Module | Purpose | Entry point |
|--------|---------|-------------|
| Schedule Engine | CPM, mutations, SDK bindings, validation | `src/lib/schedule/` |
| AI Pipeline | Agent, tools, system prompt, code execution | `src/lib/ai/` |
| Chat UI | Conversation, tool part rendering | `src/components/chat.tsx` |
| Visualization | AON diagram, resource bar | `src/components/aon-diagram.tsx` |
| API Routes | Chat, schedule state, undo | `src/app/api/` |

## Scope Constraints

- Six named activities, Finish-to-Start dependencies only
- No auth, no persistence, no calendar logic
- Resources tracked and warned, never auto-leveled
- Single-level undo
- Fixed demo project start date: 2026-01-05
