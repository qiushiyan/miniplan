import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  baseURL: "https://llm.listenhub.dev/v1",
  apiKey: process.env.LLM_API_KEY,
});

export const model = anthropic("claude-opus-4-6-high");
