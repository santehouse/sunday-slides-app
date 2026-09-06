"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { Slide, SlideContent, Template } from "@/lib/domain/types";
import type { ResolvedAsset, SlideFitResult } from "@/lib/renderer/types";
import { fitSlide } from "@/lib/renderer/fitText";
import { createCanvasMeasurer, ensureFontsLoaded } from "@/lib/renderer/measure";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ColorSelect } from "@/components/ui/ColorSelect";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { MessageState } from "@/components/ui/MessageState";
import { SafeZonesAction } from "@/components/ui/SafeZonesAction";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { saveSlideAction, duplicateSlideAction } from "./actions";

export type ApprovedColorOption = { id: string; nameEn: string; nameFr: string; hex: string };

export type EditorClientProps = {
  date: string;
  slide: Slide;
  templates: Template[];
  assetsByTemplateId: Record<string, ResolvedAsset[]>;
  colors: ApprovedColorOption[];
  safeZone: { x: number; y: number; width: number; height: number };
};

type BackgroundMode = "color" | "image";

function fitKind(fit: SlideFitResult | null): "success" | "warning" | "error" {
  if (!fit) return "success";
  if (fit.fields.some((f) => f.status === "overflow")) return "error";
  if (fit.fields.some((f) => f.status === "tight")) return "warning";
  return "success";
}

function EditorClientInner({ date, slide, templates, assetsByTemplateId, colors, safeZone }: EditorClientProps) {
  const t = useTranslations("sunday.editor");
  const tCommon = useTranslations("common");
  const tSafeZones = useTranslations("sunday.safeZones");
  const tTabs = useTranslations("sunday.tabs");
  const locale = useLocale() as AppLocale;
  const format = useFormatter();
  const router = useRouter();
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
  const [confirmingBack, setConfirmingBack] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>(`/sunday/${date}/flow?slide=${slide.id}`);
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
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const created = await duplicateSlideAction(slide.id, date);
      showToast({ state: "success", title: t("duplicated"), message: created.headline });
      router.push(`/sunday/${date}/slide/${created.id}?from=flow`);
    } finally {
      setDuplicating(false);
    }
  }

  function navigateAway(href: string) {
    if (dirty) {
      setPendingHref(href);
      setConfirmingBack(true);
      return;
    }
    router.push(href);
  }

  function handleBack() {
    navigateAway(`/sunday/${date}/flow?slide=${slide.id}`);
  }

  function handleBreadcrumbClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!dirty) return;
      event.preventDefault();
      navigateAway(href);
    };
  }

  const messageKind = fitKind(fit);
  const messageCopy =
    messageKind === "success"
      ? { title: t("textFitGood"), message: t("textFitGoodBody") }
      : messageKind === "warning"
        ? { title: t("textFitWarning"), message: t("textFitWarningBody") }
        : { title: t("textTooLong"), message: t("textTooLongBody") };

  return (
    <div className="flex flex-col gap-[22px]">
      <Breadcrumb
        items={[
          {
            label: format.dateTime(serviceDateToDate(date), "sundayShort"),
            href: `/sunday/${date}`,
            onClick: handleBreadcrumbClick(`/sunday/${date}`),
          },
          {
            label: tTabs("flow"),
            href: `/sunday/${date}/flow`,
            onClick: handleBreadcrumbClick(`/sunday/${date}/flow`),
          },
          { label: slide.headline || t("untitledSlide") },
        ]}
      />
      <div className="flex min-h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label={tCommon("back")} onClick={handleBack} className="text-fg">
            <ArrowLeft aria-hidden="true" size={24} />
          </button>
          <h1 className="truncate text-[24px] font-bold leading-tight text-fg">{slide.headline || t("untitledSlide")}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="secondary" onClick={handleDuplicate} loading={duplicating}>
            {tCommon("duplicate")}
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {tCommon("saveChanges")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[420px_1fr] gap-5">
        <Card padding="none" className="flex min-h-[850px] w-full flex-col gap-3.5 p-5">
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
                // Figma 35:570 always shows both segments; Image is inert when the
                // template has no approved assets rather than disappearing.
                options={[
                  { value: "color" as BackgroundMode, label: t("color") },
                  { value: "image" as BackgroundMode, label: t("image"), disabled: availableAssets.length === 0 },
                ]}
              />

              {backgroundMode === "color" ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-caption text-fg-secondary">{t("approvedColor")}</p>
                  <ColorSelect
                    aria-label={t("approvedColor")}
                    options={colorOptions}
                    value={approvedColorId}
                    onChange={setApprovedColorId}
                  />
                </div>
              ) : availableAssets.length === 0 ? (
                <MessageState state="info" title={t("templateNote")} message={t("noImagesForTemplate")} />
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

          <Toggle checked={includeInVideo} onChange={setIncludeInVideo} label={t("includeInMp4")} />

          {canRememberMapping ? (
            <Toggle
              checked={rememberMappingChecked}
              onChange={setRememberMappingChecked}
              label={t("rememberMapping", { name: slide.sourceAnnouncement?.headline ?? slide.headline })}
            />
          ) : null}

          <MessageState state={messageKind} title={messageCopy.title} message={messageCopy.message} />
        </Card>

        <Card padding="none" className="flex min-h-[850px] flex-col gap-3.5 p-5">
          <div className="flex h-10 items-center justify-between gap-3">
            <h3 className="text-h3 font-bold text-fg">{t("livePreview")}</h3>
            <SafeZonesAction active={showSafeZone} onToggle={() => setShowSafeZone((v) => !v)} />
          </div>
          {/* Figma 6:221 — a 590-tall subtle stage with the 800x450 render centred inside. */}
          <div className="flex h-[590px] w-full items-center justify-center rounded-[12px] bg-surface-subtle">
            <div className="aspect-video w-full max-w-[800px] overflow-hidden rounded-[12px]">
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
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingBack}
        onClose={() => setConfirmingBack(false)}
        onConfirm={() => {
          setConfirmingBack(false);
          router.push(pendingHref);
        }}
        title={t("unsavedTitle")}
        confirmLabel={t("discard")}
        cancelLabel={t("keepEditing")}
        destructive
      >
        {t("unsavedBody")}
      </ConfirmDialog>
    </div>
  );
}

export function EditorClient(props: EditorClientProps) {
  return (
    <ToastProvider>
      <EditorClientInner {...props} />
    </ToastProvider>
  );
}
