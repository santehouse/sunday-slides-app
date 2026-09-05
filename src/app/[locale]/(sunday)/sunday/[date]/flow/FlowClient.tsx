"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { SafeZonesAction } from "@/components/ui/SafeZonesAction";
import { useToast } from "@/components/ui/Toast";
import { SlideFlowList } from "@/components/sunday/SlideFlowList";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { reorderSlidesAction, removeSlideAction } from "./actions";

const SAFE_ZONES_STORAGE_KEY = "cp.showSafeZones";

export type FlowClientProps = {
  date: string;
  sundayId: string;
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  assets: ResolvedAsset[];
  safeZone: { x: number; y: number; width: number; height: number };
  initialSelectedId: string | null;
};

/** The page (`page.tsx`) wraps this — and the header's `ExportPopover` — in one shared `ToastProvider`. */
export function FlowClient({
  date,
  sundayId,
  slides,
  templatesById,
  colorHexById,
  assets,
  safeZone,
  initialSelectedId,
}: FlowClientProps) {
  const t = useTranslations("sunday.flow");
  const tSafeZones = useTranslations("sunday.safeZones");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const fallbackId = slides[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && slides.some((s) => s.id === initialSelectedId) ? initialSelectedId : fallbackId,
  );
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [slideToRemove, setSlideToRemove] = useState<Slide | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    try {
      // One-time sync from a per-viewer external store (localStorage) on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowSafeZone(window.localStorage.getItem(SAFE_ZONES_STORAGE_KEY) === "1");
    } catch {
      // ignore (private browsing / blocked storage)
    }
  }, []);

  function toggleSafeZone() {
    setShowSafeZone((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SAFE_ZONES_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  function selectSlide(id: string) {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("slide", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function handleReorder(orderedIds: string[]) {
    try {
      await reorderSlidesAction(sundayId, date, orderedIds);
    } catch {
      showToast({ state: "error", title: tErrors("generic"), message: tErrors("network") });
    }
  }

  async function confirmRemove() {
    if (!slideToRemove) return;
    setRemoving(true);
    try {
      const result = await removeSlideAction(slideToRemove.id, date);
      if (!result.ok) {
        showToast({ state: "warning", title: t("removeSlide"), message: t("cannotRemoveStructural") });
      } else {
        router.refresh();
      }
    } finally {
      setRemoving(false);
      setSlideToRemove(null);
    }
  }

  const selectedSlide = slides.find((s) => s.id === selectedId) ?? null;
  const selectedTemplate = selectedSlide ? templatesById[selectedSlide.templateId] : null;

  return (
    <div className="grid grid-cols-[500px_1fr] gap-[18px]">
      <Card padding="none" className="min-h-[820px] p-[18px]">
        {slides.length === 0 ? (
          <p className="text-label text-fg-secondary">{t("noSlides")}</p>
        ) : (
          <SlideFlowList
            slides={slides}
            templatesById={templatesById}
            colorHexById={colorHexById}
            assets={assets}
            selectedId={selectedId}
            onSelect={selectSlide}
            onOpen={(id) => router.push(`/sunday/${date}/slide/${id}?from=flow`)}
            onReorder={handleReorder}
          />
        )}
      </Card>

      <Card padding="none" className="flex min-h-[820px] flex-col gap-3.5 p-[18px]">
        <div className="flex h-10 items-center justify-between gap-3">
          <h2 className="truncate text-h3 font-bold text-fg">{selectedSlide?.headline ?? ""}</h2>
          <SafeZonesAction active={showSafeZone} onToggle={toggleSafeZone} />
        </div>

        {selectedSlide && selectedTemplate ? (
          <>
            <div className="aspect-video w-full max-w-[758px] overflow-hidden rounded-[12px] border border-border">
              <SlidePreview
                template={selectedTemplate}
                slide={selectedSlide}
                backgroundColorHex={selectedSlide.approvedColorId ? (colorHexById[selectedSlide.approvedColorId] ?? null) : null}
                assets={assets}
                safeZone={safeZone}
                showSafeZone={showSafeZone}
                safeZoneLabel={tSafeZones("label")}
              />
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="primary"
                leadingIcon={Pencil}
                onClick={() => router.push(`/sunday/${date}/slide/${selectedSlide.id}?from=flow`)}
              >
                {t("editSlide")}
              </Button>
              {/* Not in the Figma frame: the flow card itself has no menu (the status pill
                  is pinned far right there), so slide removal lives beside "Edit slide". */}
              <Button variant="ghost" leadingIcon={Trash2} onClick={() => setSlideToRemove(selectedSlide)}>
                {t("removeSlide")}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-label text-fg-secondary">{t("noSlides")}</p>
        )}
      </Card>

      <ConfirmDialog
        open={slideToRemove !== null}
        onClose={() => setSlideToRemove(null)}
        onConfirm={confirmRemove}
        confirmLoading={removing}
        destructive
        title={t("removeConfirmTitle")}
      >
        {slideToRemove ? t("removeConfirmBody", { title: slideToRemove.headline }) : null}
      </ConfirmDialog>
    </div>
  );
}
