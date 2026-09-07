"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2, Upload } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Dropzone } from "@/components/ui/Dropzone";
import { Dialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { useToast } from "@/components/ui/Toast";
import {
  createCustomFontAction,
  deleteApprovedColorAction,
  deleteFontFamilyAction,
  enableGoogleFontAction,
  saveChurchNameAction,
  setFontFamilyEnabledAction,
  upsertApprovedColorAction,
  uploadFontFileAction,
} from "./actions";
import type { ApprovedColor, FontRecord, FontStyle } from "@/lib/domain/types";

const NEEDS_FONT_FILE_FAMILY = "Times New Roman";

type FamilyGroup = {
  family: string;
  variants: FontRecord[];
  badge: "enabled" | "available" | "needsFontFile";
};

const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const WEIGHT_TOKENS: Array<[RegExp, number]> = [
  [/extra ?black|ultra ?black|heavy/i, 900],
  [/black/i, 900],
  [/extra ?bold|ultra ?bold/i, 800],
  [/semi ?bold|demi ?bold/i, 600],
  [/bold/i, 700],
  [/medium/i, 500],
  [/extra ?light|ultra ?light/i, 200],
  [/light/i, 300],
  [/thin|hairline/i, 100],
  [/regular|book|normal|roman/i, 400],
];

/** Best-effort family / weight / style from a font file name such as "Inter-SemiBoldItalic.ttf". */
function guessFontMetadata(filename: string): { family: string; weight: number | null; style: FontStyle | null } {
  const stem = filename.replace(/\.(woff2?|ttf|otf)$/i, "");
  const [rawFamily, ...rest] = stem.split(/[-_]/);
  const descriptor = rest.join(" ") || stem.replace(rawFamily ?? "", "");
  const weight = WEIGHT_TOKENS.find(([pattern]) => pattern.test(descriptor))?.[1] ?? null;
  const style: FontStyle | null = /italic|oblique/i.test(descriptor) ? "italic" : descriptor ? "normal" : null;
  const family = (rawFamily ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return { family, weight, style };
}

function groupFonts(fonts: FontRecord[]): FamilyGroup[] {
  const byFamily = new Map<string, FontRecord[]>();
  for (const font of fonts) {
    byFamily.set(font.family, [...(byFamily.get(font.family) ?? []), font]);
  }
  if (!byFamily.has(NEEDS_FONT_FILE_FAMILY)) byFamily.set(NEEDS_FONT_FILE_FAMILY, []);

  return Array.from(byFamily.entries())
    .map(([family, variants]) => ({
      family,
      variants,
      badge: (variants.length === 0
        ? "needsFontFile"
        : variants.some((v) => v.enabled)
          ? "enabled"
          : "available") as FamilyGroup["badge"],
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

type UploadItem = {
  id: string;
  file: File;
  weight: number;
  style: FontStyle;
  r2Key: string | null;
  state: "uploading" | "ready" | "failed";
};

/**
 * One family, many files: drop Regular / Bold / Italic / Bold Italic together, confirm the
 * family name once, adjust each file's weight and style, save — every file becomes its
 * own variant under the same family card. Nothing is ever replaced.
 */
function UploadFontDialog({ open, onClose, initialFamily }: { open: boolean; onClose: () => void; initialFamily?: string }) {
  const t = useTranslations("admin.brand");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [family, setFamily] = useState(initialFamily ?? "");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      // One-time reset when the dialog opens (fresh family, no leftover rows).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFamily(initialFamily ?? "");
      setItems([]);
      setRowErrors({});
    }
  }, [open, initialFamily]);

  function handleFiles(files: File[]) {
    const next: UploadItem[] = files.map((file) => {
      const guess = guessFontMetadata(file.name);
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        weight: guess.weight ?? 400,
        style: guess.style ?? "normal",
        r2Key: null,
        state: "uploading",
      };
    });
    const firstGuess = files[0] ? guessFontMetadata(files[0].name) : null;
    if (!family && firstGuess?.family) setFamily(firstGuess.family);
    setItems((current) => [...current, ...next]);

    for (const item of next) {
      const formData = new FormData();
      formData.set("file", item.file);
      void uploadFontFileAction(formData).then((result) => {
        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, state: result.ok ? "ready" : "failed", r2Key: result.ok ? result.r2Key : null } : row,
          ),
        );
        if (!result.ok) {
          showToast({
            state: "error",
            title: tCommon("failed"),
            message: result.error === "unsupported_file" ? tErrors("unsupportedFont") : tErrors("generic"),
          });
        }
      });
    }
  }

  function updateItem(id: string, patch: Partial<Pick<UploadItem, "weight" | "style">>) {
    setItems((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const ready = items.filter((row) => row.state === "ready" && row.r2Key);
  const duplicateInBatch = new Set(
    ready.filter((row, i) => ready.some((other, j) => j < i && other.weight === row.weight && other.style === row.style)).map((r) => r.id),
  );
  const canSave = Boolean(family.trim()) && ready.length > 0 && duplicateInBatch.size === 0 && !items.some((r) => r.state === "uploading");

  function handleSave() {
    if (!canSave) return;
    startTransition(async () => {
      const errors: Record<string, string> = {};
      let added = 0;
      for (const row of ready) {
        const result = await createCustomFontAction({ family, weight: row.weight, style: row.style, r2Key: row.r2Key! });
        if (result.ok) added += 1;
        else errors[row.id] = t("variantExistsRow");
      }
      setRowErrors(errors);
      if (added > 0) showToast({ state: "success", title: t("fontsSaved", { count: added, family }), message: "" });
      if (Object.keys(errors).length === 0) {
        onClose();
      } else {
        // Keep only the rows that still need attention.
        setItems((current) => current.filter((row) => errors[row.id]));
      }
      router.refresh();
    });
  }

  const styleLabel = (style: FontStyle) => (style === "italic" ? t("styleItalic") : t("styleNormal"));

  return (
    <Dialog open={open} onClose={onClose} title={t("uploadFont")} size="md">
      <div className="flex flex-col gap-4">
        <Dropzone
          title={t("uploadFont")}
          hint={t("uploadFontHelper")}
          chooseFileLabel={t("chooseFiles")}
          accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf"
          multiple
          onFiles={handleFiles}
          onFile={(file) => handleFiles([file])}
          disabled={isPending}
        />

        {items.length > 0 ? (
          <>
            <Input id="font-family" label={t("family")} value={family} onChange={(e) => setFamily(e.target.value)} />
            <ul className="flex flex-col gap-2" aria-label={t("filesToAdd")}>
              {items.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 rounded-md bg-surface-subtle p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-label font-bold text-fg">{row.file.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {row.state === "uploading" ? (
                        <span className="flex items-center gap-1.5 text-caption text-fg-secondary">
                          <Spinner size={16} />
                          {t("uploading")}
                        </span>
                      ) : row.state === "failed" ? (
                        <StatusBadge status="failed" />
                      ) : null}
                      <IconButton
                        icon={Trash2}
                        variant="ghost"
                        size={36}
                        aria-label={t("removeFile", { file: row.file.name })}
                        onClick={() => setItems((current) => current.filter((r) => r.id !== row.id))}
                      />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      id={`font-weight-${row.id}`}
                      label={t("weight")}
                      value={String(row.weight)}
                      onChange={(e) => updateItem(row.id, { weight: Number(e.target.value) })}
                      options={FONT_WEIGHTS.map((w) => ({ value: String(w), label: `${w} · ${t(`weightNames.${w}`)}` }))}
                    />
                    <Select
                      id={`font-style-${row.id}`}
                      label={t("style")}
                      value={row.style}
                      onChange={(e) => updateItem(row.id, { style: e.target.value as FontStyle })}
                      options={[
                        { value: "normal", label: styleLabel("normal") },
                        { value: "italic", label: styleLabel("italic") },
                      ]}
                    />
                  </div>
                  {duplicateInBatch.has(row.id) ? (
                    <p className="text-caption text-error-fg">{t("duplicateInBatch")}</p>
                  ) : rowErrors[row.id] ? (
                    <p className="text-caption text-error-fg">{rowErrors[row.id]}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button variant="primary" loading={isPending} disabled={!canSave} onClick={handleSave}>
            {t("addVariants", { count: ready.length })}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EnableGoogleFontRow() {
  const t = useTranslations("admin.brand");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [family, setFamily] = useState("");
  const [weights, setWeights] = useState<number[]>([400]);
  const [italic, setItalic] = useState(false);

  function toggleWeight(weight: number) {
    setWeights((current) => (current.includes(weight) ? current.filter((w) => w !== weight) : [...current, weight]));
  }

  function handleEnable() {
    if (!family || weights.length === 0) return;
    startTransition(async () => {
      await enableGoogleFontAction(family, weights, italic);
      showToast({ state: "success", title: t("saved"), message: family });
      setFamily("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <p className="text-label font-bold text-fg">{t("enableGoogleFont")}</p>
      <Input
        id="google-font-family"
        placeholder={t("googleFamilyPlaceholder")}
        value={family}
        onChange={(e) => setFamily(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-caption text-fg-secondary">{t("weights")}</span>
        {[400, 700].map((weight) => (
          <label key={weight} className="flex items-center gap-1.5 text-label text-fg">
            <input type="checkbox" checked={weights.includes(weight)} onChange={() => toggleWeight(weight)} />
            {weight}
          </label>
        ))}
        <label className="flex items-center gap-1.5 text-label text-fg">
          <input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
          {t("styleItalic")}
        </label>
      </div>
      <div>
        <Button variant="secondary" loading={isPending} disabled={!family} onClick={handleEnable}>
          {t("enable")}
        </Button>
      </div>
    </div>
  );
}

// Light → heavy, and within a weight the upright face before its italic.
const VARIANT_ORDER = (a: FontRecord, b: FontRecord) =>
  a.weight - b.weight || (a.style === b.style ? 0 : a.style === "normal" ? -1 : 1);
const FILE_KIND = (r2Key: string) => (r2Key.split(".").pop() ?? "").toUpperCase();

/** One collapsible card per family: header (name, count, badge, enable, delete), then each variant file. */
function FontFamilyCard({
  group,
  isPending,
  onToggle,
  onDeleteFamily,
  onDeleteVariant,
  onAddVariant,
}: {
  group: FamilyGroup;
  isPending: boolean;
  onToggle: (group: FamilyGroup) => void;
  onDeleteFamily: (group: FamilyGroup) => void;
  onDeleteVariant: (variant: FontRecord) => void;
  onAddVariant: (family: string) => void;
}) {
  const t = useTranslations("admin.brand");
  const [expanded, setExpanded] = useState(false);
  const variants = [...group.variants].sort(VARIANT_ORDER);
  const isGoogle = variants[0]?.source === "google";
  const listId = `font-variants-${group.family.replace(/\W+/g, "-").toLowerCase()}`;
  const variantLabel = (v: FontRecord) => `${v.weight} · ${t(`weightNames.${v.weight}` as never)}${v.style === "italic" ? ` · ${t("styleItalic")}` : ""}`;

  return (
    <div className="flex flex-col rounded-[10px] bg-surface-subtle">
      <div className="flex min-h-[92px] items-center justify-between gap-3 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {variants.length > 0 ? (
            <IconButton
              icon={expanded ? ChevronUp : ChevronDown}
              variant="ghost"
              size={36}
              aria-expanded={expanded}
              aria-controls={listId}
              aria-label={expanded ? t("hideVariants", { family: group.family }) : t("showVariants", { family: group.family })}
              onClick={() => setExpanded((v) => !v)}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-label font-bold text-fg">{group.family}</p>
            <p className="truncate text-caption text-fg-secondary">
              {variants.length > 0
                ? `${isGoogle ? t("googleFontsSource") : t("customFont")} · ${t("variantsCount", { count: variants.length })}`
                : t("needsFontFileHelper")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={group.badge} />
          {variants.length > 0 ? (
            <>
              <Toggle
                checked={group.badge === "enabled"}
                onChange={() => onToggle(group)}
                label={<VisuallyHidden>{`${t("enable")} ${group.family}`}</VisuallyHidden>}
              />
              <IconButton
                icon={Trash2}
                variant="ghost"
                aria-label={`${t("disable")} ${group.family}`}
                disabled={isPending}
                onClick={() => onDeleteFamily(group)}
              />
            </>
          ) : (
            <Button variant="secondary" leadingIcon={Upload} onClick={() => onAddVariant(group.family)}>
              {t("uploadFiles")}
            </Button>
          )}
        </div>
      </div>

      {expanded && variants.length > 0 ? (
        <div id={listId} className="flex flex-col gap-1.5 border-t border-border px-3.5 py-3">
          <ul className="flex flex-col gap-1.5">
            {variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-label text-fg">{variantLabel(variant)}</span>
                  <span className="block truncate text-caption text-fg-secondary">
                    {variant.r2Key ? t("fileKind", { kind: FILE_KIND(variant.r2Key) }) : (variant.sourceIdentifier ?? "")}
                  </span>
                </span>
                {!isGoogle ? (
                  <IconButton
                    icon={Trash2}
                    variant="ghost"
                    size={36}
                    aria-label={t("removeVariant", { variant: variantLabel(variant) })}
                    disabled={isPending}
                    onClick={() => onDeleteVariant(variant)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {!isGoogle ? (
            <div className="pt-1">
              <Button variant="ghost" leadingIcon={Plus} onClick={() => onAddVariant(group.family)}>
                {t("addVariant")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FontLibraryCard({ fonts }: { fonts: FontRecord[] }) {
  const t = useTranslations("admin.brand");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadFamily, setUploadFamily] = useState<string | null>(null);
  const groups = useMemo(() => groupFonts(fonts), [fonts]);

  function handleToggle(group: FamilyGroup) {
    if (group.variants.length === 0) return;
    const nextEnabled = group.badge !== "enabled";
    startTransition(async () => {
      await setFontFamilyEnabledAction(group.variants.map((v) => v.id), nextEnabled);
      router.refresh();
    });
  }

  function deleteIds(ids: string[]) {
    startTransition(async () => {
      const result = await deleteFontFamilyAction(ids);
      if (!result.ok) {
        showToast({ state: "error", title: t("fontInUse"), message: result.templateNames.join(", ") });
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title={t("fontLibrary")} />
      <p className="text-caption text-fg-secondary">{t("fontLibraryHelper")}</p>
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <FontFamilyCard
            key={group.family}
            group={group}
            isPending={isPending}
            onToggle={handleToggle}
            onDeleteFamily={(g) => deleteIds(g.variants.map((v) => v.id))}
            onDeleteVariant={(variant) => deleteIds([variant.id])}
            onAddVariant={(family) => setUploadFamily(family)}
          />
        ))}
      </div>

      <EnableGoogleFontRow />

      <button
        type="button"
        onClick={() => setUploadFamily("")}
        className="flex items-center gap-3 rounded-md border border-dashed border-border-strong p-3 text-left hover:bg-surface-subtle"
      >
        <Upload aria-hidden="true" size={20} className="text-fg-secondary" />
        <span>
          <span className="block text-label font-bold text-fg">{t("uploadFont")}</span>
          <span className="block text-caption text-fg-secondary">{t("uploadFontHelper")}</span>
        </span>
      </button>

      <UploadFontDialog open={uploadFamily !== null} initialFamily={uploadFamily ?? ""} onClose={() => setUploadFamily(null)} />
    </Card>
  );
}

function ApprovedColorsList({ colors }: { colors: ApprovedColor[] }) {
  const t = useTranslations("admin.brand");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      await upsertApprovedColorAction({
        nameEn: "New color",
        nameFr: "Nouvelle couleur",
        hex: "#4f46e5",
        enabled: true,
        sortOrder: colors.length,
      });
      router.refresh();
    });
  }

  function handleUpdate(color: ApprovedColor, patch: Partial<ApprovedColor>) {
    startTransition(async () => {
      await upsertApprovedColorAction({ ...color, ...patch });
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteApprovedColorAction(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-caption font-bold text-fg-secondary">{t("approvedColors")}</span>
        <Button variant="ghost" size="sm" onClick={handleAdd} disabled={isPending}>
          {t("addColor")}
        </Button>
      </div>
      <p className="text-caption text-fg-secondary">{t("approvedColorsHelper")}</p>
      {colors.map((color) => (
        <div key={color.id} className="flex items-center gap-2 rounded-md border border-border p-2">
          <span aria-hidden="true" className="size-6 shrink-0 rounded-sm" style={{ backgroundColor: color.hex }} />
          <Input
            aria-label={t("colorNameEn")}
            defaultValue={color.nameEn}
            onBlur={(e) => handleUpdate(color, { nameEn: e.target.value })}
            className="min-w-0"
          />
          <Input
            aria-label={t("colorNameFr")}
            defaultValue={color.nameFr}
            onBlur={(e) => handleUpdate(color, { nameFr: e.target.value })}
            className="min-w-0"
          />
          <Input
            aria-label={t("hex")}
            defaultValue={color.hex}
            onBlur={(e) => handleUpdate(color, { hex: e.target.value })}
            className="w-24 shrink-0"
          />
          <Toggle
            checked={color.enabled}
            onChange={(v) => handleUpdate(color, { enabled: v })}
            label={<VisuallyHidden>{`${t("enable")} ${color.nameEn}`}</VisuallyHidden>}
          />
          <IconButton icon={Trash2} variant="ghost" aria-label={tCommon("delete")} onClick={() => handleDelete(color.id)} />
        </div>
      ))}
    </div>
  );
}

export function BrandClient({
  fonts,
  colors,
  churchName: initialChurchName,
}: {
  fonts: FontRecord[];
  colors: ApprovedColor[];
  churchName: string;
}) {
  const t = useTranslations("admin.brand");
  const tCommon = useTranslations("common");
  const tLanguage = useTranslations("language");
  const { showToast } = useToast();
  const [churchName, setChurchName] = useState(initialChurchName);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await saveChurchNameAction(churchName);
      showToast({ state: "success", title: t("saved"), message: churchName });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <Button variant="primary" loading={isPending} onClick={handleSave}>
          {tCommon("save")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FontLibraryCard fonts={fonts} />

        <Card className="flex flex-col gap-4">
          <CardHeader title={t("brandDefaults")} />
          <Input id="brand-church-name" label={t("churchName")} value={churchName} onChange={(e) => setChurchName(e.target.value)} />
          <ApprovedColorsList colors={colors} />
          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold text-fg-secondary">{t("interfaceLanguages")}</span>
            <div className="flex gap-2">
              <span className="rounded-full bg-success-bg px-3 py-1 text-caption font-bold text-success-fg">
                {tLanguage("englishName")}
              </span>
              <span className="rounded-full bg-success-bg px-3 py-1 text-caption font-bold text-success-fg">
                {tLanguage("frenchName")}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
