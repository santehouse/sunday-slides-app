/**
 * Run-sheet intake: upload/email → extract → parse → preview → apply
 * (sections 15-19/38 of BUILD_HANDOFF.md). Manual upload and email intake
 * both go through `ingestRunSheet` — there is exactly one pipeline.
 *
 * Deliberately does NOT `import "server-only"` — this module is imported
 * directly by `tests/unit/sunday/*.test.ts` (Vitest, not a Next.js server
 * bundle). Every secret-touching call (object store, OpenAI) stays inside a
 * function body — nothing here reads env/config at module scope.
 */
import { randomUUID } from "node:crypto";
import { getDb, type Db, type MappingWithDetails, type TemplateWithFields, type CreateSlideInput } from "@/lib/data";
import { DEFAULT_TEMPLATE_SLUG } from "@/lib/data/mockSeed";
import { hasOpenAI, isMockMode } from "@/lib/env";
import { keys, getObjectStore } from "@/lib/r2/client";
import { extractText, MAX_RUN_SHEET_BYTES } from "@/lib/run-sheets/extract";
import { processRunSheet, type ProcessRunSheetContext } from "@/lib/run-sheets/pipeline";
import { parseRunSheetText } from "@/lib/openai/client";
import { heuristicParseRunSheetText } from "./heuristicParse";
import { planApply, READY_CONFIDENCE_THRESHOLD, type NewSlide, type PlanApplyResult, type PlanMode } from "@/lib/run-sheets/plan";
import { matchAnnouncement } from "@/lib/mappings/matcher";
import type {
  ParsedRunSheet,
  RunSheet,
  RunSheetParseStatus,
  RunSheetSourceType,
  SlideBackgroundMode,
} from "@/lib/domain/types";

export interface IngestInput {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  sourceType: "email" | "manual";
  /** Explicit target Sunday (YYYY-MM-DD); defaults to the next Sunday (settings timezone) when omitted. */
  sundayDate?: string;
  /** Resend inbound `email_id` — dedupes so a webhook retry never creates a second run sheet. */
  inboundEventId?: string;
  /**
   * Whether to run extraction/parsing right away. Defaults to `true` (manual upload in the
   * Import modal parses immediately so "Received files" can show ready/needs-review state).
   * Inbound email intake passes `false` — the file is only stored and queued; parsing happens
   * on demand when a Sunday Team member picks "Use this file" (see `reprocessRunSheet`).
   */
  parse?: boolean;
}

export interface RunSheetPreviewItem {
  headline: string;
  templateName: string | null;
  status: "ready" | "needs_review";
}

export interface RunSheetPreview {
  runSheet: RunSheet;
  summary: { found: number; mapped: number; needsReview: number };
  items: RunSheetPreviewItem[];
}

export interface ApplyRunSheetResult {
  sundayId: string;
  serviceDate: string;
  summary: { found: number; mapped: number; needsReview: number };
}

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

type RunSheetExt = "docx" | "pdf";

function detectRunSheetExt(mimeType: string, filename: string): RunSheetExt | null {
  const lowerMime = mimeType.toLowerCase();
  const extension = filename.toLowerCase().split(".").pop();
  if (lowerMime === DOCX_MIME || extension === "docx") return "docx";
  if (lowerMime === PDF_MIME || extension === "pdf") return "pdf";
  return null;
}

type FileValidation =
  | { ok: true; ext: RunSheetExt }
  | { ok: false; ext: RunSheetExt | null; error: string };

function validateRunSheetFile(mimeType: string, filename: string, size: number): FileValidation {
  const ext = detectRunSheetExt(mimeType, filename);
  if (!ext) {
    return { ok: false, ext: null, error: `Unsupported run sheet file type: ${mimeType || "unknown"} (${filename})` };
  }
  if (size > MAX_RUN_SHEET_BYTES) {
    return { ok: false, ext, error: `File is ${size} bytes, which exceeds the ${MAX_RUN_SHEET_BYTES}-byte limit` };
  }
  return { ok: true, ext };
}

// ---------------------------------------------------------------------------
// Date helpers — "next Sunday from now", in the church's own timezone.
// ---------------------------------------------------------------------------

function zonedDateOnly(date: Date, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function nextSundayOnOrAfter(date: Date): Date {
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday
  const daysToAdd = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return new Date(date.getTime() + daysToAdd * MS_PER_DAY);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function computeNextSundayDate(db: Db): Promise<string> {
  const settings = await db.getSettings();
  const today = zonedDateOnly(new Date(), settings.timezone);
  return toIsoDate(nextSundayOnOrAfter(today));
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildProcessContext(
  mappings: MappingWithDetails[],
  templates: TemplateWithFields[],
  serviceDateHint: string | null,
): ProcessRunSheetContext {
  return {
    mappings: mappings
      .filter((m) => m.active)
      .map((m) => ({ canonicalKey: m.canonicalKey, canonicalName: m.canonicalName, aliases: m.aliases.map((a) => a.alias) })),
    templates: templates.map((t) => ({ id: t.id, slug: t.slug, nameEn: t.nameEn, category: t.category })),
    serviceDateHint,
  };
}

/** Real OpenAI when configured; the deterministic offline fallback otherwise (mock mode, missing key, tests). */
function selectParser(): typeof parseRunSheetText {
  // Mock mode is the offline demo/QA mode (docs/INTAKE.md: the heuristic parser exists so
  // the product works with zero external dependencies when "no OpenAI key configured,
  // CP_MOCK_DATA=1, or every unit test"). Without this guard a stray OPENAI_API_KEY in
  // .env.local made every mock-mode run-sheet upload fail on an unreachable API call.
  return hasOpenAI() && !isMockMode() ? parseRunSheetText : heuristicParseRunSheetText;
}

async function resolveDefaultTemplate(db: Db, templatesHint?: TemplateWithFields[]): Promise<TemplateWithFields> {
  const bySlug = await db.getTemplateBySlug(DEFAULT_TEMPLATE_SLUG);
  if (bySlug) return bySlug;
  const list = templatesHint ?? (await db.listTemplates());
  const fallback = list.find((t) => t.status === "published") ?? list[0];
  if (!fallback) throw new Error("resolveDefaultTemplate: no templates are configured");
  return fallback;
}

/** Whether at least one announcement is both flagged for review AND unmatched by any active mapping. */
async function determineParseStatus(db: Db, parsed: ParsedRunSheet): Promise<"ready_to_apply" | "needs_review"> {
  const activeMappings = (await db.listMappings()).filter((m) => m.active);
  const flattened = parsed.sections.flatMap((s) => s.announcements);
  const hasUnresolvedReview = flattened.some((a) => {
    if (a.reviewReasons.length === 0) return false;
    const match = matchAnnouncement({ headline: a.headline, sourceText: a.sourceText, canonicalKey: a.canonicalKey }, activeMappings);
    return match === null;
  });
  return hasUnresolvedReview ? "needs_review" : "ready_to_apply";
}

// ---------------------------------------------------------------------------
// ingestRunSheet
// ---------------------------------------------------------------------------

/**
 * Stores, extracts, and parses a run sheet — the one pipeline manual upload
 * and Resend inbound email both call. Never throws for an expected failure
 * (bad file type, oversized file, extraction/parse error): always returns
 * the (possibly `failed`) run sheet record instead.
 */
export async function ingestRunSheet(input: IngestInput): Promise<RunSheet> {
  const db = getDb();

  const validation = validateRunSheetFile(input.mimeType, input.filename, input.bytes.byteLength);
  const serviceDate = input.sundayDate ?? (await computeNextSundayDate(db));
  const sunday = await db.getOrCreateSundayByDate(serviceDate);

  if (input.inboundEventId) {
    const existing = await db.findRunSheetByInboundEventId(input.inboundEventId);
    if (existing) return existing;
  }

  const fileId = randomUUID();
  const ext = validation.ok ? validation.ext : (validation.ext ?? "bin");
  const r2Key = keys.runSheets(sunday.serviceDate, fileId, ext);

  let runSheet = await db.createRunSheet({
    sundayId: sunday.id,
    sourceType: input.sourceType as RunSheetSourceType,
    originalFilename: input.filename,
    mimeType: input.mimeType,
    r2Key,
    parseStatus: "queued",
    inboundEventId: input.inboundEventId ?? null,
  });

  if (!validation.ok) {
    return db.updateRunSheet(runSheet.id, { parseStatus: "failed", parseError: validation.error });
  }

  try {
    await getObjectStore().putObject(r2Key, input.bytes, input.mimeType);
  } catch (err) {
    return db.updateRunSheet(runSheet.id, { parseStatus: "failed", parseError: describeError(err) });
  }

  if (input.parse === false) {
    // Stored and queued only — a human picks "Use this file" later, which parses on demand
    // via `reprocessRunSheet` (Import modal, simplified Sunday IA).
    return runSheet;
  }

  runSheet = await db.updateRunSheet(runSheet.id, { parseStatus: "processing" });

  const [mappings, templates] = await Promise.all([db.listMappings(), db.listTemplates({ status: "published" })]);
  const context = buildProcessContext(mappings, templates, sunday.serviceDate);

  const result = await processRunSheet({
    buffer: input.bytes,
    mimeType: input.mimeType,
    filename: input.filename,
    context,
    parse: selectParser(),
  });

  if (!result.ok) {
    // Extraction already succeeded once inside processRunSheet — re-run just that (cheap,
    // deterministic) step so a parse-only failure still retains the source text.
    let extractedText: string | null = null;
    if (result.stage === "parse") {
      try {
        extractedText = (await extractText(input.bytes, input.mimeType, input.filename)).text;
      } catch {
        extractedText = null;
      }
    }
    return db.updateRunSheet(runSheet.id, { parseStatus: "failed", parseError: result.error, extractedText });
  }

  const status = await determineParseStatus(db, result.parsed);

  return db.updateRunSheet(runSheet.id, {
    extractedText: result.extractedText,
    parsedJson: result.parsed,
    modelOutput: result.raw,
    processedAt: new Date().toISOString(),
    parseStatus: status,
    parseError: null,
  });
}

// ---------------------------------------------------------------------------
// previewRunSheet
// ---------------------------------------------------------------------------

function buildPreviewItems(
  parsed: ParsedRunSheet,
  mappings: MappingWithDetails[],
  templates: TemplateWithFields[],
  defaultTemplateId: string,
): RunSheetPreviewItem[] {
  const templateNameById = new Map(templates.map((t) => [t.id, t.nameEn]));
  const activeMappings = mappings.filter((m) => m.active);

  const items: RunSheetPreviewItem[] = [];
  for (const section of parsed.sections) {
    for (const announcement of section.announcements) {
      const match = matchAnnouncement(
        { headline: announcement.headline, sourceText: announcement.sourceText, canonicalKey: announcement.canonicalKey },
        activeMappings,
      );
      const templateId = match?.mapping.templateId ?? defaultTemplateId;
      const confidence = match ? Math.min(announcement.confidence, match.confidence) : announcement.confidence;
      const status: RunSheetPreviewItem["status"] =
        match && confidence >= READY_CONFIDENCE_THRESHOLD && announcement.reviewReasons.length === 0
          ? "ready"
          : "needs_review";
      items.push({ headline: announcement.headline, templateName: templateNameById.get(templateId) ?? null, status });
    }
  }
  return items;
}

/** Dry-run preview of applying `runSheetId` (always "merge" semantics) — no writes. */
export async function previewRunSheet(runSheetId: string): Promise<RunSheetPreview> {
  const db = getDb();
  const runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet) throw new Error(`previewRunSheet: run sheet ${runSheetId} not found`);

  if (!runSheet.parsedJson) {
    return { runSheet, summary: { found: 0, mapped: 0, needsReview: 0 }, items: [] };
  }

  const [mappings, templates, structuralDefaults, existingSlides] = await Promise.all([
    db.listMappings(),
    db.listTemplates(),
    db.listStructuralDefaults(),
    db.listSlidesForSunday(runSheet.sundayId),
  ]);

  const defaultTemplate = await resolveDefaultTemplate(db, templates);

  const plan = planApply({
    parsed: runSheet.parsedJson,
    mappings,
    templates,
    structuralDefaults,
    existingSlides,
    mode: "merge",
    defaultTemplateId: defaultTemplate.id,
  });

  const items = buildPreviewItems(runSheet.parsedJson, mappings, templates, defaultTemplate.id);

  return { runSheet, summary: plan.summary, items };
}

// ---------------------------------------------------------------------------
// applyRunSheet
// ---------------------------------------------------------------------------

async function firstEnabledColorId(db: Db): Promise<string | null> {
  const colors = await db.listApprovedColors({ enabledOnly: true });
  return colors[0]?.id ?? null;
}

/** A planned insert carries no background info (see `plan.ts`'s `NewSlide`) — derive it from its resolved template. */
async function toCreateSlideInput(
  db: Db,
  sundayId: string,
  insert: NewSlide,
  firstColorId: string | null,
): Promise<CreateSlideInput> {
  const template = await db.getTemplate(insert.templateId);
  const backgroundMode: SlideBackgroundMode = template?.backgroundType === "image" ? "image" : "color";

  return {
    sundayId,
    templateId: insert.templateId,
    headline: insert.headline,
    content: insert.content,
    assetId: backgroundMode === "image" ? (template?.backgroundValue ?? null) : null,
    backgroundMode,
    approvedColorId: backgroundMode === "color" ? firstColorId : null,
    sortOrder: insert.sortOrder,
    includeInVideo: insert.includeInVideo,
    status: insert.status,
    isStructural: insert.isStructural,
    structuralDefaultId: insert.structuralDefaultId,
    parserConfidence: insert.parserConfidence,
    mappingId: insert.mappingId,
    sourceAnnouncement: insert.sourceAnnouncement,
    manuallyEdited: false,
  };
}

async function applyPlanForSlides(db: Db, sundayId: string, plan: PlanApplyResult, mode: PlanMode): Promise<void> {
  const firstColorId = await firstEnabledColorId(db);

  if (mode === "replace") {
    const inputs = await Promise.all(plan.inserts.map((insert) => toCreateSlideInput(db, sundayId, insert, firstColorId)));
    await db.replaceSlidesForSunday(sundayId, inputs);
    return;
  }

  for (const id of plan.deletes) {
    await db.deleteSlide(id);
  }
  for (const update of plan.updates) {
    await db.updateSlide(update.id, update.patch);
  }
  if (plan.inserts.length > 0) {
    const inputs = await Promise.all(plan.inserts.map((insert) => toCreateSlideInput(db, sundayId, insert, firstColorId)));
    await db.createSlides(inputs);
  }

  // `plan.ts` already assigns the correct final `sortOrder` to every kept/updated/inserted
  // slide — this just re-derives the id order from it and asks the Db to make it official
  // (contiguous, `updatedAt`-bumped) rather than trusting per-row writes alone.
  const remaining = await db.listSlidesForSunday(sundayId);
  const orderedIds = [...remaining].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id);
  await db.reorderSlides(sundayId, orderedIds);
}

/**
 * Applies a processed run sheet to its Sunday: `replace` regenerates the whole deck,
 * `merge` preserves manual edits (section 15/18). Unmatched announcement headlines
 * become mapping suggestions; the Sunday's status reflects whether anything still needs
 * review.
 */
export async function applyRunSheet(runSheetId: string, mode: "merge" | "replace"): Promise<ApplyRunSheetResult> {
  const db = getDb();
  const runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet) throw new Error(`applyRunSheet: run sheet ${runSheetId} not found`);
  if (!runSheet.parsedJson) throw new Error(`applyRunSheet: run sheet ${runSheetId} has no parsed content to apply`);

  const sunday = await db.getSundayById(runSheet.sundayId);
  if (!sunday) throw new Error(`applyRunSheet: Sunday ${runSheet.sundayId} not found`);

  const [mappings, templates, structuralDefaults, existingSlides] = await Promise.all([
    db.listMappings(),
    db.listTemplates(),
    db.listStructuralDefaults(),
    db.listSlidesForSunday(sunday.id),
  ]);

  const defaultTemplate = await resolveDefaultTemplate(db, templates);

  const plan = planApply({
    parsed: runSheet.parsedJson,
    mappings,
    templates,
    structuralDefaults,
    existingSlides,
    mode,
    defaultTemplateId: defaultTemplate.id,
  });

  await applyPlanForSlides(db, sunday.id, plan, mode);

  for (const headline of plan.suggestions) {
    await db.upsertMappingSuggestion(headline);
  }

  const finalSlides = await db.listSlidesForSunday(sunday.id);
  const sundayStatus = finalSlides.some((s) => s.status === "needs_review") ? "needs_review" : "ready";

  // Previous "added_to_flow" run sheets for this Sunday are left exactly as they are —
  // they're history, not superseded records.
  await db.updateSunday(sunday.id, { sourceRunSheetId: runSheet.id, status: sundayStatus });
  await db.updateRunSheet(runSheet.id, { parseStatus: "added_to_flow" });

  return { sundayId: sunday.id, serviceDate: sunday.serviceDate, summary: plan.summary };
}

// ---------------------------------------------------------------------------
// reprocessRunSheet
// ---------------------------------------------------------------------------

/** Re-reads the stored file and re-runs extraction + parsing in place (status → `processing` → result). */
export async function reprocessRunSheet(runSheetId: string): Promise<RunSheet> {
  const db = getDb();
  const runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet) throw new Error(`reprocessRunSheet: run sheet ${runSheetId} not found`);

  await db.updateRunSheet(runSheet.id, { parseStatus: "processing" });

  let bytes: Uint8Array;
  try {
    bytes = await getObjectStore().getObject(runSheet.r2Key);
  } catch (err) {
    return db.updateRunSheet(runSheet.id, { parseStatus: "failed", parseError: describeError(err) });
  }

  const sunday = await db.getSundayById(runSheet.sundayId);
  const [mappings, templates] = await Promise.all([db.listMappings(), db.listTemplates({ status: "published" })]);
  const context = buildProcessContext(mappings, templates, sunday?.serviceDate ?? null);

  const result = await processRunSheet({
    buffer: bytes,
    mimeType: runSheet.mimeType,
    filename: runSheet.originalFilename,
    context,
    parse: selectParser(),
  });

  if (!result.ok) {
    let extractedText: string | null = null;
    if (result.stage === "parse") {
      try {
        extractedText = (await extractText(bytes, runSheet.mimeType, runSheet.originalFilename)).text;
      } catch {
        extractedText = null;
      }
    }
    return db.updateRunSheet(runSheet.id, { parseStatus: "failed", parseError: result.error, extractedText });
  }

  const status = await determineParseStatus(db, result.parsed);

  return db.updateRunSheet(runSheet.id, {
    extractedText: result.extractedText,
    parsedJson: result.parsed,
    modelOutput: result.raw,
    processedAt: new Date().toISOString(),
    parseStatus: status,
    parseError: null,
  });
}

export type { RunSheetParseStatus };
