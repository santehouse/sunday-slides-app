"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Slide, TemplateCategory } from "@/lib/domain/types";
import type { TemplateWithFields } from "@/lib/data";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { TemplateCard } from "@/components/sunday/TemplateCard";
import { createSlideFromTemplateAction } from "@/app/[locale]/(sunday)/sunday/[date]/actions";

const CATEGORIES: TemplateCategory[] = ["general", "events", "special", "giving", "welcome", "theme", "closing"];

export type SlideAddPanelProps = {
  sundayId: string;
  date: string;
  templates: TemplateWithFields[];
  assets: ResolvedAsset[];
  onCreated: (slide: Slide) => void;
  onCancel: () => void;
};

/**
 * Step 2's "Add a slide" panel — a template picker inline in the edit column, replacing
 * the old full-page `/add` screen. Picking a card creates the slide and hands it back to
 * the parent, which loads it straight into `SlideEditPanel`.
 */
export function SlideAddPanel({ sundayId, date, templates, assets, onCreated, onCancel }: SlideAddPanelProps) {
  const t = useTranslations("sunday.simple.add");
  const tCategories = useTranslations("sunday.addSlide.categories");
  const [category, setCategory] = useState<"all" | TemplateCategory>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const options = [
    { value: "all", label: tCategories("all") },
    ...CATEGORIES.map((value) => ({ value, label: tCategories(value) })),
  ];

  const visible = category === "all" ? templates : templates.filter((tpl) => tpl.category === category);

  async function handlePick(templateId: string) {
    setPendingId(templateId);
    try {
      const slide = await createSlideFromTemplateAction(sundayId, date, templateId);
      onCreated(slide);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex h-10 items-center justify-between gap-3">
        <h2 className="text-h3 font-bold text-fg">{t("title")}</h2>
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <p className="text-caption text-fg-secondary">{t("helper")}</p>

      <FilterChips options={options} value={category} onChange={(v) => setCategory(v as "all" | TemplateCategory)} aria-label={t("title")} />

      {visible.length === 0 ? (
        <p className="text-label text-fg-secondary">{t("noTemplates")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              backgroundColorHex={null}
              assets={assets}
              onClick={() => handlePick(template.id)}
              disabled={pendingId !== null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
