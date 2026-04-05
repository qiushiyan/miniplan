"use client";

import {
  type ChangeEventHandler,
  type ComponentProps,
  createContext,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface PromptInputMessage {
  text: string;
}

type PromptInputContextValue = {
  valueRef: MutableRefObject<string>;
};

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

function usePromptInputContext() {
  const context = useContext(PromptInputContext);
  if (!context) {
    throw new Error("PromptInput components must be used inside <PromptInput>.");
  }
  return context;
}

export type PromptInputProps = {
  children: ReactNode;
  className?: string;
  onSubmit?: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
};

export function PromptInput({
  children,
  className,
  onSubmit,
}: PromptInputProps) {
  const valueRef = useRef("");

  const contextValue = useMemo(
    () => ({ valueRef }),
    []
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.({ text: valueRef.current }, event);
  };

  return (
    <PromptInputContext.Provider value={contextValue}>
      <form
        className={cn("relative rounded-3xl border bg-background p-2", className)}
        onSubmit={handleSubmit}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
}

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export function PromptInputTextarea({
  className,
  onChange,
  value,
  ...props
}: PromptInputTextareaProps) {
  const { valueRef } = usePromptInputContext();

  useEffect(() => {
    valueRef.current = typeof value === "string" ? value : "";
  }, [value, valueRef]);

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    valueRef.current = event.currentTarget.value;
    onChange?.(event);
  };

  return (
    <Textarea
      className={cn(
        "min-h-[96px] resize-none border-0 bg-transparent pr-14 shadow-none focus-visible:ring-0",
        className
      )}
      onChange={handleChange}
      value={value}
      {...props}
    />
  );
}

export type PromptInputSubmitProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "type"
> & {
  status?: "ready" | "streaming";
};

export function PromptInputSubmit({
  className,
  disabled,
  status = "ready",
  ...props
}: PromptInputSubmitProps) {
  const isStreaming = status === "streaming";

  return (
    <Button
      aria-label={isStreaming ? "Streaming response" : "Send message"}
      className={cn("h-10 w-10 rounded-full", className)}
      disabled={disabled}
      size="icon-sm"
      type="submit"
      variant={isStreaming ? "secondary" : "default"}
      {...props}
    >
      {isStreaming ? <Spinner className="size-4" /> : <ArrowUpIcon className="size-4" />}
      <span className="sr-only">
        {isStreaming ? "Generating response" : "Send"}
      </span>
    </Button>
  );
}

export type PromptInputStopProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "type"
>;

export function PromptInputStop({
  className,
  ...props
}: PromptInputStopProps) {
  return (
    <Button
      aria-label="Stop response"
      className={cn("h-10 w-10 rounded-full", className)}
      size="icon-sm"
      type="button"
      variant="secondary"
      {...props}
    >
      <SquareIcon className="size-4" />
      <span className="sr-only">Stop</span>
    </Button>
  );
}
