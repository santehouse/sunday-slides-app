"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TemplateCategory } from "@/lib/domain/types";
import type { TemplateWithFields } from "@/lib/data";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { FilterChips } from "@/components/ui/FilterChips";
import { TemplateCard } from "@/components/sunday/TemplateCard";

const CATEGORIES: TemplateCategory[] = ["general", "events", "special", "giving", "welcome", "theme", "closing"];

export type SlideAddPanelProps = {
  templates: TemplateWithFields[];
  assets: ResolvedAsset[];
  /** Creates the slide for the picked template — the caller owns the server action and
      what happens next (the New slide modal swaps to the edit form). */
  onPick: (templateId: string) => Promise<void>;
};

/** Template picker — first step of the "New slide" modal. Picking a card creates the slide. */
export function SlideAddPanel({ templates, assets, onPick }: SlideAddPanelProps) {
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
      await onPick(templateId);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
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
