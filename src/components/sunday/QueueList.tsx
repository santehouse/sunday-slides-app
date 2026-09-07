"use client";

/** Draggable + keyboard-reorderable Sunday queue (dnd-kit). */
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import { resolveSlideBackgroundHex } from "@/lib/sunday/background";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { QueueRow } from "./QueueRow";

export type QueueListProps = {
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  assets: ResolvedAsset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onRemoved: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
};

function SortableRow({
  slide,
  index,
  template,
  backgroundColorHex,
  assets,
  selected,
  onSelect,
  onEdit,
  onRemoved,
}: {
  slide: Slide;
  index: number;
  template: Template;
  backgroundColorHex: string | null;
  assets: ResolvedAsset[];
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemoved: (id: string) => void;
}) {
  const t = useTranslations("sunday.flow");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  return (
    <QueueRow
      slide={slide}
      index={index}
      template={template}
      backgroundColorHex={backgroundColorHex}
      assets={assets}
      selected={selected}
      onSelect={onSelect}
      onEdit={onEdit}
      onRemoved={onRemoved}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      dragHandleProps={{ ...attributes, ...listeners, title: t("reorderHint") }}
    />
  );
}

export function QueueList({ slides, templatesById, colorHexById, assets, selectedId, onSelect, onEdit, onRemoved, onReorder }: QueueListProps) {
  const t = useTranslations("sunday.flow");
  const tQueue = useTranslations("sunday.queue");
  const [order, setOrder] = useState(() => slides.map((s) => s.id));
  const byId = new Map(slides.map((s) => [s.id, s]));

  const position = (id: string | number | undefined) => (id === undefined ? 0 : order.indexOf(String(id)) + 1);
  const accessibility = {
    screenReaderInstructions: { draggable: t("dndInstructions") },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => t("dndPickedUp", { number: position(active.id) }),
      onDragOver: ({ over }: { over: { id: string | number } | null }) => (over ? t("dndOver", { number: position(over.id) }) : undefined),
      onDragEnd: ({ over }: { over: { id: string | number } | null }) => (over ? t("dndDropped", { number: position(over.id) }) : undefined),
      onDragCancel: () => t("dndCancelled"),
    },
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const idSetKey = [...slides.map((s) => s.id)].sort().join("|");
  const prevIdSetKey = useRef(idSetKey);
  useEffect(() => {
    if (prevIdSetKey.current !== idSetKey) {
      prevIdSetKey.current = idSetKey;
      setOrder(slides.map((s) => s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSetKey]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...order];
    next.splice(oldIndex, 1);
    next.splice(newIndex, 0, String(active.id));
    setOrder(next);
    onReorder(next);
  }

  const orderedSlides = order.map((id) => byId.get(id)).filter((s): s is Slide => Boolean(s));

  return (
    <DndContext id="sunday-queue" accessibility={accessibility} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul aria-label={tQueue("listLabel")} className="flex flex-col gap-2.5">
          {orderedSlides.map((slide, index) => {
            const template = templatesById[slide.templateId];
            if (!template) return null;
            const backgroundColorHex = resolveSlideBackgroundHex(template, slide, colorHexById);
            return (
              <SortableRow
                key={slide.id}
                slide={slide}
                index={index}
                template={template}
                backgroundColorHex={backgroundColorHex}
                assets={assets}
                selected={slide.id === selectedId}
                onSelect={() => onSelect(slide.id)}
                onEdit={() => onEdit(slide.id)}
                onRemoved={onRemoved}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
