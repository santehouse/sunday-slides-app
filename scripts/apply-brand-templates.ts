/**
 * Applies the EAJC brand templates (src/lib/data/brandTemplates.ts) to a real Supabase
 * project: upserts each template by slug (fields fully replaced, allowed assets re-linked)
 * and refreshes the structural defaults' starting content. Safe to re-run.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     pnpm tsx --tsconfig scripts/tsconfig.json scripts/apply-brand-templates.ts
 *
 * Background pictures are looked up by name in the Assets library ("Annual theme sky",
 * "Baptêmes water", "Conference gold" — uploaded under Admin → Assets). A template whose
 * picture is not there yet is applied with a solid fallback colour and reported, so the
 * admin can switch it to the picture in the Studio once it is uploaded.
 *
 * Requires migration 0003_template_field_layers.sql. Like scripts/seed.ts, this avoids
 * every `server-only` module and talks to Supabase directly.
 */
import { createClient } from "@supabase/supabase-js";
import { BRAND_ASSET_NAMES, BRAND_ASSET_SLUGS, BRAND_TEMPLATE_SEEDS } from "../src/lib/data/brandTemplates";
import { STRUCTURAL_DEFAULT_SEEDS } from "../src/lib/data/mockSeed";
import type { Database } from "../src/lib/supabase/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("apply-brand-templates: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Solid stand-ins while a template's photo has not been uploaded yet. */
const FALLBACK_COLOR: Record<string, string> = {
  [BRAND_ASSET_SLUGS.annualTheme]: "#4b6a86",
  [BRAND_ASSET_SLUGS.baptisms]: "#2f5a6b",
  [BRAND_ASSET_SLUGS.conference]: "#1d2a1c",
};

async function loadAssetIds(): Promise<Map<string, string>> {
  const { data, error } = await db.from("assets").select("id,name_en,r2_key");
  if (error) throw new Error(`assets: ${error.message}`);
  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const row of data ?? []) {
    byName.set(row.name_en.trim().toLowerCase(), row.id);
    // Seeded demo assets are keyed assets/<slug>.svg; brand photos are matched by name.
    const slug = /^assets\/([^./]+)\.svg$/.exec(row.r2_key)?.[1];
    if (slug) bySlug.set(slug, row.id);
  }
  for (const [key, slug] of Object.entries(BRAND_ASSET_SLUGS) as Array<[keyof typeof BRAND_ASSET_SLUGS, string]>) {
    const id = byName.get(BRAND_ASSET_NAMES[key].nameEn.toLowerCase());
    if (id) bySlug.set(slug, id);
  }
  return bySlug;
}

async function applyTemplates(assetIdBySlug: Map<string, string>): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const template of BRAND_TEMPLATE_SEEDS) {
    let backgroundType = template.backgroundType;
    let backgroundValue = template.backgroundValue;
    if (template.backgroundType === "image") {
      const assetId = assetIdBySlug.get(template.backgroundValue);
      if (assetId) {
        backgroundValue = assetId;
      } else {
        backgroundType = "color";
        backgroundValue = FALLBACK_COLOR[template.backgroundValue] ?? "#0f172a";
        console.warn(
          `  ! ${template.slug}: picture "${template.backgroundValue}" not in the Assets library yet — applied with a solid ${backgroundValue} background.`,
        );
      }
    }

    const { data, error } = await db
      .from("templates")
      .upsert(
        {
          slug: template.slug,
          name_en: template.nameEn,
          name_fr: template.nameFr,
          category: template.category,
          status: template.status,
          renderer_key: template.rendererKey ?? "generic-v1",
          background_type: backgroundType,
          background_value: backgroundValue,
          overlay_color: template.overlayColor,
          overlay_opacity: template.overlayOpacity,
          include_in_video_default: template.includeInVideoDefault,
          allow_team_background_choice: template.allowTeamBackgroundChoice,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(`template ${template.slug}: ${error?.message}`);
    idBySlug.set(template.slug, data.id);

    const { error: deleteError } = await db.from("template_fields").delete().eq("template_id", data.id);
    if (deleteError) throw new Error(`fields delete ${template.slug}: ${deleteError.message}`);
    const { error: fieldsError } = await db.from("template_fields").insert(
      template.fields.map((f) => ({
        template_id: data.id,
        field_key: f.fieldKey,
        field_type: f.fieldType ?? "text",
        label_en: f.labelEn,
        label_fr: f.labelFr,
        team_editable: f.teamEditable,
        required: f.required,
        x: Math.round(f.x),
        y: Math.round(f.y),
        width: Math.round(f.width),
        height: Math.round(f.height),
        font_family: f.fontFamily,
        font_size: Math.round(f.fontSize),
        min_font_size: Math.round(f.minFontSize),
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
      })),
    );
    if (fieldsError) throw new Error(`fields insert ${template.slug}: ${fieldsError.message}`);

    const { error: deleteAssetsError } = await db.from("template_assets").delete().eq("template_id", data.id);
    if (deleteAssetsError) throw new Error(`assets delete ${template.slug}: ${deleteAssetsError.message}`);
    const allowed = template.allowedAssetSlugs.map((slug) => assetIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
    if (allowed.length > 0) {
      const { error: assetsError } = await db
        .from("template_assets")
        .insert(allowed.map((assetId) => ({ template_id: data.id, asset_id: assetId })));
      if (assetsError) throw new Error(`assets insert ${template.slug}: ${assetsError.message}`);
    }
    console.log(`  ✓ ${template.slug} (${template.fields.length} fields, ${allowed.length} allowed assets)`);
  }
  return idBySlug;
}

/** Structural slides start from the brand templates' content (e.g. the weekly schedule). */
async function refreshStructuralDefaults(templateIdBySlug: Map<string, string>) {
  for (const def of STRUCTURAL_DEFAULT_SEEDS) {
    const templateId = templateIdBySlug.get(def.templateSlug);
    if (!templateId) continue;
    const { error } = await db
      .from("default_structural_slides")
      .update({ template_id: templateId, default_content: def.defaultContent })
      .eq("name_en", def.nameEn);
    if (error) throw new Error(`structural default ${def.nameEn}: ${error.message}`);
  }
  console.log("  ✓ structural defaults refreshed");
}

/** The seeded "Culte d'adoration" mapping pointed at the weekly-schedule template; it is a plain announcement. */
async function fixWorshipMapping() {
  const { data, error } = await db.from("templates").select("id").eq("slug", "general-announcement").maybeSingle();
  if (error) throw new Error(`templates: ${error.message}`);
  if (!data) return;
  const { error: updateError } = await db
    .from("announcement_mappings")
    .update({ template_id: data.id })
    .eq("canonical_key", "culte-d-adoration");
  if (updateError) throw new Error(`mapping culte-d-adoration: ${updateError.message}`);
  console.log("  ✓ \"Culte d'adoration\" mapping → General announcement");
}

async function main() {
  console.log("Applying brand templates…");
  const assetIdBySlug = await loadAssetIds();
  const templateIdBySlug = await applyTemplates(assetIdBySlug);
  await refreshStructuralDefaults(templateIdBySlug);
  await fixWorshipMapping();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
