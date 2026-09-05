import "server-only";
import { isMockMode } from "@/lib/env";
import { createMockDb } from "./mockDb";
import { createSupabaseDb } from "./supabaseDb";
import type { Db } from "./types";

export type { Db } from "./types";
export {
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
  type MappingSuggestion,
  type MappingWithDetails,
  type SlideCounts,
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
export { normalizeAlias } from "./normalize";

let cached: Db | null = null;
let cachedWasMock: boolean | null = null;

/**
 * Returns the Supabase-backed repository, or the in-memory mock when
 * `isMockMode()` is true (CP_MOCK_DATA=1, or Supabase env vars are missing).
 * This is the ONLY way Sunday-team and Admin server code should touch data.
 *
 * Both implementations are cheap to construct (no I/O happens until a method
 * is actually called), so we just pick fresh each time the mode flips —
 * which only matters in tests that toggle CP_MOCK_DATA.
 */
export function getDb(): Db {
  const mock = isMockMode();
  if (cached && cachedWasMock === mock) return cached;
  cached = mock ? createMockDb() : createSupabaseDb();
  cachedWasMock = mock;
  return cached;
}
