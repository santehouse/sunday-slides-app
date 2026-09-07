"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Upload, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Dropzone } from "@/components/ui/Dropzone";
import { Dialog } from "@/components/ui/Dialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
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

function UploadFontDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin.brand");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [r2Key, setR2Key] = useState<string | null>(null);
  const [family, setFamily] = useState("");
  const [weight, setWeight] = useState(400);
  const [style, setStyle] = useState<FontStyle>("normal");

  function handleFile(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    // Prefill family / weight / style from the file name ("Inter-SemiBoldItalic.ttf") —
    // the admin only confirms, and each weight lands in its own variant.
    const guess = guessFontMetadata(file.name);
    if (guess.family && !family) setFamily(guess.family);
    if (guess.weight) setWeight(guess.weight);
    if (guess.style) setStyle(guess.style);
    startTransition(async () => {
      const result = await uploadFontFileAction(formData);
      if (result.ok) {
        setR2Key(result.r2Key);
      } else {
        showToast({
          state: "error",
          title: tCommon("failed"),
          message: result.error === "unsupported_file" ? tErrors("unsupportedFont") : tErrors("generic"),
        });
      }
    });
  }

  function handleCreate() {
    if (!r2Key || !family) return;
    startTransition(async () => {
      const result = await createCustomFontAction({ family, weight, style, r2Key });
      if (!result.ok) {
        showToast({
          state: "error",
          title: t("variantExistsTitle"),
          message: t("variantExistsBody", { family, weight, style: style === "italic" ? t("styleItalic") : t("styleNormal") }),
        });
        return;
      }
      showToast({ state: "success", title: t("fontSaved"), message: `${family} · ${weight}${style === "italic" ? "i" : ""}` });
      setR2Key(null);
      setFamily("");
      setWeight(400);
      setStyle("normal");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("uploadFont")}>
      <div className="flex flex-col gap-4">
        {!r2Key ? (
          <Dropzone
            title={t("uploadFont")}
            hint={t("uploadFontHelper")}
            chooseFileLabel={tCommon("upload")}
            accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf"
            onFile={handleFile}
            disabled={isPending}
          />
        ) : (
          <>
            <Input id="font-family" label={t("family")} value={family} onChange={(e) => setFamily(e.target.value)} />
            <Select
              id="font-weight"
              label={t("weight")}
              value={String(weight)}
              onChange={(e) => setWeight(Number(e.target.value))}
              options={FONT_WEIGHTS.map((w) => ({ value: String(w), label: `${w} · ${t(`weightNames.${w}`)}` }))}
            />
            <Select
              id="font-style"
              label={t("style")}
              value={style}
              onChange={(e) => setStyle(e.target.value as FontStyle)}
              options={[
                { value: "normal", label: t("styleNormal") },
                { value: "italic", label: t("styleItalic") },
              ]}
            />
          </>
        )}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          {r2Key ? (
            <Button variant="primary" loading={isPending} disabled={!family} onClick={handleCreate}>
              {tCommon("save")}
            </Button>
          ) : null}
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

function FontLibraryCard({ fonts }: { fonts: FontRecord[] }) {
  const t = useTranslations("admin.brand");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const groups = useMemo(() => groupFonts(fonts), [fonts]);

  function handleToggle(group: FamilyGroup) {
    if (group.variants.length === 0) return;
    const nextEnabled = group.badge !== "enabled";
    startTransition(async () => {
      await setFontFamilyEnabledAction(group.variants.map((v) => v.id), nextEnabled);
      router.refresh();
    });
  }

  function handleDelete(group: FamilyGroup) {
    if (group.variants.length === 0) return;
    startTransition(async () => {
      const result = await deleteFontFamilyAction(group.variants.map((v) => v.id));
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
          <div key={group.family} className="flex min-h-[92px] items-center justify-between gap-3 rounded-[10px] bg-surface-subtle px-3.5 py-3">
            <div className="min-w-0">
              <p className="truncate text-label font-bold text-fg">{group.family}</p>
              <p className="truncate text-caption text-fg-secondary">
                {group.variants.length > 0
                  ? `${group.variants[0]!.source === "google" ? t("googleFontsSource") : t("customFont")} · ${group.variants
                      .map((v) => `${v.weight}${v.style === "italic" ? "i" : ""}`)
                      .join(", ")}`
                  : t("customFont")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={group.badge} />
              {group.variants.length > 0 ? (
                <>
                  <Toggle
                    checked={group.badge === "enabled"}
                    onChange={() => handleToggle(group)}
                    label={<VisuallyHidden>{`${t("enable")} ${group.family}`}</VisuallyHidden>}
                  />
                  <IconButton
                    icon={Trash2}
                    variant="ghost"
                    aria-label={`${t("disable")} ${group.family}`}
                    disabled={isPending}
                    onClick={() => handleDelete(group)}
                  />
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <EnableGoogleFontRow />

      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        className="flex items-center gap-3 rounded-md border border-dashed border-border-strong p-3 text-left hover:bg-surface-subtle"
      >
        <Upload aria-hidden="true" size={20} className="text-fg-secondary" />
        <span>
          <span className="block text-label font-bold text-fg">{t("uploadFont")}</span>
          <span className="block text-caption text-fg-secondary">{t("uploadFontHelper")}</span>
        </span>
      </button>

      <UploadFontDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
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
