"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { MappingDialog } from "./MappingDialog";
import { dismissSuggestionAction } from "./actions";
import type { MappingSuggestion, MappingWithDetails, TemplateWithFields } from "@/lib/data";
import type { ParsedAnnouncement } from "@/lib/domain/types";

function ImportFromRunSheetDialog({
  open,
  onClose,
  announcements,
  onCreateFrom,
}: {
  open: boolean;
  onClose: () => void;
  announcements: ParsedAnnouncement[];
  onCreateFrom: (headline: string) => void;
}) {
  const t = useTranslations("admin.mappings");
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onClose={onClose} title={t("importFromRunSheet")} className="max-w-[520px]">
      <div className="flex flex-col gap-3">
        {announcements.length === 0 ? (
          <p className="text-label text-fg-secondary">{t("importEmpty")}</p>
        ) : (
          announcements.map((announcement, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
            >
              <p className="min-w-0 truncate text-label text-fg">{announcement.headline || announcement.sourceText}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  onCreateFrom(announcement.headline || announcement.sourceText);
                  onClose();
                }}
              >
                {t("createFromSuggestion")}
              </Button>
            </div>
          ))
        )}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("close")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function MappingsClient({
  mappings,
  suggestions,
  templates,
  unmappedAnnouncements,
}: {
  mappings: MappingWithDetails[];
  suggestions: MappingSuggestion[];
  templates: TemplateWithFields[];
  unmappedAnnouncements: ParsedAnnouncement[];
}) {
  const t = useTranslations("admin.mappings");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<MappingWithDetails | null>(null);
  const [prefillName, setPrefillName] = useState<string | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);

  function openCreate(prefill?: string) {
    setEditingMapping(null);
    setPrefillName(prefill);
    setDialogOpen(true);
  }

  function openEdit(mapping: MappingWithDetails) {
    setEditingMapping(mapping);
    setPrefillName(undefined);
    setDialogOpen(true);
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      await dismissSuggestionAction(id);
      showToast({ state: "success", title: t("dismiss"), message: "" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            {t("importFromRunSheet")}
          </Button>
          <Button variant="primary" onClick={() => openCreate()}>
            {t("new")}
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-1.5">
        <p className="text-label text-fg-secondary">{t("infoLine1")}</p>
        <p className="text-caption text-fg-secondary">{t("infoLine2")}</p>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                {(["canonical", "aliases", "template", "status"] as const).map((col) => (
                  <th key={col} className="px-5 py-3 text-caption font-bold text-fg-secondary">
                    {t(`columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-label text-fg-secondary">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr
                    key={mapping.id}
                    className="h-[64px] cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-subtle"
                    onClick={() => openEdit(mapping)}
                  >
                    <td className="px-5 text-label font-bold text-fg">{mapping.canonicalName}</td>
                    <td className="px-5 text-label text-fg-secondary">{mapping.aliases.map((a) => a.alias).join(" · ")}</td>
                    <td className="px-5 text-label text-fg-secondary">
                      {mapping.templateName
                        ? `${(isFr ? mapping.templateName.fr : mapping.templateName.en) || ""}`
                        : "—"}
                    </td>
                    <td className="px-5">
                      <StatusBadge status={mapping.active ? "active" : "draft"} />
                    </td>
                  </tr>
                ))
              )}

              {suggestions.map((suggestion) => (
                <tr key={suggestion.id} className="h-[64px] border-b border-border last:border-b-0 bg-info-bg/40">
                  <td className="px-5" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status="suggested" />
                      <span className="text-label text-fg">{t("suggestedBody", { text: suggestion.sourceText })}</span>
                    </div>
                  </td>
                  <td className="px-5" colSpan={2}>
                    <div className="flex items-center justify-end gap-2.5">
                      <Button variant="ghost" onClick={() => handleDismiss(suggestion.id)}>
                        {t("dismiss")}
                      </Button>
                      <Button variant="secondary" onClick={() => openCreate(suggestion.sourceText)}>
                        {t("createFromSuggestion")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <MappingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mapping={editingMapping}
        templates={templates}
        prefillCanonicalName={prefillName}
      />

      <ImportFromRunSheetDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        announcements={unmappedAnnouncements}
        onCreateFrom={(headline) => openCreate(headline)}
      />
    </div>
  );
}
