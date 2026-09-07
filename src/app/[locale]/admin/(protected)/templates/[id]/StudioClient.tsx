"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Copy, Eye, Plus, Trash2, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { MessageState } from "@/components/ui/MessageState";
import { useToast } from "@/components/ui/Toast";
import { StudioCanvas, type ZoomLevel } from "@/components/admin/StudioCanvas";
import { saveTemplateAction, updateSafeZoneAction } from "./actions";
import { clampBox, intersects, type Box } from "@/lib/engines/canvasGeometry";
import type { CreateTemplateFieldInput, TemplateWithFields } from "@/lib/data";
import type {
  Asset,
  BackgroundType,
  FontRecord,
  OverflowMode,
  OverlayColor,
  SafeZone,
  TemplateCategory,
  TemplateField,
  TemplateStatus,
  TextAlignment,
} from "@/lib/domain/types";

type FieldDraft = CreateTemplateFieldInput & { key: string };

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;
const NEW_FIELD_GAP = 24;

/**
 * New text boxes become Sunday-editable "Line N" fields (the next free number after the
 * existing line1/line2/…), so they show up in the Sunday Edit modal automatically.
 */
function nextLineField(fields: FieldDraft[]): { fieldKey: string; labelEn: string; labelFr: string } {
  const used = new Set(fields.map((f) => f.fieldKey));
  let n = 1;
  while (used.has(`line${n}`)) n += 1;
  return { fieldKey: `line${n}`, labelEn: `Line ${n}`, labelFr: `Ligne ${n}` };
}

/** Places a new box just under the lowest existing one, staying inside the 1920×1080 stage. */
function placeBelow(fields: FieldDraft[], box: Box): Box {
  const bottom = fields.reduce((max, f) => Math.max(max, f.y + f.height), 0);
  const y = bottom > 0 ? bottom + NEW_FIELD_GAP : box.y;
  return clampBox({ ...box, y });
}
const CATEGORY_OPTIONS: TemplateCategory[] = ["general", "events", "special", "giving", "welcome", "theme", "closing"];
const STATUS_OPTIONS: TemplateStatus[] = ["draft", "published", "archived"];
const OVERLAY_OPTIONS: OverlayColor[] = ["none", "black", "white"];
const ALIGN_OPTIONS: TextAlignment[] = ["left", "center", "right"];
const OVERFLOW_OPTIONS: OverflowMode[] = ["fixed", "auto_fit", "flex_height"];
const WEIGHT_OPTIONS = [400, 700];
const ZOOM_OPTIONS: ZoomLevel[] = ["50", "75", "100"];
const MAX_HISTORY = 50;

const TEMPLATE_STATUS_BADGE: Record<TemplateStatus, StatusBadgeStatus> = {
  published: "published",
  draft: "draft",
  archived: "archived",
};

function toFieldDraft(field: TemplateWithFields["fields"][number]): FieldDraft {
  // Drop server-owned id/templateId/fieldType — `upsertTemplateFields` fully replaces the
  // field set on save and assigns fresh ids, so the draft only carries editable data + `key`.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, templateId, fieldType, ...rest } = field;
  return { ...rest, key: field.id };
}

export function StudioClient({
  template,
  assets,
  assetUrls,
  fonts,
  safeZone,
}: {
  template: TemplateWithFields;
  assets: Asset[];
  assetUrls: Record<string, string>;
  fonts: FontRecord[];
  safeZone: SafeZone;
}) {
  const t = useTranslations("admin.templates");
  const tBrand = useTranslations("admin.brand");
  const tCommon = useTranslations("common");
  const tSafeZones = useTranslations("sunday.safeZones");
  const tSettings = useTranslations("admin.settings");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [nameEn, setNameEn] = useState(template.nameEn);
  const [nameFr, setNameFr] = useState(template.nameFr);
  const [category, setCategory] = useState<TemplateCategory>(template.category);
  const [status, setStatus] = useState<TemplateStatus>(template.status);
  const [backgroundType, setBackgroundType] = useState<BackgroundType>(template.backgroundType);
  const [backgroundColorHex, setBackgroundColorHex] = useState(
    template.backgroundType === "color" ? template.backgroundValue : "#0f172a",
  );
  const [backgroundAssetId, setBackgroundAssetId] = useState(
    template.backgroundType === "image" ? template.backgroundValue : "",
  );
  const [overlayColor, setOverlayColor] = useState<OverlayColor>(template.overlayColor);
  const [overlayOpacity, setOverlayOpacity] = useState(template.overlayOpacity);
  const [includeInVideoDefault, setIncludeInVideoDefault] = useState(template.includeInVideoDefault);
  const [allowedAssetIds, setAllowedAssetIds] = useState<string[]>(template.allowedAssetIds);
  const [fields, setFields] = useState<FieldDraft[]>(() => template.fields.map(toFieldDraft));
  const [selectedKey, setSelectedKey] = useState<string | null>(fields[0]?.key ?? null);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>("50");
  const [safeZoneEditing, setSafeZoneEditing] = useState(false);
  const [safeZoneDraft, setSafeZoneDraft] = useState<SafeZone>(safeZone);
  const [isSafeZonePending, startSafeZoneTransition] = useTransition();
  const [savedSafeZone, setSavedSafeZone] = useState<SafeZone>(safeZone);
  const selectedFieldCardRef = useRef<HTMLDivElement>(null);

  const enabledFamilies = useMemo(
    () => Array.from(new Set(fonts.filter((f) => f.enabled).map((f) => f.family))).sort(),
    [fonts],
  );

  const selectedField = fields.find((f) => f.key === selectedKey) ?? null;

  // Simple in-memory undo history (Ctrl/Cmd+Z, up to 50 steps) for canvas moves/resizes —
  // pushed once per drag/keyboard gesture by `StudioCanvas`'s `onBeginChange`.
  const historyRef = useRef<Array<{ fields: FieldDraft[]; safeZoneDraft: SafeZone }>>([]);
  const fieldsRef = useRef(fields);
  const safeZoneDraftRef = useRef(safeZoneDraft);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);
  useEffect(() => {
    safeZoneDraftRef.current = safeZoneDraft;
  }, [safeZoneDraft]);

  function pushHistory() {
    historyRef.current.push({ fields: fieldsRef.current, safeZoneDraft: safeZoneDraftRef.current });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setFields(previous.fields);
    setSafeZoneDraft(previous.safeZoneDraft);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      // Canvas shortcuts for the selected text box: ⌘/Ctrl+D duplicates, Delete/Backspace removes.
      const current = selectedKeyRef.current;
      if (!current || safeZoneEditingRef.current) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateFieldRef.current(current);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeFieldRef.current(current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Latest handlers/selection for the window-level shortcut listener above (registered once).
  const selectedKeyRef = useRef(selectedKey);
  const safeZoneEditingRef = useRef(safeZoneEditing);
  const duplicateFieldRef = useRef(duplicateField);
  const removeFieldRef = useRef(removeField);
  useEffect(() => {
    selectedKeyRef.current = selectedKey;
    safeZoneEditingRef.current = safeZoneEditing;
    duplicateFieldRef.current = duplicateField;
    removeFieldRef.current = removeField;
  });

  // Scroll the controls column to the selected field's Typography/Text fitting/Position
  // controls — whether the selection came from the canvas or the field list below. Only
  // when the selection actually *changes* to a different field (comparing against the
  // previous value, not a "have I run before" flag — Strict Mode's dev-only double effect
  // invocation would otherwise defeat a simple mount guard) — never on the initial mount,
  // where a field is pre-selected by default and the page should stay put on the canvas.
  const previousSelectedKeyRef = useRef(selectedKey);
  useEffect(() => {
    if (previousSelectedKeyRef.current !== selectedKey) {
      if (selectedKey) selectedFieldCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    previousSelectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  function updateField(key: string, patch: Partial<FieldDraft>) {
    setFields((current) => current.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function updateFieldBox(key: string, box: Box) {
    updateField(key, box);
  }

  function updateSafeZoneDraft(patch: Partial<SafeZone>) {
    setSafeZoneDraft((current) => clampBox({ ...current, ...patch }));
  }

  function addField() {
    const base = selectedField ?? fields[fields.length - 1] ?? null;
    const naming = nextLineField(fields);
    const box = placeBelow(fields, { x: base?.x ?? 96, y: 96, width: base?.width ?? 800, height: base?.height ?? 120 });
    const draft: FieldDraft = {
      key: `field-${Date.now()}`,
      ...naming,
      teamEditable: true,
      required: false,
      ...box,
      fontId: base?.fontId ?? null,
      fontFamily: base?.fontFamily ?? enabledFamilies[0] ?? "Arimo",
      fontSize: base?.fontSize ?? 56,
      minFontSize: base?.minFontSize ?? 40,
      fontWeight: base?.fontWeight ?? 400,
      fontStyle: base?.fontStyle ?? "normal",
      lineHeight: base?.lineHeight ?? 1.1,
      letterSpacing: base?.letterSpacing ?? 0,
      alignment: base?.alignment ?? "left",
      textColor: base?.textColor ?? "#ffffff",
      maxLines: base?.maxLines ?? 1,
      overflowMode: base?.overflowMode ?? "fixed",
      textTransform: base?.textTransform ?? "none",
      sortOrder: fields.length,
    };
    pushHistory();
    setFields((current) => [...current, draft]);
    setSelectedKey(draft.key);
  }

  /** Copies a box (styling included) right under the original as the next "Line N" field. */
  function duplicateField(key: string) {
    const source = fields.find((f) => f.key === key);
    if (!source) return;
    const naming = nextLineField(fields);
    const box = clampBox({ x: source.x, y: source.y + source.height + NEW_FIELD_GAP, width: source.width, height: source.height });
    const draft: FieldDraft = { ...source, key: `field-${Date.now()}`, ...naming, ...box, sortOrder: fields.length };
    pushHistory();
    setFields((current) => [...current, draft]);
    setSelectedKey(draft.key);
  }

  function removeField(key: string) {
    pushHistory();
    setFields((current) => current.filter((f) => f.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  }

  const previewFields: TemplateField[] = useMemo(
    () =>
      fields.map((f) => ({
        id: f.key,
        templateId: template.id,
        fieldType: "text" as const,
        ...f,
        fontId: f.fontId ?? null,
      })),
    [fields, template.id],
  );

  const previewContent = useMemo(() => {
    const content: Record<string, string> = {};
    for (const f of fields) content[f.fieldKey] = f.labelEn.toUpperCase();
    return content;
  }, [fields]);

  const overlappingFields = useMemo(
    () => fields.filter((f) => intersects(f, safeZoneDraft)),
    [fields, safeZoneDraft],
  );

  const currentSnapshot = JSON.stringify({
    nameEn,
    nameFr,
    category,
    status,
    backgroundType,
    backgroundValue: backgroundType === "color" ? backgroundColorHex : backgroundAssetId,
    overlayColor,
    overlayOpacity,
    includeInVideoDefault,
    allowedAssetIds,
    fields,
  });
  // Captured once on mount, replaced after every successful save — `dirty` is then just a
  // plain string comparison against the last-saved snapshot.
  const [savedSnapshot, setSavedSnapshot] = useState(currentSnapshot);
  const dirty = currentSnapshot !== savedSnapshot || JSON.stringify(safeZoneDraft) !== JSON.stringify(savedSafeZone);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  /**
   * Persists the studio. Publish / Unpublish / Archive / Restore pass their target
   * status so they act immediately — previously they only staged local state, and the
   * lifecycle change was silently lost unless the admin also pressed "Save changes".
   */
  function handleSave(nextStatus?: TemplateStatus) {
    if (nextStatus) setStatus(nextStatus);
    startTransition(async () => {
      const patch = {
        nameEn,
        nameFr,
        category,
        status: nextStatus ?? status,
        backgroundType,
        backgroundValue: backgroundType === "color" ? backgroundColorHex : backgroundAssetId,
        overlayColor,
        overlayOpacity,
        includeInVideoDefault,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fieldInputs: CreateTemplateFieldInput[] = fields.map(({ key, ...rest }) => rest);
      const result = await saveTemplateAction({
        templateId: template.id,
        patch,
        fields: fieldInputs,
        allowedAssetIds,
      });
      if (result.ok) {
        const savedFields = result.template.fields.map(toFieldDraft);
        setFields(savedFields);
        setSelectedKey(result.template.fields[0]?.id ?? null);
        setSavedSnapshot(JSON.stringify({
          nameEn,
          nameFr,
          category,
          status: nextStatus ?? status,
          backgroundType,
          backgroundValue: patch.backgroundValue,
          overlayColor,
          overlayOpacity,
          includeInVideoDefault,
          allowedAssetIds,
          fields: savedFields,
        }));
        showToast({ state: "success", title: t("saved"), message: tCommon("saveChanges") });
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: result.error });
      }
    });
  }

  /** Saves the global broadcast safe zone for every template + the Sunday preview (BUILD_HANDOFF §13). */
  function handleSaveSafeZone() {
    const box = clampBox(safeZoneDraft);
    startSafeZoneTransition(async () => {
      const result = await updateSafeZoneAction(box);
      if (result.ok) {
        setSafeZoneDraft(result.safeZone);
        setSavedSafeZone(result.safeZone);
        showToast({ state: "success", title: t("saved"), message: t("canvas.safeZoneSaved") });
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: result.error });
      }
    });
  }

  const name = isFr ? nameFr : nameEn;
  const backgroundColorInvalid = backgroundType === "color" && !HEX_PATTERN.test(backgroundColorHex);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/templates" aria-label={tCommon("back")} className="text-fg-secondary hover:text-fg">
            <ArrowLeft aria-hidden="true" size={24} />
          </Link>
          <h1 className="text-h2 font-bold text-fg">{name}</h1>
          <StatusBadge status={TEMPLATE_STATUS_BADGE[status]} />
        </div>
        <div className="flex items-center gap-2.5">
          {status === "archived" ? (
            <Button variant="secondary" loading={isPending} onClick={() => handleSave("draft")}>
              {t("restore")}
            </Button>
          ) : (
            <>
              {status !== "published" ? (
                <Button variant="secondary" loading={isPending} onClick={() => handleSave("published")}>
                  {t("publish")}
                </Button>
              ) : (
                <Button variant="secondary" loading={isPending} onClick={() => handleSave("draft")}>
                  {t("unpublish")}
                </Button>
              )}
              <Button variant="secondary" loading={isPending} onClick={() => handleSave("archived")}>
                {t("archive")}
              </Button>
            </>
          )}
          <Button variant="secondary" leadingIcon={Eye} aria-pressed={showSafeZone} onClick={() => setShowSafeZone((s) => !s)}>
            {t("preview")}
          </Button>
          <Button variant="primary" loading={isPending} onClick={() => handleSave()}>
            {tCommon("saveChanges")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr_260px]">
        {/* Controls */}
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <CardHeader title={t("templateControls")} />
            <Input id="tpl-name-en" label={t("nameEn")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            <Input id="tpl-name-fr" label={t("nameFr")} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
            <Select
              id="tpl-category"
              label={t("category")}
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
            />
            <Select
              id="tpl-status"
              label={t("status")}
              value={status}
              onChange={(e) => setStatus(e.target.value as TemplateStatus)}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`filters.${s}`) }))}
            />
            <Select
              id="tpl-bg-type"
              label={t("backgroundType")}
              value={backgroundType}
              onChange={(e) => setBackgroundType(e.target.value as BackgroundType)}
              options={[
                { value: "color", label: t("backgroundColor") },
                { value: "image", label: t("backgroundImage") },
              ]}
            />
            {backgroundType === "color" ? (
              <Input
                id="tpl-bg-color"
                label={t("backgroundColor")}
                value={backgroundColorHex}
                onChange={(e) => setBackgroundColorHex(e.target.value)}
                error={backgroundColorInvalid ? "#RRGGBB" : undefined}
              />
            ) : (
              <Select
                id="tpl-bg-asset"
                label={t("backgroundImage")}
                value={backgroundAssetId}
                onChange={(e) => setBackgroundAssetId(e.target.value)}
                options={[
                  { value: "", label: tCommon("optional") },
                  ...assets.map((a) => ({ value: a.id, label: isFr ? a.nameFr : a.nameEn })),
                ]}
              />
            )}
            <Select
              id="tpl-overlay"
              label={t("overlay")}
              value={overlayColor}
              onChange={(e) => setOverlayColor(e.target.value as OverlayColor)}
              options={OVERLAY_OPTIONS.map((o) => ({
                value: o,
                label: o === "none" ? t("overlayNone") : o === "black" ? t("overlayBlack") : t("overlayWhite"),
              }))}
            />
            {overlayColor !== "none" ? (
              <Input
                id="tpl-overlay-opacity"
                type="number"
                min={0}
                max={1}
                step={0.05}
                label={t("overlayOpacity")}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              />
            ) : null}
            <Toggle checked={includeInVideoDefault} onChange={setIncludeInVideoDefault} label={t("includeInMp4Default")} />
          </Card>

          {safeZoneEditing ? (
            <Card className="flex flex-col gap-4">
              <CardHeader title={tSafeZones("label")} />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="safe-zone-x"
                  type="number"
                  label={tSettings("pipX")}
                  value={safeZoneDraft.x}
                  onChange={(e) => updateSafeZoneDraft({ x: Number(e.target.value) })}
                />
                <Input
                  id="safe-zone-y"
                  type="number"
                  label={tSettings("pipY")}
                  value={safeZoneDraft.y}
                  onChange={(e) => updateSafeZoneDraft({ y: Number(e.target.value) })}
                />
                <Input
                  id="safe-zone-width"
                  type="number"
                  label={tSettings("pipWidth")}
                  value={safeZoneDraft.width}
                  onChange={(e) => updateSafeZoneDraft({ width: Number(e.target.value) })}
                />
                <Input
                  id="safe-zone-height"
                  type="number"
                  label={tSettings("pipHeight")}
                  value={safeZoneDraft.height}
                  onChange={(e) => updateSafeZoneDraft({ height: Number(e.target.value) })}
                />
              </div>
              <Button variant="primary" loading={isSafeZonePending} onClick={handleSaveSafeZone}>
                {t("canvas.saveSafeZone")}
              </Button>
            </Card>
          ) : null}

          {selectedField ? (
            <div ref={selectedFieldCardRef}>
            <Card className="flex flex-col gap-4">
              <CardHeader title={selectedField.labelEn || t("editableFields")} />
              <Input
                id="field-label-en"
                label={t("labelEn")}
                value={selectedField.labelEn}
                onChange={(e) => updateField(selectedField.key, { labelEn: e.target.value })}
              />
              <Input
                id="field-label-fr"
                label={t("labelFr")}
                value={selectedField.labelFr}
                onChange={(e) => updateField(selectedField.key, { labelFr: e.target.value })}
              />
              <Input
                id="field-key"
                label={t("fieldKey")}
                value={selectedField.fieldKey}
                onChange={(e) => updateField(selectedField.key, { fieldKey: e.target.value })}
              />
              <div className="flex flex-col gap-2">
                <Toggle
                  checked={selectedField.required}
                  onChange={(v) => updateField(selectedField.key, { required: v })}
                  label={t("required")}
                />
                <Toggle
                  checked={selectedField.teamEditable}
                  onChange={(v) => updateField(selectedField.key, { teamEditable: v })}
                  label={t("teamEditable")}
                />
              </div>
              <Input
                id="field-sort-order"
                type="number"
                label={t("sortOrder")}
                value={selectedField.sortOrder}
                onChange={(e) => updateField(selectedField.key, { sortOrder: Number(e.target.value) })}
              />

              <h4 className="text-caption font-bold text-fg-secondary">{t("typography")}</h4>
              <Select
                id="field-font-family"
                label={t("fontFamily")}
                value={selectedField.fontFamily}
                onChange={(e) => updateField(selectedField.key, { fontFamily: e.target.value })}
                options={(enabledFamilies.includes(selectedField.fontFamily)
                  ? enabledFamilies
                  : [selectedField.fontFamily, ...enabledFamilies]
                ).map((f) => ({ value: f, label: f }))}
              />
              <Select
                id="field-font-weight"
                label={t("fontWeight")}
                value={String(selectedField.fontWeight)}
                onChange={(e) => updateField(selectedField.key, { fontWeight: Number(e.target.value) })}
                options={WEIGHT_OPTIONS.map((w) => ({ value: String(w), label: String(w) }))}
              />
              <Select
                id="field-font-style"
                label={t("fontStyle")}
                value={selectedField.fontStyle}
                onChange={(e) => updateField(selectedField.key, { fontStyle: e.target.value as "normal" | "italic" })}
                options={[
                  { value: "normal", label: tBrand("styleNormal") },
                  { value: "italic", label: tBrand("styleItalic") },
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="field-font-size"
                  type="number"
                  label={t("fontSize")}
                  value={selectedField.fontSize}
                  onChange={(e) => updateField(selectedField.key, { fontSize: Number(e.target.value) })}
                />
                <Input
                  id="field-min-font-size"
                  type="number"
                  label={t("minFontSize")}
                  value={selectedField.minFontSize}
                  onChange={(e) => updateField(selectedField.key, { minFontSize: Number(e.target.value) })}
                />
                <Input
                  id="field-line-height"
                  type="number"
                  step={0.05}
                  label={t("lineHeight")}
                  value={selectedField.lineHeight}
                  onChange={(e) => updateField(selectedField.key, { lineHeight: Number(e.target.value) })}
                />
                <Input
                  id="field-letter-spacing"
                  type="number"
                  step={0.5}
                  label={t("letterSpacing")}
                  value={selectedField.letterSpacing}
                  onChange={(e) => updateField(selectedField.key, { letterSpacing: Number(e.target.value) })}
                />
              </div>
              <Select
                id="field-alignment"
                label={t("alignment")}
                value={selectedField.alignment}
                onChange={(e) => updateField(selectedField.key, { alignment: e.target.value as TextAlignment })}
                options={ALIGN_OPTIONS.map((a) => ({
                  value: a,
                  label: a === "left" ? t("alignLeft") : a === "center" ? t("alignCenter") : t("alignRight"),
                }))}
              />
              <Input
                id="field-text-color"
                label={t("textColor")}
                value={selectedField.textColor}
                onChange={(e) => updateField(selectedField.key, { textColor: e.target.value })}
              />

              <h4 className="text-caption font-bold text-fg-secondary">{t("textFitting")}</h4>
              <Select
                id="field-overflow"
                label={t("overflowMode")}
                value={selectedField.overflowMode}
                onChange={(e) => updateField(selectedField.key, { overflowMode: e.target.value as OverflowMode })}
                options={OVERFLOW_OPTIONS.map((o) => ({
                  value: o,
                  label:
                    o === "fixed" ? t("overflowFixed") : o === "auto_fit" ? t("overflowAutoFit") : t("overflowFlexHeight"),
                }))}
              />
              <Input
                id="field-max-lines"
                type="number"
                min={1}
                label={t("maxLines")}
                value={selectedField.maxLines}
                onChange={(e) => updateField(selectedField.key, { maxLines: Number(e.target.value) })}
              />

              <h4 className="text-caption font-bold text-fg-secondary">{t("position")}</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="field-x"
                  type="number"
                  label={t("x")}
                  value={selectedField.x}
                  onChange={(e) => updateField(selectedField.key, { x: Number(e.target.value) })}
                />
                <Input
                  id="field-y"
                  type="number"
                  label={t("y")}
                  value={selectedField.y}
                  onChange={(e) => updateField(selectedField.key, { y: Number(e.target.value) })}
                />
                <Input
                  id="field-width"
                  type="number"
                  label={t("width")}
                  value={selectedField.width}
                  onChange={(e) => updateField(selectedField.key, { width: Number(e.target.value) })}
                />
                <Input
                  id="field-height"
                  type="number"
                  label={t("height")}
                  value={selectedField.height}
                  onChange={(e) => updateField(selectedField.key, { height: Number(e.target.value) })}
                />
              </div>
            </Card>
            </div>
          ) : null}
        </div>

        {/* Canvas */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <CardHeader
              title={t("canvas.title")}
              action={
                <div className="flex items-center gap-2">
                  <span className="text-caption font-bold text-fg-secondary">{t("canvas.fit")}</span>
                  <SegmentedControl
                    ariaLabel={t("canvas.fit")}
                    size="sm"
                    value={zoom}
                    onChange={setZoom}
                    options={ZOOM_OPTIONS.map((z) => ({ value: z, label: `${z}%` }))}
                  />
                  <Button variant="ghost" leadingIcon={Eye} aria-pressed={showSafeZone} onClick={() => setShowSafeZone((s) => !s)}>
                    {showSafeZone ? t("pipGuideOn") : t("pipGuideOff")}
                  </Button>
                  <Button
                    variant={safeZoneEditing ? "primary" : "secondary"}
                    leadingIcon={Video}
                    aria-pressed={safeZoneEditing}
                    onClick={() => {
                      setSafeZoneEditing((editing) => !editing);
                      setSelectedKey(null);
                    }}
                  >
                    {t("canvas.editSafeZone")}
                  </Button>
                </div>
              }
            />
            {/* Text-box toolbar — the Fields card's "+" does the same, this keeps it next to the canvas. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" leadingIcon={Plus} onClick={addField} disabled={safeZoneEditing}>
                {t("canvas.addTextBox")}
              </Button>
              <Button
                variant="ghost"
                leadingIcon={Copy}
                onClick={() => selectedKey && duplicateField(selectedKey)}
                disabled={!selectedKey || safeZoneEditing}
              >
                {t("canvas.duplicate")}
              </Button>
              <Button
                variant="ghost"
                leadingIcon={Trash2}
                onClick={() => selectedKey && removeField(selectedKey)}
                disabled={!selectedKey || safeZoneEditing}
              >
                {t("canvas.delete")}
              </Button>
            </div>
            <StudioCanvas
              rendererKey={template.rendererKey}
              fields={previewFields}
              content={previewContent}
              backgroundType={backgroundType}
              backgroundColorHex={backgroundType === "color" ? backgroundColorHex : null}
              backgroundImageUrl={backgroundType === "image" ? assetUrls[backgroundAssetId] : null}
              overlayColor={overlayColor}
              overlayOpacity={overlayOpacity}
              safeZone={safeZoneDraft}
              showSafeZone={showSafeZone}
              safeZoneLabel={tSafeZones("label")}
              safeZoneEditing={safeZoneEditing}
              selectedKey={selectedKey}
              locale={locale}
              zoom={zoom}
              onSelectField={setSelectedKey}
              onBeginChange={pushHistory}
              onFieldChange={updateFieldBox}
              onSafeZoneChange={setSafeZoneDraft}
            />
            {overlappingFields.length > 0 ? (
              <MessageState
                state="warning"
                title={tCommon("review")}
                message={overlappingFields.map((f) => t("safeZoneOverlap", { field: f.labelEn })).join(" ")}
              />
            ) : null}
            <MessageState state="info" title={t("implementationModel")} message={t("implementationBody")} />
          </Card>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <CardHeader
              title={t("editableFields")}
              action={
                <IconButton icon={Plus} variant="outlined" aria-label={t("addField")} onClick={addField} />
              }
            />
            <div className="flex flex-col gap-2">
              {[...fields]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  // A <button> may not contain another <button> — the row is a plain
                  // container with a select button and a separate remove button.
                  <div
                    key={field.key}
                    className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 transition-colors ${
                      selectedKey === field.key ? "border-primary bg-surface-subtle" : "border-border hover:bg-surface-subtle"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedKey === field.key}
                      onClick={() => setSelectedKey(field.key)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-label font-bold text-fg">{field.labelEn}</span>
                      <span className="block truncate text-caption text-fg-secondary">
                        {field.teamEditable ? t("fieldMetaEditable") : t("fieldMetaAdminOnly")} ·{" "}
                        {field.overflowMode === "fixed"
                          ? t("fieldMetaFixed")
                          : field.overflowMode === "auto_fit"
                            ? t("fieldMetaAutoFit")
                            : t("fieldMetaMaxLines", { count: field.maxLines })}
                      </span>
                    </button>
                    <IconButton
                      icon={Trash2}
                      variant="ghost"
                      size={36}
                      aria-label={t("removeField")}
                      onClick={() => removeField(field.key)}
                    />
                  </div>
                ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <CardHeader title={t("allowedAssets")} />
            <div className="flex flex-col gap-2">
              {assets.length === 0 ? (
                <p className="text-caption text-fg-secondary">{t("noPublishedAssets")}</p>
              ) : (
                assets.map((asset) => (
                  <label key={asset.id} className="flex items-center gap-2.5 text-label text-fg">
                    <input
                      type="checkbox"
                      checked={allowedAssetIds.includes(asset.id)}
                      onChange={(e) =>
                        setAllowedAssetIds((current) =>
                          e.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                        )
                      }
                    />
                    {isFr ? asset.nameFr : asset.nameEn}
                  </label>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
