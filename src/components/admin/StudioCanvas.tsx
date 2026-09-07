"use client";

/**
 * Template Studio's interactive canvas (BUILD_HANDOFF §12/13 + Template Studio brief).
 * Renders the real render (`TemplatePreview` → `SlideFrame` + `SlideCanvas` +
 * `computeSlideLayout`) and overlays one transparent, draggable/resizable "field box"
 * per template field, plus an optional draggable safe-zone box, in slide-space
 * (1920×1080) coordinates mapped through the stage's own pixel scale. All snapping,
 * clamping and resize math lives in `@/lib/engines/canvasGeometry` — this component
 * only wires pointer/keyboard events to it and reports the resulting boxes upward.
 */
import { useCallback, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { TemplatePreview, type TemplatePreviewProps } from "@/components/admin/TemplatePreview";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import {
  applyHandleDrag,
  buildGuides,
  clampBox,
  snapEdge,
  GRID,
  MARGIN,
  type Box,
  type Handle,
} from "@/lib/engines/canvasGeometry";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/renderer/types";
import type { SafeZone, TemplateField } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const HANDLES: { id: Handle; style: CSSProperties; cursor: string }[] = [
  { id: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
  { id: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
  { id: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { id: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  { id: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
  { id: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
  { id: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
  { id: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
];

export type ZoomLevel = "50" | "75" | "100";

type DragState =
  | {
      target: "field";
      id: string;
      handle: Handle | null;
      startClientX: number;
      startClientY: number;
      startBox: Box;
    }
  | {
      target: "safeZone";
      id: null;
      handle: Handle | null;
      startClientX: number;
      startClientY: number;
      startBox: Box;
    };

export type StudioCanvasProps = {
  rendererKey?: string;
  fields: TemplateField[];
  content: Record<string, string>;
  backgroundType: TemplatePreviewProps["backgroundType"];
  backgroundColorHex?: string | null;
  backgroundImageUrl?: string | null;
  overlayColor?: TemplatePreviewProps["overlayColor"];
  overlayOpacity?: number;
  safeZone: SafeZone;
  showSafeZone: boolean;
  safeZoneLabel: string;
  safeZoneEditing: boolean;
  selectedKey: string | null;
  locale: string;
  zoom: ZoomLevel;
  onSelectField: (key: string | null) => void;
  /** Called once, before the first change of a drag/keyboard gesture — the hook for undo history. */
  onBeginChange: () => void;
  onFieldChange: (key: string, patch: Box) => void;
  onSafeZoneChange: (patch: SafeZone) => void;
};

const ZOOM_REFERENCE_WIDTH = 1600;

export function StudioCanvas({
  rendererKey,
  fields,
  content,
  backgroundType,
  backgroundColorHex,
  backgroundImageUrl,
  overlayColor,
  overlayOpacity,
  safeZone,
  showSafeZone,
  safeZoneLabel,
  safeZoneEditing,
  selectedKey,
  locale,
  zoom,
  onSelectField,
  onBeginChange,
  onFieldChange,
  onSafeZoneChange,
}: StudioCanvasProps) {
  const t = useTranslations("admin.templates.canvas");
  const isFr = locale.startsWith("fr");

  const dragRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [guideLines, setGuideLines] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [announcement, setAnnouncement] = useState("");

  const zoomPercent = Number(zoom);
  const stageWidth = Math.round((ZOOM_REFERENCE_WIDTH * zoomPercent) / 100);
  const stageHeight = Math.round((stageWidth * SLIDE_HEIGHT) / SLIDE_WIDTH);
  const scale = stageWidth / SLIDE_WIDTH;

  const announce = useCallback(
    (label: string, box: Box) => {
      setAnnouncement(
        t("position", { field: label, x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }),
      );
    },
    [t],
  );

  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (clientX - drag.startClientX) / scale;
      const dy = (clientY - drag.startClientY) / scale;

      let box: Box = drag.handle
        ? applyHandleDrag(drag.startBox, drag.handle, dx, dy)
        : { ...drag.startBox, x: drag.startBox.x + dx, y: drag.startBox.y + dy };

      const guideSource = drag.target === "field" ? safeZone : undefined;
      const guides = buildGuides(guideSource);
      let guideX: number | null = null;
      let guideY: number | null = null;

      if (!drag.handle) {
        // Moving: snap whichever edge (left/right, top/bottom) is closer to a guide.
        const leftHit = snapEdge(box.x, guides.x);
        const rightHit = snapEdge(box.x + box.width, guides.x);
        if (leftHit.guide !== null && (rightHit.guide === null || Math.abs(box.x - leftHit.value) <= Math.abs(box.x + box.width - rightHit.value))) {
          box = { ...box, x: leftHit.value };
          guideX = leftHit.guide;
        } else if (rightHit.guide !== null) {
          box = { ...box, x: rightHit.value - box.width };
          guideX = rightHit.guide;
        } else {
          box = { ...box, x: Math.round(box.x / GRID) * GRID };
        }

        const topHit = snapEdge(box.y, guides.y);
        const bottomHit = snapEdge(box.y + box.height, guides.y);
        if (topHit.guide !== null && (bottomHit.guide === null || Math.abs(box.y - topHit.value) <= Math.abs(box.y + box.height - bottomHit.value))) {
          box = { ...box, y: topHit.value };
          guideY = topHit.guide;
        } else if (bottomHit.guide !== null) {
          box = { ...box, y: bottomHit.value - box.height };
          guideY = bottomHit.guide;
        } else {
          box = { ...box, y: Math.round(box.y / GRID) * GRID };
        }
      } else {
        if (drag.handle.includes("w")) {
          const hit = snapEdge(box.x, guides.x);
          if (hit.guide !== null) {
            box = { ...box, width: box.width + (box.x - hit.value), x: hit.value };
            guideX = hit.guide;
          } else box = { ...box, x: Math.round(box.x / GRID) * GRID };
        } else if (drag.handle.includes("e")) {
          const hit = snapEdge(box.x + box.width, guides.x);
          if (hit.guide !== null) {
            box = { ...box, width: hit.value - box.x };
            guideX = hit.guide;
          } else box = { ...box, width: Math.round(box.width / GRID) * GRID };
        }
        if (drag.handle.includes("n")) {
          const hit = snapEdge(box.y, guides.y);
          if (hit.guide !== null) {
            box = { ...box, height: box.height + (box.y - hit.value), y: hit.value };
            guideY = hit.guide;
          } else box = { ...box, y: Math.round(box.y / GRID) * GRID };
        } else if (drag.handle.includes("s")) {
          const hit = snapEdge(box.y + box.height, guides.y);
          if (hit.guide !== null) {
            box = { ...box, height: hit.value - box.y };
            guideY = hit.guide;
          } else box = { ...box, height: Math.round(box.height / GRID) * GRID };
        }
      }

      box = clampBox(box);
      setGuideLines({ x: guideX, y: guideY });

      if (drag.target === "field") {
        onFieldChange(drag.id, box);
        const field = fields.find((f) => f.id === drag.id);
        if (field) announce(isFr ? field.labelFr : field.labelEn, box);
      } else {
        onSafeZoneChange(box);
        announce(safeZoneLabel, box);
      }
    },
    [scale, safeZone, fields, onFieldChange, onSafeZoneChange, announce, isFr, safeZoneLabel],
  );

  const scheduleApply = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingRef.current;
      if (pending && dragRef.current) applyDrag(pending.clientX, pending.clientY);
    });
  }, [applyDrag]);

  function startDrag(
    e: ReactPointerEvent,
    target: "field" | "safeZone",
    id: string | null,
    handle: Handle | null,
    box: Box,
  ) {
    e.stopPropagation();
    e.preventDefault();
    if (target === "field" && id) onSelectField(id);
    onBeginChange();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { target, id, handle, startClientX: e.clientX, startClientY: e.clientY, startBox: box } as DragState;
    setIsDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent) {
    if (!dragRef.current) return;
    pendingRef.current = { clientX: e.clientX, clientY: e.clientY };
    scheduleApply();
  }

  function endDrag(e: ReactPointerEvent) {
    if (!dragRef.current) return;
    if (pendingRef.current) applyDrag(pendingRef.current.clientX, pendingRef.current.clientY);
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    dragRef.current = null;
    pendingRef.current = null;
    setIsDragging(false);
    setGuideLines({ x: null, y: null });
  }

  function handleFieldKeyDown(e: ReactKeyboardEvent, field: TemplateField) {
    const step = e.shiftKey ? 8 : 1;
    let patch: Partial<Box> | null = null;
    switch (e.key) {
      case "ArrowLeft":
        patch = e.altKey ? { width: field.width - step } : { x: field.x - step };
        break;
      case "ArrowRight":
        patch = e.altKey ? { width: field.width + step } : { x: field.x + step };
        break;
      case "ArrowUp":
        patch = e.altKey ? { height: field.height - step } : { y: field.y - step };
        break;
      case "ArrowDown":
        patch = e.altKey ? { height: field.height + step } : { y: field.y + step };
        break;
      case "Escape":
        e.preventDefault();
        onSelectField(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    onBeginChange();
    const box = clampBox({ x: field.x, y: field.y, width: field.width, height: field.height, ...patch });
    onFieldChange(field.id, box);
    announce(isFr ? field.labelFr : field.labelEn, box);
  }

  function handleSafeZoneKeyDown(e: ReactKeyboardEvent) {
    const step = e.shiftKey ? 8 : 1;
    let patch: Partial<Box> | null = null;
    switch (e.key) {
      case "ArrowLeft":
        patch = e.altKey ? { width: safeZone.width - step } : { x: safeZone.x - step };
        break;
      case "ArrowRight":
        patch = e.altKey ? { width: safeZone.width + step } : { x: safeZone.x + step };
        break;
      case "ArrowUp":
        patch = e.altKey ? { height: safeZone.height - step } : { y: safeZone.y - step };
        break;
      case "ArrowDown":
        patch = e.altKey ? { height: safeZone.height + step } : { y: safeZone.y + step };
        break;
      case "Escape":
        e.preventDefault();
        onSelectField(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    onBeginChange();
    const box = clampBox({ ...safeZone, ...patch });
    onSafeZoneChange(box);
    announce(safeZoneLabel, box);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full overflow-x-auto overflow-y-hidden rounded-md border border-border bg-surface-subtle p-3">
        <div
          className="relative shrink-0"
          style={{ width: stageWidth, height: stageHeight }}
          onPointerDown={() => onSelectField(null)}
        >
          <TemplatePreview
            rendererKey={rendererKey}
            fields={fields}
            content={content}
            backgroundType={backgroundType}
            backgroundColorHex={backgroundColorHex}
            backgroundImageUrl={backgroundImageUrl}
            overlayColor={overlayColor}
            overlayOpacity={overlayOpacity}
            safeZone={safeZone}
            showSafeZone={showSafeZone && !safeZoneEditing}
            safeZoneLabel={safeZoneLabel}
          />

          {/* 96px margin guide + 8px grid — only while actively dragging */}
          {isDragging ? (
            <div
              className="pointer-events-none absolute border border-dashed border-border"
              style={{
                left: MARGIN * scale,
                top: MARGIN * scale,
                right: MARGIN * scale,
                bottom: MARGIN * scale,
                backgroundImage:
                  "linear-gradient(to right, color-mix(in srgb, var(--color-border-strong) 45%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-border-strong) 45%, transparent) 1px, transparent 1px)",
                backgroundSize: `${8 * scale}px ${8 * scale}px`,
              }}
            />
          ) : null}

          {/* Active snap guide lines */}
          {isDragging && guideLines.x !== null ? (
            <div className="pointer-events-none absolute top-0 bottom-0 bg-primary/60" style={{ left: guideLines.x * scale, width: 1 }} />
          ) : null}
          {isDragging && guideLines.y !== null ? (
            <div className="pointer-events-none absolute left-0 right-0 bg-primary/60" style={{ top: guideLines.y * scale, height: 1 }} />
          ) : null}

          {/* Field boxes */}
          {fields.map((field) => {
            const selected = !safeZoneEditing && selectedKey === field.id;
            const label = isFr ? field.labelFr : field.labelEn;
            return (
              <div
                key={field.id}
                data-field-box={field.fieldKey}
                role="button"
                tabIndex={safeZoneEditing ? -1 : 0}
                aria-label={label}
                aria-pressed={selected}
                className={cn(
                  "group absolute box-border",
                  safeZoneEditing ? "pointer-events-none" : "cursor-move",
                  selected ? "border-2 border-primary" : "border border-dashed border-transparent hover:border-border-strong",
                )}
                style={{
                  left: field.x * scale,
                  top: field.y * scale,
                  width: field.width * scale,
                  height: field.height * scale,
                  // Selected field paints above every sibling box so its resize handles
                  // stay clickable even where an unselected, later field overlaps it.
                  zIndex: selected ? 20 : 1,
                }}
                onPointerDown={(e) => {
                  if (safeZoneEditing) return;
                  startDrag(e, "field", field.id, null, { x: field.x, y: field.y, width: field.width, height: field.height });
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onKeyDown={(e) => !safeZoneEditing && handleFieldKeyDown(e, field)}
              >
                {selected ? (
                  <span className="absolute -top-[22px] left-0 rounded-[6px] bg-primary px-1.5 py-0.5 text-caption font-bold text-fg-on-primary">
                    {label}
                  </span>
                ) : null}
                {selected
                  ? HANDLES.map((h) => (
                      <span
                        key={h.id}
                        data-handle={h.id}
                        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 border border-primary bg-surface"
                        style={{ ...h.style, cursor: h.cursor }}
                        onPointerDown={(e) =>
                          startDrag(e, "field", field.id, h.id, { x: field.x, y: field.y, width: field.width, height: field.height })
                        }
                        onPointerMove={handlePointerMove}
                        onPointerUp={endDrag}
                      />
                    ))
                  : null}
              </div>
            );
          })}

          {/* Safe zone box — interactive only in edit mode */}
          {safeZoneEditing ? (
            <div
              data-safe-zone-box=""
              role="button"
              tabIndex={0}
              aria-label={safeZoneLabel}
              className="absolute box-border cursor-move border-4 border-dashed border-error-fg bg-error-fg/10"
              style={{
                left: safeZone.x * scale,
                top: safeZone.y * scale,
                width: safeZone.width * scale,
                height: safeZone.height * scale,
                zIndex: 30,
              }}
              onPointerDown={(e) => startDrag(e, "safeZone", null, null, safeZone)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onKeyDown={handleSafeZoneKeyDown}
            >
              <span className="absolute left-2 top-2 rounded-[4px] bg-surface px-1.5 py-0.5 text-caption font-bold text-primary">
                {safeZoneLabel}
              </span>
              {HANDLES.map((h) => (
                <span
                  key={h.id}
                  data-handle={h.id}
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 border border-primary bg-surface"
                  style={{ ...h.style, cursor: h.cursor }}
                  onPointerDown={(e) => startDrag(e, "safeZone", null, h.id, safeZone)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className="text-caption text-fg-secondary">{t("hint")}</p>
      <div aria-live="polite" className="sr-only">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>
    </div>
  );
}

