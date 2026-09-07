"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import type { TemplateWithFields } from "@/lib/data";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SlideAddPanel } from "@/components/sunday/SlideAddPanel";
import { SlideEditForm, type ApprovedColorOption } from "@/components/sunday/SlideEditForm";
import { createSlideFromTemplateAction } from "@/app/[locale]/(sunday)/sunday/actions";

export type NewSlideModalProps = {
  open: boolean;
  sundayId: string;
  templates: TemplateWithFields[];
  assets: ResolvedAsset[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  colors: ApprovedColorOption[];
  safeZone: { x: number; y: number; width: number; height: number };
  onClose: () => void;
  onCreated: (slide: Slide) => void;
  onSaved: (slide: Slide) => void;
  onDuplicated: (slide: Slide) => void;
};

/**
 * "New slide" modal: a category-filtered template grid, which swaps in place to the same
 * `SlideEditForm` used by the Edit modal the instant a design is picked — the volunteer
 * immediately types the text into the newly created slide.
 */
export function NewSlideModal({
  open,
  sundayId,
  templates,
  assets,
  assetsByTemplateId,
  colors,
  safeZone,
  onClose,
  onCreated,
  onSaved,
  onDuplicated,
}: NewSlideModalProps) {
  const t = useTranslations("sunday.simple.add");
  const tCommon = useTranslations("common");
  const [createdSlide, setCreatedSlide] = useState<Slide | null>(null);

  useEffect(() => {
    if (!open) {
      // One-time reset back to the template picker whenever the modal is reopened —
      // not a derived-every-render value, so this is the correct place for it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreatedSlide(null);
    }
  }, [open]);

  async function handlePick(templateId: string) {
    const slide = await createSlideFromTemplateAction(sundayId, templateId);
    setCreatedSlide(slide);
    onCreated(slide);
  }

  const templatesAsTemplates: Template[] = templates;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      bareBody
      title={t("title")}
      actions={<Button variant="secondary" onClick={onClose}>{tCommon("cancel")}</Button>}
    >
      {createdSlide ? (
        <SlideEditForm
          slide={createdSlide}
          templates={templatesAsTemplates}
          assetsByTemplateId={assetsByTemplateId}
          colors={colors}
          safeZone={safeZone}
          onSaved={onSaved}
          onDuplicated={onDuplicated}
        />
      ) : (
        <SlideAddPanel templates={templates} assets={assets} onPick={handlePick} />
      )}
    </Dialog>
  );
}
