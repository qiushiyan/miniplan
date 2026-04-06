import { tool } from "ai";
import { z } from "zod";
import {
  beginPipelineRun,
  clearPendingPipelineRun,
  getCurrentSchedule,
  commit,
  getPendingPipelineRun,
  setPendingCode,
  setPendingIntent,
  undo,
  setPipelineRun,
  type CodeArtifact,
  type IntentArtifact,
  type Schedule,
  type ExecutionArtifact,
  type PipelineRun,
} from "../schedule";
import { validate } from "../schedule/validation";
import { cloneSchedule } from "../schedule/engine";
import { executeCode } from "./execution";
import { SDK_FUNCTION_NAMES } from "../schedule/sdk";

/** Compute a diff between two schedule snapshots */
function computeDiff(before: Schedule, after: Schedule) {
  const changes: ExecutionArtifact["changedActivities"] = [];
  for (const afterAct of after.activities) {
    const beforeAct = before.activities.find((a) => a.id === afterAct.id);
    if (!beforeAct) continue;
    if (beforeAct.duration !== afterAct.duration) {
      changes.push({
        id: afterAct.id,
        field: "duration",
        before: beforeAct.duration,
        after: afterAct.duration,
      });
    }
    if (beforeAct.es !== afterAct.es) {
      changes.push({
        id: afterAct.id,
        field: "es",
        before: beforeAct.es,
        after: afterAct.es,
      });
    }
    if (beforeAct.ef !== afterAct.ef) {
      changes.push({
        id: afterAct.id,
        field: "ef",
        before: beforeAct.ef,
        after: afterAct.ef,
      });
    }
    if (beforeAct.float !== afterAct.float) {
      changes.push({
        id: afterAct.id,
        field: "float",
        before: beforeAct.float,
        after: afterAct.float,
      });
    }
  }
  return changes;
}

function createFailedExecutionArtifact(
  schedule: Schedule,
  error: string,
  warnings: string[] = []
): ExecutionArtifact {
  return {
    success: false,
    error,
    warnings,
    projectDurationBefore: schedule.projectDuration,
    projectDurationAfter: schedule.projectDuration,
    criticalPathBefore: schedule.criticalPath,
    criticalPathAfter: schedule.criticalPath,
    changedActivities: [],
  };
}

function createPipelineRunFromState(
  execution: ExecutionArtifact | null,
  scheduleAfter: Schedule
): PipelineRun {
  const pendingPipelineRun = getPendingPipelineRun();

  return {
    userMessage: pendingPipelineRun?.userMessage ?? "",
    scheduleBefore:
      pendingPipelineRun?.scheduleBefore ?? cloneSchedule(getCurrentSchedule()),
    intent: pendingPipelineRun?.intent ?? null,
    code: pendingPipelineRun?.code ?? null,
    execution,
    scheduleAfter: cloneSchedule(scheduleAfter),
  };
}

export const scheduleTools = {
  getScheduleSnapshot: tool({
    description:
      "Read the current schedule state. Call this before any modification to see the latest activities, CPM values, dependencies, resources, and critical path. Also use this to answer informational queries.",
    inputSchema: z.object({}),
    execute: async () => {
      return getCurrentSchedule();
    },
  }),

  analyzeIntent: tool({
    description:
      "Externalize your analysis of the user's request as a structured intent. This makes your reasoning visible in the UI. For clear requests, set intentClearEnough=true and proceed. For ambiguous requests, set intentClearEnough=false and provide clarificationOptions — each option should name a concrete scheduling approach and its tradeoff.",
    inputSchema: z.object({
      userRequest: z.string().describe("The user's original request"),
      intentClearEnough: z
        .boolean()
        .describe("Whether the request is clear enough to act on"),
      clarificationAsked: z
        .boolean()
        .describe("Whether you are asking the user for clarification"),
      clarificationOptions: z
        .array(
          z.object({
            label: z.string().describe("Short label for this option"),
            description: z
              .string()
              .describe("What this option does and its tradeoffs"),
          })
        )
        .optional()
        .describe(
          "Concrete options to present when the intent is ambiguous"
        ),
      operationType: z
        .enum([
          "modify_duration",
          "add_dependency",
          "remove_dependency",
          "apply_constraint",
          "query_info",
        ])
        .optional()
        .describe("The type of operation the user wants"),
      targetActivityIds: z
        .array(z.string())
        .optional()
        .describe("IDs of activities affected by the operation"),
      parameters: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Operation parameters (e.g., new duration, constraint day)"),
      summary: z
        .string()
        .describe("Human-readable summary of what you understood"),
    }),
    execute: async (input) => {
      beginPipelineRun(input.userRequest);
      const intentArtifact: IntentArtifact = {
        intentClearEnough: input.intentClearEnough,
        clarificationAsked: input.clarificationAsked,
        clarificationOptions: input.clarificationOptions,
        operationType: input.operationType,
        targetActivityIds: input.targetActivityIds,
        parameters: input.parameters,
        summary: input.summary,
      };
      const pendingPipelineRun = setPendingIntent(intentArtifact);

      if (!input.intentClearEnough) {
        setPipelineRun({
          userMessage: pendingPipelineRun.userMessage,
          scheduleBefore: cloneSchedule(pendingPipelineRun.scheduleBefore),
          intent: pendingPipelineRun.intent,
          code: null,
          execution: null,
          scheduleAfter: cloneSchedule(getCurrentSchedule()),
        });
        return {
          status: "clarification_needed",
          message:
            "Present the clarification options to the user before proceeding.",
          ...input,
        };
      }
      return {
        status: "intent_clear",
        message: "Intent is clear. Proceed to code generation.",
        ...input,
      };
    },
  }),

  generateScheduleCode: tool({
    description:
      "Write JavaScript code using the Schedule SDK to implement the schedule change. This code is shown to the planner — write it clearly. The description field should explain the change in scheduling terms, not programming terms.",
    inputSchema: z.object({
      code: z
        .string()
        .describe("JavaScript code using Schedule SDK functions. Keep it simple — one logical operation per block."),
      description: z
        .string()
        .describe("What this change does in scheduling terms (e.g., 'Extends excavation by 2 days, which will push the critical path')"),
      sdkCalls: z
        .array(z.string())
        .describe("SDK function names used in the code"),
    }),
    execute: async (input) => {
      const codeArtifact: CodeArtifact = {
        code: input.code,
        description: input.description,
        sdkCalls: input.sdkCalls,
      };

      // Validate that sdkCalls only reference approved functions
      const approvedNames = new Set<string>(SDK_FUNCTION_NAMES);
      const invalidCalls = input.sdkCalls.filter(
        (name) => !approvedNames.has(name)
      );
      if (invalidCalls.length > 0) {
        setPendingCode(codeArtifact);
        return {
          status: "invalid",
          message: `Unknown SDK functions: ${invalidCalls.join(", ")}. Use only approved SDK functions.`,
          code: input.code,
          description: input.description,
          sdkCalls: input.sdkCalls,
        };
      }
      setPendingCode(codeArtifact);
      return {
        status: "ready",
        message: "Code is ready for execution. Call executeScheduleCode next.",
        code: input.code,
        description: input.description,
        sdkCalls: input.sdkCalls,
      };
    },
  }),

  executeScheduleCode: tool({
    description:
      "Execute the generated code against the schedule. On success, the change is applied and an undo snapshot is saved. On failure (circular dependency, validation error), the schedule is unchanged. After this tool completes, summarize the result for the planner in scheduling terms.",
    inputSchema: z.object({
      code: z.string().describe("The JavaScript code to execute — should match what was passed to generateScheduleCode"),
    }),
    execute: async ({ code }) => {
      const before = getCurrentSchedule();
      const result = executeCode(code, before);

      if (!result.success) {
        const error = result.isCircularDependency
          ? "Circular dependency detected — change rejected."
          : result.error ?? "Code execution failed.";
        const artifact = createFailedExecutionArtifact(before, error);
        setPipelineRun(createPipelineRunFromState(artifact, before));

        return {
          success: false,
          error,
          warnings: result.isCircularDependency ? [error] : [],
          message: result.isCircularDependency
            ? "The change was rejected because it creates a circular dependency. Explain why the schedule logic becomes invalid and suggest an alternative."
            : `Code execution failed: ${error}. Explain the error to the user and suggest a fix.`,
        };
      }

      // Validate the new schedule
      const validation = validate(result.resultSchedule);

      if (!validation.valid) {
        const artifact = createFailedExecutionArtifact(
          before,
          "Validation failed",
          validation.warnings
        );
        setPipelineRun(createPipelineRunFromState(artifact, before));
        return {
          success: false,
          error: "Validation failed",
          warnings: validation.warnings,
          message: `The change was rejected: ${validation.warnings.join("; ")}. Explain this to the user.`,
        };
      }

      // Commit on success
      commit(result.resultSchedule);

      const after = result.resultSchedule;
      const changedActivities = computeDiff(before, after);

      // Build targeted nudges — moment-specific guidance for the model's summary
      const nudges: string[] = [];
      const durationDelta = after.projectDuration - before.projectDuration;
      if (durationDelta !== 0) {
        nudges.push(
          `Project duration ${durationDelta > 0 ? "increased" : "decreased"} by ${Math.abs(durationDelta)} days (${before.projectDuration} → ${after.projectDuration}). Explain why: was the changed activity on the critical path?`
        );
      }
      if (
        JSON.stringify(before.criticalPath) !==
        JSON.stringify(after.criticalPath)
      ) {
        nudges.push(
          `Critical path shifted from [${before.criticalPath.join(" → ")}] to [${after.criticalPath.join(" → ")}]. Explain what this means for the planner — which activities are now critical that weren't before?`
        );
      }
      // Check for near-critical activities (float <= 2)
      const nearCritical = after.activities.filter(
        (a) => a.float > 0 && a.float <= 2 && !after.criticalPath.includes(a.id)
      );
      if (nearCritical.length > 0) {
        nudges.push(
          `Near-critical activities with low float: ${nearCritical.map((a) => `${a.name} (${a.float}d float)`).join(", ")}. Mention these as risk areas.`
        );
      }
      if (validation.warnings.length > 0) {
        nudges.push(
          `Warnings: ${validation.warnings.join("; ")}. Present each warning clearly with its scheduling consequence.`
        );
      }

      const artifact: ExecutionArtifact = {
        success: true,
        warnings: validation.warnings,
        projectDurationBefore: before.projectDuration,
        projectDurationAfter: after.projectDuration,
        criticalPathBefore: before.criticalPath,
        criticalPathAfter: after.criticalPath,
        changedActivities,
      };

      setPipelineRun(createPipelineRunFromState(artifact, after));

      return {
        success: true,
        message: nudges.length > 0 ? nudges.join(" ") : "Change applied successfully. Summarize the results for the user.",
        artifact,
        schedule: after,
      };
    },
  }),

  undoLastChange: tool({
    description:
      "Undo the last schedule modification, restoring the previous state.",
    inputSchema: z.object({}),
    execute: async () => {
      const restored = undo();
      if (!restored) {
        return {
          success: false,
          message: "Nothing to undo.",
        };
      }
      clearPendingPipelineRun();
      return {
        success: true,
        message: "Last change undone. Inform the user what was restored.",
        schedule: restored,
      };
    },
  }),
};
