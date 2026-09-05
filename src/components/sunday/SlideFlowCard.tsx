"use client";

import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { Slide, Template } from "@/lib/domain/types";
import { IconButton } from "@/components/ui/IconButton";
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
  onRemove: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  style?: CSSProperties;
  setNodeRef?: (el: HTMLDivElement | null) => void;
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
  onRemove,
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

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex h-[88px] items-center gap-2.5 rounded-lg border bg-surface p-5",
        selected ? "border-2 border-primary" : "border-border",
      )}
    >
      <button
        type="button"
        aria-label={t("dragHandle", { number: index + 1 })}
        className="flex shrink-0 cursor-grab items-center justify-center text-fg-secondary active:cursor-grabbing"
        onClick={(event) => event.stopPropagation()}
        {...dragHandleProps}
      >
        <GripVertical aria-hidden="true" size={24} />
      </button>

      <div className="h-[50px] w-[88px] shrink-0 overflow-hidden rounded-[6px] border border-border">
        <SlidePreview
          template={template}
          slide={slide}
          backgroundColorHex={backgroundColorHex}
          assets={assets}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-label font-bold text-fg">
          {number} {slide.headline}
        </p>
        <p className="truncate text-caption text-fg-secondary">{metaText()}</p>
      </div>

      <StatusBadge status={slide.status === "needs_review" ? "needsReview" : slide.status === "invalid" ? "invalid" : "ready"} />

      <IconButton
        icon={MoreHorizontal}
        variant="ghost"
        size={36}
        radius={8}
        aria-label={t("removeSlide")}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      />
    </div>
  );
}
