"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { Dialog } from "@/components/ui/Dialog";
import { Dropzone } from "@/components/ui/Dropzone";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { uploadAssetAction } from "./actions";
import { AssetDetailDialog, type TemplateOption } from "./AssetDetailDialog";
import type { Asset, AssetCategory, AssetStatus } from "@/lib/domain/types";

const STATUS_FILTERS: (AssetStatus | "all")[] = ["all", "published", "draft", "archived"];
const CATEGORY_FILTERS: (AssetCategory | "all")[] = ["all", "photography", "backgrounds", "special"];
const ASSET_STATUS_BADGE: Record<AssetStatus, StatusBadgeStatus> = {
  published: "published",
  draft: "draft",
  archived: "archived",
};

function UploadAssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin.assets");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const { showToast } = useToast();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [category, setCategory] = useState<AssetCategory>("photography");
  const [isPending, startTransition] = useTransition();

  function handleUpload() {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("nameEn", nameEn || file.name);
    formData.set("category", category);
    startTransition(async () => {
      const result = await uploadAssetAction(formData);
      if (result.status === "success") {
        showToast({ state: "success", title: t("saved"), message: result.asset.nameEn });
        setFile(null);
        setNameEn("");
        onClose();
        router.refresh();
      } else {
        showToast({
          state: "error",
          title: tCommon("failed"),
          message: result.status === "error" && result.message === "unsupported_file" ? tErrors("unsupportedFile") : tErrors("generic"),
        });
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("upload")}>
      <div className="flex flex-col gap-4">
        <Dropzone
          title={t("dropHere")}
          hint={t("formats", { max: 10 })}
          chooseFileLabel={tCommon("upload")}
          accept="image/jpeg,image/png,image/webp"
          maxSizeMb={10}
          onFile={setFile}
          disabled={isPending}
        />
        {file ? <p className="text-caption text-fg-secondary">{file.name}</p> : null}
        <Input id="asset-upload-name" label={t("nameEn")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <Select
          id="asset-upload-category"
          label={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value as AssetCategory)}
          options={["photography", "backgrounds", "special"].map((c) => ({ value: c, label: t(`categories.${c}`) }))}
        />
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button variant="primary" loading={isPending} disabled={!file} onClick={handleUpload}>
            {tCommon("upload")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function AssetsClient({
  assets,
  assetUrls,
  templates,
}: {
  assets: Asset[];
  assetUrls: Record<string, string>;
  templates: TemplateOption[];
}) {
  const t = useTranslations("admin.assets");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const [status, setStatus] = useState<AssetStatus | "all">("all");
  const [category, setCategory] = useState<AssetCategory | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const filtered = assets.filter(
    (asset) => (status === "all" || asset.status === status) && (category === "all" || asset.category === category),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <Button variant="primary" onClick={() => setUploadOpen(true)}>
          {t("upload")}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <FilterChips
          aria-label={t("status")}
          value={status}
          onChange={(v) => setStatus(v as AssetStatus | "all")}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: s === "all" ? t("filters.all") : t(`filters.${s}`) }))}
        />
        <FilterChips
          aria-label={t("category")}
          value={category}
          onChange={(v) => setCategory(v as AssetCategory | "all")}
          options={CATEGORY_FILTERS.map((c) => ({ value: c, label: c === "all" ? t("filters.all") : t(`categories.${c}`) }))}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-label text-fg-secondary">{t("empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {filtered.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className="flex w-[257px] flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong"
            >
              <div className="h-[160px] w-[255px] overflow-hidden rounded-md border border-border bg-surface-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrls[asset.id]}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${asset.focalX * 100}% ${asset.focalY * 100}%` }}
                />
              </div>
              <p className="truncate text-label font-bold text-fg">{isFr ? asset.nameFr : asset.nameEn}</p>
              <p className="text-caption text-fg-secondary">
                {t("meta", { category: t(`categories.${asset.category}`), status: t(`filters.${asset.status}`) })}
              </p>
              <StatusBadge status={ASSET_STATUS_BADGE[asset.status]} className="w-fit" />
            </button>
          ))}
        </div>
      )}

      <UploadAssetDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {selectedAsset ? (
        <AssetDetailDialog
          asset={selectedAsset}
          assetUrl={assetUrls[selectedAsset.id] ?? ""}
          templates={templates}
          onClose={() => setSelectedAsset(null)}
        />
      ) : null}
    </div>
  );
}
