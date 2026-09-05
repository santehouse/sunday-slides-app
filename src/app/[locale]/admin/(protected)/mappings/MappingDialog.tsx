"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { deleteMappingAction, saveMappingAction } from "./actions";
import type { MappingWithDetails, TemplateWithFields } from "@/lib/data";

export function MappingDialog({
  open,
  onClose,
  mapping,
  templates,
  prefillCanonicalName,
}: {
  open: boolean;
  onClose: () => void;
  mapping: MappingWithDetails | null;
  templates: TemplateWithFields[];
  prefillCanonicalName?: string;
}) {
  const t = useTranslations("admin.mappings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [canonicalName, setCanonicalName] = useState(mapping?.canonicalName ?? prefillCanonicalName ?? "");
  const [templateId, setTemplateId] = useState(mapping?.templateId ?? templates[0]?.id ?? "");
  const [active, setActive] = useState(mapping?.active ?? true);
  const [aliasLines, setAliasLines] = useState(mapping ? "" : "");

  function handleSave() {
    startTransition(async () => {
      const result = await saveMappingAction({
        id: mapping?.id,
        canonicalName,
        templateId,
        active,
        aliasLines: aliasLines.split("\n"),
      });
      if (result.ok) {
        showToast({ state: "success", title: t("saved"), message: result.mapping.canonicalName });
        onClose();
        router.refresh();
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: result.error });
      }
    });
  }

  function handleDelete() {
    if (!mapping) return;
    startTransition(async () => {
      await deleteMappingAction(mapping.id);
      showToast({ state: "success", title: t("deleted"), message: mapping.canonicalName });
      setConfirmDeleteOpen(false);
      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title={mapping ? mapping.canonicalName : t("new")} className="max-w-[560px]">
        <div className="flex flex-col gap-4">
          <Input
            id="mapping-canonical-name"
            label={t("canonicalName")}
            value={canonicalName}
            onChange={(e) => setCanonicalName(e.target.value)}
          />
          <Select
            id="mapping-template"
            label={t("template")}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={templates.map((tpl) => ({ value: tpl.id, label: isFr ? tpl.nameFr : tpl.nameEn }))}
          />

          {mapping && mapping.aliases.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-bold text-fg-secondary">{t("aliases")}</span>
              <div className="flex flex-wrap gap-1.5">
                {mapping.aliases.map((alias) => (
                  <span key={alias.id} className="rounded-full bg-surface-subtle px-2.5 py-1 text-caption text-fg-secondary">
                    {alias.alias}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <Textarea
            id="mapping-aliases"
            label={t("aliases")}
            helper={t("aliasesHelper")}
            rows={3}
            value={aliasLines}
            onChange={(e) => setAliasLines(e.target.value)}
          />

          <Toggle checked={active} onChange={setActive} label={t("active")} />

          <div className="flex items-center justify-between gap-2.5 pt-2">
            {mapping ? (
              <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
                {tCommon("delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2.5">
              <Button variant="secondary" onClick={onClose}>
                {tCommon("cancel")}
              </Button>
              <Button variant="primary" loading={isPending} disabled={!canonicalName || !templateId} onClick={handleSave}>
                {tCommon("saveChanges")}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {mapping ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          onConfirm={handleDelete}
          title={t("canonicalName")}
          destructive
          confirmLoading={isPending}
          confirmLabel={tCommon("delete")}
        >
          {mapping.canonicalName}
        </ConfirmDialog>
      ) : null}
    </>
  );
}
