"use client";

/** Figma "Export Popover" (node 52:691) — anchored to the Sunday Flow "Export" trigger. */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { Slide, Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { formatSlideRange, parseSlideRange } from "@/lib/engines/exportRange";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MessageState } from "@/components/ui/MessageState";
import { Popover } from "@/components/ui/Popover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { SlidePreview } from "./SlidePreview";
import type { ExportBlocked, ExportRequest } from "@/lib/sunday/contracts";

type ExportFormat = ExportRequest["format"];
type ExportScope = ExportRequest["scope"];

export type ExportPopoverProps = {
  sundayId: string;
  slides: Slide[];
  templatesById: Record<string, Template>;
  colorHexById: Record<string, string>;
  assets: ResolvedAsset[];
  currentSlideId: string | null;
};

function extractFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const plainMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return plainMatch?.[1] ?? fallback;
}

export function ExportPopover({
  sundayId,
  slides,
  templatesById,
  colorHexById,
  assets,
  currentSlideId,
}: ExportPopoverProps) {
  const t = useTranslations("sunday.export");
  const tFlow = useTranslations("sunday.flow");
  const { showToast } = useToast();

  const [format, setFormat] = useState<ExportFormat>("jpg");
  const [scope, setScope] = useState<ExportScope>("all");
  const [rangeText, setRangeText] = useState("");
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [rangeError, setRangeError] = useState<"invalid" | "out_of_bounds" | "empty" | null>(null);
  const [loading, setLoading] = useState(false);

  const total = slides.length;

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

  function resolvedSelection(): Slide[] {
    if (scope === "current") {
      return currentSlideId ? slides.filter((s) => s.id === currentSlideId) : [];
    }
    if (scope === "all") return slides;
    return selectedNumbers.map((n) => slides[n - 1]).filter((s): s is Slide => Boolean(s));
  }

  const selection = resolvedSelection();
  const invalidSelected = selection.filter((s) => s.status === "invalid");
  const excludedCount = format === "mp4" ? selection.filter((s) => !s.includeInVideo).length : 0;
  const hasCustomError = scope === "custom" && (rangeError !== null || selection.length === 0);
  const exportDisabled = selection.length === 0 || invalidSelected.length > 0 || hasCustomError || loading;

  const rangeErrorMessage =
    rangeError === "invalid"
      ? t("rangeInvalid")
      : rangeError === "out_of_bounds"
        ? t("rangeOutOfBounds", { max: total })
        : rangeError === "empty"
          ? t("rangeEmpty")
          : undefined;

  async function handleExport(close: () => void) {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { sundayId, format, scope };
      if (scope === "custom") body.slideNumbers = selectedNumbers;
      if (scope === "current" && currentSlideId) body.currentSlideId = currentSlideId;

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let mapped = t("failed");
        try {
          const errorBody = (await res.json()) as ExportBlocked;
          if (errorBody.error === "text_overflow") mapped = t("blockedByTextFit", { count: errorBody.slideIds?.length ?? 1 });
          else if (errorBody.error === "missing_required") mapped = t("blockedByMissingField");
          else if (errorBody.error === "nothing_to_export") mapped = t("nothingToExport");
          else if (errorBody.error === "encode_failed") mapped = t("mp4Failed");
        } catch {
          // fall through to generic failed message
        }
        showToast({ state: "error", title: t("failed"), message: mapped });
        return;
      }

      const blob = await res.blob();
      const filename = extractFilename(res.headers.get("Content-Disposition"), `export.${format === "mp4" ? "mp4" : "zip"}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      showToast({ state: "success", title: t("done"), message: filename });
      close();
    } catch {
      showToast({ state: "error", title: t("failed"), message: t("failed") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover
      align="end"
      trigger={(triggerProps) => {
        const { open: _open, toggle, ...buttonProps } = triggerProps;
        void _open;
        return (
          <Button variant="primary" onClick={toggle} {...buttonProps}>
            {tFlow("export")}
            <ChevronDown aria-hidden="true" size={16} />
          </Button>
        );
      }}
      panelClassName="w-[380px]"
    >
      {({ close }) => (
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-bold text-fg">{t("title")}</h2>

          <div className="flex flex-col gap-1.5">
            <p className="text-caption font-bold text-fg-secondary">{t("format")}</p>
            <SegmentedControl
              ariaLabel={t("format")}
              size="sm"
              equalWidth
              value={format}
              onChange={setFormat}
              options={[
                { value: "jpg", label: t("jpg") },
                { value: "mp4", label: t("mp4") },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-caption font-bold text-fg-secondary">{t("slides")}</p>
            <div role="radiogroup" aria-label={t("slides")} className="flex flex-col gap-1">
              {(["current", "all", "custom"] as ExportScope[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={scope === option}
                  onClick={() => setScope(option)}
                  className={cn(
                    "flex h-[34px] items-center rounded-[8px] px-2.5 text-left text-label font-bold",
                    scope === option ? "border border-primary bg-surface-subtle text-fg" : "text-fg-secondary hover:bg-surface-subtle",
                  )}
                >
                  {option === "current" ? t("currentSlide") : option === "all" ? t("allSlides") : t("customSlides")}
                </button>
              ))}
            </div>
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
              <div className="grid grid-cols-4 gap-2">
                {slides.map((slide, index) => {
                  const number = index + 1;
                  const selected = selectedNumbers.includes(number);
                  const template = templatesById[slide.templateId];
                  const muted = format === "mp4" && !slide.includeInVideo;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={t("selectSlideThumb", { number })}
                      onClick={() => toggleThumb(number)}
                      className={cn(
                        "relative h-11 w-[76px] overflow-hidden rounded-[6px] border",
                        selected ? "border-2 border-primary bg-surface-subtle" : "border-border",
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

          {excludedCount > 0 ? (
            <MessageState state="info" title={t("slides")} message={t("excludedNotice", { count: excludedCount })} />
          ) : null}

          {invalidSelected.length > 0 ? (
            <MessageState
              state="error"
              title={t("failed")}
              message={t("blockedByTextFit", { count: invalidSelected.length })}
            />
          ) : null}

          <Button
            variant="primary"
            className="w-full justify-center"
            disabled={exportDisabled}
            loading={loading}
            onClick={() => handleExport(close)}
          >
            {format === "jpg" ? t("exportJpg") : t("exportMp4")}
          </Button>
        </div>
      )}
    </Popover>
  );
}
