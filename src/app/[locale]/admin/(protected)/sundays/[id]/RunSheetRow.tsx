"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { MessageState } from "@/components/ui/MessageState";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { applyRunSheetAction, reprocessRunSheetAction, type ReprocessResult } from "../actions";
import { initialApplyRunSheetState } from "../formState";
import type { RunSheet } from "@/lib/domain/types";

const PARSE_STATUS_MAP: Record<RunSheet["parseStatus"], StatusBadgeStatus> = {
  queued: "queued",
  processing: "processing",
  ready_to_apply: "apply",
  added_to_flow: "added",
  needs_review: "needsReview",
  failed: "failed",
};

export function RunSheetRow({ runSheet }: { runSheet: RunSheet }) {
  const t = useTranslations("admin.sundays");
  const tUpload = useTranslations("sunday.upload");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ReprocessResult | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  function handleReprocess() {
    startTransition(async () => {
      const result = await reprocessRunSheetAction(runSheet.id);
      setPreview(result);
      if (!result.ok) {
        showToast({ state: "error", title: tCommon("failed"), message: tErrors("generic") });
      }
    });
  }

  function handleApply(mode: "merge" | "replace") {
    if (!preview?.ok) return;
    const formData = new FormData();
    formData.set("runSheetId", preview.preview.runSheetId);
    formData.set("mode", mode);
    startTransition(async () => {
      const result = await applyRunSheetAction(initialApplyRunSheetState, formData);
      if (result.status === "success") {
        setPreview(null);
        showToast({ state: "success", title: tCommon("save"), message: tCommon("ready") });
        router.refresh();
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: tErrors("generic") });
      }
      setConfirmingReplace(false);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-label font-bold text-fg">{runSheet.originalFilename}</p>
          <p className="text-caption text-fg-secondary">
            {t(runSheet.sourceType === "email" ? "sourceTypeEmail" : "sourceTypeManual")}
            {" · "}
            {t("receivedAt", { date: new Date(runSheet.receivedAt) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={PARSE_STATUS_MAP[runSheet.parseStatus]} />
          <Button variant="secondary" leadingIcon={RefreshCw} loading={isPending} onClick={handleReprocess}>
            {t("reprocess")}
          </Button>
        </div>
      </div>

      {preview && !preview.ok ? (
        <MessageState state="error" title={tCommon("failed")} message={tErrors("generic")} />
      ) : null}

      {preview?.ok ? (
        <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
          <p className="text-caption text-fg-secondary">
            {t("uploadSummary", {
              found: preview.preview.summary.found,
              mapped: preview.preview.summary.mapped,
              needsReview: preview.preview.summary.needsReview,
            })}
          </p>
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="danger" loading={isPending} onClick={() => setConfirmingReplace(true)}>
              {t("replaceDeck")}
            </Button>
            <Button variant="primary" loading={isPending} onClick={() => handleApply("merge")}>
              {t("mergeUpdates")}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingReplace}
        onClose={() => setConfirmingReplace(false)}
        onConfirm={() => handleApply("replace")}
        confirmLoading={isPending}
        destructive
        title={tUpload("replaceConfirmTitle")}
        doubleConfirm={{
          title: tUpload("replaceFinalTitle"),
          confirmLabel: tUpload("replaceFinalConfirm"),
          children: tUpload("replaceFinalBody"),
        }}
      >
        {tUpload("replaceConfirmBody")}
      </ConfirmDialog>
    </div>
  );
}
