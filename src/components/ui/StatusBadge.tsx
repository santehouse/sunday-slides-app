import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type StatusBadgeStatus =
  | "ready"
  | "needsReview"
  | "draft"
  | "added"
  | "apply"
  | "published"
  | "archived"
  | "exported"
  | "active"
  | "enabled"
  | "suggested"
  | "available"
  | "needsFontFile"
  | "failed"
  | "processing"
  | "queued"
  | "invalid"
  | "waiting"
  | "used";

type Tone = "success" | "warning" | "error" | "info" | "subtle";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  error: "bg-error-bg text-error-fg",
  info: "bg-info-bg text-info-fg",
  subtle: "bg-surface-subtle text-fg-secondary",
};

// Maps each status to its `messages.status.*` key and semantic tone.
const STATUS_MAP: Record<StatusBadgeStatus, { key: string; tone: Tone }> = {
  ready: { key: "ready", tone: "success" },
  needsReview: { key: "needsReview", tone: "warning" },
  draft: { key: "draft", tone: "subtle" },
  added: { key: "addedToFlow", tone: "subtle" },
  apply: { key: "readyToApply", tone: "subtle" },
  published: { key: "published", tone: "success" },
  archived: { key: "archived", tone: "subtle" },
  exported: { key: "exported", tone: "subtle" },
  active: { key: "active", tone: "success" },
  enabled: { key: "enabled", tone: "success" },
  suggested: { key: "suggested", tone: "info" },
  available: { key: "available", tone: "subtle" },
  needsFontFile: { key: "needsFontFile", tone: "warning" },
  failed: { key: "failed", tone: "error" },
  processing: { key: "processing", tone: "info" },
  queued: { key: "queued", tone: "subtle" },
  invalid: { key: "invalid", tone: "error" },
  waiting: { key: "waitingForRunSheet", tone: "warning" },
  used: { key: "used", tone: "subtle" },
};

export type StatusBadgeProps = {
  status: StatusBadgeStatus;
  className?: string;
};

/**
 * Figma "Status Badge" master (node 3:84). The label text carries the
 * meaning — color is never the only signal.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("status");
  const { key, tone } = STATUS_MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-bold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {t(key)}
    </span>
  );
}
