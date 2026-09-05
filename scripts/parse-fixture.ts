/**
 * Manual verification script (NOT part of `pnpm test`): runs the run-sheet parsing
 * pipeline against the real fixture DOCX (`tests/fixtures/run-sheets/260906.docx`) with
 * both the real OpenAI parser (when `OPENAI_API_KEY` is configured — loaded from
 * `.env.local` if present) and the offline heuristic fallback, printing the parsed JSON
 * and the resulting Sunday Flow plan summary for each so a human can eyeball real-world
 * parser quality side by side.
 *
 *   pnpm tsx scripts/parse-fixture.ts
 *
 * Builds its own self-contained mappings/templates/structural-defaults from
 * `src/lib/data/mockSeed.ts`'s natural-key seed data — no database or R2 needed.
 *
 * In a sandboxed dev environment that routes outbound HTTPS through an env-configured
 * proxy (HTTPS_PROXY), Node's own built-in fetch (>= Node 22.21) does NOT read it unless
 * `NODE_USE_ENV_PROXY=1` is set in the process environment BEFORE Node starts — this
 * flag is read at startup, so setting `process.env.NODE_USE_ENV_PROXY` from inside the
 * script itself is too late. curl (and other tools that read HTTPS_PROXY directly) work
 * regardless, which is why only the OpenAI call (routed through `fetch`) is affected:
 *
 *   NODE_USE_ENV_PROXY=1 pnpm tsx --tsconfig scripts/tsconfig.json scripts/parse-fixture.ts
 */
import fs from "node:fs";
import path from "node:path";
import { processRunSheet, type ProcessRunSheetContext } from "@/lib/run-sheets/pipeline";
import { parseRunSheetText } from "@/lib/openai/client";
import { planApply } from "@/lib/run-sheets/plan";
import { heuristicParseRunSheetText } from "@/lib/sunday/heuristicParse";
import { DEFAULT_TEMPLATE_SLUG, MAPPING_SEEDS, STRUCTURAL_DEFAULT_SEEDS, TEMPLATE_SEEDS } from "@/lib/data/mockSeed";
import type { AnnouncementMapping, DefaultStructuralSlide, Template } from "@/lib/domain/types";

loadDotEnvLocalIfPresent();

const FIXTURE_PATH = path.resolve(__dirname, "..", "tests/fixtures/run-sheets/260906.docx");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface Fixtures {
  mappings: AnnouncementMapping[];
  templates: Template[];
  structuralDefaults: DefaultStructuralSlide[];
  defaultTemplateId: string;
}

function buildFixtures(): Fixtures {
  const now = new Date().toISOString();

  const templates: Template[] = TEMPLATE_SEEDS.map((t) => ({
    id: `template-${t.slug}`,
    slug: t.slug,
    nameEn: t.nameEn,
    nameFr: t.nameFr,
    category: t.category,
    status: t.status,
    rendererKey: t.rendererKey ?? "generic-v1",
    backgroundType: t.backgroundType,
    backgroundValue: t.backgroundValue,
    overlayColor: t.overlayColor,
    overlayOpacity: t.overlayOpacity,
    includeInVideoDefault: t.includeInVideoDefault,
    allowTeamBackgroundChoice: t.allowTeamBackgroundChoice,
    fields: [],
    allowedAssetIds: [],
    createdAt: now,
    updatedAt: now,
  }));
  const templateIdBySlug = new Map(templates.map((t) => [t.slug, t.id]));

  const mappings: AnnouncementMapping[] = MAPPING_SEEDS.map((m) => {
    const mappingId = `mapping-${m.canonicalKey}`;
    return {
      id: mappingId,
      canonicalName: m.canonicalName,
      canonicalKey: m.canonicalKey,
      templateId: templateIdBySlug.get(m.templateSlug) ?? "",
      active: true,
      aliases: m.aliases.map((a, i) => ({
        id: `alias-${m.canonicalKey}-${i}`,
        mappingId,
        alias: a.alias,
        locale: a.locale ?? null,
      })),
      createdAt: now,
      updatedAt: now,
    };
  });

  const structuralDefaults: DefaultStructuralSlide[] = STRUCTURAL_DEFAULT_SEEDS.map((s, i) => ({
    id: `structural-${i}`,
    templateId: templateIdBySlug.get(s.templateSlug) ?? "",
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

  const defaultTemplateId = templateIdBySlug.get(DEFAULT_TEMPLATE_SLUG) ?? templates[0]?.id ?? "";

  return { mappings, templates, structuralDefaults, defaultTemplateId };
}

async function run(label: string, parse: typeof parseRunSheetText): Promise<void> {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);

  const buffer = new Uint8Array(fs.readFileSync(FIXTURE_PATH));
  const { mappings, templates, structuralDefaults, defaultTemplateId } = buildFixtures();

  const context: ProcessRunSheetContext = {
    mappings: mappings.map((m) => ({ canonicalKey: m.canonicalKey, canonicalName: m.canonicalName, aliases: m.aliases.map((a) => a.alias) })),
    templates: templates.map((t) => ({ id: t.id, slug: t.slug, nameEn: t.nameEn, category: t.category })),
    serviceDateHint: "2026-09-06",
  };

  const result = await processRunSheet({ buffer, mimeType: DOCX_MIME, filename: "260906.docx", context, parse });

  if (!result.ok) {
    console.error(`[${label}] FAILED at stage "${result.stage}": ${result.error}`);
    return;
  }

  const totalAnnouncements = result.parsed.sections.reduce((n, s) => n + s.announcements.length, 0);
  console.log(`[${label}] parsed ${totalAnnouncements} announcement(s) across ${result.parsed.sections.length} section(s).`);
  console.log(JSON.stringify(result.parsed, null, 2));

  const plan = planApply({
    parsed: result.parsed,
    mappings,
    templates,
    structuralDefaults,
    existingSlides: [],
    mode: "replace",
    defaultTemplateId,
  });

  console.log(`\n[${label}] plan summary:`, plan.summary);
  console.log(`[${label}] headlines → resolved templates:`);
  for (const insert of plan.inserts.filter((i) => !i.isStructural)) {
    const template = templates.find((t) => t.id === insert.templateId);
    console.log(
      `  - "${insert.headline}" -> ${template?.nameEn ?? insert.templateId} ` +
        `(status: ${insert.status}, confidence: ${insert.parserConfidence?.toFixed(2) ?? "n/a"})`,
    );
  }
  if (plan.suggestions.length > 0) {
    console.log(`[${label}] unmatched (would become mapping suggestions):`, plan.suggestions);
  }
}

async function main(): Promise<void> {
  await run("Heuristic fallback parser (offline, no OpenAI)", heuristicParseRunSheetText);

  if (process.env.OPENAI_API_KEY) {
    await run(`Real OpenAI parser (model: ${process.env.OPENAI_MODEL ?? "gpt-4.1"})`, parseRunSheetText);
  } else {
    console.log("\nOPENAI_API_KEY not set (checked .env.local and the environment) — skipping the real OpenAI parser run.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("parse-fixture failed:", err);
    process.exit(1);
  });

/** Minimal .env.local loader — no dotenv dependency. Never overwrites an already-set var. */
function loadDotEnvLocalIfPresent(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
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
