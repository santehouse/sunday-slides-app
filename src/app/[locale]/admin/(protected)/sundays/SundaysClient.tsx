"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { CreateSundayDialog } from "@/components/admin/CreateSundayDialog";
import { UploadRunSheetDialog } from "@/components/admin/UploadRunSheetDialog";
import type { SundayListItem } from "@/lib/data";
import type { RunSheet } from "@/lib/domain/types";
import { serviceDateToDate } from "@/lib/utils/serviceDate";

const PARSE_STATUS_MAP: Record<RunSheet["parseStatus"], StatusBadgeStatus> = {
  queued: "queued",
  processing: "processing",
  ready_to_apply: "apply",
  added_to_flow: "added",
  needs_review: "needsReview",
  failed: "failed",
};

const SUNDAY_STATUS_MAP: Record<SundayListItem["status"], StatusBadgeStatus> = {
  draft: "draft",
  needs_review: "needsReview",
  ready: "ready",
  exported: "exported",
};

function isToday(iso: string): boolean {
  const a = new Date(iso).toDateString();
  const b = new Date().toDateString();
  return a === b;
}

export function SundaysClient({
  sundays,
  recentRunSheets,
  inboundEmail,
  initialUploadOpen,
}: {
  sundays: SundayListItem[];
  recentRunSheets: RunSheet[];
  inboundEmail: string | null;
  initialUploadOpen: boolean;
}) {
  const t = useTranslations("admin.sundays");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [uploadOpen, setUploadOpen] = useState(initialUploadOpen);

  const rows = useMemo(
    () =>
      sundays.map((sunday) => ({
        sunday,
        sourceLabel: sunday.latestRunSheet
          ? sunday.latestRunSheet.sourceType === "email"
            ? t("sourceEmail", { file: sunday.latestRunSheet.originalFilename })
            : t("sourceManual", { file: sunday.latestRunSheet.originalFilename })
          : t("sourceNone"),
        updatedLabel: isToday(sunday.updatedAt)
          ? `${tCommon("today")} ${format.dateTime(new Date(sunday.updatedAt), "time")}`
          : format.dateTime(new Date(sunday.updatedAt), "dateMedium"),
      })),
    [sundays, t, tCommon, format],
  );

  const sundayById = useMemo(() => new Map(sundays.map((sunday) => [sunday.id, sunday])), [sundays]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            {t("uploadRunSheet")}
          </Button>
          <CreateSundayDialog />
        </div>
      </div>

      {/* Every received/uploaded file, newest first — never filtered by date. Any of them can
          be used for the current service from the Sunday screen's Import modal. */}
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-h3 font-bold text-fg">{t("receivedFiles")}</h2>
          <p className="text-caption text-fg-secondary">{t("receivedFilesHelper")}</p>
        </div>
        {recentRunSheets.length === 0 ? (
          <p className="text-caption text-fg-secondary">{t("noReceivedFiles")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentRunSheets.map((runSheet) => {
              const filedUnder = sundayById.get(runSheet.sundayId);
              const received = new Date(runSheet.receivedAt);
              return (
                <li key={runSheet.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-subtle px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-label font-bold text-fg">{runSheet.originalFilename}</p>
                    <p className="truncate text-caption text-fg-secondary">
                      {format.dateTime(received, "dateMedium")} · {format.dateTime(received, "time")} ·{" "}
                      {runSheet.sourceType === "email" ? t("sourceTypeEmail") : t("sourceTypeManual")}
                      {filedUnder ? ` · ${t("filedUnder", { date: format.dateTime(serviceDateToDate(filedUnder.serviceDate), "dateMedium") })}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={PARSE_STATUS_MAP[runSheet.parseStatus]} />
                    <a
                      href={`/api/run-sheets/${runSheet.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-label font-bold text-primary hover:underline"
                    >
                      {t("openFile")}
                    </a>
                    {filedUnder ? (
                      <Link href={`/admin/sundays/${filedUnder.id}`} className="text-label font-bold text-fg hover:underline">
                        {t("openSunday")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr>
                {(["sunday", "source", "status", "slides", "updated"] as const).map((col) => (
                  <th key={col} className="px-5 py-3 text-caption font-bold text-fg-secondary">
                    {t(`columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-label text-fg-secondary">
                    {t("emptyTable")}
                  </td>
                </tr>
              ) : (
                rows.map(({ sunday, sourceLabel, updatedLabel }) => (
                  <tr key={sunday.id} className="h-[72px] [&>td]:bg-surface-subtle [&>td:first-child]:rounded-l-[10px] [&>td:last-child]:rounded-r-[10px] hover:[&>td]:bg-border/60">
                    <td className="px-5">
                      <Link href={`/admin/sundays/${sunday.id}`} className="text-label font-bold text-fg hover:underline">
                        {format.dateTime(serviceDateToDate(sunday.serviceDate), "dateMedium")}
                      </Link>
                    </td>
                    <td className="px-5 text-label text-fg-secondary">{sourceLabel}</td>
                    <td className="px-5">
                      <StatusBadge status={SUNDAY_STATUS_MAP[sunday.status]} />
                    </td>
                    <td className="px-5 text-label font-bold text-fg">{sunday.slideCounts.total}</td>
                    <td className="px-5 text-label text-fg-secondary">{updatedLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="m-5 mt-2 flex flex-col gap-1 rounded-[10px] bg-info-bg px-4 py-3.5">
          <span className="text-caption font-bold text-info-fg">{t("inboundEmail")}</span>
          <span className="text-caption text-fg-secondary">
            {inboundEmail ? t("inboundEmailBody", { address: inboundEmail }) : t("inboundNotConfigured")}
          </span>
        </div>
      </Card>

      <UploadRunSheetDialog key={uploadOpen ? "open" : "closed"} open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
