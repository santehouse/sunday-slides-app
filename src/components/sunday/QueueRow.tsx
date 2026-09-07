"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { useState } from "react";
import { Film, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { Slide, Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { SlidePreview } from "./SlidePreview";
import { removeSlideAction, toggleIncludeInVideoAction } from "@/app/[locale]/(sunday)/sunday/actions";

export type QueueRowProps = {
  slide: Slide;
  index: number;
  template: Template;
  backgroundColorHex: string | null;
  assets: ResolvedAsset[];
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemoved: (slideId: string) => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  style?: CSSProperties;
  setNodeRef?: (el: HTMLLIElement | null) => void;
};

/** One row in the Sunday queue (Figma "Queue row"). */
export function QueueRow({
  slide,
  index,
  template,
  backgroundColorHex,
  assets,
  selected,
  onSelect,
  onEdit,
  onRemoved,
  dragHandleProps,
  style,
  setNodeRef,
}: QueueRowProps) {
  const t = useTranslations("sunday.queue");
  const tEdit = useTranslations("sunday.simple.edit");
  const tFlow = useTranslations("sunday.flow");
  const tCommon = useTranslations("common");
  const { showToast } = useToast();

  const [toggling, setToggling] = useState(false);
  const [includeInVideo, setIncludeInVideo] = useState(slide.includeInVideo);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const needsLook = slide.status === "needs_review" || slide.status === "invalid";
  const number = String(index + 1).padStart(2, "0");

  async function handleToggleFilm() {
    setToggling(true);
    const next = !includeInVideo;
    setIncludeInVideo(next);
    try {
      await toggleIncludeInVideoAction(slide.id, next);
    } catch {
      setIncludeInVideo(!next);
    } finally {
      setToggling(false);
    }
  }

  async function confirmRemove() {
    setRemoving(true);
    try {
      const result = await removeSlideAction(slide.id);
      if (!result.ok) {
        showToast({ state: "warning", title: tCommon("delete"), message: tFlow("cannotRemoveStructural") });
      } else {
        onRemoved(slide.id);
      }
    } finally {
      setRemoving(false);
      setConfirmingRemove(false);
    }
  }

  return (
    <li
      ref={setNodeRef}
      id={`slide-card-${slide.id}`}
      style={style}
      data-slide-card=""
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex h-[88px] items-center gap-2.5 rounded-[12px] border bg-surface px-3 transition-[border-color,box-shadow] duration-[250ms]",
        selected ? "border-primary shadow-[inset_0_0_0_1px_var(--bg-primary)]" : "border-border",
      )}
    >
      <button
        type="button"
        aria-label={tFlow("dragHandle", { number: index + 1 })}
        className="flex shrink-0 cursor-grab items-center justify-center text-fg-secondary active:cursor-grabbing"
        {...dragHandleProps}
      >
        <GripVertical aria-hidden="true" size={24} />
      </button>

      <button
        type="button"
        data-slide-select=""
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="text-caption font-bold text-fg-secondary">{number}</span>
        <span className="h-[50px] w-[88px] shrink-0 overflow-hidden rounded-[6px] border border-border">
          <SlidePreview template={template} slide={slide} backgroundColorHex={backgroundColorHex} assets={assets} />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-label font-bold text-fg">{slide.headline || t("untitledSlide")}</span>
          {needsLook ? (
            <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-bold text-warning-fg">
              {t("checkTag")}
            </span>
          ) : null}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          icon={Film}
          variant="ghost"
          size={40}
          aria-pressed={includeInVideo}
          aria-label={includeInVideo ? t("inVideo") : t("notInVideo")}
          title={includeInVideo ? t("inVideo") : t("notInVideo")}
          disabled={toggling}
          onClick={handleToggleFilm}
          className={includeInVideo ? "text-primary" : "text-fg-muted"}
        />
        <IconButton icon={Pencil} variant="ghost" size={40} aria-label={tCommon("edit")} onClick={onEdit} />
        <IconButton icon={Trash2} variant="ghost" size={40} aria-label={tCommon("delete")} onClick={() => setConfirmingRemove(true)} />
      </div>

      <ConfirmDialog
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        onConfirm={confirmRemove}
        confirmLoading={removing}
        destructive
        title={tEdit("removeConfirmTitle")}
        doubleConfirm={{
          title: tEdit("removeFinalTitle"),
          confirmLabel: tEdit("removeFinalConfirm"),
          children: tEdit("removeFinalBody"),
        }}
      >
        {tEdit("removeConfirmBody", { title: slide.headline || t("untitledSlide") })}
      </ConfirmDialog>
    </li>
  );
}
