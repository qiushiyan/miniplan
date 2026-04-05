"use client";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { MessageResponse } from "@/components/ai-elements/message";
import { isToolUIPart } from "ai";

type ToolPartProps = {
  // biome-ignore lint/suspicious/noExplicitAny: tool parts have dynamic types
  part: any;
};

function ScheduleSnapshotTool({ part }: ToolPartProps) {
  return (
    <Tool>
      <ToolHeader type={part.type} state={part.state} title="Read schedule" />
      <ToolContent>
        {part.state === "output-available" && part.output && (
          <ToolOutput
            errorText={undefined}
            output={
              <div className="text-xs text-muted-foreground">
                {part.output.activities?.length ?? 0} activities,{" "}
                {part.output.projectDuration ?? "?"}-day project
              </div>
            }
          />
        )}
      </ToolContent>
    </Tool>
  );
}

function AnalyzeIntentTool({ part }: ToolPartProps) {
  const needsClarification =
    part.state === "output-available" &&
    part.output?.status === "clarification_needed";

  return (
    <Tool defaultOpen={needsClarification}>
      <ToolHeader
        type={part.type}
        state={part.state}
        title="Analyze intent"
      />
      <ToolContent>
        {(part.state === "input-available" ||
          part.state === "output-available") &&
          part.input && (
            <div className="space-y-2 p-3 text-sm">
              <p className="text-muted-foreground">{part.input.summary}</p>
              {part.input.operationType && (
                <div className="flex gap-2 text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    {part.input.operationType}
                  </span>
                  {part.input.targetActivityIds?.map((id: string) => (
                    <span
                      key={id}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              )}
              {part.input.clarificationOptions && (
                <div className="space-y-1 pt-1">
                  {part.input.clarificationOptions.map(
                    (opt: { label: string; description: string }, i: number) => (
                      <div
                        key={`opt-${i}`}
                        className="rounded-md border p-2 text-xs"
                      >
                        <span className="font-medium">{opt.label}:</span>{" "}
                        {opt.description}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
      </ToolContent>
    </Tool>
  );
}

function GenerateCodeTool({ part }: ToolPartProps) {
  const code =
    part.state === "output-available"
      ? part.output?.code ?? part.input?.code
      : part.input?.code;
  const description = part.input?.description;

  return (
    <Tool defaultOpen={true}>
      <ToolHeader
        type={part.type}
        state={part.state}
        title="Generate code"
      />
      <ToolContent>
        <div className="space-y-2">
          {description && (
            <p className="px-3 pt-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {code && (
            <CodeBlock code={code} language="javascript">
              <CodeBlockHeader>
                <CodeBlockTitle>
                  <CodeBlockFilename>schedule-update.js</CodeBlockFilename>
                </CodeBlockTitle>
                <CodeBlockActions>
                  <CodeBlockCopyButton />
                </CodeBlockActions>
              </CodeBlockHeader>
            </CodeBlock>
          )}
        </div>
      </ToolContent>
    </Tool>
  );
}

function ExecuteCodeTool({ part }: ToolPartProps) {
  const output = part.state === "output-available" ? part.output : null;

  return (
    <Tool defaultOpen={true}>
      <ToolHeader
        type={part.type}
        state={part.state}
        title="Execute"
      />
      <ToolContent>
        {output && (
          <ToolOutput
            output={
              output.success ? (
                <MessageResponse>
                  {formatExecutionResult(output.artifact)}
                </MessageResponse>
              ) : (
                <div className="text-sm text-destructive">
                  {output.error || "Execution failed"}
                </div>
              )
            }
            errorText={output.success ? undefined : output.error}
          />
        )}
      </ToolContent>
    </Tool>
  );
}

function UndoTool({ part }: ToolPartProps) {
  const output = part.state === "output-available" ? part.output : null;

  return (
    <Tool>
      <ToolHeader
        type={part.type}
        state={part.state}
        title="Undo"
      />
      <ToolContent>
        {output && (
          <ToolOutput
            errorText={undefined}
            output={
              <div className="text-sm text-muted-foreground">
                {output.success ? "Change reverted." : "Nothing to undo."}
              </div>
            }
          />
        )}
      </ToolContent>
    </Tool>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: execution artifact has dynamic shape
function formatExecutionResult(artifact: any): string {
  if (!artifact) return "Change applied.";

  const lines: string[] = [];

  if (artifact.projectDurationBefore !== artifact.projectDurationAfter) {
    lines.push(
      `**Project duration:** ${artifact.projectDurationBefore} → ${artifact.projectDurationAfter} days`
    );
  }

  if (
    JSON.stringify(artifact.criticalPathBefore) !==
    JSON.stringify(artifact.criticalPathAfter)
  ) {
    lines.push(
      `**Critical path:** ${artifact.criticalPathAfter.join(" → ")}`
    );
  }

  if (artifact.changedActivities?.length > 0) {
    for (const c of artifact.changedActivities.filter(
      // biome-ignore lint/suspicious/noExplicitAny: dynamic field access
      (ch: any) => ch.field === "duration"
    )) {
      lines.push(`- **${c.id}** ${c.field}: ${c.before} → ${c.after}`);
    }
  }

  if (artifact.warnings?.length > 0) {
    lines.push("");
    lines.push("**Warnings:**");
    for (const w of artifact.warnings) {
      lines.push(`- ${w}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Change applied successfully.";
}

export function ToolPartRenderer({ part }: ToolPartProps) {
  if (!isToolUIPart(part)) return null;

  // In AI SDK v6, typed tool parts use type "tool-{toolName}"
  switch (part.type) {
    case "tool-getScheduleSnapshot":
      return <ScheduleSnapshotTool part={part} />;
    case "tool-analyzeIntent":
      return <AnalyzeIntentTool part={part} />;
    case "tool-generateScheduleCode":
      return <GenerateCodeTool part={part} />;
    case "tool-executeScheduleCode":
      return <ExecuteCodeTool part={part} />;
    case "tool-undoLastChange":
      return <UndoTool part={part} />;
    default:
      return (
        <Tool>
          <ToolHeader
            type="dynamic-tool"
            toolName={String(part.type).replace("tool-", "")}
            state={part.state}
          />
          <ToolContent>
            <ToolInput input={part.input} />
          </ToolContent>
        </Tool>
      );
  }
}
