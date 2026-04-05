"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Spinner } from "@/components/ui/spinner";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { ToolPartRenderer } from "./tool-display";
import type { Schedule } from "@/lib/schedule/types";

const DEFAULT_SUGGESTIONS = [
  "What's the critical path?",
  "Make excavation 7 days",
  "Speed up the project",
];

type ChatPanelProps = {
  onScheduleUpdate: (schedule: Schedule) => void;
};

export function ChatPanel({ onScheduleUpdate }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  // Track which tool call IDs we've already synced to avoid duplicate updates
  const syncedToolCalls = useRef(new Set<string>());

  // Extract schedule updates from tool results
  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;
        if (part.state !== "output-available") continue;
        if (syncedToolCalls.current.has(part.toolCallId)) continue;

        const output = part.output as Record<string, unknown> | undefined;
        if (
          output?.schedule &&
          (part.type === "tool-executeScheduleCode" ||
            part.type === "tool-undoLastChange")
        ) {
          syncedToolCalls.current.add(part.toolCallId);
          onScheduleUpdate(output.schedule as Schedule);
        }
      }
    }
  }, [messages, onScheduleUpdate]);

  // Fetch suggestions asynchronously when agent finishes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (status !== "ready" || !wasStreaming || messages.length === 0) return;

    // Abort any in-flight suggestion request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSuggestionsLoading(true);

    // Fire and forget — don't block anything
    fetchSuggestions(messages, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted && result.length > 0) {
          setSuggestions(result);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSuggestionsLoading(false);
        }
      });
  }, [status, messages]);

  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) {
      // Abort in-flight suggestions and clear them when sending a new message
      abortRef.current?.abort();
      setSuggestions([]);
      sendMessage({ text: message.text });
      setInput("");
    }
  };

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      abortRef.current?.abort();
      setSuggestions([]);
      sendMessage({ text: suggestion });
    },
    [sendMessage]
  );

  const isStreaming = status === "streaming";

  return (
    <div className="flex h-full flex-col">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="text-2xl font-semibold">Schedule Assistant</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Ask me about the construction schedule or request changes. I can
                modify durations, add dependencies, and apply constraints.
              </p>
              <SuggestionButtons
                suggestions={DEFAULT_SUGGESTIONS}
                onClick={handleSuggestionClick}
              />
            </div>
          ) : (
            messages.map((message, index) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessageParts
                    message={message}
                    isLastMessage={index === messages.length - 1}
                    isStreaming={isStreaming}
                  />
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Spinner />
              <span>Thinking...</span>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        {/* Suggestion area above input */}
        {messages.length > 0 && status === "ready" && (
          <div className="mx-auto mb-2 max-w-2xl">
            {suggestionsLoading && suggestions.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                <span>Planning next steps...</span>
              </div>
            ) : (
              suggestions.length > 0 && (
                <SuggestionButtons
                  suggestions={suggestions}
                  onClick={handleSuggestionClick}
                />
              )
            )}
          </div>
        )}

        <PromptInput onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <PromptInputTextarea
            value={input}
            placeholder="Ask about the schedule or request changes..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            status={isStreaming ? "streaming" : "ready"}
            disabled={!input.trim() && status !== "streaming"}
            className="absolute bottom-1 right-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}

async function fetchSuggestions(
  messages: UIMessage[],
  signal: AbortSignal
): Promise<string[]> {
  try {
    const res = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
    if (!res.ok) return [];
    const text = await res.text();
    // The endpoint returns streamed text that builds up a JSON object
    // Parse the final result
    const parsed = JSON.parse(text);
    return parsed.suggestions?.filter(
      (s: unknown): s is string => typeof s === "string" && (s as string).length > 0
    ) ?? [];
  } catch {
    return [];
  }
}

function MessageParts({
  message,
  isLastMessage,
  isStreaming,
}: {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
}) {
  const reasoningParts = message.parts.filter(
    (part) => part.type === "reasoning"
  );
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");
  const hasReasoning = reasoningParts.length > 0;

  const lastPart = message.parts.at(-1);
  const isReasoningStreaming =
    isLastMessage && isStreaming && lastPart?.type === "reasoning";

  return (
    <>
      {hasReasoning && (
        <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          const isLastTextPart =
            isLastMessage &&
            isStreaming &&
            message.role === "assistant" &&
            i === message.parts.findLastIndex((p) => p.type === "text");
          return (
            <MessageResponse
              key={`${message.id}-text-${i}`}
              isAnimating={isLastTextPart}
            >
              {part.text}
            </MessageResponse>
          );
        }
        if (part.type === "reasoning") {
          return null;
        }
        if (isToolUIPart(part)) {
          return (
            <ToolPartRenderer
              key={`${message.id}-tool-${i}`}
              part={part}
            />
          );
        }
        return null;
      })}
    </>
  );
}

function SuggestionButtons({
  suggestions,
  onClick,
}: {
  suggestions: string[];
  onClick: (suggestion: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => onClick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
