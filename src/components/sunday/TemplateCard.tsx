"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { SlidePreview } from "./SlidePreview";
import { makeTemplateSampleSlide } from "./slideSample";

export type TemplateCardProps = {
  template: Template;
  backgroundColorHex: string | null;
  assets: ResolvedAsset[];
  onClick: () => void;
  disabled?: boolean;
};

/** Figma "Template Card" (Add Slide / Template Library, 310×174 thumbnail variant). */
export function TemplateCard({ template, backgroundColorHex, assets, onClick, disabled }: TemplateCardProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("sunday.addSlide");
  const tCategories = useTranslations("sunday.addSlide.categories");
  const tStatus = useTranslations("status");
  const name = locale === "fr-CA" ? template.nameFr : template.nameEn;
  const slide = makeTemplateSampleSlide(template, locale);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={t("use", { name })}
      className="flex flex-col gap-3 rounded-lg text-left disabled:pointer-events-none disabled:opacity-50"
    >
      <div className="aspect-video w-full overflow-hidden rounded-[12px] border border-border">
        <SlidePreview template={template} slide={slide} backgroundColorHex={backgroundColorHex} assets={assets} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-label font-bold text-fg">{name}</p>
        <p className="text-caption text-fg-secondary">
          {t("cardMeta", { category: tCategories(template.category), status: tStatus(template.status) })}
        </p>
      </div>
    </button>
  );
}
