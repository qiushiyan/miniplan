# Schedule AI Agent — Demo App Specification

## What We're Building

A minimal but functional AI-powered construction schedule editor. Users interact through a chat interface in natural language. The system translates their requests into schedule operations, executes them, and visualizes the results in real-time.

Think of it as a simplified version of what PlanLab (https://www.planlab.ai) builds: an AI programmer that has access to scheduling tools. Read their blog post "If Planners Were Programmers" at resources/planlab-blog.md to understand the product vision and see examples of the code generation pattern we're replicating.

## Current state

This is a barebone Nextjs 16 project (app router) with all default settings and pages. You need to start from scratch.

## Domain Background: Construction Scheduling

Before building, you need to understand a few core concepts from construction project scheduling. These are well-established concepts from the field — search for additional context if needed.

### Activities and Dependencies

A construction project is a set of **activities** (tasks) with **dependencies** between them. The most common dependency type is **Finish-to-Start (FS)**: Activity B cannot start until Activity A finishes. Other types exist (Start-to-Start, Finish-to-Finish, Start-to-Finish) but we only need FS for this demo.

### Critical Path Method (CPM)

CPM is the core scheduling algorithm. Given activities with durations and FS dependencies:

1. **Forward Pass**: Starting from project start (time 0), calculate the **Early Start (ES)** and **Early Finish (EF)** of each activity. An activity's ES is the maximum EF of all its predecessors. EF = ES + duration.

2. **Backward Pass**: Starting from the project end (the maximum EF), calculate the **Late Finish (LF)** and **Late Start (LS)** of each activity. An activity's LF is the minimum LS of all its successors. LS = LF - duration.

3. **Float (Slack)**: Float = LS - ES = LF - EF. Activities with **zero float** are on the **critical path** — any delay to these activities delays the entire project.

### Activity-on-Node (AON) Diagram

A visual representation where each activity is a **node** (box) and dependencies are **arrows** between nodes. Each node displays: activity name, duration, ES, EF, LS, LF, and float. Critical path activities are typically highlighted (e.g., red border).

### Resources

Activities may require resources (e.g., excavators, cranes, workers). Resources have limited availability. When two activities need the same resource simultaneously and there isn't enough, one must be delayed — this is the **resource leveling** problem. For this demo, we track resources and display conflicts but do NOT need to implement automated resource leveling.

## The Mock Schedule

Use this fixed schedule for the demo. All relationships are Finish-to-Start (FS):

```
Activities:
- EXC: Excavation, 5 days, requires 2 excavators
- FND: Foundation, 8 days, requires 1 crane, depends on EXC
- STL: Structural Steel, 10 days, requires 2 cranes, depends on FND
- ELC: Electrical Installation, 6 days, no special resource, depends on FND
- CPR: Concrete Pour, 4 days, requires 1 crane, depends on STL
- COM: Commissioning, 3 days, no special resource, depends on CPR AND ELC

Resources available:
- Excavators: 3
- Cranes: 2
```

This schedule has:
- A critical path (EXC → FND → STL → CPR → COM = 30 days)
- A parallel non-critical path (FND → ELC, which has float)
- Resource constraints (STL uses 2 cranes, CPR uses 1 — no conflict since they're sequential, but modifications could create conflicts)

After implementing CPM, verify your calculations produce these results before proceeding.

## Core Architecture: The AI Pipeline

The system has a 3-step pipeline that transforms natural language into schedule operations. Each step should be visible in the UI so the user (and interviewer) can see what's happening under the hood.

### Step 1: Intent Analysis & Clarification

The AI receives the user's natural language input and determines:

- **Is the request clear enough to act on?** If not, ask clarifying questions. Examples of vague requests:
  - "Make it faster" → Which activities? By how much? Willing to add resources or only resequence?
  - "Fix the schedule" → What's wrong with it? What outcome do you want?
  - "Move things around" → Which activities? What constraints should be respected?

- **What is the structured intent?** If clear, extract:
  - Operation type: modify_duration, add_dependency, remove_dependency, apply_constraint, query_info
  - Target activities: which activities are affected (by name, by group, by characteristic)
  - Parameters: new duration, constraint date, relationship type, etc.

This step should output a structured intent object AND a human-readable explanation of what the system understood.

### Step 2: Code Generation

Based on the structured intent, the AI generates TypeScript code that uses the **Schedule SDK** — a set of functions we provide for manipulating the schedule. The generated code should look similar to the examples in PlanLab's blog post.

The Schedule SDK provides these functions (implement these as the actual schedule manipulation layer):

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
applyDateConstraint(activityId: string, date: string, type: 'START_AFTER' | 'FINISH_BEFORE'): void

// After any modification, CPM is automatically recalculated
```

The generated code is displayed to the user in a code block within the pipeline panel. This transparency is intentional — it shows the user exactly what the AI is "thinking."

### Step 3: Execution & Validation

Execute the generated code against the schedule. After execution:

1. **Recalculate CPM** (forward pass + backward pass) to update all ES, EF, LS, LF, float values
2. **Check for constraint violations:**
   - Negative float (should not happen with valid FS dependencies, but could with date constraints)
   - Resource over-allocation (flag but don't auto-resolve)
   - Circular dependencies (reject the change)
3. **Report results** back to the user:
   - What changed (before/after comparison)
   - New project duration
   - New critical path (if it changed)
   - Any warnings (resource conflicts, reduced float on near-critical activities)
4. **Update the visualization**

## UI Layout

A single-page application with this layout:

```
+------------------------------------------+
|              Header / Title              |
+------------------+-----------------------+
|                  |                       |
|   Chat Panel     |  Schedule             |
|   (left, ~40%)   |  Visualization        |
|                  |  (right, ~60%)        |
|   - User msgs    |                       |
|   - AI responses |  - AON diagram        |
|   - Pipeline     |    (nodes + arrows)   |
|     details      |  - Critical path      |
|     (collapsible)|    highlighted        |
|                  |  - Resource usage      |
|                  |    bar (simple)       |
|                  |                       |
+------------------+-----------------------+
```

### Chat Panel
- Standard chat interface with user/AI message bubbles
- After each AI response, a collapsible "Pipeline Details" section shows:
  - Step 1: Intent Analysis result (structured intent + any clarifying questions)
  - Step 2: Generated Code (syntax highlighted TypeScript)
  - Step 3: Execution Result (changes made, warnings, new project duration)

### Schedule Visualization
- **AON Diagram**: Each activity as a box showing name, duration, ES/EF, LS/LF, float. Critical path activities have a distinct visual treatment (e.g., red border or background). Arrows show dependencies.
- **Resource Bar**: A simple horizontal bar chart showing resource usage per time period. Highlight periods where usage exceeds availability.
- The visualization updates in real-time after each schedule modification.
- Include an "Undo" button that reverts the last change.

## Technical Stack

- **Language**: TypeScript throughout (frontend, schedule engine, AI pipeline)
- **AI Integration**: Vercel AI SDK (`ai` package) for chat interface and LLM streaming. Use Anthropic's Claude as the model provider.
- **Frontend**: Your choice of React framework. Keep it simple — this is a demo, not a production app. Canvas-based or SVG-based rendering for the AON diagram is fine; a library like ReactFlow could also work for the node graph.
- **No separate backend required**: Nextjs is a fullstack framework. You can use server actions and api routes for server side logic. The schedule engine, CPM calculation, and code execution can be decided to happen in either the browser or server.
- **Basic database**: You may use simple on disk json files for persistence of chat sessions and project state, create wrappers such as `saveChatSession` so you can swap implementations in the future
- pnpm for package management

## Module Breakdown

### 1. Schedule Engine (`src/lib/schedule/`)
- `types.ts` — Activity, Dependency, Resource, Schedule types
- `cpm.ts` — Forward pass, backward pass, critical path, float calculation
- `schedule.ts` — The schedule state manager: holds activities, dependencies, resources. Exposes the Schedule SDK functions. After any mutation, automatically runs CPM.
- `mock-data.ts` — The fixed mock schedule defined above
- `validation.ts` — Constraint checking: circular dependencies, resource conflicts

### 2. AI Pipeline (`src/lib/ai/`)
- `intent-analysis.ts` — Step 1: Takes user message + current schedule state, returns structured intent or clarifying questions. Uses LLM.
- `code-generation.ts` — Step 2: Takes structured intent + schedule SDK type definitions, generates TypeScript code. Uses LLM.
- `execution.ts` — Step 3: Takes generated code string, executes it against the schedule engine (using `new Function()` or similar sandboxed approach), returns results and any validation errors.
- `prompts.ts` — System prompts for each pipeline step. Keep these well-structured and separate from the pipeline logic.

### 3. UI (`src/app/` or `src/components/`)
- Chat interface with message history
- Pipeline details panel (collapsible, shows each step)
- AON diagram visualization
- Resource usage bar
- Undo button

For AI related components, I will be installed the ai-elements registry of components which implements things such as chat bubbles, AI interactions, etc. so you dont have to worry too much about it.

## What NOT to Build

- **No authentication or user management**
- **No persistent storage** — everything resets on page refresh
- **No automated resource leveling** — just detect and flag conflicts
- **No complex dependency types** — only Finish-to-Start
- **No calendar/working days logic** — all durations are in simple days
- **No multiple schedules** — one fixed schedule
- **No real sandbox isolation** — a simple `new Function()` execution with the SDK functions in scope is sufficient. We are not handling untrusted code.
- All chat history happens in one single session, so you dont have to build a sidebar listing sessions in traditional chat frontends
- Did not made a decision on what canvas package we want to use yet, since we are mostly interested in a simple static display of activities and edges, we might dont need a fancy library, but I have heard good things about @xyflow/react

## Implementation Order

1. **Schedule Engine first**: Implement types, CPM algorithm, and SDK functions. Write tests to verify CPM calculations match the expected values for the mock schedule. This is the foundation — get it right before moving on.

2. **AI Pipeline second**: Implement the 3-step pipeline. Start with code generation (Step 2) since it's the most visible. Then add intent analysis (Step 1). Execution (Step 3) connects the generated code to the schedule engine.

3. **UI last**: Build the chat interface, visualization, and pipeline panel. Connect everything together.

## Key Design Principles

1. **Transparency over magic**: Show every step of the pipeline. The user should see what the AI understood, what code it wrote, and what the execution produced. This is a core product principle — trust comes from visibility.

2. **Clarification over assumption**: When the user's request is ambiguous, ask questions rather than guessing. This is better UX and also a key eval dimension.

3. **Validation over blind execution**: Every schedule modification should be validated. If the change creates a resource conflict or violates a constraint, tell the user before applying it.

4. **Separation of concerns**: The schedule engine knows nothing about AI. The AI pipeline knows nothing about rendering. The UI connects them. This makes each module independently testable.

## Other considerations 

This is more of a toy project that is not meant for production use cases. The core goal with this project is to see how far we can go with implementing a minimal version of an AI-powered intelligent construction scheduling assistant.

The project focus is structured as follows:

1. Primary Emphasis
   (a) The design of the agent logic
   (b) UX decisions (such as how to encourage the user to elaborate on possibly vague requirements)

2. What is NOT a focus
   (a) Implementing a highly optimized algorithm
   (b) The actual running of activities
   (c) Resource leveling algorithms

We do need a somewhat friendly and easy frontend display so that we can see how it works in action, but overall, the frontend is also not a special focus here.

## Why This Project Exists

This is a demo project built for a job interview at PlanLab (https://www.planlab.ai), a London-based startup that builds AI-powered construction scheduling software. 


The purpose of this demo is to show that I understand their core product architecture — specifically the pipeline of natural language → intent analysis → code generation → schedule execution → visualization — and that I can build a working version of it from scratch.

This is a toy implementation. It is intentionally minimal. The goal is NOT to build a production-ready scheduling tool. The goal IS to demonstrate:

Understanding of the domain: CPM, critical path, float, dependencies — these concepts are correctly implemented
Understanding of the AI pipeline: The 3-step pipeline mirrors PlanLab's actual architecture as described in their blog posts
Engineering judgment: Clean separation of concerns, transparent pipeline visibility, proper validation after mutations

What we plan to focus on after the MVP runs:

Eval system: Adding automated evaluation for each pipeline step — did intent analysis correctly parse the query? Did code generation produce valid SDK calls? Did execution maintain schedule integrity? This is the interviewer's top priority ("70% of time should be on evals")

Clarification UX: Designing better patterns for handling ambiguous user requests — when to ask follow-up questions, how to present tradeoffs, how to help users who don't know exactly what they want

Live customization demo: Using this project as a base to show how I would implement a new feature request on the spot during the interview, demonstrating my development workflow with AI coding tools



## Reference Materials

- PlanLab blog "If Planners Were Programmers": resources/planlab-blog.md — The product vision and code generation examples we're replicating
- PlanLab blog "Critical Path Drag": resources/drag.md — Deeper understanding of CPM concepts
- Use web search — If you need more background on CPM, forward/backward pass, and float calculations


You current job is researching relevant domain knowledge, tech stack (using context7 or web search), and interview my to make sure you understand the product intention. DO not implement anything now.
