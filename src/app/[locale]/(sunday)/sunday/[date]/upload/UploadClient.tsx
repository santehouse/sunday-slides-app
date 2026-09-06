"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RunSheet } from "@/lib/domain/types";
import type { RunSheetPreview } from "@/lib/sunday/contracts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Dropzone } from "@/components/ui/Dropzone";
import { MessageState } from "@/components/ui/MessageState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { applyRunSheetAction, previewRunSheetAction, reprocessRunSheetAction, uploadRunSheetAction } from "./actions";

const MAX_FILE_MB = 10;
const PREVIEW_ROW_LIMIT = 4;

type Stage = "idle" | "uploading" | "processing" | "ready" | "failed";

export type UploadClientProps = {
  date: string;
  hasSlides: boolean;
  currentRunSheet: RunSheet | null;
};

function UploadClientInner({ date, hasSlides, currentRunSheet }: UploadClientProps) {
  const t = useTranslations("sunday.upload");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const { showToast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<RunSheetPreview | null>(null);
  const [runSheetId, setRunSheetId] = useState<string | null>(null);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [applying, setApplying] = useState<"merge" | "replace" | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  async function handleFile(file: File) {
    setStage("uploading");
    setPreview(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { runSheetId: id } = await uploadRunSheetAction(formData, date);
      setRunSheetId(id);
      setStage("processing");
      const result = await previewRunSheetAction(id);
      setPreview(result);
      setStage(result.runSheet.parseStatus === "failed" ? "failed" : "ready");
    } catch {
      setStage("failed");
    }
  }

  async function handleRetry() {
    if (!runSheetId) return;
    setReprocessing(true);
    try {
      const result = await reprocessRunSheetAction(runSheetId);
      setPreview(result);
      setStage(result.runSheet.parseStatus === "failed" ? "failed" : "ready");
    } catch {
      setStage("failed");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleApply(mode: "merge" | "replace") {
    if (!runSheetId) return;
    setApplying(mode);
    try {
      await applyRunSheetAction(runSheetId, mode, date);
      showToast({
        state: "success",
        title: mode === "merge" ? t("merged") : t("replaced"),
        message: mode === "merge" ? t("merged") : t("replaced"),
      });
      router.push(`/sunday/${date}/flow`);
    } finally {
      setApplying(null);
      setConfirmingReplace(false);
    }
  }

  const statusBadge: StatusBadgeStatus | null = preview
    ? preview.runSheet.parseStatus === "ready_to_apply"
      ? "apply"
      : preview.runSheet.parseStatus === "needs_review"
        ? "needsReview"
        : preview.runSheet.parseStatus === "failed"
          ? "failed"
          : "processing"
    : null;

  const visibleItems = preview ? (showAllAnnouncements ? preview.items : preview.items.slice(0, PREVIEW_ROW_LIMIT)) : [];
  const remaining = preview ? Math.max(0, preview.items.length - PREVIEW_ROW_LIMIT) : 0;

  return (
    <div className="grid grid-cols-[620px_minmax(0,1fr)] gap-[18px]">
      <Card padding="none" className="flex min-h-[820px] flex-col gap-3.5 p-[22px]">
        <div className="flex flex-col gap-1">
          <h3 className="text-h3 font-bold text-fg">{t("manualUpload")}</h3>
          <p className="text-[13px] text-fg-secondary">{t("helper")}</p>
        </div>

        <Dropzone
          title={t("dropHere")}
          hint={t("formats", { max: MAX_FILE_MB })}
          chooseFileLabel={t("chooseFile")}
          accept=".docx,.pdf"
          maxSizeMb={MAX_FILE_MB}
          disabled={stage === "uploading" || stage === "processing"}
          onFile={handleFile}
        />

        {currentRunSheet ? (
          <div className="flex h-[78px] items-center gap-3 rounded-[10px] bg-surface-subtle px-3.5">
            <FileText aria-hidden="true" size={24} className="shrink-0 text-fg-secondary" />
            <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-label font-bold text-fg">{t("current", { file: currentRunSheet.originalFilename })}</p>
            <p className="truncate text-caption text-fg-secondary">
              {t("currentMeta", {
                source: currentRunSheet.sourceType === "email" ? t("sourceEmail") : t("sourceManual"),
                status: tStatus(
                  currentRunSheet.parseStatus === "added_to_flow"
                    ? "addedToFlow"
                    : currentRunSheet.parseStatus === "ready_to_apply"
                      ? "readyToApply"
                      : currentRunSheet.parseStatus === "needs_review"
                        ? "needsReview"
                        : currentRunSheet.parseStatus,
                ),
              })}
            </p>
            </div>
          </div>
        ) : null}
      </Card>

      <Card padding="none" className="flex min-h-[820px] flex-col items-start gap-3.5 p-[22px]">
        <CardHeader title={t("preview")} className="w-full" />
        <p className="text-caption text-fg-secondary">{t("previewHelper")}</p>

        {stage === "idle" ? (
          <MessageState state="info" title={t("emptyPreviewTitle")} message={t("emptyPreview")} className="w-full" />
        ) : null}

        {stage === "uploading" || stage === "processing" ? (
          <div className="flex w-full items-center gap-3 rounded-[10px] bg-surface-subtle p-4">
            <Spinner label={t("processing")} />
            <div className="flex flex-col gap-0.5">
              <p className="text-label font-bold text-fg">{t("processing")}</p>
              <p className="text-caption text-fg-secondary">{t("processingBody")}</p>
            </div>
          </div>
        ) : null}

        {stage === "failed" ? (
          <>
            <MessageState state="error" title={t("processingFailed")} message={t("processingFailedBody")} className="w-full" />
            <Button variant="secondary" onClick={handleRetry} loading={reprocessing} className="w-fit">
              {tCommon("tryAgain")}
            </Button>
          </>
        ) : null}

        {stage === "ready" && preview ? (
          <>
            <div className="flex flex-col items-start gap-2.5">
              <p className="text-label font-bold text-fg">{preview.runSheet.originalFilename}</p>
              {statusBadge ? <StatusBadge status={statusBadge} /> : null}
            </div>
            <p className="text-caption text-fg-secondary">
              {t("summary", {
                found: preview.summary.found,
                mapped: preview.summary.mapped,
                review: preview.summary.needsReview,
              })}
            </p>

            <div className="flex w-full flex-col gap-2.5">
              {visibleItems.map((item, index) => (
                <div key={index} className="flex h-16 items-center justify-between gap-3 rounded-[10px] bg-surface-subtle px-3.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-label font-bold text-fg">{item.headline}</p>
                    <p className="truncate text-caption text-fg-secondary">{item.templateName ?? t("noTemplate")}</p>
                  </div>
                  <StatusBadge status={item.status === "ready" ? "ready" : "needsReview"} />
                </div>
              ))}
              {remaining > 0 && !showAllAnnouncements ? (
                <button
                  type="button"
                  className="text-left text-caption font-bold text-fg-secondary hover:underline"
                  onClick={() => setShowAllAnnouncements(true)}
                >
                  {t("moreAnnouncements", { count: remaining })}
                </button>
              ) : null}
            </div>

            {hasSlides ? (
              <div className="flex items-center gap-2.5">
                <Button variant="danger" onClick={() => setConfirmingReplace(true)} disabled={applying !== null}>
                  {t("replaceDeck")}
                </Button>
                <Button variant="primary" onClick={() => handleApply("merge")} loading={applying === "merge"}>
                  {t("mergeUpdates")}
                </Button>
              </div>
            ) : (
              <Button variant="primary" onClick={() => handleApply("replace")} loading={applying === "replace"} className="w-fit">
                {t("applyToSunday")}
              </Button>
            )}
          </>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmingReplace}
        onClose={() => setConfirmingReplace(false)}
        onConfirm={() => handleApply("replace")}
        confirmLoading={applying === "replace"}
        destructive
        title={t("replaceConfirmTitle")}
        doubleConfirm={{
          title: t("replaceFinalTitle"),
          confirmLabel: t("replaceFinalConfirm"),
          children: t("replaceFinalBody"),
        }}
      >
        {t("replaceConfirmBody")}
      </ConfirmDialog>
    </div>
  );
}

export function UploadClient(props: UploadClientProps) {
  return (
    <ToastProvider>
      <UploadClientInner {...props} />
    </ToastProvider>
  );
}
