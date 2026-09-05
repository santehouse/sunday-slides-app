import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type MessageStateKind = "success" | "warning" | "error" | "info";

const TONE_CLASSES: Record<MessageStateKind, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  error: "bg-error-bg text-error-fg",
  info: "bg-info-bg text-info-fg",
};

export type MessageStateProps = {
  state: MessageStateKind;
  title: ReactNode;
  message: ReactNode;
  className?: string;
};

/**
 * Figma "Message State" master (node 68:1209). Title/message are always
 * supplied by the caller — this component only owns the semantic styling.
 */
export function MessageState({ state, title, message, className }: MessageStateProps) {
  const Icon = state === "success" ? CheckCircle2 : AlertCircle;
  const tone = TONE_CLASSES[state];
  return (
    <div
      role={state === "warning" || state === "error" ? "alert" : "status"}
      className={cn("flex w-full items-start gap-3 rounded-md p-3.5", tone, className)}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        <Icon aria-hidden="true" size={20} />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-label font-bold">{title}</p>
        <p className="text-[12px] leading-[17px] text-fg-secondary">{message}</p>
      </div>
    </div>
  );
}
