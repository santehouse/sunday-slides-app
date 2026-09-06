/**
 * Pure helpers for the "Check slides" checklist (Simplified Sunday IA, Step 2). No
 * `server-only` here — this file is imported by the client checklist component as well
 * as (indirectly, via the same slide/template shapes) anything else that wants a plain-
 * language reason for why a slide needs attention.
 */
import type { Slide, Template, TemplateField } from "@/lib/domain/types";

export type CheckReason = "review" | "missing" | "tooLong";

export interface CheckItem {
  slideId: string;
  index: number;
  headline: string;
  reason: CheckReason;
}

/**
 * `status === "invalid"` covers both "a required field is empty" and "the text doesn't
 * fit" — the Slide record itself doesn't distinguish them, so this infers it from the
 * template's required fields (missing wins when both would apply).
 */
export function inferCheckReason(slide: Pick<Slide, "status" | "content" | "headline">, template: Pick<Template, "fields"> | undefined): CheckReason {
  if (slide.status === "needs_review") return "review";
  const requiredFields: TemplateField[] = template?.fields.filter((f) => f.required) ?? [];
  const missing = requiredFields.some((field) => {
    const value = field.fieldKey === "headline" ? slide.headline : (slide.content[field.fieldKey] ?? "");
    return value.trim() === "";
  });
  return missing ? "missing" : "tooLong";
}

/** Every slide the Sunday team should look at, in Sunday Flow order, with a plain-language reason. */
export function buildCheckItems(slides: Slide[], templatesById: Record<string, Template>): CheckItem[] {
  return slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.status === "needs_review" || slide.status === "invalid")
    .map(({ slide, index }) => ({
      slideId: slide.id,
      index,
      headline: slide.headline || "",
      reason: inferCheckReason(slide, templatesById[slide.templateId]),
    }));
}
