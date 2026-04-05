# MiniPlan Onboarding

You are working on an AI-powered construction schedule editor. Interview demo
for PlanLab — replicates their NL → intent → code generation → execution →
visualization pipeline.

## Phase 1: Architecture Mental Model

Read these docs in order:

1. `docs/README.md` — System shape, key architectural decisions, module map
2. `docs/schedule-engine.md` — CPM algorithm, engine vs SDK layers, state
   semantics
3. `docs/agent-pipeline.md` — Pipeline tools, prompt architecture, eval
   readiness
4. `docs/known-gaps.md` — Current limitations, tech debt, next priorities

Then spawn parallel agents to explore the source:

- **Schedule engine**: `src/lib/schedule/types.ts`, `src/lib/schedule/cpm.ts`,
  `src/lib/schedule/sdk.ts`, `src/lib/schedule/state.ts`
- **AI pipeline**: `src/lib/ai/prompts.ts`, `src/lib/ai/tools.ts`,
  `src/lib/ai/execution.ts`, `src/lib/ai/agent.ts`
- **UI + visualization**: `src/app/page.tsx`, `src/components/chat.tsx`,
  `src/components/tool-display.tsx`, `src/components/aon-diagram.tsx`

## Phase 2: Reference (On-Demand Only)

Only read when your task touches these areas:

- `docs/superpowers/specs/2026-04-04-schedule-agent-design.md` — Full design
  spec with phasing
- `src/lib/schedule/validation.ts` — Validation checks (cycles, resources,
  negative float)
- `src/lib/schedule/mock-data.ts` — The 6-activity construction schedule
- `src/components/aon-node.tsx` — Custom ReactFlow node for AON diagram
- `src/components/resource-bar.tsx` — Resource usage visualization

## After Onboarding

Report back with a concise understanding of:

1. The three-stage pipeline (intent → code → execution) and why each stage is a
   separate tool
2. How the schedule engine works (pure functions + thin state layer)
3. The prompt architecture (system prompt for reasoning, tool descriptions for
   usage, tool responses for moment-specific nudges)
