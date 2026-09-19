"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  boxGradientCss,
  isHexColor,
  MAX_GRADIENT_STOPS,
  MIN_GRADIENT_STOPS,
  moveGradientStop,
  type BoxGradient,
} from "@/lib/engines/boxGradient";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type GradientEditorProps = {
  value: BoxGradient;
  onChange: (next: BoxGradient) => void;
};

const ANGLE_PRESETS: Array<{ angle: number; key: "topToBottom" | "leftToRight" | "bottomToTop" | "rightToLeft" }> = [
  { angle: 180, key: "topToBottom" },
  { angle: 90, key: "leftToRight" },
  { angle: 0, key: "bottomToTop" },
  { angle: 270, key: "rightToLeft" },
];

/** Stops need stable ids across reorders; the index is not stable, so we key by position at mount + colour. */
function stopIds(stops: string[]): string[] {
  const seen = new Map<string, number>();
  return stops.map((hex) => {
    const n = (seen.get(hex) ?? 0) + 1;
    seen.set(hex, n);
    return `${hex}#${n}`;
  });
}

function StopRow({
  id,
  index,
  total,
  hex,
  onHexChange,
  onRemove,
}: {
  id: string;
  index: number;
  total: number;
  hex: string;
  onHexChange: (hex: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("admin.templates.gradient");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const swatchId = useId();
  const valid = isHexColor(hex);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border bg-surface p-1.5",
        isDragging && "z-10 shadow-md",
      )}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-sm text-fg-muted hover:bg-surface-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-border-focus"
        aria-label={t("drag", { n: index + 1, total })}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={18} />
      </button>
      <label htmlFor={swatchId} className="sr-only">
        {t("stop", { n: index + 1 })}
      </label>
      <input
        id={swatchId}
        type="color"
        // The swatch mirrors the hex field; an invalid hex keeps the last good colour.
        value={valid ? (hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.slice(0, 7)) : "#000000"}
        onChange={(e) => onHexChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent p-0"
      />
      <Input
        aria-label={t("stopHex", { n: index + 1 })}
        value={hex}
        onChange={(e) => onHexChange(e.target.value)}
        error={valid ? undefined : t("invalidHex")}
        containerClassName="min-w-0 flex-1"
        spellCheck={false}
      />
      <IconButton
        icon={Trash2}
        variant="ghost"
        size={36}
        aria-label={t("remove")}
        disabled={total <= MIN_GRADIENT_STOPS}
        onClick={onRemove}
      />
    </li>
  );
}

/**
 * Studio "Box fill → Gradient" editor: an angle, and 2–7 colour stops that can be dragged
 * (or moved with the arrow buttons) into order. The preview bar is the exact CSS the
 * renderer paints.
 */
export function GradientEditor({ value, onChange }: GradientEditorProps) {
  const t = useTranslations("admin.templates.gradient");
  const ids = stopIds(value.stops);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function setStops(stops: string[]) {
    onChange({ ...value, stops });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    setStops(moveGradientStop(value.stops, from, to));
  }

  const allValid = value.stops.every(isHexColor);

  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="h-8 w-full rounded-md border border-border"
        style={allValid ? { backgroundImage: boxGradientCss(value) } : undefined}
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          id="gradient-direction"
          label={t("direction")}
          value={ANGLE_PRESETS.some((p) => p.angle === value.angle) ? String(value.angle) : "custom"}
          onChange={(e) => {
            if (e.target.value !== "custom") onChange({ ...value, angle: Number(e.target.value) });
          }}
          options={[
            ...ANGLE_PRESETS.map((preset) => ({ value: String(preset.angle), label: t(preset.key) })),
            ...(ANGLE_PRESETS.some((p) => p.angle === value.angle) ? [] : [{ value: "custom", label: t("custom") }]),
          ]}
        />
        <Input
          id="gradient-angle"
          type="number"
          min={0}
          max={360}
          step={1}
          label={t("angle")}
          value={value.angle}
          onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
        />
      </div>

      <span className="text-caption font-bold text-fg-secondary">{t("stops")}</span>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex w-full flex-col gap-1.5" aria-label={t("stops")}>
            {value.stops.map((hex, index) => (
              <StopRow
                key={ids[index]}
                id={ids[index]!}
                index={index}
                total={value.stops.length}
                hex={hex}
                onHexChange={(next) => setStops(value.stops.map((s, i) => (i === index ? next : s)))}
                onRemove={() => setStops(value.stops.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={Plus}
          disabled={value.stops.length >= MAX_GRADIENT_STOPS}
          onClick={() => setStops([...value.stops, value.stops[value.stops.length - 1] ?? "#ffffff"])}
        >
          {t("add")}
        </Button>
        <span className="text-caption text-fg-secondary">{t("max", { max: MAX_GRADIENT_STOPS })}</span>
      </div>
    </div>
  );
}
