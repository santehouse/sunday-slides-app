"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import type { TemplateWithFields } from "@/lib/data";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { buildCheckItems } from "@/lib/sunday/checklist";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { MessageState } from "@/components/ui/MessageState";
import { SlideFlowList } from "@/components/sunday/SlideFlowList";
import { SlideEditPanel, type SlideEditPanelHandle, type ApprovedColorOption } from "@/components/sunday/SlideEditPanel";
import { SlideAddPanel } from "@/components/sunday/SlideAddPanel";
import { reorderSlidesAction } from "@/app/[locale]/(sunday)/sunday/[date]/actions";

const REASON_KEY: Record<"review" | "missing" | "tooLong", string> = {
  review: "reasonReview",
  missing: "reasonMissing",
  tooLong: "reasonTooLong",
};

type Mode = { kind: "edit"; slideId: string } | { kind: "add" } | { kind: "empty" };

export type CheckSlidesClientProps = {
  date: string;
  sundayId: string;
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  colors: ApprovedColorOption[];
  assets: ResolvedAsset[];
  publishedTemplates: TemplateWithFields[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  safeZone: { x: number; y: number; width: number; height: number };
  initialSelectedId: string | null;
  initialAdd: boolean;
};

function initialModeFrom(initialSelectedId: string | null, initialAdd: boolean, slides: Slide[]): Mode {
  if (initialAdd) return { kind: "add" };
  const fallback = slides[0]?.id ?? null;
  const id = initialSelectedId && slides.some((s) => s.id === initialSelectedId) ? initialSelectedId : fallback;
  return id ? { kind: "edit", slideId: id } : { kind: "empty" };
}

export function CheckSlidesClient({
  date,
  sundayId,
  slides,
  templatesById,
  colorHexById,
  colors,
  assets,
  publishedTemplates,
  assetsByTemplateId,
  safeZone,
  initialSelectedId,
  initialAdd,
}: CheckSlidesClientProps) {
  const t = useTranslations("sunday.simple.check");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(() => initialModeFrom(initialSelectedId, initialAdd, slides));
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const editPanelRef = useRef<SlideEditPanelHandle>(null);

  // Reset to a valid slide whenever the current one disappears from underneath us (removed,
  // or a fresh server render after a run-sheet apply) — never derived on every render, since
  // that would fight the user's own in-progress selection.
  const idSetKey = slides.map((s) => s.id).join("|");
  const prevIdSetKey = useRef(idSetKey);
  useEffect(() => {
    if (prevIdSetKey.current === idSetKey) return;
    prevIdSetKey.current = idSetKey;
    if (mode.kind === "edit" && !slides.some((s) => s.id === mode.slideId)) {
      const fallback = slides[0]?.id ?? null;
      // One-time resync to a valid selection after the id set changes underneath us —
      // not a derived-every-render value, so this is the correct place for it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(fallback ? { kind: "edit", slideId: fallback } : { kind: "empty" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSetKey]);

  function updateUrl(next: Mode) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("slide");
    params.delete("add");
    if (next.kind === "edit") params.set("slide", next.slideId);
    if (next.kind === "add") params.set("add", "1");
    const query = params.toString();
    // Shallow URL update: keeps the panel state shareable/refreshable without a server
    // round trip (a router navigation briefly blanks the document title while streaming).
    window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
  }

  function isDirty(): boolean {
    return mode.kind === "edit" && Boolean(editPanelRef.current?.isDirty());
  }

  /** Runs `action` now, or defers it behind a discard-changes prompt when the edit panel is dirty. */
  function guarded(action: () => void) {
    if (isDirty()) {
      setPendingAction(() => action);
      return;
    }
    action();
  }

  function selectSlide(id: string) {
    guarded(() => {
      setMode({ kind: "edit", slideId: id });
      updateUrl({ kind: "edit", slideId: id });
      document.getElementById(`slide-card-${id}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  function openAdd() {
    guarded(() => {
      setMode({ kind: "add" });
      updateUrl({ kind: "add" });
    });
  }

  function cancelAdd() {
    guarded(() => {
      const next = initialModeFrom(null, false, slides);
      setMode(next);
      updateUrl(next);
    });
  }

  function handleSaved() {
    router.refresh();
  }

  function handleRemoved() {
    router.refresh();
  }

  function handleDuplicated(created: Slide) {
    router.refresh();
    setMode({ kind: "edit", slideId: created.id });
    updateUrl({ kind: "edit", slideId: created.id });
  }

  function handleCreated(created: Slide) {
    router.refresh();
    setMode({ kind: "edit", slideId: created.id });
    updateUrl({ kind: "edit", slideId: created.id });
  }

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorderSlidesAction(sundayId, date, orderedIds);
    } catch {
      // Reorder failures are rare (network) and the list already reflects the attempted
      // order locally — nothing actionable to show beyond the generic toast pattern used
      // elsewhere on the Sunday side would require its own ToastProvider here.
      console.error(tErrors("network"));
    }
  }

  const checkItems = buildCheckItems(slides, templatesById);
  const selectedSlide = mode.kind === "edit" ? (slides.find((s) => s.id === mode.slideId) ?? null) : null;

  return (
    <div className="flex flex-col gap-5">
      {checkItems.length > 0 ? (
        <Card padding="none" className="flex flex-col gap-2.5 p-[18px]">
          <h2 className="text-h3 font-bold text-fg">{t("title", { count: checkItems.length })}</h2>
          <ul className="flex flex-col gap-2">
            {checkItems.map((item) => (
              <li
                key={item.slideId}
                data-checklist-row=""
                className="flex items-center gap-3 rounded-md bg-warning-bg px-3.5 py-2.5 text-warning-fg"
              >
                <span className="shrink-0 text-caption font-bold">{String(item.index + 1).padStart(2, "0")}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-label font-bold">{item.headline}</p>
                  <p className="truncate text-caption">{t(REASON_KEY[item.reason])}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => selectSlide(item.slideId)}>
                  {t("checkButton")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : slides.length > 0 ? (
        <MessageState state="success" title={t("allGoodTitle")} message={t("allGoodBody")} />
      ) : null}

      {checkItems.length === 0 && slides.length > 0 ? (
        <div className="flex justify-end">
          <Button variant="primary" href={`/sunday/${date}/download`} leadingIcon={CircleCheck}>
            {t("goToDownload")}
          </Button>
        </div>
      ) : null}

      {slides.length === 0 && mode.kind !== "add" ? (
        <MessageState state="info" title={t("emptyTitle")} message={t("noSlides")} />
      ) : null}

      <div className="grid grid-cols-[500px_1fr] gap-[18px]">
        <Card padding="none" className="flex min-h-[820px] flex-col gap-2.5 p-[18px]">
          {slides.length > 0 ? (
            <SlideFlowList
              slides={slides}
              templatesById={templatesById}
              colorHexById={colorHexById}
              assets={assets}
              selectedId={mode.kind === "edit" ? mode.slideId : null}
              onSelect={selectSlide}
              onOpen={selectSlide}
              onReorder={handleReorder}
            />
          ) : null}
          <Button variant="ghost" leadingIcon={Plus} onClick={openAdd} className="w-full justify-center">
            {t("addSlide")}
          </Button>
        </Card>

        <Card padding="none" className="flex min-h-[820px] flex-col gap-3.5 p-[18px]">
          {mode.kind === "add" ? (
            <SlideAddPanel
              sundayId={sundayId}
              date={date}
              templates={publishedTemplates}
              assets={assets}
              onCreated={handleCreated}
              onCancel={cancelAdd}
            />
          ) : selectedSlide ? (
            <SlideEditPanel
              key={selectedSlide.id}
              ref={editPanelRef}
              date={date}
              slide={selectedSlide}
              templates={publishedTemplates}
              assetsByTemplateId={assetsByTemplateId}
              colors={colors}
              safeZone={safeZone}
              onSaved={handleSaved}
              onRemoved={handleRemoved}
              onDuplicated={handleDuplicated}
            />
          ) : null}
        </Card>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          action?.();
        }}
        title={t("unsavedTitle")}
        confirmLabel={t("discard")}
        cancelLabel={t("keepEditing")}
        destructive
      >
        {t("unsavedBody")}
      </ConfirmDialog>
    </div>
  );
}
