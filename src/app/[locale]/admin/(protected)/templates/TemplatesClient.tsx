"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
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

const TEMPLATE_STATUS_BADGE: Record<TemplateStatus, StatusBadgeStatus> = {
  published: "published",
  draft: "draft",
  archived: "archived",
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
  const name = isFr ? template.nameFr : template.nameEn;
  const sampleContent = useMemo(() => {
    const content: Record<string, string> = {};
    for (const field of template.fields) {
      content[field.fieldKey] = field.fieldKey === "headline" ? name.toUpperCase() : field.labelEn;
    }
    return content;
  }, [template.fields, name]);

  return (
    <Link
      href={`/admin/templates/${template.id}`}
      className="flex w-[257px] flex-col gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong"
    >
      <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-surface-subtle">
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
      <div className="flex flex-col gap-1">
        <p className="truncate text-label font-bold text-fg">{name}</p>
        <p className="text-caption text-fg-secondary">{categoryLabel}</p>
        <StatusBadge status={TEMPLATE_STATUS_BADGE[template.status]} className="w-fit" />
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
              categoryLabel={`${t(`categories.${template.category}`)} · ${t(`filters.${template.status}`)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
