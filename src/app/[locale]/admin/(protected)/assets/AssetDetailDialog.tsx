"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { setAssetAllowedTemplatesAction, updateAssetAction } from "./actions";
import type { Asset, AssetCategory, AssetStatus } from "@/lib/domain/types";

const CATEGORY_OPTIONS: AssetCategory[] = ["photography", "backgrounds", "special"];
const STATUS_OPTIONS: AssetStatus[] = ["draft", "published", "archived"];

export type TemplateOption = { id: string; nameEn: string; nameFr: string; allowedAssetIds: string[] };

export function AssetDetailDialog({
  asset,
  assetUrl,
  templates,
  onClose,
}: {
  asset: Asset;
  assetUrl: string;
  templates: TemplateOption[];
  onClose: () => void;
}) {
  const t = useTranslations("admin.assets");
  const tTemplates = useTranslations("admin.templates");
  const tCommon = useTranslations("common");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nameEn, setNameEn] = useState(asset.nameEn);
  const [nameFr, setNameFr] = useState(asset.nameFr);
  const [category, setCategory] = useState<AssetCategory>(asset.category);
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [focalX, setFocalX] = useState(asset.focalX);
  const [focalY, setFocalY] = useState(asset.focalY);
  const [allowedTemplateIds, setAllowedTemplateIds] = useState<string[]>(
    templates.filter((tpl) => tpl.allowedAssetIds.includes(asset.id)).map((tpl) => tpl.id),
  );

  const focalPointStyle = useMemo(
    () => ({ left: `${focalX * 100}%`, top: `${focalY * 100}%` }),
    [focalX, focalY],
  );

  function handlePickFocal(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setFocalX(Number(x.toFixed(3)));
    setFocalY(Number(y.toFixed(3)));
  }

  function handleSave() {
    startTransition(async () => {
      const tagList = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      await updateAssetAction(asset.id, {
        nameEn,
        nameFr,
        category,
        status,
        tags: tagList,
        focalX,
        focalY,
      });
      await setAssetAllowedTemplatesAction(asset.id, allowedTemplateIds);
      showToast({ state: "success", title: t("saved"), message: tCommon("saveChanges") });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onClose={onClose} title={nameEn} className="max-w-[640px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-bold text-fg-secondary">{t("focalPoint")}</span>
          <button
            type="button"
            onClick={handlePickFocal}
            className="relative block aspect-video w-full overflow-hidden rounded-md border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl} alt="" className="h-full w-full object-cover" />
            <span
              aria-hidden="true"
              className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
              style={focalPointStyle}
            />
          </button>
          <p className="text-caption text-fg-secondary">{t("focalPointHelper")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input id="asset-name-en" label={t("nameEn")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Input id="asset-name-fr" label={t("nameFr")} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="asset-category"
            label={t("category")}
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory)}
            options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
          />
          <Select
            id="asset-status"
            label={t("status")}
            value={status}
            onChange={(e) => setStatus(e.target.value as AssetStatus)}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`filters.${s}`) }))}
          />
        </div>
        <Input id="asset-tags" label={t("tags")} value={tags} onChange={(e) => setTags(e.target.value)} />

        <div className="flex flex-col gap-2">
          <span className="text-caption font-bold text-fg-secondary">{t("allowedTemplates")}</span>
          <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-caption text-fg-secondary">{tTemplates("empty")}</p>
            ) : (
              templates.map((tpl) => (
                <label key={tpl.id} className="flex items-center gap-2.5 text-label text-fg">
                  <input
                    type="checkbox"
                    checked={allowedTemplateIds.includes(tpl.id)}
                    onChange={(e) =>
                      setAllowedTemplateIds((current) =>
                        e.target.checked ? [...current, tpl.id] : current.filter((id) => id !== tpl.id),
                      )
                    }
                  />
                  {tpl.nameEn}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button variant="primary" loading={isPending} onClick={handleSave}>
            {tCommon("saveChanges")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
