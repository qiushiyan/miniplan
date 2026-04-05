import { ToolLoopAgent, type InferAgentUIMessage } from "ai";
import { model } from "./model";
import { scheduleTools } from "./tools";
import { systemPrompt } from "./prompts";

export const scheduleAgent = new ToolLoopAgent({
  model,
  instructions: systemPrompt,
  tools: scheduleTools,
});

export type ScheduleAgentUIMessage = InferAgentUIMessage<typeof scheduleAgent>;
