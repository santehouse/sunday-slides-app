"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { normalizeAlias } from "@/lib/data";
import type { MappingWithDetails } from "@/lib/data";

export type SaveMappingInput = {
  id?: string;
  canonicalName: string;
  templateId: string;
  active: boolean;
  /** Existing mappings: only NEW lines (not already an alias) are added — the repository layer has no alias-removal method. */
  aliasLines: string[];
};

export type SaveMappingResult = { ok: true; mapping: MappingWithDetails } | { ok: false; error: string };

export async function saveMappingAction(input: SaveMappingInput): Promise<SaveMappingResult> {
  const db = getDb();
  const canonicalName = input.canonicalName.trim();
  if (!canonicalName || !input.templateId) {
    return { ok: false, error: "invalid" };
  }
  const aliasLines = input.aliasLines.map((line) => line.trim()).filter(Boolean);

  try {
    let mapping: MappingWithDetails;
    if (input.id) {
      mapping = await db.updateMapping(input.id, {
        canonicalName,
        templateId: input.templateId,
        active: input.active,
      });
      const existing = new Set(mapping.aliases.map((a) => normalizeAlias(a.alias)));
      for (const alias of aliasLines) {
        if (!existing.has(normalizeAlias(alias))) {
          await db.addAlias(mapping.id, alias);
          existing.add(normalizeAlias(alias));
        }
      }
      mapping = (await db.getMapping(mapping.id)) ?? mapping;
    } else {
      mapping = await db.createMapping({
        canonicalName,
        templateId: input.templateId,
        aliases: aliasLines.map((alias) => ({ alias })),
      });
    }

    revalidatePath("/admin/mappings");
    return { ok: true, mapping };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function deleteMappingAction(id: string): Promise<{ ok: boolean }> {
  const db = getDb();
  await db.deleteMapping(id);
  revalidatePath("/admin/mappings");
  return { ok: true };
}

export async function dismissSuggestionAction(id: string): Promise<{ ok: boolean }> {
  const db = getDb();
  await db.dismissMappingSuggestion(id);
  revalidatePath("/admin/mappings");
  return { ok: true };
}
