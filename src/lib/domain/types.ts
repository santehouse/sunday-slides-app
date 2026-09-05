/**
 * Domain types — the shared contract between UI, data layer, engines, renderer and parsing.
 * These mirror the Supabase schema in supabase/migrations/0001_init.sql. Keep them in sync.
 * All coordinates are in the 1920×1080 slide coordinate system.
 */

export type Locale = "en" | "fr-CA";

export type AdminRole = "owner" | "admin";

export type SundayStatus = "draft" | "needs_review" | "ready" | "exported";

export type RunSheetSourceType = "email" | "manual";
export type RunSheetParseStatus =
  | "queued"
  | "processing"
  | "ready_to_apply"
  | "added_to_flow"
  | "needs_review"
  | "failed";

export type TemplateStatus = "draft" | "published" | "archived";
export type TemplateCategory =
  | "general"
  | "events"
  | "special"
  | "giving"
  | "welcome"
  | "theme"
  | "closing";
export type BackgroundType = "color" | "image";
export type OverlayColor = "none" | "black" | "white";

export type FieldType = "text";
export type TextAlignment = "left" | "center" | "right";
export type OverflowMode = "fixed" | "auto_fit" | "flex_height";
export type FontStyle = "normal" | "italic";

export type AssetStatus = "draft" | "published" | "archived";
export type AssetCategory = "photography" | "backgrounds" | "special";

export type FontSource = "google" | "custom";

export type SlideStatus = "ready" | "needs_review" | "invalid";
export type SlideBackgroundMode = "color" | "image";

export type StructuralInsertionRule = "always" | "default" | "manual";
export type StructuralSortZone = "opening" | "before_announcements" | "after_announcements" | "closing";

export type ExportType = "jpg" | "jpg_zip" | "mp4";
export type ExportStatus = "queued" | "processing" | "complete" | "failed";

export interface AdminUser {
  id: string;
  authUserId: string;
  displayName: string;
  email: string;
  role: AdminRole;
  locale: Locale;
  createdAt: string;
  disabledAt: string | null;
}

export interface SafeZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  id: string;
  churchName: string;
  timezone: string;
  defaultLocale: Locale;
  /** Number of digits in the shared Sunday PIN (4–8). */
  sundayPinLength: number;
  /** Bcrypt hash of the shared Sunday PIN; null until an admin sets one. Server-side only — never render this. */
  sundayPinHash: string | null;
  /** Bumped by `setSundayPin`; included in the Sunday session JWT so rotating the PIN invalidates old sessions. */
  sundayPinVersion: number;
  defaultSlideHoldSeconds: number;
  inboundEmail: string | null;
  autoProcessInbound: boolean;
  safeZone: SafeZone;
  temporaryRetentionDays: number;
  updatedAt: string;
}

export interface Sunday {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  serviceDate: string;
  status: SundayStatus;
  sourceRunSheetId: string | null;
  defaultSlideHoldSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface RunSheet {
  id: string;
  sundayId: string;
  sourceType: RunSheetSourceType;
  originalFilename: string;
  mimeType: string;
  r2Key: string;
  extractedText: string | null;
  parseStatus: RunSheetParseStatus;
  parseError: string | null;
  parsedJson: ParsedRunSheet | null;
  receivedAt: string;
  processedAt: string | null;
}

/** Strict OpenAI structured output, validated with Zod in lib/openai/schema.ts. */
export interface ParsedRunSheet {
  serviceDate: string | null;
  documentLanguage: "en" | "fr" | "mixed";
  sections: ParsedSection[];
}

export interface ParsedSection {
  title: string;
  announcements: ParsedAnnouncement[];
}

export interface ParsedAnnouncement {
  sourceOrder: number;
  sourceText: string;
  canonicalKey: string | null;
  category: TemplateCategory;
  headline: string;
  line1: string | null;
  line2: string | null;
  suggestedMappingId: string | null;
  suggestedTemplateId: string | null;
  confidence: number;
  reviewReasons: string[];
}

export interface TemplateField {
  id: string;
  templateId: string;
  fieldKey: string; // "headline" | "line1" | "line2" | custom
  fieldType: FieldType;
  labelEn: string;
  labelFr: string;
  teamEditable: boolean;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontId: string | null;
  fontFamily: string; // resolved family name for rendering
  fontSize: number;
  minFontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  lineHeight: number; // multiplier, e.g. 1.1
  letterSpacing: number; // px at 1920 scale
  alignment: TextAlignment;
  textColor: string; // hex
  maxLines: number;
  overflowMode: OverflowMode;
  sortOrder: number;
  /** Optional CSS text-transform applied by the template (uppercase headlines). */
  textTransform: "none" | "uppercase";
}

export interface Template {
  id: string;
  slug: string;
  nameEn: string;
  nameFr: string;
  category: TemplateCategory;
  status: TemplateStatus;
  /** "generic-v1" for configurable templates; bespoke keys map to code renderers. */
  rendererKey: string;
  backgroundType: BackgroundType;
  /** Hex color for color backgrounds, or asset id for image backgrounds. */
  backgroundValue: string;
  overlayColor: OverlayColor;
  overlayOpacity: number; // 0–1
  includeInVideoDefault: boolean;
  /** Whether the Sunday team may switch this template's background mode. */
  allowTeamBackgroundChoice: boolean;
  fields: TemplateField[];
  allowedAssetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  nameEn: string;
  nameFr: string;
  status: AssetStatus;
  category: AssetCategory;
  tags: string[];
  r2Key: string;
  mimeType: string;
  width: number;
  height: number;
  focalX: number; // 0–1
  focalY: number; // 0–1
  cropMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedColor {
  id: string;
  nameEn: string;
  nameFr: string;
  hex: string;
  enabled: boolean;
  sortOrder: number;
}

export interface FontRecord {
  id: string;
  family: string;
  source: FontSource;
  /** Google family name, or null for custom. */
  sourceIdentifier: string | null;
  r2Key: string | null;
  weight: number;
  style: FontStyle;
  enabled: boolean;
  createdAt: string;
}

export interface AnnouncementMapping {
  id: string;
  canonicalName: string;
  canonicalKey: string;
  templateId: string;
  active: boolean;
  aliases: AnnouncementAlias[];
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementAlias {
  id: string;
  mappingId: string;
  alias: string;
  locale: Locale | null;
}

/** Field values keyed by TemplateField.fieldKey. */
export type SlideContent = Record<string, string>;

export interface Slide {
  id: string;
  sundayId: string;
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
  sourceAnnouncement: ParsedAnnouncement | null;
  /** True once a Sunday user has edited content — merge preserves these. */
  manuallyEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DefaultStructuralSlide {
  id: string;
  templateId: string;
  nameEn: string;
  nameFr: string;
  insertionRule: StructuralInsertionRule;
  defaultSortZone: StructuralSortZone;
  sortOrder: number;
  enabled: boolean;
  removableBySundayTeam: boolean;
  includeInVideoDefault: boolean;
  /** Default content applied when inserted. */
  defaultContent: SlideContent;
}

export interface ExportSelection {
  format: "jpg" | "mp4";
  scope: "current" | "all" | "custom";
  /** 1-based slide numbers in Sunday Flow order. */
  slideNumbers: number[];
}

export interface ExportJob {
  id: string;
  sundayId: string;
  type: ExportType;
  status: ExportStatus;
  selection: ExportSelection;
  outputR2Key: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SystemCheck {
  id: string;
  checkType: string;
  status: "ok" | "warn" | "error";
  details: Record<string, unknown>;
  createdAt: string;
}
