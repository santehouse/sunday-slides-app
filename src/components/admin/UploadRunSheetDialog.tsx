"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropzone } from "@/components/ui/Dropzone";
import { MessageState } from "@/components/ui/MessageState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { applyRunSheetAction, uploadRunSheetAction } from "@/app/[locale]/admin/(protected)/sundays/actions";
import {
  initialApplyRunSheetState,
  initialUploadRunSheetState,
  type UploadRunSheetState,
} from "@/app/[locale]/admin/(protected)/sundays/formState";

const MAX_SIZE_MB = 10;

export type UploadRunSheetDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the target Sunday's service date (e.g. opened from a Sunday's detail page). */
  defaultServiceDate?: string;
};

/** Figma "Upload Run Sheet" flow, as a dialog reused from the Dashboard link and the Sundays list. */
export function UploadRunSheetDialog({ open, onClose, defaultServiceDate }: UploadRunSheetDialogProps) {
  const t = useTranslations("admin.sundays");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const router = useRouter();

  // Remounted (via `key`) by the parent each time it opens, so plain initial state — no
  // reset-on-open effect needed — always starts fresh.
  const [file, setFile] = useState<File | null>(null);
  const [serviceDate, setServiceDate] = useState(defaultServiceDate ?? "");
  const [preview, setPreview] = useState<UploadRunSheetState>(initialUploadRunSheetState);
  const [isPending, startTransition] = useTransition();

  const canUpload = Boolean(file) && Boolean(serviceDate) && preview.status !== "previewing";

  function handleUpload() {
    if (!file || !serviceDate) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("serviceDate", serviceDate);
    startTransition(async () => {
      const result = await uploadRunSheetAction(initialUploadRunSheetState, formData);
      setPreview(result);
    });
  }

  function handleApply(mode: "merge" | "replace") {
    if (preview.status !== "previewing") return;
    const formData = new FormData();
    formData.set("runSheetId", preview.runSheetId);
    formData.set("mode", mode);
    startTransition(async () => {
      const result = await applyRunSheetAction(initialApplyRunSheetState, formData);
      if (result.status === "success") {
        onClose();
        router.push(`/admin/sundays/${result.sundayId}`);
      } else if (result.status === "error") {
        setPreview({ status: "error", message: result.message });
      }
    });
  }

  const errorMessage = useMemo(() => {
    if (preview.status !== "error") return null;
    return preview.message === "missing_file" ? tErrors("validation") : tErrors("generic");
  }, [preview, tErrors]);

  return (
    <Dialog open={open} onClose={onClose} title={t("uploadRunSheet")} className="max-w-[560px]">
      <div className="flex flex-col gap-4">
        <Input
          id="upload-run-sheet-date"
          type="date"
          label={t("serviceDate")}
          value={serviceDate}
          onChange={(event) => setServiceDate(event.target.value)}
          disabled={preview.status === "previewing"}
        />

        {preview.status !== "previewing" ? (
          <Dropzone
            title={t("dropzoneTitle")}
            hint={t("dropzoneHint", { max: MAX_SIZE_MB })}
            chooseFileLabel={t("chooseFile")}
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            maxSizeMb={MAX_SIZE_MB}
            onFile={setFile}
            disabled={isPending}
          />
        ) : null}

        {file && preview.status !== "previewing" ? (
          <p className="text-caption text-fg-secondary">{file.name}</p>
        ) : null}

        {errorMessage ? <MessageState state="error" title={tCommon("failed")} message={errorMessage} /> : null}

        {preview.status === "previewing" ? (
          <div className="flex flex-col gap-3">
            <p className="text-label font-bold text-fg">{preview.filename}</p>
            <p className="text-caption text-fg-secondary">
              {t("uploadSummary", {
                found: preview.summary.found,
                mapped: preview.summary.mapped,
                needsReview: preview.summary.needsReview,
              })}
            </p>
            <div className="flex flex-col gap-2">
              {preview.items.slice(0, 6).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-label font-bold text-fg">{item.headline}</p>
                    {item.templateName ? (
                      <p className="truncate text-caption text-fg-secondary">{item.templateName}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={item.status === "ready" ? "ready" : "needsReview"} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          {preview.status === "previewing" ? (
            <>
              <Button variant="danger" loading={isPending} onClick={() => handleApply("replace")}>
                {t("replaceDeck")}
              </Button>
              <Button variant="primary" loading={isPending} onClick={() => handleApply("merge")}>
                {t("mergeUpdates")}
              </Button>
            </>
          ) : (
            <Button variant="primary" loading={isPending} disabled={!canUpload} onClick={handleUpload}>
              {tCommon("upload")}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
