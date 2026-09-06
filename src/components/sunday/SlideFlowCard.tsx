"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { Slide, Template } from "@/lib/domain/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SlidePreview } from "./SlidePreview";
import type { ResolvedAsset } from "@/lib/renderer/types";

export type SlideFlowCardProps = {
  slide: Slide;
  index: number;
  template: Template;
  backgroundColorHex: string | null;
  assets: ResolvedAsset[];
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  style?: CSSProperties;
  setNodeRef?: (el: HTMLLIElement | null) => void;
};

/** Figma "Slide Flow Card" (Sunday Flow list variant, h88). */
export function SlideFlowCard({
  slide,
  index,
  template,
  backgroundColorHex,
  assets,
  selected,
  onSelect,
  onOpen,
  dragHandleProps,
  style,
  setNodeRef,
}: SlideFlowCardProps) {
  const t = useTranslations("sunday.flow");
  const number = String(index + 1).padStart(2, "0");

  function metaText(): string | null {
    if (slide.status === "needs_review") return t("templateNeedsConfirmation");
    if (slide.status === "invalid") return t("textTooLong");
    return slide.includeInVideo ? t("includedInMp4") : t("excludedFromMp4");
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-slide-card=""
      aria-current={selected ? "true" : undefined}
      className={cn(
        // Figma 6:19 — 12px side padding, 10px gaps. Selected keeps the same background
        // and gains a 2px primary edge; the inset shadow avoids a 1px content shift.
        "flex h-[88px] items-center gap-2.5 rounded-[12px] border bg-surface px-3 transition-[border-color,box-shadow] duration-[250ms]",
        selected
          ? "border-primary shadow-[inset_0_0_0_1px_var(--bg-primary)]"
          : "border-border",
      )}
    >
      <button
        type="button"
        aria-label={t("dragHandle", { number: index + 1 })}
        className="flex shrink-0 cursor-grab items-center justify-center text-fg-secondary active:cursor-grabbing"
        {...dragHandleProps}
      >
        <GripVertical aria-hidden="true" size={24} />
      </button>

      {/* One control selects the card. A row-level `role="option"` may not contain
          focusable children (axe `nested-interactive`), so the row is a plain list item. */}
      <button
        type="button"
        data-slide-select=""
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="h-[50px] w-[88px] shrink-0 overflow-hidden rounded-[6px] border border-border">
          <SlidePreview
            template={template}
            slide={slide}
            backgroundColorHex={backgroundColorHex}
            assets={assets}
          />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-label font-bold text-fg">
            {number} {slide.headline}
          </span>
          <span className="truncate text-caption text-fg-secondary">{metaText()}</span>
        </span>
      </button>

      <StatusBadge status={slide.status === "needs_review" ? "needsReview" : slide.status === "invalid" ? "invalid" : "ready"} />
    </li>
  );
}
