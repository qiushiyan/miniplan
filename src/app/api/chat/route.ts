import { createAgentUIStreamResponse } from "ai";
import { scheduleAgent } from "@/lib/ai/agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: scheduleAgent,
    uiMessages: messages,
  });
}
