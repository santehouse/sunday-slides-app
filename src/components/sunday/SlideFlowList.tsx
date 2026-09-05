"use client";

/** Draggable + keyboard-reorderable Sunday Flow list (dnd-kit), Figma "Sunday Flow" left column. */
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
import type { ResolvedAsset } from "@/lib/renderer/types";
import { SlideFlowCard } from "./SlideFlowCard";

export type SlideFlowListProps = {
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  assets: ResolvedAsset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRemove: (slide: Slide) => void;
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
  onOpen,
  onRemove,
}: {
  slide: Slide;
  index: number;
  template: Template;
  backgroundColorHex: string | null;
  assets: ResolvedAsset[];
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("sunday.flow");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  return (
    <SlideFlowCard
      slide={slide}
      index={index}
      template={template}
      backgroundColorHex={backgroundColorHex}
      assets={assets}
      selected={selected}
      onSelect={onSelect}
      onOpen={onOpen}
      onRemove={onRemove}
      setNodeRef={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      dragHandleProps={{ ...attributes, ...listeners, title: t("reorderHint") }}
    />
  );
}

export function SlideFlowList({
  slides,
  templatesById,
  colorHexById,
  assets,
  selectedId,
  onSelect,
  onOpen,
  onRemove,
  onReorder,
}: SlideFlowListProps) {
  const [order, setOrder] = useState(() => slides.map((s) => s.id));
  const byId = new Map(slides.map((s) => [s.id, s]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Keep local order in sync when the server slide list changes underneath us
  // (add/remove/refresh) — reset to server order whenever the id *set* changes.
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div role="listbox" className="flex flex-col gap-2.5">
          {orderedSlides.map((slide, index) => {
            const template = templatesById[slide.templateId];
            if (!template) return null;
            const backgroundColorHex = slide.approvedColorId ? (colorHexById[slide.approvedColorId] ?? null) : null;
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
                onOpen={() => onOpen(slide.id)}
                onRemove={() => onRemove(slide)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
