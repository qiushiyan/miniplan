import { tool } from "ai";
import { z } from "zod";
import {
  getCurrentSchedule,
  commit,
  undo,
  type Schedule,
  type ExecutionArtifact,
} from "../schedule";
import { validate } from "../schedule/validation";
import { cloneSchedule } from "../schedule/engine";
import { executeCode } from "./execution";
import { SDK_FUNCTION_NAMES } from "../schedule/sdk";

/** Format a schedule snapshot for the model to read */
function formatScheduleSnapshot(schedule: Schedule) {
  return {
    projectDuration: schedule.projectDuration,
    criticalPath: schedule.criticalPath,
    activities: schedule.activities.map((a) => ({
      id: a.id,
      name: a.name,
      duration: a.duration,
      es: a.es,
      ef: a.ef,
      ls: a.ls,
      lf: a.lf,
      float: a.float,
      resources: a.resources,
    })),
    dependencies: schedule.dependencies.map((d) => ({
      from: d.fromId,
      to: d.toId,
    })),
    resources: schedule.resources,
    constraints: schedule.constraints,
  };
}

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

export const scheduleTools = {
  getScheduleSnapshot: tool({
    description:
      "Read the current schedule state including all activities with CPM values, dependencies, resources, and critical path.",
    inputSchema: z.object({}),
    execute: async () => {
      const schedule = getCurrentSchedule();
      return formatScheduleSnapshot(schedule);
    },
  }),

  analyzeIntent: tool({
    description:
      "Externalize your analysis of the user's request. Fill in the structured intent fields to show what you understood. If the request is ambiguous, set intentClearEnough to false and provide clarificationOptions with concrete alternatives and tradeoffs.",
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
        .record(z.unknown())
        .optional()
        .describe("Operation parameters (e.g., new duration, constraint day)"),
      summary: z
        .string()
        .describe("Human-readable summary of what you understood"),
    }),
    execute: async (input) => {
      if (!input.intentClearEnough) {
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
      "Generate JavaScript code using the Schedule SDK to implement the intended schedule change. The code will be executed in a sandboxed scope with SDK functions available.",
    inputSchema: z.object({
      code: z
        .string()
        .describe("JavaScript code using Schedule SDK functions"),
      description: z
        .string()
        .describe("Human-readable description of what the code does"),
      sdkCalls: z
        .array(z.string())
        .describe("Names of SDK functions used in the code"),
    }),
    execute: async (input) => {
      // Validate that sdkCalls only reference approved functions
      const approvedNames = new Set<string>(SDK_FUNCTION_NAMES);
      const invalidCalls = input.sdkCalls.filter(
        (name) => !approvedNames.has(name)
      );
      if (invalidCalls.length > 0) {
        return {
          status: "invalid",
          message: `Unknown SDK functions: ${invalidCalls.join(", ")}. Use only approved SDK functions.`,
          code: input.code,
          description: input.description,
          sdkCalls: input.sdkCalls,
        };
      }
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
      "Execute the generated JavaScript code against the current schedule. The code runs in a sandboxed scope with Schedule SDK functions available. On success, the schedule is updated and an undo snapshot is saved.",
    inputSchema: z.object({
      code: z.string().describe("JavaScript code to execute"),
    }),
    execute: async ({ code }) => {
      const before = getCurrentSchedule();
      const result = executeCode(code, before);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          message: `Code execution failed: ${result.error}. Explain the error to the user and suggest a fix.`,
        };
      }

      // Validate the new schedule
      const validation = validate(result.resultSchedule);

      if (!validation.valid) {
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

      // Build targeted nudges for the response
      const nudges: string[] = [];
      if (
        JSON.stringify(before.criticalPath) !==
        JSON.stringify(after.criticalPath)
      ) {
        nudges.push(
          `Critical path changed from [${before.criticalPath.join(" → ")}] to [${after.criticalPath.join(" → ")}] — highlight this to the user.`
        );
      }
      if (validation.warnings.length > 0) {
        nudges.push(
          `Warnings detected: ${validation.warnings.join("; ")} — inform the user.`
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

      return {
        success: true,
        message: nudges.length > 0 ? nudges.join(" ") : "Change applied successfully. Summarize the results for the user.",
        artifact,
        schedule: formatScheduleSnapshot(after),
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
      return {
        success: true,
        message: "Last change undone. Inform the user what was restored.",
        schedule: formatScheduleSnapshot(restored),
      };
    },
  }),
};
