/**
 * Idempotent seed for a real Supabase project — run with `pnpm seed`.
 *
 * Seeds the same demo templates/fields/colors/mappings/structural defaults
 * as mock mode (shared from src/lib/data/mockSeed.ts, which has no Next.js
 * imports so it's safe to run under plain tsx), creates the owner admin
 * user via the Supabase Admin API, and sets the Sunday PIN.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (defaults to the demo
 * owner + a generated password if omitted), SEED_SUNDAY_PIN (defaults to
 * the demo PIN "53787").
 *
 * Deliberately does NOT import anything under src/lib that starts with
 * `import "server-only"` (env.ts, supabase/service.ts, data/supabaseDb.ts)
 * — that guard throws unconditionally outside a Next.js server bundle, so
 * this script talks to Supabase directly with its own client.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  ADMIN_USER_SEED,
  APPROVED_COLOR_SEEDS,
  ASSET_SEEDS,
  CHURCH_NAME,
  FONT_SEEDS,
  MAPPING_SEEDS,
  SETTINGS_SEED,
  STRUCTURAL_DEFAULT_SEEDS,
  SUNDAY_PIN,
  TEMPLATE_SEEDS,
} from "../src/lib/data/mockSeed";
import { normalizeAlias } from "../src/lib/data/normalize";
import type { Database } from "../src/lib/supabase/database.types";

loadDotEnvIfPresent();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("seed: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Church Panels seed — starting.");

  await seedFonts();
  await seedApprovedColors();
  const assetIdBySlug = await seedAssets();
  const templateIdBySlug = await seedTemplates(assetIdBySlug);
  await seedMappings(templateIdBySlug);
  await seedStructuralDefaults(templateIdBySlug);
  await seedSettings();
  await seedSundayPin();
  await seedAdminUser();

  console.log("Church Panels seed — done.");
}

async function seedFonts() {
  for (const font of FONT_SEEDS) {
    const { error } = await db
      .from("fonts")
      .upsert(
        {
          family: font.family,
          source: font.source,
          source_identifier: font.sourceIdentifier,
          weight: font.weight,
          style: font.style,
          enabled: font.enabled ?? true,
        },
        { onConflict: "family,weight,style" },
      );
    if (error) throw new Error(`seedFonts(${font.family} ${font.weight} ${font.style}): ${error.message}`);
  }
  console.log(`  fonts: ${FONT_SEEDS.length} upserted`);
}

async function seedApprovedColors() {
  for (const color of APPROVED_COLOR_SEEDS) {
    const { data: existing, error: findError } = await db
      .from("approved_colors")
      .select("id")
      .eq("hex", color.hex)
      .maybeSingle();
    if (findError) throw new Error(`seedApprovedColors (find ${color.hex}): ${findError.message}`);

    const row = {
      name_en: color.nameEn,
      name_fr: color.nameFr,
      hex: color.hex,
      enabled: color.enabled ?? true,
      sort_order: color.sortOrder,
    };
    const { error } = existing
      ? await db.from("approved_colors").update(row).eq("id", existing.id)
      : await db.from("approved_colors").insert(row);
    if (error) throw new Error(`seedApprovedColors (${color.hex}): ${error.message}`);
  }
  console.log(`  approved colors: ${APPROVED_COLOR_SEEDS.length} upserted`);
}

async function seedAssets(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const asset of ASSET_SEEDS) {
    const r2Key = `assets/${asset.slug}.svg`;
    const { data: existing, error: findError } = await db
      .from("assets")
      .select("id")
      .eq("r2_key", r2Key)
      .maybeSingle();
    if (findError) throw new Error(`seedAssets (find ${asset.slug}): ${findError.message}`);

    const row = {
      name_en: asset.nameEn,
      name_fr: asset.nameFr,
      status: asset.status ?? ("published" as const),
      category: asset.category,
      tags: asset.tags ?? [],
      r2_key: r2Key,
      mime_type: "image/svg+xml",
      width: asset.width,
      height: asset.height,
      focal_x: 0.5,
      focal_y: 0.5,
    };

    if (existing) {
      const { error } = await db.from("assets").update(row).eq("id", existing.id);
      if (error) throw new Error(`seedAssets (update ${asset.slug}): ${error.message}`);
      idBySlug.set(asset.slug, existing.id);
    } else {
      const { data, error } = await db.from("assets").insert(row).select("id").single();
      if (error || !data) throw new Error(`seedAssets (insert ${asset.slug}): ${error?.message}`);
      idBySlug.set(asset.slug, data.id);
    }
  }
  console.log(`  assets: ${ASSET_SEEDS.length} upserted`);
  return idBySlug;
}

async function seedTemplates(assetIdBySlug: Map<string, string>): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();

  for (const template of TEMPLATE_SEEDS) {
    const backgroundValue =
      template.backgroundType === "image"
        ? (assetIdBySlug.get(template.backgroundValue) ?? template.backgroundValue)
        : template.backgroundValue;

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
          background_type: template.backgroundType,
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
    if (error || !data) throw new Error(`seedTemplates (${template.slug}): ${error?.message}`);
    idBySlug.set(template.slug, data.id);

    const { error: deleteFieldsError } = await db.from("template_fields").delete().eq("template_id", data.id);
    if (deleteFieldsError) throw new Error(`seedTemplates fields delete (${template.slug}): ${deleteFieldsError.message}`);
    const { error: fieldsError } = await db.from("template_fields").insert(
      template.fields.map((f) => ({
        template_id: data.id,
        field_key: f.fieldKey,
        field_type: "text",
        label_en: f.labelEn,
        label_fr: f.labelFr,
        team_editable: f.teamEditable,
        required: f.required,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
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
      })),
    );
    if (fieldsError) throw new Error(`seedTemplates fields insert (${template.slug}): ${fieldsError.message}`);

    const { error: deleteAssetsError } = await db.from("template_assets").delete().eq("template_id", data.id);
    if (deleteAssetsError) throw new Error(`seedTemplates assets delete (${template.slug}): ${deleteAssetsError.message}`);
    if (template.allowedAssetSlugs.length > 0) {
      const { error: assetsError } = await db.from("template_assets").insert(
        template.allowedAssetSlugs.map((slug) => ({
          template_id: data.id,
          asset_id: assetIdBySlug.get(slug) ?? slug,
        })),
      );
      if (assetsError) throw new Error(`seedTemplates assets insert (${template.slug}): ${assetsError.message}`);
    }
  }
  console.log(`  templates: ${TEMPLATE_SEEDS.length} upserted (with fields + allowed assets)`);
  return idBySlug;
}

async function seedMappings(templateIdBySlug: Map<string, string>) {
  for (const mapping of MAPPING_SEEDS) {
    const templateId = templateIdBySlug.get(mapping.templateSlug);
    if (!templateId) throw new Error(`seedMappings: unknown template slug ${mapping.templateSlug}`);

    const { data, error } = await db
      .from("announcement_mappings")
      .upsert(
        { canonical_name: mapping.canonicalName, canonical_key: mapping.canonicalKey, template_id: templateId },
        { onConflict: "canonical_key" },
      )
      .select("id")
      .single();
    if (error || !data) throw new Error(`seedMappings (${mapping.canonicalKey}): ${error?.message}`);

    for (const alias of mapping.aliases) {
      const { error: aliasError } = await db
        .from("announcement_aliases")
        .upsert(
          {
            mapping_id: data.id,
            alias: alias.alias,
            alias_normalized: normalizeAlias(alias.alias),
            locale: alias.locale,
          },
          { onConflict: "mapping_id,alias_normalized" },
        );
      if (aliasError) throw new Error(`seedMappings alias (${mapping.canonicalKey} / ${alias.alias}): ${aliasError.message}`);
    }
  }
  console.log(`  mappings: ${MAPPING_SEEDS.length} upserted (with aliases)`);
}

async function seedStructuralDefaults(templateIdBySlug: Map<string, string>) {
  for (const def of STRUCTURAL_DEFAULT_SEEDS) {
    const templateId = templateIdBySlug.get(def.templateSlug);
    if (!templateId) throw new Error(`seedStructuralDefaults: unknown template slug ${def.templateSlug}`);

    const { data: existing, error: findError } = await db
      .from("default_structural_slides")
      .select("id")
      .eq("name_en", def.nameEn)
      .maybeSingle();
    if (findError) throw new Error(`seedStructuralDefaults (find ${def.nameEn}): ${findError.message}`);

    const row = {
      template_id: templateId,
      name_en: def.nameEn,
      name_fr: def.nameFr,
      insertion_rule: def.insertionRule,
      default_sort_zone: def.defaultSortZone,
      sort_order: def.sortOrder,
      enabled: true,
      removable_by_sunday_team: def.removableBySundayTeam,
      include_in_video_default: def.includeInVideoDefault,
      default_content: def.defaultContent,
    };
    const { error } = existing
      ? await db.from("default_structural_slides").update(row).eq("id", existing.id)
      : await db.from("default_structural_slides").insert(row);
    if (error) throw new Error(`seedStructuralDefaults (${def.nameEn}): ${error.message}`);
  }
  console.log(`  structural defaults: ${STRUCTURAL_DEFAULT_SEEDS.length} upserted`);
}

async function seedSettings() {
  const { error } = await db
    .from("app_settings")
    .update({
      church_name: CHURCH_NAME,
      timezone: SETTINGS_SEED.timezone,
      default_locale: SETTINGS_SEED.defaultLocale,
      default_slide_hold_seconds: SETTINGS_SEED.defaultSlideHoldSeconds,
      inbound_email: SETTINGS_SEED.inboundEmail,
      auto_process_inbound: SETTINGS_SEED.autoProcessInbound,
      pip_x: SETTINGS_SEED.safeZone.x,
      pip_y: SETTINGS_SEED.safeZone.y,
      pip_width: SETTINGS_SEED.safeZone.width,
      pip_height: SETTINGS_SEED.safeZone.height,
      temporary_retention_days: SETTINGS_SEED.temporaryRetentionDays,
    })
    .eq("singleton", true);
  if (error) throw new Error(`seedSettings: ${error.message}`);
  console.log(`  settings: church name set to "${CHURCH_NAME}"`);
}

async function seedSundayPin() {
  const pin = process.env.SEED_SUNDAY_PIN || SUNDAY_PIN;
  const { data: current, error: readError } = await db
    .from("app_settings")
    .select("sunday_pin_version")
    .eq("singleton", true)
    .single();
  if (readError) throw new Error(`seedSundayPin (read): ${readError.message}`);

  const hash = bcrypt.hashSync(pin, 10);
  const { error } = await db
    .from("app_settings")
    .update({
      sunday_pin_hash: hash,
      sunday_pin_length: pin.length,
      sunday_pin_version: (current?.sunday_pin_version ?? 0) + 1,
    })
    .eq("singleton", true);
  if (error) throw new Error(`seedSundayPin: ${error.message}`);
  console.log(`  sunday pin: set (${pin.length} digits)`);
}

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL || ADMIN_USER_SEED.email;
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(12).toString("base64url");

  let authUserId: string | null = null;
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    authUserId = created.user.id;
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log(`  admin user: created ${email} with a generated password: ${password}`);
      console.log("    (set SEED_ADMIN_PASSWORD next time to control it, or send a magic link instead)");
    } else {
      console.log(`  admin user: created ${email}`);
    }
  } else {
    // Already exists — look it up so we can still upsert the admin_users row.
    const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 200 });
    if (listError) throw new Error(`seedAdminUser (listUsers): ${listError.message}`);
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      throw new Error(`seedAdminUser: createUser failed (${createError?.message}) and no existing user found for ${email}`);
    }
    authUserId = existing.id;
    console.log(`  admin user: ${email} already exists`);
  }

  const { error: upsertError } = await db.from("admin_users").upsert(
    {
      auth_user_id: authUserId,
      email,
      display_name: ADMIN_USER_SEED.displayName,
      role: ADMIN_USER_SEED.role,
      locale: ADMIN_USER_SEED.locale,
    },
    { onConflict: "auth_user_id" },
  );
  if (upsertError) throw new Error(`seedAdminUser (admin_users upsert): ${upsertError.message}`);
  console.log(`  admin_users: ${email} set as ${ADMIN_USER_SEED.role}`);
}

/** Minimal .env loader so `pnpm seed` works locally without an extra dependency. Never overwrites an already-set var. */
function loadDotEnvIfPresent() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

main().catch((error) => {
  console.error("seed failed:", error);
  process.exit(1);
});
