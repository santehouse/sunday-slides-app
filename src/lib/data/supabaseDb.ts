import "server-only";
/**
 * Supabase-backed `Db` implementation — service-role client, RLS bypassed.
 * Only ever called from server code that has already validated the caller
 * (Sunday session cookie, or an authenticated + `is_admin()` Supabase user).
 */
import { getServiceClient } from "@/lib/supabase/service";
import { nextSundayOnOrAfter } from "@/lib/utils/serviceDate";
import type {
  AnnouncementAliasRow,
  AnnouncementMappingRow,
  AppSettingsRow,
  AssetRow,
  ExportJobRow,
  FontRow,
  Json,
  RunSheetRow,
  SundayRow,
  TemplateFieldRow,
  TemplateRow,
} from "@/lib/supabase/database.types";
import type {
  AdminUser,
  AppSettings,
  ExportJob,
  RunSheet,
  Slide,
  SystemCheck,
  Sunday,
  Template,
} from "@/lib/domain/types";
import {
  adminUserFromRow,
  aliasFromRow,
  approvedColorFromRow,
  assetFromRow,
  exportJobFromRow,
  fontFromRow,
  mappingFromRow,
  runSheetFromRow,
  settingsFromRow,
  slideFromRow,
  slidePatchToRow,
  slideToRow,
  structuralDefaultFromRow,
  sundayFromRow,
  systemCheckFromRow,
  templateFieldFromRow,
  templateFromRow,
} from "./mappers";
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

function assertData<T>(data: T | null, error: unknown, what: string): T {
  if (error) throw new Error(`${what}: ${(error as { message?: string }).message ?? String(error)}`);
  if (data === null || data === undefined) throw new Error(`${what}: not found`);
  return data;
}

async function fetchTemplateAssetIds(templateId: string): Promise<string[]> {
  const db = getServiceClient();
  const { data, error } = await db.from("template_assets").select("asset_id").eq("template_id", templateId);
  if (error) throw new Error(`fetchTemplateAssetIds: ${error.message}`);
  return (data ?? []).map((r) => r.asset_id);
}

async function fetchTemplateFields(templateId: string): Promise<TemplateFieldRow[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("template_fields")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`fetchTemplateFields: ${error.message}`);
  return data ?? [];
}

async function hydrateTemplate(row: TemplateRow): Promise<TemplateWithFields> {
  const [fields, assetIds] = await Promise.all([fetchTemplateFields(row.id), fetchTemplateAssetIds(row.id)]);
  return templateFromRow(row, fields, assetIds);
}

async function hydrateMapping(
  mappingRow: Parameters<typeof mappingFromRow>[0],
  templatesById: Map<string, Template>,
): Promise<MappingWithDetails> {
  const db = getServiceClient();
  const { data, error } = await db.from("announcement_aliases").select("*").eq("mapping_id", mappingRow.id);
  if (error) throw new Error(`hydrateMapping: ${error.message}`);
  const mapping = mappingFromRow(mappingRow, data ?? []);
  const template = templatesById.get(mapping.templateId);
  return { ...mapping, templateName: template ? { en: template.nameEn, fr: template.nameFr } : null };
}

export function createSupabaseDb(): Db {
  const db = getServiceClient();

  return {
    // ---------- settings ----------
    async getSettings(): Promise<AppSettings> {
      const { data, error } = await db.from("app_settings").select("*").eq("singleton", true).single();
      return settingsFromRow(assertData(data, error, "getSettings"));
    },
    async updateSettings(patch: UpdateSettingsPatch): Promise<AppSettings> {
      const row: Partial<AppSettingsRow> = {};
      if (patch.churchName !== undefined) row.church_name = patch.churchName;
      if (patch.timezone !== undefined) row.timezone = patch.timezone;
      if (patch.defaultLocale !== undefined) row.default_locale = patch.defaultLocale;
      if (patch.defaultSlideHoldSeconds !== undefined) row.default_slide_hold_seconds = patch.defaultSlideHoldSeconds;
      if (patch.inboundEmail !== undefined) row.inbound_email = patch.inboundEmail;
      if (patch.autoProcessInbound !== undefined) row.auto_process_inbound = patch.autoProcessInbound;
      if (patch.temporaryRetentionDays !== undefined) row.temporary_retention_days = patch.temporaryRetentionDays;
      if (patch.safeZone !== undefined) {
        row.pip_x = patch.safeZone.x;
        row.pip_y = patch.safeZone.y;
        row.pip_width = patch.safeZone.width;
        row.pip_height = patch.safeZone.height;
      }
      const { data, error } = await db.from("app_settings").update(row).eq("singleton", true).select("*").single();
      return settingsFromRow(assertData(data, error, "updateSettings"));
    },
    async setSundayPin(pinHash: string, length: number): Promise<AppSettings> {
      const current = await this.getSettings();
      const { data, error } = await db
        .from("app_settings")
        .update({
          sunday_pin_hash: pinHash,
          sunday_pin_length: length,
          sunday_pin_version: current.sundayPinVersion + 1,
        })
        .eq("singleton", true)
        .select("*")
        .single();
      return settingsFromRow(assertData(data, error, "setSundayPin"));
    },

    // ---------- admin users ----------
    async listAdminUsers(): Promise<AdminUser[]> {
      const { data, error } = await db.from("admin_users").select("*").order("created_at", { ascending: true });
      if (error) throw new Error(`listAdminUsers: ${error.message}`);
      return (data ?? []).map(adminUserFromRow);
    },
    async getAdminUserByAuthId(authUserId: string): Promise<AdminUser | null> {
      const { data, error } = await db.from("admin_users").select("*").eq("auth_user_id", authUserId).maybeSingle();
      if (error) throw new Error(`getAdminUserByAuthId: ${error.message}`);
      return data ? adminUserFromRow(data) : null;
    },
    async upsertAdminUser(input: UpsertAdminUserInput): Promise<AdminUser> {
      const { data, error } = await db
        .from("admin_users")
        .upsert(
          {
            auth_user_id: input.authUserId,
            email: input.email,
            display_name: input.displayName,
            role: input.role,
            locale: input.locale,
          },
          { onConflict: "auth_user_id" },
        )
        .select("*")
        .single();
      return adminUserFromRow(assertData(data, error, "upsertAdminUser"));
    },
    async updateAdminUserLocale(id: string, locale): Promise<AdminUser> {
      const { data, error } = await db.from("admin_users").update({ locale }).eq("id", id).select("*").single();
      return adminUserFromRow(assertData(data, error, "updateAdminUserLocale"));
    },
    async setAdminDisabled(id: string, disabledAt: string | null): Promise<AdminUser> {
      const { data, error } = await db
        .from("admin_users")
        .update({ disabled_at: disabledAt })
        .eq("id", id)
        .select("*")
        .single();
      return adminUserFromRow(assertData(data, error, "setAdminDisabled"));
    },

    // ---------- sundays ----------
    async listSundays(opts): Promise<SundayListItem[]> {
      let query = db.from("sundays").select("*").order("service_date", { ascending: false });
      if (opts?.limit) query = query.limit(opts.limit);
      const { data, error } = await query;
      if (error) throw new Error(`listSundays: ${error.message}`);
      const sundays = (data ?? []).map(sundayFromRow);
      return Promise.all(
        sundays.map(async (sunday) => {
          const [{ data: slideRows }, { data: runSheetRows }] = await Promise.all([
            db.from("slides").select("status, include_in_video").eq("sunday_id", sunday.id),
            db
              .from("run_sheets")
              .select("*")
              .eq("sunday_id", sunday.id)
              .order("received_at", { ascending: false })
              .limit(1),
          ]);
          const slides = slideRows ?? [];
          return {
            ...sunday,
            slideCounts: {
              total: slides.length,
              needsReview: slides.filter((s) => s.status === "needs_review").length,
              includedInVideo: slides.filter((s) => s.include_in_video).length,
            },
            latestRunSheet: runSheetRows?.[0] ? runSheetFromRow(runSheetRows[0]) : null,
          };
        }),
      );
    },
    async getSundayByDate(date: string): Promise<Sunday | null> {
      const { data, error } = await db.from("sundays").select("*").eq("service_date", date).maybeSingle();
      if (error) throw new Error(`getSundayByDate: ${error.message}`);
      return data ? sundayFromRow(data) : null;
    },
    async getSundayById(id: string): Promise<Sunday | null> {
      const { data, error } = await db.from("sundays").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getSundayById: ${error.message}`);
      return data ? sundayFromRow(data) : null;
    },
    async getOrCreateSundayByDate(date: string): Promise<Sunday> {
      const existing = await this.getSundayByDate(date);
      if (existing) return existing;
      const { data, error } = await db.from("sundays").insert({ service_date: date }).select("*").single();
      return sundayFromRow(assertData(data, error, "getOrCreateSundayByDate"));
    },
    async getNextSunday(fromDate: string, opts): Promise<Sunday | null> {
      // "The current service" is the coming Sunday's exact date — never a Sunday created
      // further ahead (a special event, a pre-planned deck) just because it sorts first.
      const target = nextSundayOnOrAfter(fromDate);
      const existing = await this.getSundayByDate(target);
      if (existing) return existing;
      if (!opts?.create) return null;
      return this.getOrCreateSundayByDate(target);
    },
    async getAdjacentSundayDates(date: string): Promise<AdjacentSundayDates> {
      const [{ data: beforeRows }, { data: afterRows }] = await Promise.all([
        db.from("sundays").select("service_date").lt("service_date", date).order("service_date", { ascending: false }).limit(1),
        db.from("sundays").select("service_date").gt("service_date", date).order("service_date", { ascending: true }).limit(1),
      ]);
      const parsed = new Date(`${date}T00:00:00Z`);
      const plusMinus = (days: number) => {
        const d = new Date(parsed);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      return {
        prev: beforeRows?.[0]?.service_date ?? plusMinus(-7),
        next: afterRows?.[0]?.service_date ?? plusMinus(7),
      };
    },
    async updateSunday(id: string, patch: UpdateSundayPatch): Promise<Sunday> {
      const row: Partial<SundayRow> = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.sourceRunSheetId !== undefined) row.source_run_sheet_id = patch.sourceRunSheetId;
      if (patch.defaultSlideHoldSeconds !== undefined) row.default_slide_hold_seconds = patch.defaultSlideHoldSeconds;
      const { data, error } = await db.from("sundays").update(row).eq("id", id).select("*").single();
      return sundayFromRow(assertData(data, error, "updateSunday"));
    },

    // ---------- run sheets ----------
    async createRunSheet(input: CreateRunSheetInput): Promise<RunSheet> {
      const { data, error } = await db
        .from("run_sheets")
        .insert({
          sunday_id: input.sundayId,
          source_type: input.sourceType,
          original_filename: input.originalFilename,
          mime_type: input.mimeType,
          r2_key: input.r2Key,
          extracted_text: input.extractedText ?? null,
          parse_status: input.parseStatus ?? "queued",
          parsed_json: (input.parsedJson as unknown as Json) ?? null,
          model_output: (input.modelOutput as Json) ?? null,
          inbound_event_id: input.inboundEventId ?? null,
          received_at: input.receivedAt,
        })
        .select("*")
        .single();
      return runSheetFromRow(assertData(data, error, "createRunSheet"));
    },
    async getRunSheet(id: string): Promise<RunSheet | null> {
      const { data, error } = await db.from("run_sheets").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getRunSheet: ${error.message}`);
      return data ? runSheetFromRow(data) : null;
    },
    async listRunSheetsForSunday(sundayId: string): Promise<RunSheet[]> {
      const { data, error } = await db
        .from("run_sheets")
        .select("*")
        .eq("sunday_id", sundayId)
        .order("received_at", { ascending: false });
      if (error) throw new Error(`listRunSheetsForSunday: ${error.message}`);
      return (data ?? []).map(runSheetFromRow);
    },
    async getLatestRunSheetForSunday(sundayId: string): Promise<RunSheet | null> {
      const { data, error } = await db
        .from("run_sheets")
        .select("*")
        .eq("sunday_id", sundayId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`getLatestRunSheetForSunday: ${error.message}`);
      return data ? runSheetFromRow(data) : null;
    },
    async updateRunSheet(id: string, patch: UpdateRunSheetPatch): Promise<RunSheet> {
      const row: Partial<RunSheetRow> = {};
      if (patch.extractedText !== undefined) row.extracted_text = patch.extractedText;
      if (patch.parseStatus !== undefined) row.parse_status = patch.parseStatus;
      if (patch.parseError !== undefined) row.parse_error = patch.parseError;
      if (patch.parsedJson !== undefined) row.parsed_json = patch.parsedJson as unknown as Json;
      if (patch.modelOutput !== undefined) row.model_output = patch.modelOutput as Json;
      if (patch.processedAt !== undefined) row.processed_at = patch.processedAt;
      if (patch.openedAt !== undefined) row.opened_at = patch.openedAt;
      const { data, error } = await db.from("run_sheets").update(row).eq("id", id).select("*").single();
      return runSheetFromRow(assertData(data, error, "updateRunSheet"));
    },
    async listRecentRunSheets(limit: number): Promise<RunSheet[]> {
      const { data, error } = await db
        .from("run_sheets")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`listRecentRunSheets: ${error.message}`);
      return (data ?? []).map(runSheetFromRow);
    },
    async findRunSheetByInboundEventId(eventId: string): Promise<RunSheet | null> {
      const { data, error } = await db.from("run_sheets").select("*").eq("inbound_event_id", eventId).maybeSingle();
      if (error) throw new Error(`findRunSheetByInboundEventId: ${error.message}`);
      return data ? runSheetFromRow(data) : null;
    },

    // ---------- slides ----------
    async listSlidesForSunday(sundayId: string): Promise<Slide[]> {
      const { data, error } = await db
        .from("slides")
        .select("*")
        .eq("sunday_id", sundayId)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(`listSlidesForSunday: ${error.message}`);
      return (data ?? []).map(slideFromRow);
    },
    async getSlide(id: string): Promise<Slide | null> {
      const { data, error } = await db.from("slides").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getSlide: ${error.message}`);
      return data ? slideFromRow(data) : null;
    },
    async createSlide(input: CreateSlideInput): Promise<Slide> {
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const { count } = await db
          .from("slides")
          .select("id", { count: "exact", head: true })
          .eq("sunday_id", input.sundayId);
        sortOrder = count ?? 0;
      }
      const row = slideToRow({ ...input, sortOrder });
      const { data, error } = await db.from("slides").insert(row).select("*").single();
      return slideFromRow(assertData(data, error, "createSlide"));
    },
    async createSlides(inputs: CreateSlideInput[]): Promise<Slide[]> {
      const rows = inputs.map((input, i) => slideToRow({ ...input, sortOrder: input.sortOrder ?? i }));
      const { data, error } = await db.from("slides").insert(rows).select("*");
      if (error) throw new Error(`createSlides: ${error.message}`);
      return (data ?? []).map(slideFromRow);
    },
    async updateSlide(id: string, patch: UpdateSlidePatch): Promise<Slide> {
      const row = slidePatchToRow(patch);
      const { data, error } = await db.from("slides").update(row).eq("id", id).select("*").single();
      return slideFromRow(assertData(data, error, "updateSlide"));
    },
    async deleteSlide(id: string): Promise<void> {
      const { error } = await db.from("slides").delete().eq("id", id);
      if (error) throw new Error(`deleteSlide: ${error.message}`);
    },
    async reorderSlides(sundayId: string, orderedIds: string[]): Promise<Slide[]> {
      await Promise.all(
        orderedIds.map((id, index) => db.from("slides").update({ sort_order: index }).eq("id", id).eq("sunday_id", sundayId)),
      );
      return this.listSlidesForSunday(sundayId);
    },
    async replaceSlidesForSunday(sundayId: string, inputs: CreateSlideInput[]): Promise<Slide[]> {
      const { error: deleteError } = await db.from("slides").delete().eq("sunday_id", sundayId);
      if (deleteError) throw new Error(`replaceSlidesForSunday (delete): ${deleteError.message}`);
      if (inputs.length === 0) return [];
      return this.createSlides(inputs.map((input) => ({ ...input, sundayId })));
    },

    // ---------- templates ----------
    async listTemplates(opts): Promise<TemplateWithFields[]> {
      let query = db.from("templates").select("*").order("name_en", { ascending: true });
      if (opts?.status) query = query.eq("status", opts.status);
      if (opts?.category) query = query.eq("category", opts.category);
      const { data, error } = await query;
      if (error) throw new Error(`listTemplates: ${error.message}`);
      return Promise.all((data ?? []).map(hydrateTemplate));
    },
    async getTemplate(id: string): Promise<TemplateWithFields | null> {
      const { data, error } = await db.from("templates").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getTemplate: ${error.message}`);
      return data ? hydrateTemplate(data) : null;
    },
    async getTemplateBySlug(slug: string): Promise<TemplateWithFields | null> {
      const { data, error } = await db.from("templates").select("*").eq("slug", slug).maybeSingle();
      if (error) throw new Error(`getTemplateBySlug: ${error.message}`);
      return data ? hydrateTemplate(data) : null;
    },
    async createTemplate(input: CreateTemplateInput): Promise<TemplateWithFields> {
      const { data, error } = await db
        .from("templates")
        .insert({
          slug: input.slug,
          name_en: input.nameEn,
          name_fr: input.nameFr,
          category: input.category,
          status: input.status ?? "draft",
          renderer_key: input.rendererKey ?? "generic-v1",
          background_type: input.backgroundType ?? "color",
          background_value: input.backgroundValue ?? "#0f172a",
          overlay_color: input.overlayColor ?? "none",
          overlay_opacity: input.overlayOpacity ?? 0,
          include_in_video_default: input.includeInVideoDefault ?? true,
          allow_team_background_choice: input.allowTeamBackgroundChoice ?? true,
        })
        .select("*")
        .single();
      return hydrateTemplate(assertData(data, error, "createTemplate"));
    },
    async updateTemplate(id: string, patch: UpdateTemplatePatch): Promise<TemplateWithFields> {
      const row: Partial<TemplateRow> = {};
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.nameEn !== undefined) row.name_en = patch.nameEn;
      if (patch.nameFr !== undefined) row.name_fr = patch.nameFr;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.rendererKey !== undefined) row.renderer_key = patch.rendererKey;
      if (patch.backgroundType !== undefined) row.background_type = patch.backgroundType;
      if (patch.backgroundValue !== undefined) row.background_value = patch.backgroundValue;
      if (patch.overlayColor !== undefined) row.overlay_color = patch.overlayColor;
      if (patch.overlayOpacity !== undefined) row.overlay_opacity = patch.overlayOpacity;
      if (patch.includeInVideoDefault !== undefined) row.include_in_video_default = patch.includeInVideoDefault;
      if (patch.allowTeamBackgroundChoice !== undefined) row.allow_team_background_choice = patch.allowTeamBackgroundChoice;
      const { data, error } = await db.from("templates").update(row).eq("id", id).select("*").single();
      return hydrateTemplate(assertData(data, error, "updateTemplate"));
    },
    async upsertTemplateFields(templateId: string, fields: CreateTemplateFieldInput[]) {
      const { error: deleteError } = await db.from("template_fields").delete().eq("template_id", templateId);
      if (deleteError) throw new Error(`upsertTemplateFields (delete): ${deleteError.message}`);
      if (fields.length === 0) return [];
      const rows = fields.map((f) => ({
        template_id: templateId,
        field_key: f.fieldKey,
        field_type: f.fieldType ?? "text",
        label_en: f.labelEn,
        label_fr: f.labelFr,
        team_editable: f.teamEditable,
        required: f.required,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        font_id: f.fontId ?? null,
        font_family: f.fontFamily,
        font_size: f.fontSize,
        min_font_size: f.minFontSize,
        font_weight: f.fontWeight,
        font_style: f.fontStyle,
        line_height: f.lineHeight,
        letter_spacing: f.letterSpacing,
        alignment: f.alignment,
        text_color: f.textColor,
        max_lines: f.maxLines,
        overflow_mode: f.overflowMode,
        text_transform: f.textTransform,
        sort_order: f.sortOrder,
        default_value: f.defaultValue ?? "",
        rotation: f.rotation ?? 0,
        box_color: f.boxColor ?? null,
        box_padding: f.boxPadding ?? 0,
        frame_color: f.frameColor ?? null,
        frame_width: f.frameWidth ?? 0,
      }));
      const { data, error } = await db.from("template_fields").insert(rows).select("*");
      if (error) throw new Error(`upsertTemplateFields (insert): ${error.message}`);
      return (data ?? []).map(templateFieldFromRow);
    },
    async setTemplateAssets(templateId: string, assetIds: string[]): Promise<void> {
      const { error: deleteError } = await db.from("template_assets").delete().eq("template_id", templateId);
      if (deleteError) throw new Error(`setTemplateAssets (delete): ${deleteError.message}`);
      if (assetIds.length === 0) return;
      const { error } = await db
        .from("template_assets")
        .insert(assetIds.map((assetId) => ({ template_id: templateId, asset_id: assetId })));
      if (error) throw new Error(`setTemplateAssets (insert): ${error.message}`);
    },
    async countSlidesUsingTemplate(templateId: string): Promise<number> {
      const { count, error } = await db
        .from("slides")
        .select("id", { count: "exact", head: true })
        .eq("template_id", templateId);
      if (error) throw new Error(`countSlidesUsingTemplate: ${error.message}`);
      return count ?? 0;
    },

    // ---------- assets ----------
    async listAssets(opts) {
      let query = db.from("assets").select("*").order("name_en", { ascending: true });
      if (opts?.status) query = query.eq("status", opts.status);
      if (opts?.category) query = query.eq("category", opts.category);
      const { data, error } = await query;
      if (error) throw new Error(`listAssets: ${error.message}`);
      return (data ?? []).map(assetFromRow);
    },
    async getAsset(id: string) {
      const { data, error } = await db.from("assets").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getAsset: ${error.message}`);
      return data ? assetFromRow(data) : null;
    },
    async createAsset(input: CreateAssetInput) {
      const { data, error } = await db
        .from("assets")
        .insert({
          name_en: input.nameEn,
          name_fr: input.nameFr,
          status: input.status ?? "draft",
          category: input.category,
          tags: input.tags ?? [],
          r2_key: input.r2Key,
          mime_type: input.mimeType,
          width: input.width,
          height: input.height,
          focal_x: input.focalX ?? 0.5,
          focal_y: input.focalY ?? 0.5,
          crop_metadata: (input.cropMetadata as Json) ?? null,
        })
        .select("*")
        .single();
      return assetFromRow(assertData(data, error, "createAsset"));
    },
    async updateAsset(id: string, patch: UpdateAssetPatch) {
      const row: Partial<AssetRow> = {};
      if (patch.nameEn !== undefined) row.name_en = patch.nameEn;
      if (patch.nameFr !== undefined) row.name_fr = patch.nameFr;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.tags !== undefined) row.tags = patch.tags;
      if (patch.r2Key !== undefined) row.r2_key = patch.r2Key;
      if (patch.mimeType !== undefined) row.mime_type = patch.mimeType;
      if (patch.width !== undefined) row.width = patch.width;
      if (patch.height !== undefined) row.height = patch.height;
      if (patch.focalX !== undefined) row.focal_x = patch.focalX;
      if (patch.focalY !== undefined) row.focal_y = patch.focalY;
      if (patch.cropMetadata !== undefined) row.crop_metadata = patch.cropMetadata as Json;
      const { data, error } = await db.from("assets").update(row).eq("id", id).select("*").single();
      return assetFromRow(assertData(data, error, "updateAsset"));
    },
    async listAssetsForTemplate(templateId: string, opts) {
      const { data: links, error: linkError } = await db
        .from("template_assets")
        .select("asset_id")
        .eq("template_id", templateId);
      if (linkError) throw new Error(`listAssetsForTemplate: ${linkError.message}`);
      const ids = (links ?? []).map((l) => l.asset_id);
      if (ids.length === 0) return [];
      let query = db.from("assets").select("*").in("id", ids);
      if (opts?.publishedOnly !== false) query = query.eq("status", "published");
      const { data, error } = await query;
      if (error) throw new Error(`listAssetsForTemplate: ${error.message}`);
      return ((data as AssetRow[]) ?? []).map(assetFromRow);
    },

    // ---------- approved colors ----------
    async listApprovedColors(opts) {
      let query = db.from("approved_colors").select("*").order("sort_order", { ascending: true });
      if (opts?.enabledOnly) query = query.eq("enabled", true);
      const { data, error } = await query;
      if (error) throw new Error(`listApprovedColors: ${error.message}`);
      return (data ?? []).map(approvedColorFromRow);
    },
    async upsertApprovedColor(input: UpsertApprovedColorInput) {
      const row = {
        ...(input.id ? { id: input.id } : {}),
        name_en: input.nameEn,
        name_fr: input.nameFr,
        hex: input.hex,
        enabled: input.enabled ?? true,
        sort_order: input.sortOrder ?? 0,
      };
      const { data, error } = await db.from("approved_colors").upsert(row).select("*").single();
      return approvedColorFromRow(assertData(data, error, "upsertApprovedColor"));
    },
    async deleteApprovedColor(id: string) {
      const { error } = await db.from("approved_colors").delete().eq("id", id);
      if (error) throw new Error(`deleteApprovedColor: ${error.message}`);
    },

    // ---------- fonts ----------
    async listFonts() {
      const { data, error } = await db.from("fonts").select("*").order("family", { ascending: true });
      if (error) throw new Error(`listFonts: ${error.message}`);
      return (data ?? []).map(fontFromRow);
    },
    async createFont(input: CreateFontInput) {
      const { data, error } = await db
        .from("fonts")
        .insert({
          family: input.family,
          source: input.source,
          source_identifier: input.sourceIdentifier ?? null,
          r2_key: input.r2Key ?? null,
          weight: input.weight,
          style: input.style,
          enabled: input.enabled ?? true,
        })
        .select("*")
        .single();
      return fontFromRow(assertData(data, error, "createFont"));
    },
    async updateFont(id: string, patch: UpdateFontPatch) {
      const row: Partial<FontRow> = {};
      if (patch.family !== undefined) row.family = patch.family;
      if (patch.source !== undefined) row.source = patch.source;
      if (patch.sourceIdentifier !== undefined) row.source_identifier = patch.sourceIdentifier;
      if (patch.r2Key !== undefined) row.r2_key = patch.r2Key;
      if (patch.weight !== undefined) row.weight = patch.weight;
      if (patch.style !== undefined) row.style = patch.style;
      if (patch.enabled !== undefined) row.enabled = patch.enabled;
      const { data, error } = await db.from("fonts").update(row).eq("id", id).select("*").single();
      return fontFromRow(assertData(data, error, "updateFont"));
    },
    async deleteFont(id: string) {
      const { data: font, error: fontError } = await db.from("fonts").select("*").eq("id", id).maybeSingle();
      if (fontError) throw new Error(`deleteFont: ${fontError.message}`);
      if (!font) throw new Error(`deleteFont: not found: ${id}`);
      const { data: fieldsUsing, error: fieldsError } = await db
        .from("template_fields")
        .select("template_id")
        .or(`font_id.eq.${id},font_family.eq.${font.family}`);
      if (fieldsError) throw new Error(`deleteFont: ${fieldsError.message}`);
      const templateIds = [...new Set((fieldsUsing ?? []).map((f) => f.template_id))];
      if (templateIds.length > 0) {
        const { data: templates, error: templatesError } = await db
          .from("templates")
          .select("id, name_en, status")
          .in("id", templateIds)
          .eq("status", "published");
        if (templatesError) throw new Error(`deleteFont: ${templatesError.message}`);
        if (templates && templates.length > 0) {
          throw new FontInUseError(
            id,
            templates.map((t) => t.name_en),
          );
        }
      }
      const { error } = await db.from("fonts").delete().eq("id", id);
      if (error) throw new Error(`deleteFont: ${error.message}`);
    },
    async listFontsUsedByPublishedTemplates() {
      const { data: templates, error: templatesError } = await db
        .from("templates")
        .select("id")
        .eq("status", "published");
      if (templatesError) throw new Error(`listFontsUsedByPublishedTemplates: ${templatesError.message}`);
      const templateIds = (templates ?? []).map((t) => t.id);
      if (templateIds.length === 0) return [];
      const { data: fields, error: fieldsError } = await db
        .from("template_fields")
        .select("font_family")
        .in("template_id", templateIds);
      if (fieldsError) throw new Error(`listFontsUsedByPublishedTemplates: ${fieldsError.message}`);
      const families = [...new Set((fields ?? []).map((f) => f.font_family))];
      if (families.length === 0) return [];
      const { data: fonts, error: fontsError } = await db.from("fonts").select("*").in("family", families);
      if (fontsError) throw new Error(`listFontsUsedByPublishedTemplates: ${fontsError.message}`);
      return (fonts ?? []).map(fontFromRow);
    },

    // ---------- mappings ----------
    async listMappings() {
      const [{ data: mappingRows, error: mappingError }, { data: templateRows, error: templateError }] = await Promise.all([
        db.from("announcement_mappings").select("*").order("canonical_name", { ascending: true }),
        db.from("templates").select("*"),
      ]);
      if (mappingError) throw new Error(`listMappings: ${mappingError.message}`);
      if (templateError) throw new Error(`listMappings: ${templateError.message}`);
      const templatesById = new Map(
        (templateRows ?? []).map((t) => [t.id, templateFromRow(t)]),
      );
      return Promise.all((mappingRows ?? []).map((row) => hydrateMapping(row, templatesById)));
    },
    async getMapping(id: string) {
      const { data, error } = await db.from("announcement_mappings").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getMapping: ${error.message}`);
      if (!data) return null;
      const { data: templateRow } = await db.from("templates").select("*").eq("id", data.template_id).maybeSingle();
      const templatesById = new Map(templateRow ? [[templateRow.id, templateFromRow(templateRow)]] : []);
      return hydrateMapping(data, templatesById);
    },
    async createMapping(input: CreateMappingInput) {
      const canonicalKey = normalizeAlias(input.canonicalName).replace(/\s+/g, "-");
      const { data: mappingRow, error } = await db
        .from("announcement_mappings")
        .insert({ canonical_name: input.canonicalName, canonical_key: canonicalKey, template_id: input.templateId })
        .select("*")
        .single();
      const mapping = assertData(mappingRow, error, "createMapping");
      if (input.aliases.length > 0) {
        const { error: aliasError } = await db.from("announcement_aliases").insert(
          input.aliases.map((a) => ({
            mapping_id: mapping.id,
            alias: a.alias,
            alias_normalized: normalizeAlias(a.alias),
            locale: a.locale ?? null,
          })),
        );
        if (aliasError) throw new Error(`createMapping (aliases): ${aliasError.message}`);
      }
      const { data: templateRow } = await db.from("templates").select("*").eq("id", input.templateId).maybeSingle();
      const templatesById = new Map(templateRow ? [[templateRow.id, templateFromRow(templateRow)]] : []);
      return hydrateMapping(mapping, templatesById);
    },
    async updateMapping(id: string, patch: UpdateMappingPatch) {
      const row: Partial<AnnouncementMappingRow> = {};
      if (patch.canonicalName !== undefined) row.canonical_name = patch.canonicalName;
      if (patch.templateId !== undefined) row.template_id = patch.templateId;
      if (patch.active !== undefined) row.active = patch.active;
      const { data, error } = await db.from("announcement_mappings").update(row).eq("id", id).select("*").single();
      const mapping = assertData(data, error, "updateMapping");
      const { data: templateRow } = await db.from("templates").select("*").eq("id", mapping.template_id).maybeSingle();
      const templatesById = new Map(templateRow ? [[templateRow.id, templateFromRow(templateRow)]] : []);
      return hydrateMapping(mapping, templatesById);
    },
    async deleteMapping(id: string) {
      const { error } = await db.from("announcement_mappings").delete().eq("id", id);
      if (error) throw new Error(`deleteMapping: ${error.message}`);
    },
    async addAlias(mappingId: string, alias: string, locale) {
      const { data, error } = await db
        .from("announcement_aliases")
        .insert({ mapping_id: mappingId, alias, alias_normalized: normalizeAlias(alias), locale: locale ?? null })
        .select("*")
        .single();
      return aliasFromRow(assertData(data, error, "addAlias") as AnnouncementAliasRow);
    },
    async listMappingSuggestions(): Promise<MappingSuggestion[]> {
      const { data, error } = await db
        .from("mapping_suggestions")
        .select("*")
        .is("dismissed_at", null)
        .order("last_seen_at", { ascending: false });
      if (error) throw new Error(`listMappingSuggestions: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: row.id,
        sourceText: row.source_text,
        sourceTextNormalized: row.source_text_normalized,
        lastSeenAt: row.last_seen_at,
        seenCount: row.seen_count,
        dismissedAt: row.dismissed_at,
      }));
    },
    async upsertMappingSuggestion(sourceText: string): Promise<MappingSuggestion> {
      const normalized = normalizeAlias(sourceText);
      const { data: existing } = await db
        .from("mapping_suggestions")
        .select("*")
        .eq("source_text_normalized", normalized)
        .maybeSingle();
      if (existing) {
        const { data, error } = await db
          .from("mapping_suggestions")
          .update({ seen_count: existing.seen_count + 1, last_seen_at: new Date().toISOString(), dismissed_at: null })
          .eq("id", existing.id)
          .select("*")
          .single();
        const row = assertData(data, error, "upsertMappingSuggestion");
        return {
          id: row.id,
          sourceText: row.source_text,
          sourceTextNormalized: row.source_text_normalized,
          lastSeenAt: row.last_seen_at,
          seenCount: row.seen_count,
          dismissedAt: row.dismissed_at,
        };
      }
      const { data, error } = await db
        .from("mapping_suggestions")
        .insert({ source_text: sourceText, source_text_normalized: normalized })
        .select("*")
        .single();
      const row = assertData(data, error, "upsertMappingSuggestion");
      return {
        id: row.id,
        sourceText: row.source_text,
        sourceTextNormalized: row.source_text_normalized,
        lastSeenAt: row.last_seen_at,
        seenCount: row.seen_count,
        dismissedAt: row.dismissed_at,
      };
    },
    async dismissMappingSuggestion(id: string) {
      const { error } = await db
        .from("mapping_suggestions")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`dismissMappingSuggestion: ${error.message}`);
    },

    // ---------- structural defaults ----------
    async listStructuralDefaults(opts) {
      let query = db.from("default_structural_slides").select("*").order("sort_order", { ascending: true });
      if (opts?.enabledOnly) query = query.eq("enabled", true);
      const { data, error } = await query;
      if (error) throw new Error(`listStructuralDefaults: ${error.message}`);
      return (data ?? []).map(structuralDefaultFromRow);
    },
    async upsertStructuralDefault(input: UpsertStructuralDefaultInput) {
      const row = {
        ...(input.id ? { id: input.id } : {}),
        template_id: input.templateId,
        name_en: input.nameEn,
        name_fr: input.nameFr,
        insertion_rule: input.insertionRule,
        default_sort_zone: input.defaultSortZone,
        sort_order: input.sortOrder ?? 0,
        enabled: input.enabled ?? true,
        removable_by_sunday_team: input.removableBySundayTeam ?? true,
        include_in_video_default: input.includeInVideoDefault ?? true,
        default_content: input.defaultContent ?? {},
      };
      const { data, error } = await db.from("default_structural_slides").upsert(row).select("*").single();
      return structuralDefaultFromRow(assertData(data, error, "upsertStructuralDefault"));
    },
    async deleteStructuralDefault(id: string) {
      const { error } = await db.from("default_structural_slides").delete().eq("id", id);
      if (error) throw new Error(`deleteStructuralDefault: ${error.message}`);
    },

    // ---------- exports ----------
    async createExportJob(input: CreateExportJobInput): Promise<ExportJob> {
      const { data, error } = await db
        .from("export_jobs")
        .insert({
          sunday_id: input.sundayId,
          type: input.type,
          status: input.status ?? "queued",
          selection_json: input.selection as unknown as Json,
        })
        .select("*")
        .single();
      return exportJobFromRow(assertData(data, error, "createExportJob"));
    },
    async updateExportJob(id: string, patch: UpdateExportJobPatch): Promise<ExportJob> {
      const row: Partial<ExportJobRow> = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.outputR2Key !== undefined) row.output_r2_key = patch.outputR2Key;
      if (patch.error !== undefined) row.error = patch.error;
      if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
      const { data, error } = await db.from("export_jobs").update(row).eq("id", id).select("*").single();
      return exportJobFromRow(assertData(data, error, "updateExportJob"));
    },
    async getExportJob(id: string): Promise<ExportJob | null> {
      const { data, error } = await db.from("export_jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getExportJob: ${error.message}`);
      return data ? exportJobFromRow(data) : null;
    },
    async listRecentExportJobs(limit: number): Promise<ExportJob[]> {
      const { data, error } = await db
        .from("export_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`listRecentExportJobs: ${error.message}`);
      return (data ?? []).map(exportJobFromRow);
    },

    // ---------- system checks ----------
    async recordSystemCheck(type, status, details): Promise<SystemCheck> {
      const { data, error } = await db
        .from("system_checks")
        .insert({ check_type: type, status, details: details as Json })
        .select("*")
        .single();
      return systemCheckFromRow(assertData(data, error, "recordSystemCheck"));
    },
    async latestSystemChecks(): Promise<SystemCheck[]> {
      const { data, error } = await db.from("system_checks").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(`latestSystemChecks: ${error.message}`);
      const byType = new Map<string, SystemCheck>();
      for (const row of data ?? []) {
        const check = systemCheckFromRow(row);
        if (!byType.has(check.checkType)) byType.set(check.checkType, check);
      }
      return [...byType.values()];
    },

    // ---------- pin attempts ----------
    async recordPinAttempt(ipHash: string, success: boolean): Promise<void> {
      const { error } = await db.from("pin_attempts").insert({ ip_hash: ipHash, success });
      if (error) throw new Error(`recordPinAttempt: ${error.message}`);
    },
    async countRecentPinFailures(ipHash: string, windowMinutes: number): Promise<number> {
      const cutoff = new Date(Date.now() - windowMinutes * 60_000).toISOString();
      const { count, error } = await db
        .from("pin_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .eq("success", false)
        .gte("attempted_at", cutoff);
      if (error) throw new Error(`countRecentPinFailures: ${error.message}`);
      return count ?? 0;
    },
  };
}
