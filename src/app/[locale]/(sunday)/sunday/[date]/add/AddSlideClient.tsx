"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { TemplateCategory } from "@/lib/domain/types";
import type { TemplateWithFields } from "@/lib/data";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { FilterChips } from "@/components/ui/FilterChips";
import { TemplateCard } from "@/components/sunday/TemplateCard";
import { addSlideAction } from "./actions";

const CATEGORIES: TemplateCategory[] = ["general", "events", "special", "giving", "welcome", "theme", "closing"];

export type AddSlideClientProps = {
  sundayId: string;
  date: string;
  templates: TemplateWithFields[];
  assets: ResolvedAsset[];
};

export function AddSlideClient({ sundayId, date, templates, assets }: AddSlideClientProps) {
  const t = useTranslations("sunday.addSlide");
  const tCategories = useTranslations("sunday.addSlide.categories");
  const [category, setCategory] = useState<"all" | TemplateCategory>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const options = [
    { value: "all", label: tCategories("all") },
    ...CATEGORIES.map((value) => ({ value, label: tCategories(value) })),
  ];

  const visible = category === "all" ? templates : templates.filter((tpl) => tpl.category === category);

  function handlePick(templateId: string) {
    setPendingId(templateId);
    // `addSlideAction` redirects on success — its special NEXT_REDIRECT throw must
    // propagate uncaught for Next.js to perform the navigation.
    startTransition(() => {
      void addSlideAction(sundayId, date, templateId);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterChips options={options} value={category} onChange={(v) => setCategory(v as "all" | TemplateCategory)} aria-label={t("chooseTemplate")} />

      {visible.length === 0 ? (
        <p className="text-label text-fg-secondary">{t("noTemplates")}</p>
      ) : (
        <div className="grid grid-cols-4 gap-4">
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
