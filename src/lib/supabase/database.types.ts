/**
 * Hand-written minimal Database type for supabase/migrations/0001_init.sql.
 * Covers every table + enum used by src/lib/data/supabaseDb.ts. A generated
 * file (`pnpm db:types`) will replace this once a real project is linked —
 * keep shapes here in sync with the migration until then.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AdminRoleEnum = "owner" | "admin";
export type SundayStatusEnum = "draft" | "needs_review" | "ready" | "exported";
export type RunSheetSourceEnum = "email" | "manual";
export type RunSheetParseStatusEnum =
  "queued" | "processing" | "ready_to_apply" | "added_to_flow" | "needs_review" | "failed";
export type TemplateStatusEnum = "draft" | "published" | "archived";
export type TemplateCategoryEnum =
  "general" | "events" | "special" | "giving" | "welcome" | "theme" | "closing";
export type BackgroundTypeEnum = "color" | "image";
export type OverlayColorEnum = "none" | "black" | "white";
export type TextAlignmentEnum = "left" | "center" | "right";
export type OverflowModeEnum = "fixed" | "auto_fit" | "flex_height";
export type FontStyleEnum = "normal" | "italic";
export type AssetStatusEnum = "draft" | "published" | "archived";
export type AssetCategoryEnum = "photography" | "backgrounds" | "special";
export type FontSourceEnum = "google" | "custom";
export type SlideStatusEnum = "ready" | "needs_review" | "invalid";
export type SlideBackgroundModeEnum = "color" | "image";
export type StructuralInsertionRuleEnum = "always" | "default" | "manual";
export type StructuralSortZoneEnum =
  "opening" | "before_announcements" | "after_announcements" | "closing";
export type ExportTypeEnum = "jpg" | "jpg_zip" | "mp4";
export type ExportStatusEnum = "queued" | "processing" | "complete" | "failed";

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type AdminUserRow = {
  id: string;
  auth_user_id: string | null;
  display_name: string;
  email: string;
  role: AdminRoleEnum;
  locale: string;
  created_at: string;
  disabled_at: string | null;
};

export type AppSettingsRow = {
  id: string;
  singleton: boolean;
  church_name: string;
  timezone: string;
  default_locale: string;
  sunday_pin_hash: string | null;
  sunday_pin_length: number;
  sunday_pin_version: number;
  default_slide_hold_seconds: number;
  inbound_email: string | null;
  auto_process_inbound: boolean;
  pip_x: number;
  pip_y: number;
  pip_width: number;
  pip_height: number;
  temporary_retention_days: number;
  created_at: string;
  updated_at: string;
};

export type FontRow = {
  id: string;
  family: string;
  source: FontSourceEnum;
  source_identifier: string | null;
  r2_key: string | null;
  weight: number;
  style: FontStyleEnum;
  enabled: boolean;
  created_at: string;
};

export type ApprovedColorRow = {
  id: string;
  name_en: string;
  name_fr: string;
  hex: string;
  enabled: boolean;
  sort_order: number;
};

export type AssetRow = {
  id: string;
  name_en: string;
  name_fr: string;
  status: AssetStatusEnum;
  category: AssetCategoryEnum;
  tags: string[];
  r2_key: string;
  mime_type: string;
  width: number;
  height: number;
  focal_x: number;
  focal_y: number;
  crop_metadata: Json | null;
  created_at: string;
  updated_at: string;
};

export type TemplateRow = {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  category: TemplateCategoryEnum;
  status: TemplateStatusEnum;
  renderer_key: string;
  background_type: BackgroundTypeEnum;
  background_value: string;
  overlay_color: OverlayColorEnum;
  overlay_opacity: number;
  include_in_video_default: boolean;
  allow_team_background_choice: boolean;
  created_at: string;
  updated_at: string;
};

export type TemplateFieldRow = {
  id: string;
  template_id: string;
  field_key: string;
  field_type: string;
  label_en: string;
  label_fr: string;
  team_editable: boolean;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  font_id: string | null;
  font_family: string;
  font_size: number;
  min_font_size: number;
  font_weight: number;
  font_style: FontStyleEnum;
  line_height: number;
  letter_spacing: number;
  alignment: TextAlignmentEnum;
  text_color: string;
  max_lines: number;
  overflow_mode: OverflowModeEnum;
  text_transform: string;
  sort_order: number;
};

export type TemplateAssetRow = {
  template_id: string;
  asset_id: string;
};

export type AnnouncementMappingRow = {
  id: string;
  canonical_name: string;
  canonical_key: string;
  template_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AnnouncementAliasRow = {
  id: string;
  mapping_id: string;
  alias: string;
  alias_normalized: string;
  locale: string | null;
};

export type MappingSuggestionRow = {
  id: string;
  source_text: string;
  source_text_normalized: string;
  last_seen_at: string;
  seen_count: number;
  dismissed_at: string | null;
};

export type DefaultStructuralSlideRow = {
  id: string;
  template_id: string;
  name_en: string;
  name_fr: string;
  insertion_rule: StructuralInsertionRuleEnum;
  default_sort_zone: StructuralSortZoneEnum;
  sort_order: number;
  enabled: boolean;
  removable_by_sunday_team: boolean;
  include_in_video_default: boolean;
  default_content: Json;
};

export type SundayRow = {
  id: string;
  service_date: string;
  status: SundayStatusEnum;
  source_run_sheet_id: string | null;
  default_slide_hold_seconds: number;
  created_at: string;
  updated_at: string;
};

export type RunSheetRow = {
  id: string;
  sunday_id: string;
  source_type: RunSheetSourceEnum;
  original_filename: string;
  mime_type: string;
  r2_key: string;
  extracted_text: string | null;
  parse_status: RunSheetParseStatusEnum;
  parse_error: string | null;
  parsed_json: Json | null;
  model_output: Json | null;
  inbound_event_id: string | null;
  received_at: string;
  processed_at: string | null;
  opened_at: string | null;
};

export type SlideRow = {
  id: string;
  sunday_id: string;
  template_id: string;
  headline: string;
  content_json: Json;
  asset_id: string | null;
  background_mode: SlideBackgroundModeEnum;
  approved_color_id: string | null;
  sort_order: number;
  include_in_video: boolean;
  status: SlideStatusEnum;
  is_structural: boolean;
  structural_default_id: string | null;
  parser_confidence: number | null;
  mapping_id: string | null;
  source_announcement_json: Json | null;
  manually_edited: boolean;
  created_at: string;
  updated_at: string;
};

export type ExportJobRow = {
  id: string;
  sunday_id: string;
  type: ExportTypeEnum;
  status: ExportStatusEnum;
  selection_json: Json;
  output_r2_key: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export type SystemCheckRow = {
  id: string;
  check_type: string;
  status: "ok" | "warn" | "error";
  details: Json;
  created_at: string;
};

export type PinAttemptRow = {
  id: number;
  ip_hash: string;
  attempted_at: string;
  success: boolean;
};

type Insertable<Row> = Partial<Row> & Record<string, unknown>;

export type Database = {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      admin_users: Table<AdminUserRow, Insertable<AdminUserRow>, Partial<AdminUserRow>>;
      app_settings: Table<AppSettingsRow, Insertable<AppSettingsRow>, Partial<AppSettingsRow>>;
      fonts: Table<FontRow, Insertable<FontRow>, Partial<FontRow>>;
      approved_colors: Table<
        ApprovedColorRow,
        Insertable<ApprovedColorRow>,
        Partial<ApprovedColorRow>
      >;
      assets: Table<AssetRow, Insertable<AssetRow>, Partial<AssetRow>>;
      templates: Table<TemplateRow, Insertable<TemplateRow>, Partial<TemplateRow>>;
      template_fields: Table<
        TemplateFieldRow,
        Insertable<TemplateFieldRow>,
        Partial<TemplateFieldRow>
      >;
      template_assets: Table<
        TemplateAssetRow,
        Insertable<TemplateAssetRow>,
        Partial<TemplateAssetRow>
      >;
      announcement_mappings: Table<
        AnnouncementMappingRow,
        Insertable<AnnouncementMappingRow>,
        Partial<AnnouncementMappingRow>
      >;
      announcement_aliases: Table<
        AnnouncementAliasRow,
        Insertable<AnnouncementAliasRow>,
        Partial<AnnouncementAliasRow>
      >;
      mapping_suggestions: Table<
        MappingSuggestionRow,
        Insertable<MappingSuggestionRow>,
        Partial<MappingSuggestionRow>
      >;
      default_structural_slides: Table<
        DefaultStructuralSlideRow,
        Insertable<DefaultStructuralSlideRow>,
        Partial<DefaultStructuralSlideRow>
      >;
      sundays: Table<SundayRow, Insertable<SundayRow>, Partial<SundayRow>>;
      run_sheets: Table<RunSheetRow, Insertable<RunSheetRow>, Partial<RunSheetRow>>;
      slides: Table<SlideRow, Insertable<SlideRow>, Partial<SlideRow>>;
      export_jobs: Table<ExportJobRow, Insertable<ExportJobRow>, Partial<ExportJobRow>>;
      system_checks: Table<SystemCheckRow, Insertable<SystemCheckRow>, Partial<SystemCheckRow>>;
      pin_attempts: Table<PinAttemptRow, Insertable<PinAttemptRow>, Partial<PinAttemptRow>>;
    };
  };
};
