"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { useEffect, useRef, useState } from "react";
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
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { ToolPartRenderer } from "./tool-display";
import type { Schedule } from "@/lib/schedule/types";

type ChatPanelProps = {
  onScheduleUpdate: (schedule: Schedule) => void;
};

export function ChatPanel({ onScheduleUpdate }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  // Track which tool call IDs we've already synced to avoid duplicate updates
  const syncedToolCalls = useRef(new Set<string>());

  // Extract schedule updates from tool results via useEffect (not during render)
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

  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) {
      sendMessage({ text: message.text });
      setInput("");
    }
  };

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
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "What's the critical path?",
                  "Make excavation 7 days",
                  "Speed up the project",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    onClick={() => {
                      sendMessage({ text: suggestion });
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={`${message.id}-text-${i}`}>
                          {part.text}
                        </MessageResponse>
                      );
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
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        <PromptInput onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <PromptInputTextarea
            value={input}
            placeholder="Ask about the schedule or request changes..."
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            status={status === "streaming" ? "streaming" : "ready"}
            disabled={!input.trim() && status !== "streaming"}
            className="absolute bottom-1 right-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}
