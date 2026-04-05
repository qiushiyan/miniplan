import { ToolLoopAgent, type InferAgentUIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { scheduleTools } from "./tools";
import { systemPrompt } from "./prompts";

export const scheduleAgent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-5"),
  instructions: systemPrompt,
  tools: scheduleTools,
});

export type ScheduleAgentUIMessage = InferAgentUIMessage<typeof scheduleAgent>;
