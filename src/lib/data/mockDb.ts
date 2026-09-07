/**
 * In-memory `Db` implementation used when `isMockMode()` is true. Seeded once
 * from `mockSeed.ts` and kept on `globalThis` so Next dev's HMR module
 * reloads don't reset state mid-session (a Sunday user editing a slide
 * shouldn't lose that edit because a server file changed).
 */
import { randomUUID } from "node:crypto";
import { addDays, subDays, format } from "date-fns";
import { nextSundayOnOrAfter } from "@/lib/utils/serviceDate";
import type {
  AdminUser,
  AnnouncementAlias,
  AnnouncementMapping,
  AppSettings,
  Asset,
  ApprovedColor,
  DefaultStructuralSlide,
  ExportJob,
  FontRecord,
  RunSheet,
  Slide,
  SystemCheck,
  Sunday,
  Template,
  TemplateField,
} from "@/lib/domain/types";
import {
  ADMIN_USER_SEED,
  APPROVED_COLOR_SEEDS,
  ASSET_SEEDS,
  computeSundayPinHash,
  FONT_SEEDS,
  MAPPING_SEEDS,
  MAPPING_SUGGESTION_SEEDS,
  SETTINGS_SEED,
  STRUCTURAL_DEFAULT_SEEDS,
  SUNDAY_SEEDS,
  TEMPLATE_SEEDS,
} from "./mockSeed";
import { normalizeAlias } from "./normalize";
import {
  FontInUseError,
  type AdjacentSundayDates,
  type CreateAssetInput,
  type CreateExportJobInput,
  type CreateFontInput,
  type CreateMappingInput,
  type CreateRunSheetInput,
  type CreateSlideInput,
  type CreateTemplateFieldInput,
  type CreateTemplateInput,
  type Db,
  type MappingSuggestion,
  type MappingWithDetails,
  type SundayListItem,
  type TemplateWithFields,
  type UpdateAssetPatch,
  type UpdateExportJobPatch,
  type UpdateFontPatch,
  type UpdateMappingPatch,
  type UpdateRunSheetPatch,
  type UpdateSettingsPatch,
  type UpdateSlidePatch,
  type UpdateSundayPatch,
  type UpdateTemplatePatch,
  type UpsertAdminUserInput,
  type UpsertApprovedColorInput,
  type UpsertStructuralDefaultInput,
} from "./types";

interface PinAttemptRecord {
  ipHash: string;
  attemptedAt: string;
  success: boolean;
}

interface MockStore {
  settings: AppSettings;
  adminUsers: AdminUser[];
  fonts: FontRecord[];
  approvedColors: ApprovedColor[];
  assets: Asset[];
  templates: Template[];
  mappings: AnnouncementMapping[];
  mappingSuggestions: MappingSuggestion[];
  structuralDefaults: DefaultStructuralSlide[];
  sundays: Sunday[];
  runSheets: RunSheet[];
  slides: Slide[];
  exportJobs: ExportJob[];
  systemChecks: SystemCheck[];
  pinAttempts: PinAttemptRecord[];
}

declare global {
  var __churchPanelsMockStore: MockStore | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function buildInitialStore(): MockStore {
  const now = nowIso();

  const fonts: FontRecord[] = FONT_SEEDS.map((f) => ({
    id: `font-${f.family.toLowerCase()}-${f.weight}-${f.style}`,
    family: f.family,
    source: f.source,
    sourceIdentifier: f.sourceIdentifier,
    r2Key: null,
    weight: f.weight,
    style: f.style,
    enabled: f.enabled ?? true,
    createdAt: now,
  }));

  const approvedColors: ApprovedColor[] = APPROVED_COLOR_SEEDS.map((c) => ({
    id: `color-${c.nameEn.toLowerCase()}`,
    nameEn: c.nameEn,
    nameFr: c.nameFr,
    hex: c.hex,
    enabled: c.enabled ?? true,
    sortOrder: c.sortOrder,
  }));

  const assets: Asset[] = ASSET_SEEDS.map((a) => ({
    id: `asset-${a.slug}`,
    nameEn: a.nameEn,
    nameFr: a.nameFr,
    status: a.status ?? "published",
    category: a.category,
    tags: a.tags ?? [],
    r2Key: `assets/${a.slug}.svg`,
    mimeType: "image/svg+xml",
    width: a.width,
    height: a.height,
    focalX: 0.5,
    focalY: 0.5,
    cropMetadata: null,
    createdAt: now,
    updatedAt: now,
  }));
  const assetIdBySlug = new Map(ASSET_SEEDS.map((a, i) => [a.slug, assets[i].id]));

  const templates: Template[] = TEMPLATE_SEEDS.map((t) => {
    const templateId = `tmpl-${t.slug}`;
    const fields: TemplateField[] = t.fields.map((f) => ({
      id: `field-${t.slug}-${f.fieldKey}`,
      templateId,
      fieldKey: f.fieldKey,
      fieldType: f.fieldType ?? "text",
      labelEn: f.labelEn,
      labelFr: f.labelFr,
      teamEditable: f.teamEditable,
      required: f.required,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      fontId: null,
      fontFamily: f.fontFamily,
      fontSize: f.fontSize,
      minFontSize: f.minFontSize,
      fontWeight: f.fontWeight,
      fontStyle: f.fontStyle,
      lineHeight: f.lineHeight,
      letterSpacing: f.letterSpacing,
      alignment: f.alignment,
      textColor: f.textColor,
      maxLines: f.maxLines,
      overflowMode: f.overflowMode,
      sortOrder: f.sortOrder,
      textTransform: f.textTransform,
      defaultValue: f.defaultValue ?? "",
      rotation: f.rotation ?? 0,
      boxColor: f.boxColor ?? null,
      boxPadding: f.boxPadding ?? 0,
      frameColor: f.frameColor ?? null,
      frameWidth: f.frameWidth ?? 0,
    }));
    const backgroundValue =
      t.backgroundType === "image" ? (assetIdBySlug.get(t.backgroundValue) ?? t.backgroundValue) : t.backgroundValue;
    return {
      id: templateId,
      slug: t.slug,
      nameEn: t.nameEn,
      nameFr: t.nameFr,
      category: t.category,
      status: t.status,
      rendererKey: t.rendererKey ?? "generic-v1",
      backgroundType: t.backgroundType,
      backgroundValue,
      overlayColor: t.overlayColor,
      overlayOpacity: t.overlayOpacity,
      includeInVideoDefault: t.includeInVideoDefault,
      allowTeamBackgroundChoice: t.allowTeamBackgroundChoice,
      fields,
      allowedAssetIds: t.allowedAssetSlugs.map((slug) => assetIdBySlug.get(slug) ?? slug),
      createdAt: now,
      updatedAt: now,
    };
  });
  const templateIdBySlug = new Map(TEMPLATE_SEEDS.map((t, i) => [t.slug, templates[i].id]));

  const mappings: AnnouncementMapping[] = MAPPING_SEEDS.map((m) => {
    const mappingId = `map-${m.canonicalKey}`;
    const aliases: AnnouncementAlias[] = m.aliases.map((a, i) => ({
      id: `alias-${m.canonicalKey}-${i}`,
      mappingId,
      alias: a.alias,
      locale: a.locale,
    }));
    return {
      id: mappingId,
      canonicalName: m.canonicalName,
      canonicalKey: m.canonicalKey,
      templateId: templateIdBySlug.get(m.templateSlug) ?? m.templateSlug,
      active: true,
      aliases,
      createdAt: now,
      updatedAt: now,
    };
  });

  const mappingSuggestions: MappingSuggestion[] = MAPPING_SUGGESTION_SEEDS.map((text) => ({
    id: `suggestion-${normalizeAlias(text).replace(/\s+/g, "-")}`,
    sourceText: text,
    sourceTextNormalized: normalizeAlias(text),
    lastSeenAt: now,
    seenCount: 1,
    dismissedAt: null,
  }));

  const structuralDefaults: DefaultStructuralSlide[] = STRUCTURAL_DEFAULT_SEEDS.map((s) => ({
    id: `struct-${normalizeAlias(s.nameEn).replace(/\s+/g, "-")}`,
    templateId: templateIdBySlug.get(s.templateSlug) ?? s.templateSlug,
    nameEn: s.nameEn,
    nameFr: s.nameFr,
    insertionRule: s.insertionRule,
    defaultSortZone: s.defaultSortZone,
    sortOrder: s.sortOrder,
    enabled: true,
    removableBySundayTeam: s.removableBySundayTeam,
    includeInVideoDefault: s.includeInVideoDefault,
    defaultContent: s.defaultContent,
  }));
  const structuralIdByNameEn = new Map(STRUCTURAL_DEFAULT_SEEDS.map((s, i) => [s.nameEn, structuralDefaults[i].id]));
  const mappingIdByCanonicalKey = new Map(mappings.map((m) => [m.canonicalKey, m.id]));

  const sundays: Sunday[] = [];
  const runSheets: RunSheet[] = [];
  const slides: Slide[] = [];

  for (const s of SUNDAY_SEEDS) {
    const sundayId = `sunday-${s.serviceDate}`;
    let runSheetId: string | null = null;
    if (s.runSheet) {
      runSheetId = `runsheet-${s.serviceDate}`;
      const receivedAt = new Date(Date.now() - s.runSheet.receivedMinutesAgo * 60_000).toISOString();
      runSheets.push({
        id: runSheetId,
        sundayId,
        sourceType: s.runSheet.sourceType,
        originalFilename: s.runSheet.originalFilename,
        mimeType: s.runSheet.mimeType,
        r2Key: s.runSheet.r2Key,
        extractedText: s.runSheet.extractedText ?? null,
        parseStatus: s.runSheet.parseStatus,
        parseError: null,
        parsedJson: s.runSheet.parsedJson ?? null,
        receivedAt,
        processedAt: s.runSheet.processed ? receivedAt : null,
        openedAt: s.runSheet.processed ? receivedAt : null,
      });
    }

    sundays.push({
      id: sundayId,
      serviceDate: s.serviceDate,
      status: s.status,
      sourceRunSheetId: runSheetId,
      defaultSlideHoldSeconds: s.defaultSlideHoldSeconds ?? SETTINGS_SEED.defaultSlideHoldSeconds,
      createdAt: now,
      updatedAt: now,
    });

    for (const slide of s.slides) {
      const templateId = templateIdBySlug.get(slide.templateSlug) ?? slide.templateSlug;
      slides.push({
        id: `slide-${s.serviceDate}-${slide.sortOrder}`,
        sundayId,
        templateId,
        headline: slide.headline,
        content: slide.content,
        assetId: slide.assetSlug ? (assetIdBySlug.get(slide.assetSlug) ?? null) : null,
        backgroundMode: slide.backgroundMode,
        approvedColorId: slide.approvedColorName
          ? (approvedColors.find((c) => c.nameEn === slide.approvedColorName)?.id ?? null)
          : null,
        sortOrder: slide.sortOrder,
        includeInVideo: slide.includeInVideo ?? templates.find((t) => t.id === templateId)?.includeInVideoDefault ?? true,
        status: slide.status ?? "ready",
        isStructural: slide.isStructural ?? false,
        structuralDefaultId: slide.structuralDefaultNameEn
          ? (structuralIdByNameEn.get(slide.structuralDefaultNameEn) ?? null)
          : null,
        parserConfidence: slide.parserConfidence ?? null,
        mappingId: slide.mappingCanonicalKey ? (mappingIdByCanonicalKey.get(slide.mappingCanonicalKey) ?? null) : null,
        sourceAnnouncement: slide.sourceAnnouncement ?? null,
        manuallyEdited: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const settings: AppSettings = {
    id: "settings-singleton",
    churchName: SETTINGS_SEED.churchName,
    timezone: SETTINGS_SEED.timezone,
    defaultLocale: SETTINGS_SEED.defaultLocale,
    sundayPinLength: SETTINGS_SEED.sundayPinLength,
    sundayPinHash: computeSundayPinHash(),
    sundayPinVersion: 1,
    defaultSlideHoldSeconds: SETTINGS_SEED.defaultSlideHoldSeconds,
    inboundEmail: SETTINGS_SEED.inboundEmail,
    autoProcessInbound: SETTINGS_SEED.autoProcessInbound,
    safeZone: SETTINGS_SEED.safeZone,
    temporaryRetentionDays: SETTINGS_SEED.temporaryRetentionDays,
    updatedAt: now,
  };

  const adminUsers: AdminUser[] = [
    {
      id: "admin-josiah",
      authUserId: "mock-auth-josiah",
      displayName: ADMIN_USER_SEED.displayName,
      email: ADMIN_USER_SEED.email,
      role: ADMIN_USER_SEED.role,
      locale: ADMIN_USER_SEED.locale,
      createdAt: now,
      disabledAt: null,
    },
  ];

  return {
    settings,
    adminUsers,
    fonts,
    approvedColors,
    assets,
    templates,
    mappings,
    mappingSuggestions,
    structuralDefaults,
    sundays,
    runSheets,
    slides,
    exportJobs: [],
    systemChecks: [],
    pinAttempts: [],
  };
}

function getStore(): MockStore {
  if (!globalThis.__churchPanelsMockStore) {
    globalThis.__churchPanelsMockStore = buildInitialStore();
  }
  return globalThis.__churchPanelsMockStore;
}

/** Test-only: force a fresh store on the next getDb() call in this process. */
export function resetMockStore(): void {
  globalThis.__churchPanelsMockStore = undefined;
}

function notFound(what: string, id: string): never {
  throw new Error(`${what} not found: ${id}`);
}

/** Builds a new Slide record from a CreateSlideInput; shared by createSlide/createSlides/replaceSlidesForSunday. */
function buildSlide(store: MockStore, input: CreateSlideInput, fallbackSortOrder: number): Slide {
  const template = store.templates.find((t) => t.id === input.templateId);
  const now = nowIso();
  return {
    id: randomUUID(),
    sundayId: input.sundayId,
    templateId: input.templateId,
    headline: input.headline ?? "",
    content: input.content ?? {},
    assetId: input.assetId ?? null,
    backgroundMode: input.backgroundMode ?? "color",
    approvedColorId: input.approvedColorId ?? null,
    sortOrder: input.sortOrder ?? fallbackSortOrder,
    includeInVideo: input.includeInVideo ?? template?.includeInVideoDefault ?? true,
    status: input.status ?? "ready",
    isStructural: input.isStructural ?? false,
    structuralDefaultId: input.structuralDefaultId ?? null,
    parserConfidence: input.parserConfidence ?? null,
    mappingId: input.mappingId ?? null,
    sourceAnnouncement: input.sourceAnnouncement ?? null,
    manuallyEdited: input.manuallyEdited ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

function toTemplateWithFields(t: Template): TemplateWithFields {
  return clone(t);
}

function toMappingWithDetails(m: AnnouncementMapping, templates: Template[]): MappingWithDetails {
  const template = templates.find((t) => t.id === m.templateId);
  return {
    ...clone(m),
    templateName: template ? { en: template.nameEn, fr: template.nameFr } : null,
  };
}

export function createMockDb(): Db {
  return {
    // ---------- settings ----------
    async getSettings() {
      return clone(getStore().settings);
    },
    async updateSettings(patch: UpdateSettingsPatch) {
      const store = getStore();
      store.settings = { ...store.settings, ...patch, updatedAt: nowIso() };
      return clone(store.settings);
    },
    async setSundayPin(pinHash: string, length: number) {
      const store = getStore();
      store.settings = {
        ...store.settings,
        sundayPinHash: pinHash,
        sundayPinLength: length,
        sundayPinVersion: store.settings.sundayPinVersion + 1,
        updatedAt: nowIso(),
      };
      return clone(store.settings);
    },

    // ---------- admin users ----------
    async listAdminUsers() {
      return clone(getStore().adminUsers);
    },
    async getAdminUserByAuthId(authUserId: string) {
      const found = getStore().adminUsers.find((a) => a.authUserId === authUserId);
      return found ? clone(found) : null;
    },
    async upsertAdminUser(input: UpsertAdminUserInput) {
      const store = getStore();
      const existing = store.adminUsers.find((a) => a.authUserId === input.authUserId);
      if (existing) {
        Object.assign(existing, input);
        return clone(existing);
      }
      const created: AdminUser = {
        id: randomUUID(),
        authUserId: input.authUserId,
        displayName: input.displayName,
        email: input.email,
        role: input.role,
        locale: input.locale,
        createdAt: nowIso(),
        disabledAt: null,
      };
      store.adminUsers.push(created);
      return clone(created);
    },
    async updateAdminUserLocale(id: string, locale) {
      const store = getStore();
      const user = store.adminUsers.find((a) => a.id === id);
      if (!user) notFound("AdminUser", id);
      user.locale = locale;
      return clone(user);
    },
    async setAdminDisabled(id: string, disabledAt: string | null) {
      const store = getStore();
      const user = store.adminUsers.find((a) => a.id === id);
      if (!user) notFound("AdminUser", id);
      user.disabledAt = disabledAt;
      return clone(user);
    },

    // ---------- sundays ----------
    async listSundays(opts) {
      const store = getStore();
      const sorted = [...store.sundays].sort((a, b) => (a.serviceDate < b.serviceDate ? 1 : -1));
      const limited = opts?.limit ? sorted.slice(0, opts.limit) : sorted;
      const items: SundayListItem[] = limited.map((sunday) => {
        const slidesForSunday = store.slides.filter((s) => s.sundayId === sunday.id);
        const latestRunSheet =
          [...store.runSheets]
            .filter((r) => r.sundayId === sunday.id)
            .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))[0] ?? null;
        return {
          ...clone(sunday),
          slideCounts: {
            total: slidesForSunday.length,
            needsReview: slidesForSunday.filter((s) => s.status === "needs_review").length,
            includedInVideo: slidesForSunday.filter((s) => s.includeInVideo).length,
          },
          latestRunSheet: latestRunSheet ? clone(latestRunSheet) : null,
        };
      });
      return items;
    },
    async getSundayByDate(date: string) {
      const found = getStore().sundays.find((s) => s.serviceDate === date);
      return found ? clone(found) : null;
    },
    async getSundayById(id: string) {
      const found = getStore().sundays.find((s) => s.id === id);
      return found ? clone(found) : null;
    },
    async getOrCreateSundayByDate(date: string) {
      const store = getStore();
      const existing = store.sundays.find((s) => s.serviceDate === date);
      if (existing) return clone(existing);
      const created: Sunday = {
        id: randomUUID(),
        serviceDate: date,
        status: "draft",
        sourceRunSheetId: null,
        defaultSlideHoldSeconds: store.settings.defaultSlideHoldSeconds,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      store.sundays.push(created);
      return clone(created);
    },
    async getNextSunday(fromDate: string, opts) {
      const store = getStore();
      // "The current service" is the coming Sunday's exact date — never a Sunday created
      // further ahead (a special event, a pre-planned deck) just because it sorts first.
      const target = nextSundayOnOrAfter(fromDate);
      const existing = store.sundays.find((s) => s.serviceDate === target);
      if (existing) return clone(existing);
      if (!opts?.create) return null;
      // Mock-mode fallback: the seeded demo Sundays are fixed calendar dates, so once the
      // real clock rolls past the last one, the naive "create a blank Sunday" behaviour
      // below would land the whole app on an empty deck instead of the rich Figma demo.
      // Land on the latest seeded Sunday that actually has slides instead — documented in
      // docs/BUILD_HANDOFF.md's mock-mode section.
      const richestSeeded = [...store.sundays]
        .filter((s) => store.slides.some((slide) => slide.sundayId === s.id))
        .sort((a, b) => (a.serviceDate < b.serviceDate ? 1 : -1))[0];
      if (richestSeeded) return clone(richestSeeded);
      return this.getOrCreateSundayByDate(target);
    },
    async getAdjacentSundayDates(date: string): Promise<AdjacentSundayDates> {
      const store = getStore();
      const parsed = new Date(`${date}T00:00:00Z`);
      const before = [...store.sundays].filter((s) => s.serviceDate < date).sort((a, b) => (a.serviceDate < b.serviceDate ? 1 : -1))[0];
      const after = [...store.sundays].filter((s) => s.serviceDate > date).sort((a, b) => (a.serviceDate < b.serviceDate ? -1 : 1))[0];
      return {
        prev: before ? before.serviceDate : format(subDays(parsed, 7), "yyyy-MM-dd"),
        next: after ? after.serviceDate : format(addDays(parsed, 7), "yyyy-MM-dd"),
      };
    },
    async updateSunday(id: string, patch: UpdateSundayPatch) {
      const store = getStore();
      const sunday = store.sundays.find((s) => s.id === id);
      if (!sunday) notFound("Sunday", id);
      Object.assign(sunday, patch, { updatedAt: nowIso() });
      return clone(sunday);
    },

    // ---------- run sheets ----------
    async createRunSheet(input: CreateRunSheetInput) {
      const store = getStore();
      const created: RunSheet = {
        id: randomUUID(),
        sundayId: input.sundayId,
        sourceType: input.sourceType,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        r2Key: input.r2Key,
        extractedText: input.extractedText ?? null,
        parseStatus: input.parseStatus ?? "queued",
        parseError: null,
        parsedJson: input.parsedJson ?? null,
        receivedAt: input.receivedAt ?? nowIso(),
        processedAt: null,
        openedAt: null,
      };
      store.runSheets.push(created);
      if (input.inboundEventId) {
        (created as unknown as { inboundEventId?: string }).inboundEventId = input.inboundEventId;
      }
      return clone(created);
    },
    async getRunSheet(id: string) {
      const found = getStore().runSheets.find((r) => r.id === id);
      return found ? clone(found) : null;
    },
    async listRunSheetsForSunday(sundayId: string) {
      return clone(
        getStore()
          .runSheets.filter((r) => r.sundayId === sundayId)
          .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1)),
      );
    },
    async getLatestRunSheetForSunday(sundayId: string) {
      const list = getStore()
        .runSheets.filter((r) => r.sundayId === sundayId)
        .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
      return list[0] ? clone(list[0]) : null;
    },
    async listRecentRunSheets(limit: number) {
      return clone(
        [...getStore().runSheets].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1)).slice(0, limit),
      );
    },
    async updateRunSheet(id: string, patch: UpdateRunSheetPatch) {
      const store = getStore();
      const runSheet = store.runSheets.find((r) => r.id === id);
      if (!runSheet) notFound("RunSheet", id);
      Object.assign(runSheet, patch);
      return clone(runSheet);
    },
    async findRunSheetByInboundEventId(eventId: string) {
      const found = getStore().runSheets.find(
        (r) => (r as unknown as { inboundEventId?: string }).inboundEventId === eventId,
      );
      return found ? clone(found) : null;
    },

    // ---------- slides ----------
    async listSlidesForSunday(sundayId: string) {
      return clone(
        getStore()
          .slides.filter((s) => s.sundayId === sundayId)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
    async getSlide(id: string) {
      const found = getStore().slides.find((s) => s.id === id);
      return found ? clone(found) : null;
    },
    async createSlide(input: CreateSlideInput) {
      const store = getStore();
      const fallbackSortOrder = store.slides.filter((s) => s.sundayId === input.sundayId).length;
      const created = buildSlide(store, input, fallbackSortOrder);
      store.slides.push(created);
      return clone(created);
    },
    async createSlides(inputs: CreateSlideInput[]) {
      const store = getStore();
      const results: Slide[] = [];
      let nextSortOrder = store.slides.filter((s) => s.sundayId === inputs[0]?.sundayId).length;
      for (const input of inputs) {
        const created = buildSlide(store, input, nextSortOrder);
        store.slides.push(created);
        results.push(clone(created));
        nextSortOrder += 1;
      }
      return results;
    },
    async updateSlide(id: string, patch: UpdateSlidePatch) {
      const store = getStore();
      const slide = store.slides.find((s) => s.id === id);
      if (!slide) notFound("Slide", id);
      Object.assign(slide, patch, { updatedAt: nowIso() });
      return clone(slide);
    },
    async deleteSlide(id: string) {
      const store = getStore();
      store.slides = store.slides.filter((s) => s.id !== id);
    },
    async reorderSlides(sundayId: string, orderedIds: string[]) {
      const store = getStore();
      const index = new Map(orderedIds.map((id, i) => [id, i]));
      for (const slide of store.slides) {
        if (slide.sundayId !== sundayId) continue;
        const next = index.get(slide.id);
        if (next !== undefined) {
          slide.sortOrder = next;
          slide.updatedAt = nowIso();
        }
      }
      return clone(
        store.slides.filter((s) => s.sundayId === sundayId).sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
    async replaceSlidesForSunday(sundayId: string, inputs: CreateSlideInput[]) {
      const store = getStore();
      store.slides = store.slides.filter((s) => s.sundayId !== sundayId);
      const created = inputs.map((input, i) => {
        const slide = buildSlide(store, { ...input, sundayId }, i);
        store.slides.push(slide);
        return slide;
      });
      return clone(created.sort((a, b) => a.sortOrder - b.sortOrder));
    },

    // ---------- templates ----------
    async listTemplates(opts) {
      const store = getStore();
      return store.templates
        .filter((t) => (opts?.status ? t.status === opts.status : true))
        .filter((t) => (opts?.category ? t.category === opts.category : true))
        .map(toTemplateWithFields);
    },
    async getTemplate(id: string) {
      const found = getStore().templates.find((t) => t.id === id);
      return found ? toTemplateWithFields(found) : null;
    },
    async getTemplateBySlug(slug: string) {
      const found = getStore().templates.find((t) => t.slug === slug);
      return found ? toTemplateWithFields(found) : null;
    },
    async createTemplate(input: CreateTemplateInput) {
      const store = getStore();
      const now = nowIso();
      const created: Template = {
        id: randomUUID(),
        slug: input.slug,
        nameEn: input.nameEn,
        nameFr: input.nameFr,
        category: input.category,
        status: input.status ?? "draft",
        rendererKey: input.rendererKey ?? "generic-v1",
        backgroundType: input.backgroundType ?? "color",
        backgroundValue: input.backgroundValue ?? "#0f172a",
        overlayColor: input.overlayColor ?? "none",
        overlayOpacity: input.overlayOpacity ?? 0,
        includeInVideoDefault: input.includeInVideoDefault ?? true,
        allowTeamBackgroundChoice: input.allowTeamBackgroundChoice ?? true,
        fields: [],
        allowedAssetIds: [],
        createdAt: now,
        updatedAt: now,
      };
      store.templates.push(created);
      return toTemplateWithFields(created);
    },
    async updateTemplate(id: string, patch: UpdateTemplatePatch) {
      const store = getStore();
      const template = store.templates.find((t) => t.id === id);
      if (!template) notFound("Template", id);
      Object.assign(template, patch, { updatedAt: nowIso() });
      return toTemplateWithFields(template);
    },
    async upsertTemplateFields(templateId: string, fields: CreateTemplateFieldInput[]) {
      const store = getStore();
      const template = store.templates.find((t) => t.id === templateId);
      if (!template) notFound("Template", templateId);
      template.fields = fields.map((f) => ({
        id: randomUUID(),
        templateId,
        ...f,
        fieldType: f.fieldType ?? ("text" as const),
        fontId: f.fontId ?? null,
        defaultValue: f.defaultValue ?? "",
        rotation: f.rotation ?? 0,
        boxColor: f.boxColor ?? null,
        boxPadding: f.boxPadding ?? 0,
        frameColor: f.frameColor ?? null,
        frameWidth: f.frameWidth ?? 0,
      }));
      return clone(template.fields);
    },
    async setTemplateAssets(templateId: string, assetIds: string[]) {
      const store = getStore();
      const template = store.templates.find((t) => t.id === templateId);
      if (!template) notFound("Template", templateId);
      template.allowedAssetIds = [...assetIds];
    },
    async countSlidesUsingTemplate(templateId: string) {
      return getStore().slides.filter((s) => s.templateId === templateId).length;
    },

    // ---------- assets ----------
    async listAssets(opts) {
      return clone(
        getStore()
          .assets.filter((a) => (opts?.status ? a.status === opts.status : true))
          .filter((a) => (opts?.category ? a.category === opts.category : true)),
      );
    },
    async getAsset(id: string) {
      const found = getStore().assets.find((a) => a.id === id);
      return found ? clone(found) : null;
    },
    async createAsset(input: CreateAssetInput) {
      const store = getStore();
      const now = nowIso();
      const created: Asset = {
        id: randomUUID(),
        nameEn: input.nameEn,
        nameFr: input.nameFr,
        status: input.status ?? "draft",
        category: input.category,
        tags: input.tags ?? [],
        r2Key: input.r2Key,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        focalX: input.focalX ?? 0.5,
        focalY: input.focalY ?? 0.5,
        cropMetadata: input.cropMetadata ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.assets.push(created);
      return clone(created);
    },
    async updateAsset(id: string, patch: UpdateAssetPatch) {
      const store = getStore();
      const asset = store.assets.find((a) => a.id === id);
      if (!asset) notFound("Asset", id);
      Object.assign(asset, patch, { updatedAt: nowIso() });
      return clone(asset);
    },
    async listAssetsForTemplate(templateId: string, opts) {
      const store = getStore();
      const template = store.templates.find((t) => t.id === templateId);
      if (!template) notFound("Template", templateId);
      const allowed = new Set(template.allowedAssetIds);
      return clone(
        store.assets
          .filter((a) => allowed.has(a.id))
          .filter((a) => (opts?.publishedOnly === false ? true : a.status === "published")),
      );
    },

    // ---------- approved colors ----------
    async listApprovedColors(opts) {
      const list = getStore()
        .approvedColors.filter((c) => (opts?.enabledOnly ? c.enabled : true))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return clone(list);
    },
    async upsertApprovedColor(input: UpsertApprovedColorInput) {
      const store = getStore();
      if (input.id) {
        const existing = store.approvedColors.find((c) => c.id === input.id);
        if (!existing) notFound("ApprovedColor", input.id);
        Object.assign(existing, input);
        return clone(existing);
      }
      const created: ApprovedColor = {
        id: randomUUID(),
        nameEn: input.nameEn,
        nameFr: input.nameFr,
        hex: input.hex,
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? store.approvedColors.length,
      };
      store.approvedColors.push(created);
      return clone(created);
    },
    async deleteApprovedColor(id: string) {
      const store = getStore();
      store.approvedColors = store.approvedColors.filter((c) => c.id !== id);
    },

    // ---------- fonts ----------
    async listFonts() {
      return clone(getStore().fonts);
    },
    async createFont(input: CreateFontInput) {
      const store = getStore();
      const created: FontRecord = {
        id: randomUUID(),
        family: input.family,
        source: input.source,
        sourceIdentifier: input.sourceIdentifier ?? null,
        r2Key: input.r2Key ?? null,
        weight: input.weight,
        style: input.style,
        enabled: input.enabled ?? true,
        createdAt: nowIso(),
      };
      store.fonts.push(created);
      return clone(created);
    },
    async updateFont(id: string, patch: UpdateFontPatch) {
      const store = getStore();
      const font = store.fonts.find((f) => f.id === id);
      if (!font) notFound("Font", id);
      Object.assign(font, patch);
      return clone(font);
    },
    async deleteFont(id: string) {
      const store = getStore();
      const font = store.fonts.find((f) => f.id === id);
      if (!font) notFound("Font", id);
      const usedBy = store.templates.filter(
        (t) => t.status === "published" && t.fields.some((f) => f.fontId === id || f.fontFamily === font.family),
      );
      if (usedBy.length > 0) {
        throw new FontInUseError(
          id,
          usedBy.map((t) => t.nameEn),
        );
      }
      store.fonts = store.fonts.filter((f) => f.id !== id);
    },
    async listFontsUsedByPublishedTemplates() {
      const store = getStore();
      const families = new Set(
        store.templates.filter((t) => t.status === "published").flatMap((t) => t.fields.map((f) => f.fontFamily)),
      );
      return clone(store.fonts.filter((f) => families.has(f.family)));
    },

    // ---------- mappings ----------
    async listMappings() {
      const store = getStore();
      return store.mappings.map((m) => toMappingWithDetails(m, store.templates));
    },
    async getMapping(id: string) {
      const store = getStore();
      const found = store.mappings.find((m) => m.id === id);
      return found ? toMappingWithDetails(found, store.templates) : null;
    },
    async createMapping(input: CreateMappingInput) {
      const store = getStore();
      const now = nowIso();
      const canonicalKey = normalizeAlias(input.canonicalName).replace(/\s+/g, "-");
      const mappingId = randomUUID();
      const created: AnnouncementMapping = {
        id: mappingId,
        canonicalName: input.canonicalName,
        canonicalKey,
        templateId: input.templateId,
        active: true,
        aliases: input.aliases.map((a) => ({
          id: randomUUID(),
          mappingId,
          alias: a.alias,
          locale: a.locale ?? null,
        })),
        createdAt: now,
        updatedAt: now,
      };
      store.mappings.push(created);
      return toMappingWithDetails(created, store.templates);
    },
    async updateMapping(id: string, patch: UpdateMappingPatch) {
      const store = getStore();
      const mapping = store.mappings.find((m) => m.id === id);
      if (!mapping) notFound("AnnouncementMapping", id);
      Object.assign(mapping, patch, { updatedAt: nowIso() });
      return toMappingWithDetails(mapping, store.templates);
    },
    async deleteMapping(id: string) {
      const store = getStore();
      store.mappings = store.mappings.filter((m) => m.id !== id);
    },
    async addAlias(mappingId: string, alias: string, locale) {
      const store = getStore();
      const mapping = store.mappings.find((m) => m.id === mappingId);
      if (!mapping) notFound("AnnouncementMapping", mappingId);
      const created: AnnouncementAlias = { id: randomUUID(), mappingId, alias, locale: locale ?? null };
      mapping.aliases.push(created);
      mapping.updatedAt = nowIso();
      return clone(created);
    },
    async listMappingSuggestions() {
      return clone(getStore().mappingSuggestions.filter((s) => !s.dismissedAt));
    },
    async upsertMappingSuggestion(sourceText: string) {
      const store = getStore();
      const normalized = normalizeAlias(sourceText);
      const existing = store.mappingSuggestions.find((s) => s.sourceTextNormalized === normalized);
      if (existing) {
        existing.seenCount += 1;
        existing.lastSeenAt = nowIso();
        existing.dismissedAt = null;
        return clone(existing);
      }
      const created: MappingSuggestion = {
        id: randomUUID(),
        sourceText,
        sourceTextNormalized: normalized,
        lastSeenAt: nowIso(),
        seenCount: 1,
        dismissedAt: null,
      };
      store.mappingSuggestions.push(created);
      return clone(created);
    },
    async dismissMappingSuggestion(id: string) {
      const store = getStore();
      const suggestion = store.mappingSuggestions.find((s) => s.id === id);
      if (!suggestion) notFound("MappingSuggestion", id);
      suggestion.dismissedAt = nowIso();
    },

    // ---------- structural defaults ----------
    async listStructuralDefaults(opts) {
      const list = getStore().structuralDefaults.filter((s) => (opts?.enabledOnly ? s.enabled : true));
      return clone(list);
    },
    async upsertStructuralDefault(input: UpsertStructuralDefaultInput) {
      const store = getStore();
      if (input.id) {
        const existing = store.structuralDefaults.find((s) => s.id === input.id);
        if (!existing) notFound("DefaultStructuralSlide", input.id);
        Object.assign(existing, input);
        return clone(existing);
      }
      const created: DefaultStructuralSlide = {
        id: randomUUID(),
        templateId: input.templateId,
        nameEn: input.nameEn,
        nameFr: input.nameFr,
        insertionRule: input.insertionRule,
        defaultSortZone: input.defaultSortZone,
        sortOrder: input.sortOrder ?? 0,
        enabled: input.enabled ?? true,
        removableBySundayTeam: input.removableBySundayTeam ?? true,
        includeInVideoDefault: input.includeInVideoDefault ?? true,
        defaultContent: input.defaultContent ?? {},
      };
      store.structuralDefaults.push(created);
      return clone(created);
    },
    async deleteStructuralDefault(id: string) {
      const store = getStore();
      store.structuralDefaults = store.structuralDefaults.filter((s) => s.id !== id);
    },

    // ---------- exports ----------
    async createExportJob(input: CreateExportJobInput) {
      const store = getStore();
      const created: ExportJob = {
        id: randomUUID(),
        sundayId: input.sundayId,
        type: input.type,
        status: input.status ?? "queued",
        selection: input.selection,
        outputR2Key: null,
        error: null,
        createdAt: nowIso(),
        completedAt: null,
      };
      store.exportJobs.push(created);
      return clone(created);
    },
    async updateExportJob(id: string, patch: UpdateExportJobPatch) {
      const store = getStore();
      const job = store.exportJobs.find((j) => j.id === id);
      if (!job) notFound("ExportJob", id);
      Object.assign(job, patch);
      return clone(job);
    },
    async getExportJob(id: string) {
      const found = getStore().exportJobs.find((j) => j.id === id);
      return found ? clone(found) : null;
    },
    async listRecentExportJobs(limit: number) {
      return clone(
        [...getStore().exportJobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit),
      );
    },

    // ---------- system checks ----------
    async recordSystemCheck(type, status, details) {
      const store = getStore();
      const created: SystemCheck = {
        id: randomUUID(),
        checkType: type,
        status,
        details,
        createdAt: nowIso(),
      };
      store.systemChecks.push(created);
      return clone(created);
    },
    async latestSystemChecks() {
      const store = getStore();
      const byType = new Map<string, SystemCheck>();
      for (const check of [...store.systemChecks].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
        if (!byType.has(check.checkType)) byType.set(check.checkType, check);
      }
      return clone([...byType.values()]);
    },

    // ---------- pin attempts ----------
    async recordPinAttempt(ipHash: string, success: boolean) {
      getStore().pinAttempts.push({ ipHash, attemptedAt: nowIso(), success });
    },
    async countRecentPinFailures(ipHash: string, windowMinutes: number) {
      const cutoff = Date.now() - windowMinutes * 60_000;
      return getStore().pinAttempts.filter(
        (a) => a.ipHash === ipHash && !a.success && new Date(a.attemptedAt).getTime() >= cutoff,
      ).length;
    },
  };
}
