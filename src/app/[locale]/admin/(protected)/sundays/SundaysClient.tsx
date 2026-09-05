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
  inboundEmail,
  initialUploadOpen,
}: {
  sundays: SundayListItem[];
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

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
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
                  <tr key={sunday.id} className="h-[72px] border-b border-border last:border-b-0 hover:bg-surface-subtle">
                    <td className="px-5">
                      <Link href={`/admin/sundays/${sunday.id}`} className="text-label font-bold text-fg hover:underline">
                        {format.dateTime(new Date(`${sunday.serviceDate}T00:00:00`), "dateMedium")}
                      </Link>
                    </td>
                    <td className="px-5 text-label text-fg-secondary">{sourceLabel}</td>
                    <td className="px-5">
                      <StatusBadge status={SUNDAY_STATUS_MAP[sunday.status]} />
                    </td>
                    <td className="px-5">
                      <div className="flex items-center gap-2">
                        <span className="text-label text-fg">{tCommon("slidesCount", { count: sunday.slideCounts.total })}</span>
                        {sunday.slideCounts.needsReview > 0 ? <StatusBadge status="needsReview" /> : null}
                      </div>
                    </td>
                    <td className="px-5 text-label text-fg-secondary">{updatedLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 text-caption text-fg-secondary">
          <span className="font-bold text-fg">{t("inboundEmail")}</span>
          <span>{inboundEmail ? t("inboundEmailBody", { address: inboundEmail }) : t("inboundNotConfigured")}</span>
        </div>
      </Card>

      <UploadRunSheetDialog key={uploadOpen ? "open" : "closed"} open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
