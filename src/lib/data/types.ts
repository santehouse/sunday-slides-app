/**
 * Repository contract. `getDb()` (see index.ts) returns either the Supabase
 * service-role implementation (supabaseDb.ts) or the in-memory mock
 * (mockDb.ts). Every Sunday-team and Admin screen/action goes through this
 * interface — never query Supabase directly from a route/page/action.
 */
import type {
  AdminRole,
  AnnouncementAlias,
  AnnouncementMapping,
  Locale,
  ApprovedColor,
  Asset,
  AssetCategory,
  AssetStatus,
  AdminUser,
  AppSettings,
  DefaultStructuralSlide,
  ExportJob,
  ExportSelection,
  ExportStatus,
  ExportType,
  FontRecord,
  FontSource,
  FontStyle,
  ParsedRunSheet,
  RunSheet,
  RunSheetParseStatus,
  RunSheetSourceType,
  SafeZone,
  Slide,
  SlideBackgroundMode,
  SlideContent,
  SlideStatus,
  StructuralInsertionRule,
  StructuralSortZone,
  Sunday,
  SystemCheck,
  Template,
  TemplateCategory,
  TemplateField,
  TemplateStatus,
} from "@/lib/domain/types";

/** Thrown by `deleteFont` when a Published template's field still references it. */
export class FontInUseError extends Error {
  constructor(public readonly fontId: string, public readonly templateNames: string[]) {
    super(`Font ${fontId} is used by published template(s): ${templateNames.join(", ")}`);
    this.name = "FontInUseError";
  }
}

export interface SlideCounts {
  total: number;
  needsReview: number;
  includedInVideo: number;
}

export interface SundayListItem extends Sunday {
  slideCounts: SlideCounts;
  latestRunSheet: RunSheet | null;
}

export interface AdjacentSundayDates {
  prev: string;
  next: string;
}

export interface TemplateWithFields extends Template {
  fields: TemplateField[];
  allowedAssetIds: string[];
}

export interface MappingWithDetails extends AnnouncementMapping {
  aliases: AnnouncementAlias[];
  templateName: { en: string; fr: string } | null;
}

export interface MappingSuggestion {
  id: string;
  sourceText: string;
  sourceTextNormalized: string;
  lastSeenAt: string;
  seenCount: number;
  dismissedAt: string | null;
}

// ---------- input shapes ----------

export interface CreateRunSheetInput {
  sundayId: string;
  sourceType: RunSheetSourceType;
  originalFilename: string;
  mimeType: string;
  r2Key: string;
  extractedText?: string | null;
  parseStatus?: RunSheetParseStatus;
  parsedJson?: ParsedRunSheet | null;
  modelOutput?: unknown;
  inboundEventId?: string | null;
  receivedAt?: string;
}

export type UpdateRunSheetPatch = Partial<{
  extractedText: string | null;
  parseStatus: RunSheetParseStatus;
  parseError: string | null;
  parsedJson: ParsedRunSheet | null;
  modelOutput: unknown;
  processedAt: string | null;
}>;

export interface CreateSlideInput {
  sundayId: string;
  templateId: string;
  headline?: string;
  content?: SlideContent;
  assetId?: string | null;
  backgroundMode?: SlideBackgroundMode;
  approvedColorId?: string | null;
  sortOrder?: number;
  includeInVideo?: boolean;
  status?: SlideStatus;
  isStructural?: boolean;
  structuralDefaultId?: string | null;
  parserConfidence?: number | null;
  mappingId?: string | null;
  sourceAnnouncement?: Slide["sourceAnnouncement"];
  manuallyEdited?: boolean;
}

export type UpdateSlidePatch = Partial<{
  templateId: string;
  headline: string;
  content: SlideContent;
  assetId: string | null;
  backgroundMode: SlideBackgroundMode;
  approvedColorId: string | null;
  sortOrder: number;
  includeInVideo: boolean;
  status: SlideStatus;
  isStructural: boolean;
  structuralDefaultId: string | null;
  parserConfidence: number | null;
  mappingId: string | null;
  sourceAnnouncement: Slide["sourceAnnouncement"];
  manuallyEdited: boolean;
}>;

export type UpdateSundayPatch = Partial<{
  status: Sunday["status"];
  sourceRunSheetId: string | null;
  defaultSlideHoldSeconds: number;
}>;

export type UpdateSettingsPatch = Partial<{
  churchName: string;
  timezone: string;
  defaultLocale: Locale;
  defaultSlideHoldSeconds: number;
  inboundEmail: string | null;
  autoProcessInbound: boolean;
  safeZone: SafeZone;
  temporaryRetentionDays: number;
}>;

export interface UpsertAdminUserInput {
  authUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  locale: Locale;
}

export interface CreateTemplateFieldInput {
  fieldKey: string;
  labelEn: string;
  labelFr: string;
  teamEditable: boolean;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontId?: string | null;
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  lineHeight: number;
  letterSpacing: number;
  alignment: TemplateField["alignment"];
  textColor: string;
  maxLines: number;
  overflowMode: TemplateField["overflowMode"];
  textTransform: TemplateField["textTransform"];
  sortOrder: number;
}

export interface CreateTemplateInput {
  slug: string;
  nameEn: string;
  nameFr: string;
  category: TemplateCategory;
  status?: TemplateStatus;
  rendererKey?: string;
  backgroundType?: Template["backgroundType"];
  backgroundValue?: string;
  overlayColor?: Template["overlayColor"];
  overlayOpacity?: number;
  includeInVideoDefault?: boolean;
  allowTeamBackgroundChoice?: boolean;
}

export type UpdateTemplatePatch = Partial<
  Omit<CreateTemplateInput, "slug"> & { slug: string }
>;

export interface CreateAssetInput {
  nameEn: string;
  nameFr: string;
  status?: AssetStatus;
  category: AssetCategory;
  tags?: string[];
  r2Key: string;
  mimeType: string;
  width: number;
  height: number;
  focalX?: number;
  focalY?: number;
  cropMetadata?: Record<string, unknown> | null;
}

export type UpdateAssetPatch = Partial<CreateAssetInput>;

export interface CreateFontInput {
  family: string;
  source: FontSource;
  sourceIdentifier?: string | null;
  r2Key?: string | null;
  weight: number;
  style: FontStyle;
  enabled?: boolean;
}

export type UpdateFontPatch = Partial<CreateFontInput>;

export interface CreateMappingInput {
  canonicalName: string;
  templateId: string;
  aliases: { alias: string; locale?: Locale | null }[];
}

export type UpdateMappingPatch = Partial<{
  canonicalName: string;
  templateId: string;
  active: boolean;
}>;

export interface UpsertApprovedColorInput {
  id?: string;
  nameEn: string;
  nameFr: string;
  hex: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface UpsertStructuralDefaultInput {
  id?: string;
  templateId: string;
  nameEn: string;
  nameFr: string;
  insertionRule: StructuralInsertionRule;
  defaultSortZone: StructuralSortZone;
  sortOrder?: number;
  enabled?: boolean;
  removableBySundayTeam?: boolean;
  includeInVideoDefault?: boolean;
  defaultContent?: SlideContent;
}

export interface CreateExportJobInput {
  sundayId: string;
  type: ExportType;
  status?: ExportStatus;
  selection: ExportSelection;
}

export type UpdateExportJobPatch = Partial<{
  status: ExportStatus;
  outputR2Key: string | null;
  error: string | null;
  completedAt: string | null;
}>;

// ---------- the interface ----------

export interface Db {
  // settings
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: UpdateSettingsPatch): Promise<AppSettings>;
  setSundayPin(pinHash: string, length: number): Promise<AppSettings>;

  // admin users
  listAdminUsers(): Promise<AdminUser[]>;
  getAdminUserByAuthId(authUserId: string): Promise<AdminUser | null>;
  upsertAdminUser(input: UpsertAdminUserInput): Promise<AdminUser>;
  updateAdminUserLocale(id: string, locale: Locale): Promise<AdminUser>;
  setAdminDisabled(id: string, disabledAt: string | null): Promise<AdminUser>;

  // sundays
  listSundays(opts?: { limit?: number }): Promise<SundayListItem[]>;
  getSundayByDate(date: string): Promise<Sunday | null>;
  getSundayById(id: string): Promise<Sunday | null>;
  getOrCreateSundayByDate(date: string): Promise<Sunday>;
  getNextSunday(fromDate: string, opts?: { create?: boolean }): Promise<Sunday | null>;
  getAdjacentSundayDates(date: string): Promise<AdjacentSundayDates>;
  updateSunday(id: string, patch: UpdateSundayPatch): Promise<Sunday>;

  // run sheets
  createRunSheet(input: CreateRunSheetInput): Promise<RunSheet>;
  getRunSheet(id: string): Promise<RunSheet | null>;
  listRunSheetsForSunday(sundayId: string): Promise<RunSheet[]>;
  getLatestRunSheetForSunday(sundayId: string): Promise<RunSheet | null>;
  updateRunSheet(id: string, patch: UpdateRunSheetPatch): Promise<RunSheet>;
  findRunSheetByInboundEventId(eventId: string): Promise<RunSheet | null>;

  // slides
  listSlidesForSunday(sundayId: string): Promise<Slide[]>;
  getSlide(id: string): Promise<Slide | null>;
  createSlide(input: CreateSlideInput): Promise<Slide>;
  createSlides(inputs: CreateSlideInput[]): Promise<Slide[]>;
  updateSlide(id: string, patch: UpdateSlidePatch): Promise<Slide>;
  deleteSlide(id: string): Promise<void>;
  reorderSlides(sundayId: string, orderedIds: string[]): Promise<Slide[]>;
  replaceSlidesForSunday(sundayId: string, inputs: CreateSlideInput[]): Promise<Slide[]>;

  // templates
  listTemplates(opts?: { status?: TemplateStatus; category?: TemplateCategory }): Promise<TemplateWithFields[]>;
  getTemplate(id: string): Promise<TemplateWithFields | null>;
  getTemplateBySlug(slug: string): Promise<TemplateWithFields | null>;
  createTemplate(input: CreateTemplateInput): Promise<TemplateWithFields>;
  updateTemplate(id: string, patch: UpdateTemplatePatch): Promise<TemplateWithFields>;
  upsertTemplateFields(templateId: string, fields: CreateTemplateFieldInput[]): Promise<TemplateField[]>;
  setTemplateAssets(templateId: string, assetIds: string[]): Promise<void>;
  countSlidesUsingTemplate(templateId: string): Promise<number>;

  // assets
  listAssets(opts?: { status?: AssetStatus; category?: AssetCategory }): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | null>;
  createAsset(input: CreateAssetInput): Promise<Asset>;
  updateAsset(id: string, patch: UpdateAssetPatch): Promise<Asset>;
  listAssetsForTemplate(templateId: string, opts?: { publishedOnly?: boolean }): Promise<Asset[]>;

  // approved colors
  listApprovedColors(opts?: { enabledOnly?: boolean }): Promise<ApprovedColor[]>;
  upsertApprovedColor(input: UpsertApprovedColorInput): Promise<ApprovedColor>;
  deleteApprovedColor(id: string): Promise<void>;

  // fonts
  listFonts(): Promise<FontRecord[]>;
  createFont(input: CreateFontInput): Promise<FontRecord>;
  updateFont(id: string, patch: UpdateFontPatch): Promise<FontRecord>;
  deleteFont(id: string): Promise<void>; // throws FontInUseError
  listFontsUsedByPublishedTemplates(): Promise<FontRecord[]>;

  // mappings
  listMappings(): Promise<MappingWithDetails[]>;
  getMapping(id: string): Promise<MappingWithDetails | null>;
  createMapping(input: CreateMappingInput): Promise<MappingWithDetails>;
  updateMapping(id: string, patch: UpdateMappingPatch): Promise<MappingWithDetails>;
  deleteMapping(id: string): Promise<void>;
  addAlias(mappingId: string, alias: string, locale?: Locale | null): Promise<AnnouncementAlias>;
  listMappingSuggestions(): Promise<MappingSuggestion[]>;
  upsertMappingSuggestion(sourceText: string): Promise<MappingSuggestion>;
  dismissMappingSuggestion(id: string): Promise<void>;

  // structural defaults
  listStructuralDefaults(opts?: { enabledOnly?: boolean }): Promise<DefaultStructuralSlide[]>;
  upsertStructuralDefault(input: UpsertStructuralDefaultInput): Promise<DefaultStructuralSlide>;
  deleteStructuralDefault(id: string): Promise<void>;

  // exports
  createExportJob(input: CreateExportJobInput): Promise<ExportJob>;
  updateExportJob(id: string, patch: UpdateExportJobPatch): Promise<ExportJob>;
  getExportJob(id: string): Promise<ExportJob | null>;
  listRecentExportJobs(limit: number): Promise<ExportJob[]>;

  // system checks
  recordSystemCheck(type: string, status: SystemCheck["status"], details: Record<string, unknown>): Promise<SystemCheck>;
  latestSystemChecks(): Promise<SystemCheck[]>;

  // pin attempts
  recordPinAttempt(ipHash: string, success: boolean): Promise<void>;
  countRecentPinFailures(ipHash: string, windowMinutes: number): Promise<number>;
}
