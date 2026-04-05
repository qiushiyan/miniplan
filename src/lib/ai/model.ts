import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

export const model = anthropic("claude-opus-4-6-high");
export const suggestionModel = anthropic("claude-haiku-4-5-20251001");
