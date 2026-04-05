import { streamText, Output, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { suggestionModel } from "@/lib/ai/model";
import { suggestionSystemPrompt } from "@/lib/ai/suggestions";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: suggestionModel,
    system: suggestionSystemPrompt,
    messages: modelMessages,
    output: Output.object({
      schema: z.object({
        suggestions: z
          .array(z.string())
          .describe("3 follow-up questions the planner might ask next"),
      }),
    }),
  });

  return result.toTextStreamResponse();
}
