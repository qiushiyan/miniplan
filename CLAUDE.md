# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

MiniPlan is an AI-powered construction schedule editor — a demo for a PlanLab interview. Users chat in natural language; an agentic AI pipeline translates requests into schedule operations through three visible stages (intent analysis → code generation → execution), then visualizes results in an AON diagram.

The core product principle: **transparency over magic**. Every pipeline stage produces a typed artifact rendered in the UI. The planner sees what the AI understood, what code it wrote, and what changed.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build (includes typecheck)
pnpm lint         # Biome check
pnpm format       # Biome format
```

Vitest is installed but no test suite exists yet. When tests are added: `pnpm vitest` or `pnpm vitest run src/lib/schedule/cpm.test.ts` for a single file.

## Tech Stack

- **Next.js 16** (app router, Turbopack default) — async request APIs required (`await params`, `await cookies()`)
- **Vercel AI SDK v6** — `ToolLoopAgent`, `createAgentUIStreamResponse`, `useChat` with `DefaultChatTransport`
- **@ai-sdk/anthropic** — Claude as model provider
- **@xyflow/react** + **@dagrejs/dagre** — AON diagram with automatic DAG layout
- **ai-elements** — vendored chat UI components (Conversation, Message, PromptInput, Tool, CodeBlock)
- **Tailwind CSS v4** + **shadcn/ui** + **Biome** for formatting/linting

## Architecture

Two independent modules connected by API routes:

**Schedule Engine** (`src/lib/schedule/`) — Pure functions. CPM algorithm computes ES/EF/LS/LF/float. SDK bindings auto-recompute CPM after each mutation. Thin state layer with commit-on-success and single-level undo.

**AI Pipeline** (`src/lib/ai/`) — `ToolLoopAgent` with five tools mapping to visible pipeline stages: `getScheduleSnapshot`, `analyzeIntent`, `generateScheduleCode`, `executeScheduleCode`, `undoLastChange`. Generated code runs via `new Function()` with SDK bindings in scope.

**UI** (`src/components/`, `src/app/`) — Split-pane: chat left (40%), visualization right (60%). Tool parts rendered per pipeline stage. Schedule state syncs from tool results via `useEffect`.

## Prompt Architecture

Three surfaces, each for what it does best:
- **System prompt** (`src/lib/ai/prompts.ts`) — domain knowledge, thinking framework, behavioral guidance
- **Tool descriptions** (`src/lib/ai/tools.ts`) — usage patterns, planner-facing language expectations
- **Tool response nudges** (in tool execute functions) — moment-specific guidance fired at decision points

## Key Constraints

- Six fixed activities, Finish-to-Start dependencies only
- No persistence — resets on refresh
- Resources warned, never auto-leveled
- `prompt-input.tsx` has `@ts-nocheck` due to Base UI type incompatibility — tech debt
- `ANTHROPIC_API_KEY` must be in `.env.local`

@AGENTS.md
