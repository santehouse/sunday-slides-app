/**
 * snake_case Supabase rows <-> camelCase domain types (src/lib/domain/types.ts).
 * Used only by supabaseDb.ts.
 */
import type {
  AdminUser,
  AnnouncementAlias,
  AnnouncementMapping,
  AppSettings,
  ApprovedColor,
  Asset,
  DefaultStructuralSlide,
  ExportJob,
  ExportSelection,
  FontRecord,
  ParsedRunSheet,
  RunSheet,
  Slide,
  SlideContent,
  SystemCheck,
  Sunday,
  Template,
  TemplateField,
} from "@/lib/domain/types";
import type {
  AdminUserRow,
  AnnouncementAliasRow,
  AnnouncementMappingRow,
  AppSettingsRow,
  ApprovedColorRow,
  AssetRow,
  DefaultStructuralSlideRow,
  ExportJobRow,
  FontRow,
  Json,
  RunSheetRow,
  SlideRow,
  SystemCheckRow,
  SundayRow,
  TemplateFieldRow,
  TemplateRow,
} from "@/lib/supabase/database.types";

export function settingsFromRow(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    churchName: row.church_name,
    timezone: row.timezone,
    defaultLocale: row.default_locale as AppSettings["defaultLocale"],
    sundayPinLength: row.sunday_pin_length,
    sundayPinHash: row.sunday_pin_hash,
    sundayPinVersion: row.sunday_pin_version,
    defaultSlideHoldSeconds: row.default_slide_hold_seconds,
    inboundEmail: row.inbound_email,
    autoProcessInbound: row.auto_process_inbound,
    safeZone: { x: row.pip_x, y: row.pip_y, width: row.pip_width, height: row.pip_height },
    temporaryRetentionDays: row.temporary_retention_days,
    updatedAt: row.updated_at,
  };
}

export function adminUserFromRow(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id ?? "",
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    locale: row.locale as AdminUser["locale"],
    createdAt: row.created_at,
    disabledAt: row.disabled_at,
  };
}

export function fontFromRow(row: FontRow): FontRecord {
  return {
    id: row.id,
    family: row.family,
    source: row.source,
    sourceIdentifier: row.source_identifier,
    r2Key: row.r2_key,
    weight: row.weight,
    style: row.style,
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

export function approvedColorFromRow(row: ApprovedColorRow): ApprovedColor {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    hex: row.hex,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  };
}

export function assetFromRow(row: AssetRow): Asset {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    status: row.status,
    category: row.category,
    tags: row.tags,
    r2Key: row.r2_key,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    focalX: row.focal_x,
    focalY: row.focal_y,
    cropMetadata: (row.crop_metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function templateFieldFromRow(row: TemplateFieldRow): TemplateField {
  return {
    id: row.id,
    templateId: row.template_id,
    fieldKey: row.field_key,
    fieldType: "text",
    labelEn: row.label_en,
    labelFr: row.label_fr,
    teamEditable: row.team_editable,
    required: row.required,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    fontId: row.font_id,
    fontFamily: row.font_family,
    fontSize: row.font_size,
    minFontSize: row.min_font_size,
    fontWeight: row.font_weight,
    fontStyle: row.font_style,
    lineHeight: row.line_height,
    letterSpacing: row.letter_spacing,
    alignment: row.alignment,
    textColor: row.text_color,
    maxLines: row.max_lines,
    overflowMode: row.overflow_mode,
    sortOrder: row.sort_order,
    textTransform: row.text_transform as "none" | "uppercase",
  };
}

export function templateFromRow(
  row: TemplateRow,
  fields: TemplateFieldRow[] = [],
  allowedAssetIds: string[] = [],
): Template {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    category: row.category,
    status: row.status,
    rendererKey: row.renderer_key,
    backgroundType: row.background_type,
    backgroundValue: row.background_value,
    overlayColor: row.overlay_color,
    overlayOpacity: row.overlay_opacity,
    includeInVideoDefault: row.include_in_video_default,
    allowTeamBackgroundChoice: row.allow_team_background_choice,
    fields: fields.map(templateFieldFromRow),
    allowedAssetIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function aliasFromRow(row: AnnouncementAliasRow): AnnouncementAlias {
  return {
    id: row.id,
    mappingId: row.mapping_id,
    alias: row.alias,
    locale: row.locale as AnnouncementAlias["locale"],
  };
}

export function mappingFromRow(row: AnnouncementMappingRow, aliases: AnnouncementAliasRow[] = []): AnnouncementMapping {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    canonicalKey: row.canonical_key,
    templateId: row.template_id,
    active: row.active,
    aliases: aliases.map(aliasFromRow),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function structuralDefaultFromRow(row: DefaultStructuralSlideRow): DefaultStructuralSlide {
  return {
    id: row.id,
    templateId: row.template_id,
    nameEn: row.name_en,
    nameFr: row.name_fr,
    insertionRule: row.insertion_rule,
    defaultSortZone: row.default_sort_zone,
    sortOrder: row.sort_order,
    enabled: row.enabled,
    removableBySundayTeam: row.removable_by_sunday_team,
    includeInVideoDefault: row.include_in_video_default,
    defaultContent: (row.default_content as SlideContent) ?? {},
  };
}

export function sundayFromRow(row: SundayRow): Sunday {
  return {
    id: row.id,
    serviceDate: row.service_date,
    status: row.status,
    sourceRunSheetId: row.source_run_sheet_id,
    defaultSlideHoldSeconds: row.default_slide_hold_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function runSheetFromRow(row: RunSheetRow): RunSheet {
  return {
    id: row.id,
    sundayId: row.sunday_id,
    sourceType: row.source_type,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    r2Key: row.r2_key,
    extractedText: row.extracted_text,
    parseStatus: row.parse_status,
    parseError: row.parse_error,
    parsedJson: (row.parsed_json as unknown as ParsedRunSheet | null) ?? null,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

export function slideFromRow(row: SlideRow): Slide {
  return {
    id: row.id,
    sundayId: row.sunday_id,
    templateId: row.template_id,
    headline: row.headline,
    content: (row.content_json as SlideContent) ?? {},
    assetId: row.asset_id,
    backgroundMode: row.background_mode,
    approvedColorId: row.approved_color_id,
    sortOrder: row.sort_order,
    includeInVideo: row.include_in_video,
    status: row.status,
    isStructural: row.is_structural,
    structuralDefaultId: row.structural_default_id,
    parserConfidence: row.parser_confidence,
    mappingId: row.mapping_id,
    sourceAnnouncement: (row.source_announcement_json as unknown as Slide["sourceAnnouncement"]) ?? null,
    manuallyEdited: row.manually_edited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function slideToRow(slide: {
  sundayId: string;
  templateId: string;
  headline?: string;
  content?: SlideContent;
  assetId?: string | null;
  backgroundMode?: Slide["backgroundMode"];
  approvedColorId?: string | null;
  sortOrder?: number;
  includeInVideo?: boolean;
  status?: Slide["status"];
  isStructural?: boolean;
  structuralDefaultId?: string | null;
  parserConfidence?: number | null;
  mappingId?: string | null;
  sourceAnnouncement?: Slide["sourceAnnouncement"];
  manuallyEdited?: boolean;
}): Partial<SlideRow> {
  return {
    sunday_id: slide.sundayId,
    template_id: slide.templateId,
    ...(slide.headline !== undefined ? { headline: slide.headline } : {}),
    ...(slide.content !== undefined ? { content_json: slide.content as unknown as Json } : {}),
    ...(slide.assetId !== undefined ? { asset_id: slide.assetId } : {}),
    ...(slide.backgroundMode !== undefined ? { background_mode: slide.backgroundMode } : {}),
    ...(slide.approvedColorId !== undefined ? { approved_color_id: slide.approvedColorId } : {}),
    ...(slide.sortOrder !== undefined ? { sort_order: slide.sortOrder } : {}),
    ...(slide.includeInVideo !== undefined ? { include_in_video: slide.includeInVideo } : {}),
    ...(slide.status !== undefined ? { status: slide.status } : {}),
    ...(slide.isStructural !== undefined ? { is_structural: slide.isStructural } : {}),
    ...(slide.structuralDefaultId !== undefined ? { structural_default_id: slide.structuralDefaultId } : {}),
    ...(slide.parserConfidence !== undefined ? { parser_confidence: slide.parserConfidence } : {}),
    ...(slide.mappingId !== undefined ? { mapping_id: slide.mappingId } : {}),
    ...(slide.sourceAnnouncement !== undefined
      ? { source_announcement_json: slide.sourceAnnouncement as unknown as Json }
      : {}),
    ...(slide.manuallyEdited !== undefined ? { manually_edited: slide.manuallyEdited } : {}),
  };
}

/** Partial slide patch -> snake_case row fields, for `updateSlide`. Only defined keys are included. */
export function slidePatchToRow(patch: {
  templateId?: string;
  headline?: string;
  content?: SlideContent;
  assetId?: string | null;
  backgroundMode?: Slide["backgroundMode"];
  approvedColorId?: string | null;
  sortOrder?: number;
  includeInVideo?: boolean;
  status?: Slide["status"];
  isStructural?: boolean;
  structuralDefaultId?: string | null;
  parserConfidence?: number | null;
  mappingId?: string | null;
  sourceAnnouncement?: Slide["sourceAnnouncement"];
  manuallyEdited?: boolean;
}): Partial<SlideRow> {
  const row: Partial<SlideRow> = {};
  if (patch.templateId !== undefined) row.template_id = patch.templateId;
  if (patch.headline !== undefined) row.headline = patch.headline;
  if (patch.content !== undefined) row.content_json = patch.content as unknown as Json;
  if (patch.assetId !== undefined) row.asset_id = patch.assetId;
  if (patch.backgroundMode !== undefined) row.background_mode = patch.backgroundMode;
  if (patch.approvedColorId !== undefined) row.approved_color_id = patch.approvedColorId;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.includeInVideo !== undefined) row.include_in_video = patch.includeInVideo;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.isStructural !== undefined) row.is_structural = patch.isStructural;
  if (patch.structuralDefaultId !== undefined) row.structural_default_id = patch.structuralDefaultId;
  if (patch.parserConfidence !== undefined) row.parser_confidence = patch.parserConfidence;
  if (patch.mappingId !== undefined) row.mapping_id = patch.mappingId;
  if (patch.sourceAnnouncement !== undefined)
    row.source_announcement_json = patch.sourceAnnouncement as unknown as Json;
  if (patch.manuallyEdited !== undefined) row.manually_edited = patch.manuallyEdited;
  return row;
}

export function exportJobFromRow(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    sundayId: row.sunday_id,
    type: row.type,
    status: row.status,
    selection: (row.selection_json as unknown as ExportSelection) ?? { format: "jpg", scope: "all", slideNumbers: [] },
    outputR2Key: row.output_r2_key,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function systemCheckFromRow(row: SystemCheckRow): SystemCheck {
  return {
    id: row.id,
    checkType: row.check_type,
    status: row.status,
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  };
}
