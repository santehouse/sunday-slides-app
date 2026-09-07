"use client";

import { useEffect, useState } from "react";
import { Eye, FileText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { RunSheetParseStatus, RunSheetSourceType } from "@/lib/domain/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Dropzone } from "@/components/ui/Dropzone";
import { MessageState } from "@/components/ui/MessageState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  getRunSheetContentPreviewAction,
  markRunSheetOpenedAction,
  uploadRunSheetAction,
  activateRunSheetFileAction,
  type RunSheetContentPreview,
} from "@/app/[locale]/(sunday)/sunday/actions";

export interface RecentRunSheetData {
  id: string;
  filename: string;
  sourceType: RunSheetSourceType;
  receivedAt: string;
  openedAt: string | null;
  parseStatus: RunSheetParseStatus;
  mimeType: string;
}

export type ImportModalProps = {
  open: boolean;
  sundayId: string;
  recentFiles: RecentRunSheetData[];
  onClose: () => void;
  /** Called right after a manual upload finishes — the parent re-fetches server data so
      the new file appears in "Received files" (still needs its own "Use this file"). */
  onUploaded: () => void;
  /** Called after "Use this file" succeeds — the parent re-fetches server data and closes the modal. */
  onApplied: (summary: { found: number; mapped: number; needsReview: number }) => void;
};

/** Renders extracted run-sheet text as light markdown-ish blocks (# headings, - list items, paragraphs). */
function DocPreview({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i} className="list-disc pl-5 text-label text-fg">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^-\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        if (lines.length === 1 && lines[0].startsWith("#")) {
          return (
            <h3 key={i} className="text-h3 font-bold text-fg">
              {lines[0].replace(/^#+\s*/, "")}
            </h3>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap text-label text-fg">
            {lines.join("\n")}
          </p>
        );
      })}
    </div>
  );
}

function PreviewDialog({
  file,
  onClose,
}: {
  file: RecentRunSheetData;
  onClose: () => void;
}) {
  const t = useTranslations("sunday.import");
  const [preview, setPreview] = useState<RunSheetContentPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getRunSheetContentPreviewAction(file.id).then((result) => {
      if (!cancelled) setPreview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  return (
    <Dialog open onClose={onClose} size="lg" bareBody title={file.filename}>
      <div className="h-full min-h-[50vh] rounded-[10px] bg-surface-subtle p-4">
        {!preview ? (
          <span className="flex items-center gap-2 text-label text-fg-secondary">
            <Spinner size={18} />
            {t("working")}
          </span>
        ) : preview.kind === "text" ? (
          <div className="h-full max-h-[60vh] overflow-y-auto">
            <DocPreview text={preview.text} />
          </div>
        ) : preview.kind === "pdf" ? (
          <iframe title={file.filename} src={preview.url} className="h-[60vh] w-full rounded-[8px] border border-border bg-surface" />
        ) : (
          <MessageState state="info" title={t("emptyPreview")} message={t("previewUnavailable")} />
        )}
      </div>
    </Dialog>
  );
}

function FileRow({
  file,
  sundayId,
  onUsed,
}: {
  file: RecentRunSheetData;
  sundayId: string;
  onUsed: (summary: { found: number; mapped: number; needsReview: number }) => void;
}) {
  const t = useTranslations("sunday.import");
  const tInbox = useTranslations("sunday.simple.inbox");
  const format = useFormatter();
  const { showToast } = useToast();

  const [previewing, setPreviewing] = useState(false);
  const [using, setUsing] = useState(false);
  const [opened, setOpened] = useState(Boolean(file.openedAt));

  async function handlePreview() {
    setPreviewing(true);
    await markRunSheetOpenedAction(file.id);
    setOpened(true);
  }

  async function handleUse() {
    setUsing(true);
    try {
      const result = await activateRunSheetFileAction(file.id, sundayId);
      setOpened(true);
      if (result.ok && result.summary) {
        onUsed(result.summary);
      } else {
        showToast({ state: "error", title: tInbox("failedTitle"), message: tInbox("failedBody") });
      }
    } finally {
      setUsing(false);
    }
  }

  const received = new Date(file.receivedAt);
  const receivedLabel = `${format.dateTime(received, "dateMedium")} · ${format.dateTime(received, "time")}`;

  return (
    <li className="flex items-center gap-3 rounded-md bg-surface-subtle p-3.5">
      <FileText aria-hidden="true" size={24} className="shrink-0 text-fg-secondary" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          {!opened ? (
            <span className="inline-flex size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          ) : null}
          <span className="truncate text-label font-bold text-fg">{file.filename}</span>
          {!opened ? <span className="sr-only">{t("newFile")}</span> : null}
        </span>
        <span className="truncate text-caption text-fg-secondary">
          {t("receivedOn", { date: receivedLabel })} · {file.sourceType === "email" ? t("sourceEmail") : t("sourceManual")}
        </span>
      </div>
      <Button variant="ghost" size="sm" aria-label={t("previewFile", { filename: file.filename })} onClick={handlePreview}>
        <Eye aria-hidden="true" size={20} />
      </Button>
      <Button variant="primary" size="sm" onClick={handleUse} loading={using}>
        {using ? t("working") : t("useThisFile")}
      </Button>

      {previewing ? <PreviewDialog file={file} onClose={() => setPreviewing(false)} /> : null}
    </li>
  );
}

/** Near-full-screen "Import announcements" modal: upload on the left, recent files on the right. */
export function ImportModal({ open, sundayId, recentFiles, onClose, onUploaded, onApplied }: ImportModalProps) {
  const t = useTranslations("sunday.import");
  const tCommon = useTranslations("common");
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      await uploadRunSheetAction(formData, sundayId);
      onUploaded();
    } finally {
      setUploading(false);
    }
  }

  function handleUsed(summary: { found: number; mapped: number; needsReview: number }) {
    showToast({ state: "success", title: t("title"), message: t("applied", { count: summary.found, review: summary.needsReview }) });
    onApplied(summary);
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg" bareBody title={t("title")} actions={<Button variant="secondary" onClick={onClose}>{tCommon("close")}</Button>}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-3">
          <Dropzone
            title={t("dropTitle")}
            hint={t("dropHint")}
            chooseFileLabel={tCommon("chooseFile")}
            accept=".docx,.pdf"
            maxSizeMb={10}
            disabled={uploading}
            onFile={handleFile}
          />
          {uploading ? (
            <span className="flex items-center gap-2 text-label text-fg-secondary">
              <Spinner size={18} />
              {t("working")}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-h3 font-bold text-fg">{t("recentFiles")}</h3>
          {recentFiles.length === 0 ? (
            <p className="text-label text-fg-secondary">{t("noFilesYet")}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentFiles.map((file) => (
                <FileRow key={file.id} file={file} sundayId={sundayId} onUsed={handleUsed} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
