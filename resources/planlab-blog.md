# If Planners Were Programmers

## Two Years of Complex Projects

We started PlanLab two years ago with a group of engineers & data scientists. Since then, we've worked on some of the most interesting and complex scheduling problems in the industry—billion-dollar project portfolios, multi-year infrastructure programs, intricate construction schedules with (tens of) thousands of activities and constraints.

Along the way, we noticed something: **there's enormous overlap between what computer programmers do and what schedulers and planners do**.

## The Hidden Parallel

At first glance, planning and programming seem like different worlds. One deals with construction sites, equipment, and crews. The other with servers, APIs, and databases. But look closer at the actual work:

Type of Work

Planners

Programmers

Define interfaces

Create milestone structure

Define types & signatures

Break down deliverables

Build WBS structure

Define modules & packages

Build logical structure

Set up activity dependencies

Define control flow & data flow

Create implementation

Set up activities with durations

Implement functions & classes

Verify correctness

Run CPM, check constraints, validate logic

Build and run tests, validate behavior

Communicate with stakeholders

Present Gantt charts, create custom visualizations

Write documentation, build UIs

Reuse prior work

Create and use template schedules

Create and use libraries, frameworks, components

Both disciplines involve breaking down complex problems, building logical structures, creating implementations, verifying correctness, and iterating.

The mental models are almost identical—just applied to different domains.

## Programming Techniques as a Cheat Code

We're programmers by trade. And we've found that applying programming techniques to planning problems feels like a cheat code.

Consider what programmers take for granted:

-   **Version control:** Track every change, revert mistakes, branch to try alternatives
-   **Automation:** Write a script once, run it a thousand times
-   **Testing:** Verify that changes don't break existing functionality
-   **Abstraction:** Build reusable components instead of copy-pasting
-   **Static analysis:** Catch errors before they cause problems

Now imagine applying these to scheduling. What if you could write a script that automatically adjusts all concrete activities in a specific zone? What if you could test that a change doesn't violate any constraints before applying it? What if you could version control your schedule and see exactly what changed and when?

Furthermore, programmer productivity is skyrocketing due to the rise of AI tools like Cursor, Claude Code and more. These productivity boosts have sadly not yet reached the planning industry.

## The Case for Planners Hiring Programmers

Some of the best planning teams already recognize this. They have programmers, data scientists, or automation specialists on staff to:

-   Process client data from various formats into their systems
-   Build bills of materials from design documents
-   Optimize complex resource allocation problems
-   Create integrations with ERP systems, procurement tools, and BIM platforms
-   Automate repetitive schedule updates
-   Build custom dashboards and reports

The teams that do this have a significant advantage. They can handle larger projects, respond faster to changes, and deliver more value to their clients. However, this is a costly investment to make, and not feasible for most teams.

## What If Every Planner Had a Programmer?

At PlanLab, we're building something different: **an AI programmer that has access to scheduling tools**. This means every planner can have a programmer on hand—one that understands schedules, activities, dependencies, resources, and constraints.

Here's how it works when a user asks the Planlab AI Agent to make an update:

User (Planner)"Make concrete pouring twice as long"natural languageclarifying questionsAI AgentUnderstands intent,writes code, checks resultsqueryschedule elementsgenerated codeexecution resultsSchedule ReaderFinds activities, WBS,codes & relationshipsSchedule VMExecutes code on scheduleRuns CPM, validates results

The user speaks in natural language. The AI agent understands the intent and writes code. The Schedule VM executes that code on the actual schedule, runs CPM analysis, validates results, and reports back. The user reviews the changes and can iterate.

### Real Examples

Let's have a look underneath the hood of the AI Agent. Our AI Agent takes each user's request, reasons about it, uses a Schedule Reader AI to understand what parts of the schedule are relevant, and then writes code to make the changes. **You can think of this code as the thoughts of the AI agent.**

We' look at a few examples of the code that the AI Agent writes. In a future blog post, we'll look at the Schedule Reader AI and how it works in more detail - for now, simply think of it as an AI system that can read schedules, find patterns, and understand how parts of the schedule relate to the user's request.

**Example 1:** A user says: "Make all activities in WBS Zone 5 ten percent longer."

The agent reasons about the request, creates a plan, and writes:

AI Generated code

```
const Zone5WBSs = /* AI-discovered WBS items for Zone 5 */;
const Zone5Activities = dedupe(
  Zone5WBSs.flatMap((z) => getWBSContainedActivities(z))
);

Zone5Activities.forEach((a) => {
  const d = activityGetDuration(a, 'hours');
  setActivityDuration(a, d * 1.1, 'hours');
});
```

This works because the code first discovers all WBS items that represent Zone 5, then collects every activity contained within those WBS items. The `dedupe` function ensures each activity is only processed once (since activities can appear under multiple WBS paths). Finally, it loops through each activity, reads the current duration, and sets it to 110% of the original—a clean, repeatable operation that would take hours to do manually. The system can make this change in seconds, even if the given Zone 5 WBS has hundreds of activities.

**Example 2:** "Equipment delivery for Control Systems will be 2 weeks longer."

AI Generated code

```
const EquipmentDeliveryActivities = /* AI-discovered activities for equipment delivery */;
const ControlSystemWBSs = /* AI-discovered WBS items for control systems */;

const EquipmentDeliveryForControlSystems = 
  EquipmentDeliveryActivities.filter((act) => 
    ControlSystemWBSs.some(w => activityIsContainedInWBS(act, w))
  );

EquipmentDeliveryForControlSystems.forEach((act) => {
  const d = activityGetDuration(act, 'weeks');
  setActivityDuration(act, d + 2, 'weeks');
});
```

This demonstrates the power of set operations. The code finds two sets of activities—equipment delivery activities and activities within Control Systems WBS—then filters to find only activities that belong to both. This intersection logic would require careful manual cross-referencing in traditional tools. Once identified, adding 2 weeks to each is trivial. The agent handles the complexity of finding the right activities; the update itself is straightforward.

**Example 3:** "Construction of Beneficiation has to happen after construction of Primary Crushing."

AI Generated code

```
const PrimaryCrushingWBSs = /* AI-discovered WBS items for primary crushing */;
const ConstructionWBSs = /* AI-discovered WBS items for construction */;
const BeneficiationWBSs = /* AI-discovered WBS items for benefication */;

const BeneficiationActivities = dedupe(
  BeneficiationWBSs.flatMap((w) => getWBSContainedActivities(w))
);
const ConstructionActivities = dedupe(
  ConstructionWBSs.flatMap((w) => getWBSContainedActivities(w))
);
const ConstructionOfBeneficiation = dedupe(
  BeneficiationActivities.filter((b) => 
    ConstructionActivities.some((c) => activitiesAreEqual(b, c))
  )
);

const PrimaryCrushingActivities = dedupe(
  PrimaryCrushingWBSs.flatMap((w) => getWBSContainedActivities(w))
);
const ConstructionOfPrimaryCrushing = dedupe(
  PrimaryCrushingActivities.filter((p) => 
    ConstructionActivities.some((c) => activitiesAreEqual(p, c))
  )
);

ConstructionOfBeneficiation.forEach((benAct) => {
  ConstructionOfPrimaryCrushing.forEach((crushAct) => {
    createPrerequisite(crushAct, benAct, 'START_AFTER_FINISH');
  });
});
```

This example shows complex relationship creation. The code first builds two precise sets: construction activities for Beneficiation and construction activities for Primary Crushing. It finds these by intersecting each discipline's WBS with the Construction WBS. Then it creates predecessor relationships between every pair—ensuring nothing in Beneficiation can start until Primary Crushing finishes. What would be dozens of manual relationship entries becomes a single logical operation.

**Example 4:** "Commissioning cannot start until July 2026."

AI Generated code

```
const CommissioningCodes = /* AI-discovered activity codes for commissioning */;
const CommissioningActivities = dedupe(
  CommissioningCodes.flatMap((c) => getAssignedActivities(c))
);

CommissioningActivities.forEach((act) => {
  activityApplyDateConstraint(
    act, 
    dateFromYearMonthDay(2026, 7, 1), 
    'START_AFTER'
  );
});
```

Here the code uses activity codes—metadata tags that classify activities by type or phase. The agent discovers which codes represent commissioning work, retrieves all activities assigned to those codes, and applies a "start no earlier than" constraint to each. This pattern scales effortlessly: whether there are 5 or 500 commissioning activities, the logic remains the same, and every activity gets the constraint applied correctly and consistently.

## But Where Does This Code Run?

You might be wondering: if an AI is writing and executing code, how do we keep things safe? This is where our Schedule VM comes in—a sandboxed virtual machine purpose-built for schedule operations.

The AI agent writes code, but that code runs in complete isolation. It cannot escape the sandbox. It cannot access the internet. It cannot touch anything outside the schedule it's working on. The only output is a set of proposed edits to the schedule—edits that a user can review, accept, or undo at any time.

This sandboxed execution environment is core technology we developed specifically for performance and safety. The AI can freely experiment, try different approaches, and iterate on solutions—all without any risk to your data or systems. If the code produces unexpected results, you simply undo. If the AI takes a wrong turn, it stays contained within the sandbox.

This architecture gives you the best of both worlds: the power of AI-generated code with the safety guarantees of a controlled environment.

## The Power of Programmable Schedules

Notice what's happening here. The user expresses intent in plain English. The system translates that into precise operations on the schedule. The code is deterministic, repeatable, and auditable.

This unlocks capabilities that were previously impractical:

-   **Bulk operations:** Update hundreds of activities in seconds
-   **Complex logic:** "All activities assigned to both Main Site and Civil codes"
-   **Conditional updates:** "Only if the activity is on the critical path"
-   **Scenario modeling:** "What if weather adds 20% to all outdoor work?"
-   **Automation:** Run the same update across multiple schedules

## The Future of Planning

We believe this is the future of planning. Not replacing planners—**amplifying them**. Giving every planner the power of having a programmer at their side. One that understands schedules deeply, can execute complex operations instantly, and never makes arithmetic errors.

The best planning teams have always known that programming and planning are deeply connected. Now, every team can benefit from that connection.

If you're interested in seeing this in action, [get in touch](/get-in-touch). We'd love to show you what happens when planners can write code.
