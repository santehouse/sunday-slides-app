"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { TemplatePreview } from "@/components/admin/TemplatePreview";
import { createTemplateAction } from "./actions";
import type { TemplateWithFields } from "@/lib/data";
import type { TemplateCategory, TemplateStatus } from "@/lib/domain/types";

const STATUS_FILTERS: (TemplateStatus | "all")[] = ["all", "published", "draft", "archived"];
const CATEGORY_FILTERS: (TemplateCategory | "all")[] = [
  "all",
  "general",
  "events",
  "special",
  "giving",
  "welcome",
  "theme",
  "closing",
];

// Figma 8:317 shows the lifecycle state as coloured text under the category, not a pill.
const TEMPLATE_STATUS_TEXT: Record<TemplateStatus, string> = {
  published: "text-success-fg",
  draft: "text-fg",
  archived: "text-fg-secondary",
};

function TemplateCard({
  template,
  assetUrls,
  isFr,
  categoryLabel,
}: {
  template: TemplateWithFields;
  assetUrls: Record<string, string>;
  isFr: boolean;
  categoryLabel: string;
}) {
  const tStatus = useTranslations("status");
  const name = isFr ? template.nameFr : template.nameEn;
  // Figma 8:317 renders the template name alone in the thumbnail; filling the other
  // fields with their labels put English "Line 1 / Line 2" into the FR thumbnails.
  const sampleContent = useMemo(() => ({ headline: name.toUpperCase() }), [name]);

  return (
    <Link
      href={`/admin/templates/${template.id}`}
      className="flex w-[257px] flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong"
    >
      {/* Figma 8:317 — the render is flush to the card, three text lines below. */}
      <div className="aspect-video w-full overflow-hidden bg-surface-subtle">
        <TemplatePreview
          rendererKey={template.rendererKey}
          fields={template.fields}
          content={sampleContent}
          backgroundType={template.backgroundType}
          backgroundColorHex={template.backgroundType === "color" ? template.backgroundValue : null}
          backgroundImageUrl={template.backgroundType === "image" ? assetUrls[template.backgroundValue] : null}
          overlayColor={template.overlayColor}
          overlayOpacity={template.overlayOpacity}
        />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="truncate text-label font-bold text-fg">{name}</p>
        <p className="text-caption text-fg-secondary">{categoryLabel}</p>
        <p className={`text-caption font-bold ${TEMPLATE_STATUS_TEXT[template.status]}`}>{tStatus(template.status)}</p>
      </div>
    </Link>
  );
}

export function TemplatesClient({
  templates,
  assetUrls,
}: {
  templates: TemplateWithFields[];
  assetUrls: Record<string, string>;
}) {
  const t = useTranslations("admin.templates");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const [status, setStatus] = useState<TemplateStatus | "all">("all");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const filtered = templates.filter(
    (template) => (status === "all" || template.status === status) && (category === "all" || template.category === category),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <form action={createTemplateAction}>
          <Button type="submit" variant="primary">
            {t("create")}
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <FilterChips
          aria-label={t("filters.all")}
          value={status}
          onChange={(v) => setStatus(v as TemplateStatus | "all")}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: s === "all" ? t("filters.all") : t(`filters.${s}`) }))}
        />
        <FilterChips
          aria-label={t("category")}
          value={category}
          onChange={(v) => setCategory(v as TemplateCategory | "all")}
          options={CATEGORY_FILTERS.map((c) => ({ value: c, label: c === "all" ? t("filters.all") : t(`categories.${c}`) }))}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-label text-fg-secondary">{t("empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              assetUrls={assetUrls}
              isFr={isFr}
              // Figma 8:317: line 2 is the category alone; the status is line 3.
              categoryLabel={t(`categories.${template.category}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
