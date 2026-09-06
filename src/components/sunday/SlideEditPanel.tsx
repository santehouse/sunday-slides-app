"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Slide, SlideContent, Template } from "@/lib/domain/types";
import type { ResolvedAsset, SlideFitResult } from "@/lib/renderer/types";
import { fitSlide } from "@/lib/renderer/fitText";
import { createCanvasMeasurer, ensureFontsLoaded } from "@/lib/renderer/measure";
import { Button } from "@/components/ui/Button";
import { ColorSelect } from "@/components/ui/ColorSelect";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { MessageState } from "@/components/ui/MessageState";
import { SafeZonesAction } from "@/components/ui/SafeZonesAction";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { duplicateSlideAction, removeSlideAction, saveSlideAction } from "@/app/[locale]/(sunday)/sunday/[date]/actions";

export type ApprovedColorOption = { id: string; nameEn: string; nameFr: string; hex: string };

export type SlideEditPanelHandle = {
  isDirty: () => boolean;
};

export type SlideEditPanelProps = {
  date: string;
  slide: Slide;
  templates: Template[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  colors: ApprovedColorOption[];
  safeZone: { x: number; y: number; width: number; height: number };
  /** Called after a successful save/duplicate/remove — the parent already owns navigation/selection. */
  onSaved: () => void;
  onRemoved: () => void;
  onDuplicated: (slide: Slide) => void;
};

type BackgroundMode = "color" | "image";

function fitKind(fit: SlideFitResult | null): "success" | "warning" | "error" {
  if (!fit) return "success";
  if (fit.fields.some((f) => f.status === "overflow")) return "error";
  if (fit.fields.some((f) => f.status === "tight")) return "warning";
  return "success";
}

/**
 * The Step 2 ("Check slides") edit panel — one slide's live preview plus its editable
 * fields, moved out of the old full-page Slide Editor so it can sit inline next to the
 * Sunday Flow list. Exposes `isDirty()` via ref so the parent can guard slide switches.
 */
export const SlideEditPanel = forwardRef<SlideEditPanelHandle, SlideEditPanelProps>(function SlideEditPanel(
  { date, slide, templates, assetsByTemplateId, colors, safeZone, onSaved, onRemoved, onDuplicated },
  ref,
) {
  const t = useTranslations("sunday.simple.edit");
  const tCommon = useTranslations("common");
  const tSafeZones = useTranslations("sunday.safeZones");
  const locale = useLocale() as AppLocale;
  const { showToast } = useToast();

  const templatesById = useMemo(() => Object.fromEntries(templates.map((tpl) => [tpl.id, tpl])), [templates]);

  const [templateId, setTemplateId] = useState(slide.templateId);
  const [content, setContent] = useState<SlideContent>({ headline: slide.headline, ...slide.content });
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(slide.backgroundMode);
  const [approvedColorId, setApprovedColorId] = useState<string | null>(slide.approvedColorId);
  const [assetId, setAssetId] = useState<string | null>(slide.assetId);
  const [includeInVideo, setIncludeInVideo] = useState(slide.includeInVideo);
  const [rememberMappingChecked, setRememberMappingChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [fit, setFit] = useState<SlideFitResult | null>(null);

  const template = templatesById[templateId];

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({
      templateId: slide.templateId,
      content: { headline: slide.headline, ...slide.content },
      backgroundMode: slide.backgroundMode,
      approvedColorId: slide.approvedColorId,
      assetId: slide.assetId,
      includeInVideo: slide.includeInVideo,
    }),
  );

  const currentSnapshot = JSON.stringify({ templateId, content, backgroundMode, approvedColorId, assetId, includeInVideo });
  const dirty = currentSnapshot !== savedSnapshot;

  useImperativeHandle(ref, () => ({ isDirty: () => dirty }), [dirty]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const contentKey = JSON.stringify(content);
  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    (async () => {
      const fonts = template.fields.map((f) => ({ family: f.fontFamily, weight: f.fontWeight, style: f.fontStyle }));
      await ensureFontsLoaded(fonts, document);
      if (cancelled) return;
      const measurer = createCanvasMeasurer(document);
      const result = fitSlide(template, { id: slide.id, headline: content.headline ?? "", content }, measurer);
      if (!cancelled) setFit(result);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, contentKey]);

  if (!template) return null;

  const editableFields = [...template.fields].filter((f) => f.teamEditable).sort((a, b) => a.sortOrder - b.sortOrder);
  const availableAssets = assetsByTemplateId[template.id] ?? [];
  const colorOptions = colors.map((c) => ({ id: c.id, name: locale === "fr-CA" ? c.nameFr : c.nameEn, hex: c.hex }));
  const templateChanged = templateId !== slide.templateId;
  const canRememberMapping = Boolean(slide.sourceAnnouncement) && templateChanged;

  function handleTemplateChange(nextId: string) {
    const nextTemplate = templatesById[nextId];
    if (!nextTemplate) return;
    const nextContent: SlideContent = {};
    for (const field of nextTemplate.fields) {
      nextContent[field.fieldKey] = content[field.fieldKey] ?? "";
    }
    setTemplateId(nextId);
    setContent(nextContent);
    if (!nextTemplate.allowTeamBackgroundChoice) setBackgroundMode(nextTemplate.backgroundType);
    if ((assetsByTemplateId[nextId] ?? []).length === 0 && backgroundMode === "image") setBackgroundMode("color");
  }

  function updateField(fieldKey: string, value: string) {
    setContent((prev) => ({ ...prev, [fieldKey]: value }));
  }

  async function handleSave() {
    setAttemptedSave(true);
    setSaving(true);
    try {
      const firstFieldKey = editableFields[0]?.fieldKey;
      const headline = content.headline ?? (firstFieldKey ? content[firstFieldKey] : undefined) ?? slide.headline;
      const status = fit?.exportable === false ? "invalid" : "ready";
      await saveSlideAction(slide.id, date, {
        templateId,
        headline,
        content,
        backgroundMode,
        approvedColorId: backgroundMode === "color" ? approvedColorId : null,
        assetId: backgroundMode === "image" ? assetId : null,
        includeInVideo,
        status,
        rememberMappingTemplateId: canRememberMapping && rememberMappingChecked ? templateId : undefined,
      });
      setSavedSnapshot(currentSnapshot);
      showToast({ state: "success", title: t("saved"), message: content.headline ?? slide.headline });
      if (canRememberMapping && rememberMappingChecked) {
        showToast({ state: "success", title: t("mappingRemembered"), message: t("mappingRemembered") });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const created = await duplicateSlideAction(slide.id, date);
      showToast({ state: "success", title: t("duplicated"), message: created.headline });
      onDuplicated(created);
    } finally {
      setDuplicating(false);
    }
  }

  async function confirmRemove() {
    setRemoving(true);
    try {
      const result = await removeSlideAction(slide.id, date);
      if (!result.ok) {
        showToast({ state: "warning", title: t("removeThisSlide"), message: t("cannotRemove") });
      } else {
        onRemoved();
      }
    } finally {
      setRemoving(false);
      setConfirmingRemove(false);
    }
  }

  const messageKind = fitKind(fit);
  const messageCopy =
    messageKind === "success"
      ? { title: t("textFitGood"), message: t("textFitGoodBody") }
      : messageKind === "warning"
        ? { title: t("textFitWarning"), message: t("textFitWarningBody") }
        : { title: t("textTooLong"), message: t("textTooLongBody") };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex h-10 items-center justify-between gap-3">
        <h2 className="truncate text-h3 font-bold text-fg">{slide.headline || t("untitledSlide")}</h2>
        <SafeZonesAction active={showSafeZone} onToggle={() => setShowSafeZone((v) => !v)} />
      </div>

      <div className="flex w-full items-center justify-center rounded-[12px] bg-surface-subtle p-3.5">
        <div className="aspect-video w-full max-w-[640px] overflow-hidden rounded-[10px]">
          <SlidePreview
            template={template}
            slide={{ id: slide.id, headline: content.headline ?? "", content, backgroundMode, assetId }}
            backgroundColorHex={approvedColorId ? (colorOptions.find((c) => c.id === approvedColorId)?.hex ?? null) : null}
            assets={availableAssets}
            safeZone={safeZone}
            showSafeZone={showSafeZone}
            safeZoneLabel={tSafeZones("label")}
          />
        </div>
      </div>

      <h3 className="text-h3 font-bold text-fg">{t("content")}</h3>

      <Select
        label={t("template")}
        value={templateId}
        onChange={(event) => handleTemplateChange(event.target.value)}
        options={templates.map((tpl) => ({ value: tpl.id, label: locale === "fr-CA" ? tpl.nameFr : tpl.nameEn }))}
      />

      {editableFields.map((field) => {
        const value = content[field.fieldKey] ?? "";
        const label = locale === "fr-CA" ? field.labelFr : field.labelEn;
        const showRequiredError = attemptedSave && field.required && value.trim() === "";
        return (
          <Input
            key={field.fieldKey}
            label={field.required ? `${label} *` : label}
            value={value}
            onChange={(event) => updateField(field.fieldKey, event.target.value)}
            error={showRequiredError ? t("requiredField") : undefined}
          />
        );
      })}

      {template.allowTeamBackgroundChoice ? (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-fg-secondary">{t("background")}</p>
          <SegmentedControl
            ariaLabel={t("background")}
            size="sm"
            value={backgroundMode}
            onChange={setBackgroundMode}
            options={[
              { value: "color" as BackgroundMode, label: t("color") },
              { value: "image" as BackgroundMode, label: t("image"), disabled: availableAssets.length === 0 },
            ]}
          />

          {backgroundMode === "color" ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-caption text-fg-secondary">{t("approvedColor")}</p>
              <ColorSelect aria-label={t("approvedColor")} options={colorOptions} value={approvedColorId} onChange={setApprovedColorId} />
            </div>
          ) : availableAssets.length === 0 ? (
            <MessageState state="info" title={t("background")} message={t("noImagesForTemplate")} />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableAssets.map(({ asset, url }) => (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={assetId === asset.id}
                  aria-label={asset.nameEn}
                  onClick={() => setAssetId(asset.id)}
                  className={`aspect-video overflow-hidden rounded-[8px] border bg-cover bg-center ${
                    assetId === asset.id ? "border-2 border-primary" : "border-border"
                  }`}
                  style={{ backgroundImage: `url(${url})` }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Toggle checked={includeInVideo} onChange={setIncludeInVideo} label={t("includeInVideo")} />

      {canRememberMapping ? (
        <Toggle
          checked={rememberMappingChecked}
          onChange={setRememberMappingChecked}
          label={t("rememberMapping", { name: slide.sourceAnnouncement?.headline ?? slide.headline })}
        />
      ) : null}

      <MessageState state={messageKind} title={messageCopy.title} message={messageCopy.message} />

      <div className="flex items-center gap-2.5">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {tCommon("save")}
        </Button>
        <Button variant="secondary" onClick={handleDuplicate} loading={duplicating}>
          {t("duplicate")}
        </Button>
        {!slide.isStructural ? (
          <Button variant="ghost" onClick={() => setConfirmingRemove(true)}>
            {t("removeThisSlide")}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        onConfirm={confirmRemove}
        confirmLoading={removing}
        destructive
        title={t("removeConfirmTitle")}
        doubleConfirm={{
          title: t("removeFinalTitle"),
          confirmLabel: t("removeFinalConfirm"),
          children: t("removeFinalBody"),
        }}
      >
        {t("removeConfirmBody", { title: slide.headline || t("untitledSlide") })}
      </ConfirmDialog>
    </div>
  );
});
