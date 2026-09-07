"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { SlideEditForm, type ApprovedColorOption, type SlideEditFormBusy, type SlideEditFormHandle } from "@/components/sunday/SlideEditForm";

export type SlideEditModalProps = {
  open: boolean;
  slide: Slide | null;
  templates: Template[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  colors: ApprovedColorOption[];
  safeZone: { x: number; y: number; width: number; height: number };
  onClose: () => void;
  onSaved: (slide: Slide) => void;
  onDuplicated: (slide: Slide) => void;
};

/** Near-full-screen "Edit slide" modal — the same `SlideEditForm` body used by the New slide modal's second step. */
export function SlideEditModal({ open, slide, templates, assetsByTemplateId, colors, safeZone, onClose, onSaved, onDuplicated }: SlideEditModalProps) {
  const t = useTranslations("sunday.simple.edit");
  const tCommon = useTranslations("common");
  const formRef = useRef<SlideEditFormHandle>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<SlideEditFormBusy>({ saving: false, duplicating: false });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    if (!open) {
      // One-time reset whenever the modal closes — not a derived-every-render value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirty(false);
    }
  }, [open]);

  function requestClose() {
    if (dirty || formRef.current?.isDirty()) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  if (!slide) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        size="lg"
        bareBody
        title={slide.headline || t("untitledSlide")}
        actions={
          // Save / Duplicate live in the sticky footer so they never scroll out of view
          // behind the two-column body on short laptop screens.
          <>
            <Button variant="secondary" onClick={requestClose}>
              {tCommon("cancel")}
            </Button>
            <Button variant="secondary" onClick={() => formRef.current?.duplicate()} loading={busy.duplicating}>
              {t("duplicate")}
            </Button>
            <Button variant="primary" onClick={() => formRef.current?.save()} loading={busy.saving}>
              {tCommon("save")}
            </Button>
          </>
        }
      >
        <SlideEditForm
          ref={formRef}
          onBusyChange={setBusy}
          slide={slide}
          templates={templates}
          assetsByTemplateId={assetsByTemplateId}
          colors={colors}
          safeZone={safeZone}
          onDirtyChange={setDirty}
          onSaved={(saved) => {
            setDirty(false);
            onSaved(saved);
          }}
          onDuplicated={onDuplicated}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        onConfirm={() => {
          setConfirmingDiscard(false);
          setDirty(false);
          onClose();
        }}
        destructive
        title={t("unsavedTitle")}
        confirmLabel={t("discard")}
        cancelLabel={t("keepEditing")}
      >
        {t("unsavedBody")}
      </ConfirmDialog>
    </>
  );
}
