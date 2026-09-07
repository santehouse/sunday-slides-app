"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Inbox, Plus, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import { resolveSlideBackgroundHex } from "@/lib/sunday/background";
import type { TemplateWithFields } from "@/lib/data";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { buildCheckItems } from "@/lib/sunday/checklist";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { SafeZonesAction } from "@/components/ui/SafeZonesAction";
import { useToast } from "@/components/ui/Toast";
import { QueueList } from "@/components/sunday/QueueList";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { SlideEditModal } from "@/components/sunday/SlideEditModal";
import { NewSlideModal } from "@/components/sunday/NewSlideModal";
import { ImportModal, type RecentRunSheetData } from "@/components/sunday/ImportModal";
import { ExportMenu } from "@/components/sunday/ExportMenu";
import type { ApprovedColorOption } from "@/components/sunday/SlideEditForm";
import { clearQueueAction, reorderSlidesAction, updateHoldSecondsAction } from "@/app/[locale]/(sunday)/sunday/actions";

const REASON_KEY: Record<"review" | "missing" | "tooLong", string> = {
  review: "reasonReview",
  missing: "reasonMissing",
  tooLong: "reasonTooLong",
};

export type SundayQueueClientProps = {
  sundayId: string;
  serviceDate: string;
  holdSeconds: number;
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  colors: ApprovedColorOption[];
  assets: ResolvedAsset[];
  publishedTemplates: TemplateWithFields[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  safeZone: { x: number; y: number; width: number; height: number };
  recentFiles: RecentRunSheetData[];
  initialSelectedSlideId: string | null;
  initialAdd: boolean;
  initialImport: boolean;
};

export function SundayQueueClient({
  sundayId,
  serviceDate,
  holdSeconds,
  slides,
  templatesById,
  colorHexById,
  colors,
  assets,
  publishedTemplates,
  assetsByTemplateId,
  safeZone,
  recentFiles,
  initialSelectedSlideId,
  initialAdd,
  initialImport,
}: SundayQueueClientProps) {
  const t = useTranslations("sunday.queue");
  const tCheck = useTranslations("sunday.simple.check");
  const format = useFormatter();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [editingSlideId, setEditingSlideId] = useState<string | null>(initialSelectedSlideId);
  const [newSlideOpen, setNewSlideOpen] = useState(initialAdd);
  const [importOpen, setImportOpen] = useState(initialImport);
  const [previewId, setPreviewId] = useState<string | null>(initialSelectedSlideId ?? slides[0]?.id ?? null);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const prevIdSetKey = useRef(slides.map((s) => s.id).join("|"));
  useEffect(() => {
    const idSetKey = slides.map((s) => s.id).join("|");
    if (prevIdSetKey.current === idSetKey) return;
    prevIdSetKey.current = idSetKey;
    if (previewId && !slides.some((s) => s.id === previewId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewId(slides[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  function syncUrl(next: { slide?: string | null; add?: boolean; import?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("slide");
    params.delete("add");
    params.delete("import");
    const slideId = next.slide !== undefined ? next.slide : editingSlideId;
    const add = next.add !== undefined ? next.add : newSlideOpen;
    const imp = next.import !== undefined ? next.import : importOpen;
    if (slideId) params.set("slide", slideId);
    if (add) params.set("add", "1");
    if (imp) params.set("import", "1");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
  }

  function openEdit(id: string) {
    setEditingSlideId(id);
    syncUrl({ slide: id });
  }
  function closeEdit() {
    setEditingSlideId(null);
    syncUrl({ slide: null });
  }
  function openNewSlide() {
    setNewSlideOpen(true);
    syncUrl({ add: true });
  }
  function closeNewSlide() {
    setNewSlideOpen(false);
    syncUrl({ add: false });
  }
  function openImport() {
    setImportOpen(true);
    syncUrl({ import: true });
  }
  function closeImport() {
    setImportOpen(false);
    syncUrl({ import: false });
  }

  function handleSelect(id: string) {
    setPreviewId(id);
  }

  function handleRemoved(id: string) {
    if (previewId === id) setPreviewId(null);
    router.refresh();
  }

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorderSlidesAction(sundayId, orderedIds);
    } catch {
      // The list already reflects the attempted order locally; a refresh will
      // resync if the server write actually failed.
    }
  }

  async function handleClearQueue() {
    setClearing(true);
    try {
      await clearQueueAction(sundayId);
      setConfirmingClear(false);
      showToast({ state: "success", title: t("cleared"), message: "" });
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  async function handleHoldSecondsChange(seconds: number): Promise<number> {
    return updateHoldSecondsAction(sundayId, seconds);
  }

  const editingSlide = editingSlideId ? (slides.find((s) => s.id === editingSlideId) ?? null) : null;
  const previewSlide = previewId ? (slides.find((s) => s.id === previewId) ?? null) : null;
  const previewTemplate = previewSlide ? templatesById[previewSlide.templateId] : null;

  const checkItems = buildCheckItems(slides, templatesById);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-tight text-fg">{t("title")}</h1>
          <p className="text-caption text-fg-secondary">{format.dateTime(serviceDateToDate(serviceDate), "sundayLong")}</p>
        </div>
        <ExportMenu
          sundayId={sundayId}
          slides={slides}
          templatesById={templatesById}
          colorHexById={colorHexById}
          assets={assets}
          holdSeconds={holdSeconds}
          onHoldSecondsChange={handleHoldSecondsChange}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ConfirmDialog
          open={confirmingClear}
          onClose={() => setConfirmingClear(false)}
          onConfirm={handleClearQueue}
          confirmLoading={clearing}
          destructive
          title={t("clearTitle")}
          doubleConfirm={{ title: t("clearFinalTitle"), confirmLabel: t("clearConfirm"), children: t("clearFinalBody") }}
        >
          {t("clearBody")}
        </ConfirmDialog>
        <Button variant="secondary" leadingIcon={Trash2} onClick={() => setConfirmingClear(true)} disabled={slides.length === 0}>
          {t("clear")}
        </Button>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" leadingIcon={Inbox} onClick={openImport}>
            {t("importAnnouncements")}
          </Button>
          <Button variant="primary" leadingIcon={Plus} onClick={openNewSlide}>
            {t("newSlide")}
          </Button>
        </div>
      </div>

      {checkItems.length > 0 ? (
        // A hand-built warning callout (MessageState's fixed `<p>` message wrapper can't
        // hold a list of buttons) using the same warning tone tokens.
        <div role="alert" className="flex items-start gap-3 rounded-md bg-warning-bg p-3.5 text-warning-fg">
          <AlertCircle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-label font-bold">{t("needsLook", { count: checkItems.length })}</p>
            <ul className="flex flex-col gap-1.5">
              {checkItems.map((item) => (
                <li key={item.slideId}>
                  <button type="button" className="text-left text-[12px] font-bold underline-offset-2 hover:underline" onClick={() => openEdit(item.slideId)}>
                    {String(item.index + 1).padStart(2, "0")} — {item.headline || t("untitledSlide")}: {tCheck(REASON_KEY[item.reason])}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {slides.length === 0 ? (
        <Card padding="md" className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-label text-fg-secondary">{t("empty")}</p>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" leadingIcon={Inbox} onClick={openImport}>
              {t("importAnnouncements")}
            </Button>
            <Button variant="primary" leadingIcon={Plus} onClick={openNewSlide}>
              {t("newSlide")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
          {/* Queue and preview split the width 50/50 on desktop. */}
          <div className="min-w-0 lg:flex-1 lg:basis-0">
            <QueueList
              slides={slides}
              templatesById={templatesById}
              colorHexById={colorHexById}
              assets={assets}
              selectedId={previewId}
              onSelect={handleSelect}
              onEdit={openEdit}
              onRemoved={handleRemoved}
              onReorder={handleReorder}
            />
          </div>

          <Card padding="none" className="flex w-full min-w-0 flex-col gap-3 p-[18px] lg:flex-1 lg:basis-0 lg:self-start">
            <div className="flex h-9 items-center justify-between">
              <span className="text-caption font-bold uppercase tracking-[0.08em] text-fg-secondary">{t("previewLabel")}</span>
              <SafeZonesAction active={showSafeZone} onToggle={() => setShowSafeZone((v) => !v)} />
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-[10px] bg-surface-subtle">
              {previewSlide && previewTemplate ? (
                <SlidePreview
                  template={previewTemplate}
                  slide={previewSlide}
                  backgroundColorHex={resolveSlideBackgroundHex(previewTemplate, previewSlide, colorHexById)}
                  assets={assets}
                  safeZone={safeZone}
                  showSafeZone={showSafeZone}
                />
              ) : null}
            </div>
          </Card>
        </div>
      )}

      <SlideEditModal
        open={editingSlide !== null}
        slide={editingSlide}
        templates={publishedTemplates}
        assetsByTemplateId={assetsByTemplateId}
        colors={colors}
        safeZone={safeZone}
        onClose={closeEdit}
        onSaved={() => {
          closeEdit();
          router.refresh();
        }}
        onDuplicated={(created) => {
          closeEdit();
          router.refresh();
          openEdit(created.id);
        }}
      />

      <NewSlideModal
        open={newSlideOpen}
        sundayId={sundayId}
        templates={publishedTemplates}
        assets={assets}
        assetsByTemplateId={assetsByTemplateId}
        colors={colors}
        safeZone={safeZone}
        onClose={() => {
          closeNewSlide();
          router.refresh();
        }}
        onCreated={() => router.refresh()}
        onSaved={() => {
          closeNewSlide();
          router.refresh();
        }}
        onDuplicated={() => router.refresh()}
      />

      <ImportModal
        open={importOpen}
        sundayId={sundayId}
        recentFiles={recentFiles}
        onClose={closeImport}
        onUploaded={() => router.refresh()}
        onApplied={() => {
          closeImport();
          router.refresh();
        }}
      />
    </div>
  );
}
