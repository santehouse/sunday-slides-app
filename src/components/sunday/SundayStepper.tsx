import { CircleCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import type { SundayStepperData } from "@/lib/sunday/view";

export type SundayStepperStep = "runSheet" | "check" | "download";

export type SundayStepperProps = {
  date: string;
  locale: string;
  data: SundayStepperData;
  active: SundayStepperStep;
};

type Tone = "done" | "attention" | "default";

const TONE_CLASSES: Record<Tone, string> = {
  done: "bg-success-bg text-success-fg",
  attention: "bg-warning-bg text-warning-fg",
  default: "bg-surface-subtle text-fg-secondary",
};

/**
 * The header block for every Simplified Sunday IA screen: the Sunday's title, an
 * optional "Switch to …" link when another Sunday is also in progress, and the
 * 3-step stepper (Run sheet → Check slides → Download) that replaces the old tab strip.
 */
export async function SundayStepper({ date, locale, data, active }: SundayStepperProps) {
  const t = await getTranslations({ locale, namespace: "sunday.simple.stepper" });
  const tDashboard = await getTranslations({ locale, namespace: "sunday.dashboard" });
  const format = await getFormatter({ locale });

  const steps: {
    key: SundayStepperStep;
    href: string;
    label: string;
    tone: Tone;
    status: string;
  }[] = [
    {
      key: "runSheet",
      href: `/sunday/${date}/run-sheet`,
      label: t("step1Label"),
      tone: data.runSheet.state === "used" ? "done" : data.runSheet.state === "new" ? "attention" : "default",
      status:
        data.runSheet.state === "used"
          ? t("runSheetUsed", { file: data.runSheet.file ?? "" })
          : data.runSheet.state === "new"
            ? t("runSheetNew")
            : t("runSheetNone"),
    },
    {
      key: "check",
      href: `/sunday/${date}`,
      label: t("step2Label"),
      tone: data.check.state === "allGood" ? "done" : data.check.state === "toCheck" ? "attention" : "default",
      status:
        data.check.state === "allGood"
          ? t("checkAllGood")
          : data.check.state === "toCheck"
            ? t("checkToCheck", { count: data.check.count })
            : t("checkEmpty"),
    },
    {
      key: "download",
      href: `/sunday/${date}/download`,
      label: t("step3Label"),
      tone: data.download.state === "ready" ? "done" : data.download.state === "blocked" ? "attention" : "default",
      status:
        data.download.state === "ready"
          ? t("downloadReady")
          : data.download.state === "blocked"
            ? t("downloadBlocked", { count: data.download.count })
            : t("downloadEmpty"),
    },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[28px] font-bold leading-tight text-fg">
          {tDashboard("title", { date: serviceDateToDate(date) })}
        </h1>
        {data.switchTo ? (
          <Link href={`/sunday/${data.switchTo.date}`} className="text-label font-bold text-primary hover:underline">
            {t("switchTo", { date: format.dateTime(serviceDateToDate(data.switchTo.date), "sundayShort") })}
          </Link>
        ) : null}
      </div>

      <nav aria-label={tDashboard("title", { date: serviceDateToDate(date) })} className="grid grid-cols-3 gap-3.5">
        {steps.map((step, index) => {
          const isActive = step.key === active;
          return (
            <Link
              key={step.key}
              href={step.href}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-surface p-3.5 transition-colors duration-[250ms]",
                isActive ? "border-primary" : "border-border hover:bg-surface-subtle",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-label font-bold",
                  TONE_CLASSES[step.tone],
                )}
              >
                {step.tone === "done" ? <CircleCheck aria-hidden="true" size={20} /> : index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-label font-bold text-fg">{step.label}</span>
                <span className="truncate text-caption text-fg-secondary">{step.status}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
