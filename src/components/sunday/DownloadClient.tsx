"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Film, Images } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Slide, Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";
import type { ExportBlocked } from "@/lib/sunday/contracts";
import { formatSlideRange, parseSlideRange } from "@/lib/engines/exportRange";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DurationStepper } from "@/components/ui/DurationStepper";
import { Input } from "@/components/ui/Input";
import { MessageState } from "@/components/ui/MessageState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { updateHoldSecondsAction } from "@/app/[locale]/(sunday)/sunday/[date]/download/actions";

export type DownloadClientProps = {
  date: string;
  sundayId: string;
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  assets: ResolvedAsset[];
  initialHoldSeconds: number;
};

type Format = "jpg" | "mp4";

function extractFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const plainMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return plainMatch?.[1] ?? fallback;
}

function DownloadClientInner({ date, sundayId, slides, templatesById, colorHexById, assets, initialHoldSeconds }: DownloadClientProps) {
  const t = useTranslations("sunday.simple.download");
  const tErrors = useTranslations("sunday.export");
  const { showToast } = useToast();
  const router = useRouter();

  const [holdSeconds, setHoldSeconds] = useState(initialHoldSeconds);
  const [, startTransition] = useTransition();
  const [downloadingFormat, setDownloadingFormat] = useState<Format | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced/custom-selection state (lifted from the old ExportPopover).
  const [advFormat, setAdvFormat] = useState<Format>("jpg");
  const [scope, setScope] = useState<"all" | "custom">("all");
  const [rangeText, setRangeText] = useState("");
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [rangeError, setRangeError] = useState<"invalid" | "out_of_bounds" | "empty" | null>(null);
  const [advDownloading, setAdvDownloading] = useState(false);

  const total = slides.length;
  const invalidSlides = slides.filter((s) => s.status === "invalid");
  const blocked = invalidSlides.length > 0;
  const includedInVideo = slides.filter((s) => s.includeInVideo);
  const hiddenFromVideo = total - includedInVideo.length;
  const totalVideoSeconds = includedInVideo.length * holdSeconds;

  function handleHoldChange(next: number) {
    const previous = holdSeconds;
    setHoldSeconds(next);
    startTransition(async () => {
      try {
        const confirmed = await updateHoldSecondsAction(sundayId, next);
        setHoldSeconds(confirmed);
      } catch {
        setHoldSeconds(previous);
      }
    });
  }

  async function downloadBlob(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let mapped = t("downloadFailed");
      try {
        const errorBody = (await res.json()) as ExportBlocked;
        if (errorBody.error === "text_overflow") mapped = tErrors("blockedByTextFit", { count: errorBody.slideIds?.length ?? 1 });
        else if (errorBody.error === "missing_required") mapped = tErrors("blockedByMissingField");
        else if (errorBody.error === "nothing_to_export") mapped = tErrors("nothingToExport");
        else if (errorBody.error === "encode_failed") mapped = tErrors("mp4Failed");
      } catch {
        // fall through to generic failed message
      }
      showToast({ state: "error", title: t("downloadFailed"), message: mapped });
      return false;
    }

    const blob = await res.blob();
    const format = (body.format as Format) ?? "jpg";
    const filename = extractFilename(res.headers.get("Content-Disposition"), `export.${format === "mp4" ? "mp4" : "zip"}`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    showToast({ state: "success", title: t("downloadDone"), message: filename });
    return true;
  }

  async function handleQuickDownload(format: Format) {
    setDownloadingFormat(format);
    try {
      await downloadBlob({ sundayId, format, scope: "all" });
    } finally {
      setDownloadingFormat(null);
    }
  }

  function applyRangeText(text: string) {
    setRangeText(text);
    if (text.trim() === "") {
      setSelectedNumbers([]);
      setRangeError(null);
      return;
    }
    const result = parseSlideRange(text, total);
    if (result.ok) {
      setSelectedNumbers(result.numbers);
      setRangeError(null);
    } else {
      setRangeError(result.error);
    }
  }

  function toggleThumb(number: number) {
    const next = selectedNumbers.includes(number)
      ? selectedNumbers.filter((n) => n !== number)
      : [...selectedNumbers, number].sort((a, b) => a - b);
    setSelectedNumbers(next);
    setRangeText(formatSlideRange(next));
    setRangeError(null);
  }

  const advSelection = scope === "all" ? slides : selectedNumbers.map((n) => slides[n - 1]).filter((s): s is Slide => Boolean(s));
  const advInvalid = advSelection.filter((s) => s.status === "invalid");
  const advExcluded = advFormat === "mp4" ? advSelection.filter((s) => !s.includeInVideo).length : 0;
  const hasCustomError = scope === "custom" && (rangeError !== null || advSelection.length === 0);
  const advDisabled = advSelection.length === 0 || advInvalid.length > 0 || hasCustomError || advDownloading;

  const rangeErrorMessage =
    rangeError === "invalid"
      ? t("rangeInvalid")
      : rangeError === "out_of_bounds"
        ? t("rangeOutOfBounds", { max: total })
        : rangeError === "empty"
          ? t("rangeEmpty")
          : undefined;

  async function handleAdvancedDownload() {
    setAdvDownloading(true);
    try {
      const body: Record<string, unknown> = { sundayId, format: advFormat, scope };
      if (scope === "custom") body.slideNumbers = selectedNumbers;
      await downloadBlob(body);
    } finally {
      setAdvDownloading(false);
    }
  }

  if (total === 0) {
    return <MessageState state="info" title={t("emptyTitle")} message={t("nothingYet")} />;
  }

  if (blocked) {
    return (
      <div className="flex flex-col gap-3.5">
        <MessageState state="error" title={t("blockedTitle", { count: invalidSlides.length })} message={t("blockedBody")} />
        <div>
          <Button variant="primary" onClick={() => router.push(`/sunday/${date}`)}>
            {t("backToCheck")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-[18px]">
        <Card padding="none" className="flex flex-col items-start gap-3 p-6">
          <Images aria-hidden="true" size={28} className="text-primary" />
          <h2 className="text-h3 font-bold text-fg">{t("picturesTitle")}</h2>
          <p className="text-label text-fg-secondary">{t("picturesSubtitle", { count: total })}</p>
          <Button variant="primary" onClick={() => handleQuickDownload("jpg")} loading={downloadingFormat === "jpg"}>
            {downloadingFormat === "jpg" ? t("making") : t("picturesTitle")}
          </Button>
        </Card>

        <Card padding="none" className="flex flex-col items-start gap-3 p-6">
          <Film aria-hidden="true" size={28} className="text-primary" />
          <h2 className="text-h3 font-bold text-fg">{t("videoTitle")}</h2>
          <p className="text-label text-fg-secondary">
            {t("videoSubtitle", {
              count: includedInVideo.length,
              seconds: `${holdSeconds} sec`,
              total: `${totalVideoSeconds} sec`,
            })}
          </p>
          {hiddenFromVideo > 0 ? <p className="text-caption text-fg-secondary">{t("hiddenFromVideo", { count: hiddenFromVideo })}</p> : null}
          <Button variant="primary" onClick={() => handleQuickDownload("mp4")} loading={downloadingFormat === "mp4"}>
            {downloadingFormat === "mp4" ? t("making") : t("videoTitle")}
          </Button>
        </Card>
      </div>

      <Card padding="none" className="flex items-center p-[18px]">
        <DurationStepper value={holdSeconds} onChange={handleHoldChange} size="md" label={t("durationLabel")} />
      </Card>

      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-fit items-center gap-1.5 text-label font-bold text-fg-secondary hover:text-fg"
        >
          {t("advanced")}
          <ChevronDown aria-hidden="true" size={18} className={cn("transition-transform duration-[250ms]", advancedOpen && "rotate-180")} />
        </button>

        {advancedOpen ? (
          <Card padding="none" className="flex flex-col gap-4 p-[18px]">
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] leading-4 text-fg-secondary">{t("format")}</p>
              <SegmentedControl
                ariaLabel={t("format")}
                size="lg"
                variant="solid"
                equalWidth
                value={advFormat}
                onChange={setAdvFormat}
                options={[
                  { value: "jpg", label: t("pictures") },
                  { value: "mp4", label: t("video") },
                ]}
              />
            </div>

            <div role="radiogroup" aria-label={t("allSlides")} className="flex flex-col gap-1">
              {(["all", "custom"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={scope === option}
                  onClick={() => setScope(option)}
                  className={cn(
                    "flex h-[34px] items-center rounded-[8px] px-3 text-left text-caption text-fg",
                    scope === option ? "bg-primary-subtle font-bold" : "hover:bg-surface-subtle",
                  )}
                >
                  {option === "all" ? t("allSlides") : t("chosenSlides")}
                </button>
              ))}
            </div>

            {scope === "custom" ? (
              <div className="flex flex-col gap-3">
                <Input
                  label={t("slideNumbers")}
                  placeholder={t("rangePlaceholder")}
                  value={rangeText}
                  onChange={(event) => applyRangeText(event.target.value)}
                  error={rangeErrorMessage}
                />
                <div className="grid grid-cols-6 gap-x-2 gap-y-2.5">
                  {slides.map((slide, index) => {
                    const number = index + 1;
                    const selected = selectedNumbers.includes(number);
                    const template = templatesById[slide.templateId];
                    const muted = advFormat === "mp4" && !slide.includeInVideo;
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={t("selectSlideThumb", { number })}
                        onClick={() => toggleThumb(number)}
                        className={cn(
                          "relative h-11 w-[76px] overflow-hidden rounded-[6px]",
                          selected ? "border-[3px] border-primary" : "border border-border",
                          muted && "opacity-40",
                        )}
                      >
                        {template ? (
                          <SlidePreview
                            template={template}
                            slide={slide}
                            backgroundColorHex={slide.approvedColorId ? (colorHexById[slide.approvedColorId] ?? null) : null}
                            assets={assets}
                          />
                        ) : null}
                        <span className="absolute left-1 top-0.5 text-[10px] font-bold text-white drop-shadow">{number}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {advExcluded > 0 ? <MessageState state="info" title={t("video")} message={t("excludedNotice", { count: advExcluded })} /> : null}

            <div>
              <Button variant="primary" disabled={advDisabled} loading={advDownloading} onClick={handleAdvancedDownload}>
                {t("download")}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function DownloadClient(props: DownloadClientProps) {
  return (
    <ToastProvider>
      <DownloadClientInner {...props} />
    </ToastProvider>
  );
}
