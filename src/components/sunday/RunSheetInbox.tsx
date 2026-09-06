"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { RunSheetParseStatus, RunSheetSourceType } from "@/lib/domain/types";
import type { RunSheetPreview } from "@/lib/sunday/contracts";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropzone } from "@/components/ui/Dropzone";
import { Link } from "@/i18n/navigation";
import { MessageState } from "@/components/ui/MessageState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { previewRunSheetAction, reprocessRunSheetAction, uploadRunSheetAction, activateRunSheetAction } from "@/app/[locale]/(sunday)/sunday/[date]/run-sheet/actions";

const MAX_FILE_MB = 10;
const PREVIEW_ROW_LIMIT = 6;

export interface InboxItemData {
  runSheetId: string;
  filename: string;
  sourceType: RunSheetSourceType;
  receivedAt: string;
  parseStatus: RunSheetParseStatus;
  forDate: string;
}

export type RunSheetInboxProps = {
  date: string;
  items: InboxItemData[];
};

function InboxRow({
  item,
  onUpdated,
}: {
  item: InboxItemData;
  onUpdated: (patch: Partial<InboxItemData>) => void;
}) {
  const t = useTranslations("sunday.simple.inbox");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const format = useFormatter();
  const { showToast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<RunSheetPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [using, setUsing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const canExpand = item.parseStatus === "ready_to_apply" || item.parseStatus === "needs_review";

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !preview) {
      setLoadingPreview(true);
      try {
        setPreview(await previewRunSheetAction(item.runSheetId));
      } finally {
        setLoadingPreview(false);
      }
    }
  }

  async function handleUse() {
    setUsing(true);
    try {
      const result = await activateRunSheetAction(item.runSheetId);
      if (result.mergedKeptCount !== null && result.mergedKeptCount > 0) {
        showToast({ state: "success", title: t("used"), message: t("mergedKept", { count: result.mergedKeptCount }) });
      }
      router.push(`/sunday/${result.date}`);
    } finally {
      setUsing(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const result = await reprocessRunSheetAction(item.runSheetId);
      setPreview(result);
      onUpdated({ parseStatus: result.runSheet.parseStatus });
    } finally {
      setRetrying(false);
    }
  }

  const visibleItems = preview ? preview.items.slice(0, PREVIEW_ROW_LIMIT) : [];
  const remaining = preview ? Math.max(0, preview.items.length - PREVIEW_ROW_LIMIT) : 0;

  return (
    <li className="flex flex-col gap-2.5 rounded-md bg-surface-subtle p-3.5">
      <div className="flex items-center gap-3">
        <FileText aria-hidden="true" size={24} className="shrink-0 text-fg-secondary" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-label font-bold text-fg">{item.filename}</p>
          <p className="truncate text-caption text-fg-secondary">
            {item.sourceType === "email"
              ? t("fromEmail", { time: format.dateTime(new Date(item.receivedAt), "dayTime") })
              : t("uploaded", { time: format.dateTime(new Date(item.receivedAt), "dayTime") })}
            {" · "}
            {t("forSunday", { date: format.dateTime(serviceDateToDate(item.forDate), "sundayShort") })}
          </p>
        </div>

        {item.parseStatus === "added_to_flow" ? (
          <StatusBadge status="used" />
        ) : item.parseStatus === "failed" ? (
          <Button variant="secondary" onClick={handleRetry} loading={retrying}>
            {tCommon("tryAgain")}
          </Button>
        ) : item.parseStatus === "queued" || item.parseStatus === "processing" ? (
          <Spinner label={t("processing")} />
        ) : (
          <Button variant="primary" onClick={handleUse} loading={using}>
            {t("use")}
          </Button>
        )}

        {canExpand ? (
          <Button variant="ghost" size="sm" onClick={toggleExpand}>
            {expanded ? t("hideWhatWasFound") : t("seeWhatWasFound")}
            {expanded ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
          </Button>
        ) : null}
      </div>

      {item.parseStatus === "failed" ? <MessageState state="error" title={t("failedTitle")} message={t("failedBody")} /> : null}

      {expanded ? (
        loadingPreview ? (
          <Spinner label={tCommon("loading")} />
        ) : preview ? (
          <div className="flex flex-col gap-2">
            <p className="text-caption text-fg-secondary">
              {t("summary", { found: preview.summary.found, review: preview.summary.needsReview })}
            </p>
            {visibleItems.map((row, index) => (
              <div key={index} className="flex h-12 items-center justify-between gap-3 rounded-[8px] bg-surface px-3">
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-caption font-bold text-fg">{row.headline}</p>
                  <p className="truncate text-[11px] text-fg-secondary">{row.templateName ?? t("noTemplate")}</p>
                </div>
                <StatusBadge status={row.status === "ready" ? "ready" : "needsReview"} />
              </div>
            ))}
            {remaining > 0 ? <p className="text-caption text-fg-secondary">+{remaining}</p> : null}
          </div>
        ) : null
      ) : null}
    </li>
  );
}

function RunSheetInboxInner({ date, items: initialItems }: RunSheetInboxProps) {
  const t = useTranslations("sunday.simple.inbox");
  const [items, setItems] = useState(initialItems);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { runSheetId } = await uploadRunSheetAction(formData, date);
      const preview = await previewRunSheetAction(runSheetId);
      const newItem: InboxItemData = {
        runSheetId,
        filename: preview.runSheet.originalFilename,
        sourceType: preview.runSheet.sourceType,
        receivedAt: preview.runSheet.receivedAt,
        parseStatus: preview.runSheet.parseStatus,
        forDate: date,
      };
      setItems((prev) => [newItem, ...prev.filter((i) => i.runSheetId !== runSheetId)]);
    } finally {
      setUploading(false);
    }
  }

  function updateItem(runSheetId: string, patch: Partial<InboxItemData>) {
    setItems((prev) => prev.map((i) => (i.runSheetId === runSheetId ? { ...i, ...patch } : i)));
  }

  return (
    <div className="flex flex-col gap-5">
      <Card padding="none" className="flex flex-col gap-3.5 p-[22px]">
        <h2 className="text-h3 font-bold text-fg">{t("uploadTitle")}</h2>
        <Dropzone
          title={t("uploadTitle")}
          hint={t("uploadHint")}
          chooseFileLabel={t("chooseFile")}
          accept=".docx,.pdf"
          maxSizeMb={MAX_FILE_MB}
          disabled={uploading}
          onFile={handleFile}
        />
        {uploading ? <Spinner label={t("processing")} /> : null}
      </Card>

      <Card padding="none" className="flex flex-col gap-3.5 p-[22px]">
        <h2 className="text-h3 font-bold text-fg">{t("heading")}</h2>
        {items.length === 0 ? (
          <p className="text-label text-fg-secondary">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <InboxRow key={item.runSheetId} item={item} onUpdated={(patch) => updateItem(item.runSheetId, patch)} />
            ))}
          </ul>
        )}
      </Card>

      <Link href={`/sunday/${date}/run-sheet/previous`} className="text-label font-bold text-fg-secondary hover:underline">
        {t("previousSundays")}
      </Link>
    </div>
  );
}

export function RunSheetInbox(props: RunSheetInboxProps) {
  return (
    <ToastProvider>
      <RunSheetInboxInner {...props} />
    </ToastProvider>
  );
}
