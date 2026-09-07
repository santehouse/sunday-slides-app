"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { Slide, SlideContent, Template } from "@/lib/domain/types";
import { resolveSlideBackgroundHex } from "@/lib/sunday/background";
import type { ResolvedAsset, SlideFitResult } from "@/lib/renderer/types";
import { fitSlide } from "@/lib/renderer/fitText";
import { createCanvasMeasurer, ensureFontsLoaded } from "@/lib/renderer/measure";
import { ColorSelect } from "@/components/ui/ColorSelect";
import { Input } from "@/components/ui/Input";
import { MessageState } from "@/components/ui/MessageState";
import { SafeZonesAction } from "@/components/ui/SafeZonesAction";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { duplicateSlideAction, saveSlideAction } from "@/app/[locale]/(sunday)/sunday/actions";

export type ApprovedColorOption = { id: string; nameEn: string; nameFr: string; hex: string };

export type SlideEditFormBusy = { saving: boolean; duplicating: boolean };

export type SlideEditFormHandle = {
  isDirty: () => boolean;
  /** Saves the slide — driven by the host modal's sticky footer button. */
  save: () => Promise<void>;
  /** Duplicates the slide — driven by the host modal's sticky footer button. */
  duplicate: () => Promise<void>;
};

export type SlideEditFormProps = {
  slide: Slide;
  templates: Template[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  colors: ApprovedColorOption[];
  safeZone: { x: number; y: number; width: number; height: number };
  /** Called after a successful save. */
  onSaved: (slide: Slide) => void;
  onDuplicated: (slide: Slide) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Lets the host modal show loading states on its footer Save / Duplicate buttons. */
  onBusyChange?: (busy: SlideEditFormBusy) => void;
};

type BackgroundMode = "color" | "image";

function fitKind(fit: SlideFitResult | null): "success" | "warning" | "error" {
  if (!fit) return "success";
  if (fit.fields.some((f) => f.status === "overflow")) return "error";
  if (fit.fields.some((f) => f.status === "tight")) return "warning";
  return "success";
}

/**
 * The Edit modal's body: live preview + editable fields for one slide, shared by the
 * queue's Edit modal and the New slide modal's second step (same component so the
 * volunteer immediately types the text after picking a design).
 */
export const SlideEditForm = forwardRef<SlideEditFormHandle, SlideEditFormProps>(function SlideEditForm(
  { slide, templates, assetsByTemplateId, colors, safeZone, onSaved, onDuplicated, onDirtyChange, onBusyChange },
  ref,
) {
  const t = useTranslations("sunday.simple.edit");
  const tSafeZones = useTranslations("sunday.safeZones");
  const tQueue = useTranslations("sunday.queue");
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
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
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

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onBusyChange?.({ saving, duplicating });
  }, [saving, duplicating, onBusyChange]);

  // `handleSave` / `handleDuplicate` are function declarations below (hoisted); the host
  // modal's sticky footer drives them through this handle.
  useImperativeHandle(ref, () => ({ isDirty: () => dirty, save: handleSave, duplicate: handleDuplicate }));

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
      const saved = await saveSlideAction(slide.id, {
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
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const created = await duplicateSlideAction(slide.id);
      showToast({ state: "success", title: t("duplicated"), message: created.headline });
      onDuplicated(created);
    } finally {
      setDuplicating(false);
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-3.5">
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
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex h-10 items-center justify-between">
          <span className="text-caption font-bold uppercase tracking-[0.08em] text-fg-secondary">{tQueue("previewLabel")}</span>
          <SafeZonesAction active={showSafeZone} onToggle={() => setShowSafeZone((v) => !v)} />
        </div>
        <div className="flex w-full items-center justify-center rounded-[12px] bg-surface-subtle p-3.5">
          <div className="aspect-video w-full overflow-hidden rounded-[10px]">
            <SlidePreview
              template={template}
              slide={{ id: slide.id, headline: content.headline ?? "", content, backgroundMode, assetId }}
              backgroundColorHex={resolveSlideBackgroundHex(template, { approvedColorId }, (id) => colorOptions.find((c) => c.id === id)?.hex)}
              assets={availableAssets}
              safeZone={safeZone}
              showSafeZone={showSafeZone}
              safeZoneLabel={tSafeZones("label")}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
