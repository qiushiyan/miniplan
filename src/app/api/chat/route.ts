import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  validateUIMessages,
  streamText,
  Output,
} from "ai";
import { z } from "zod";
import { scheduleAgent } from "@/lib/ai/agent";
import { suggestionModel } from "@/lib/ai/model";
import { suggestionSystemPrompt } from "@/lib/ai/suggestions";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages: uiMessages } = await request.json();

  // biome-ignore lint/suspicious/noExplicitAny: validateUIMessages expects a generic tool record
  const tools = scheduleAgent.tools as any;
  const validated = await validateUIMessages({ messages: uiMessages, tools });
  const modelMessages = await convertToModelMessages(validated, { tools });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // 1. Run the agent pipeline
      const result = await scheduleAgent.stream({ prompt: modelMessages });
      writer.merge(
        result.toUIMessageStream({ originalMessages: validated })
      );
      await result.consumeStream();

      // 2. Get response messages to include as context for suggestions
      const responseMessages = (await result.response).messages;

      // 3. Stream follow-up suggestions with Haiku
      const suggestionsResult = streamText({
        model: suggestionModel,
        system: suggestionSystemPrompt,
        messages: [...modelMessages, ...responseMessages],
        output: Output.object({
          schema: z.object({
            suggestions: z
              .array(z.string())
              .describe("3 follow-up questions the planner might ask next"),
          }),
        }),
      });

      const dataPartId = crypto.randomUUID();
      for await (const partial of suggestionsResult.partialOutputStream) {
        const suggestions = partial.suggestions?.filter(
          (s): s is string => typeof s === "string" && s.length > 0
        );
        if (suggestions && suggestions.length > 0) {
          writer.write({
            type: "data-suggestions" as const,
            id: dataPartId,
            data: { suggestions },
          });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
