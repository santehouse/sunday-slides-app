import { describe, expect, it, vi } from "vitest";
import { ParseValidationError, parseRunSheetText, type CallModel } from "@/lib/openai/client";
import type { ParsedRunSheet } from "@/lib/domain/types";

const validParsed: ParsedRunSheet = {
  serviceDate: "2026-09-06",
  documentLanguage: "fr",
  sections: [
    {
      title: "Rendez-vous de la semaine",
      announcements: [
        {
          sourceOrder: 0,
          sourceText: "Étude biblique\nMercredi 19h00 à 20h00",
          canonicalKey: "bible-study",
          category: "general",
          headline: "ÉTUDE BIBLIQUE",
          line1: "Mercredi",
          line2: "19h00 à 20h00",
          suggestedMappingId: null,
          suggestedTemplateId: null,
          confidence: 0.98,
          reviewReasons: [],
        },
      ],
    },
  ],
};

const baseInput = {
  text: "Étude biblique\nMercredi 19h00 à 20h00",
  mappings: [{ canonicalKey: "bible-study", canonicalName: "Étude biblique", aliases: ["Bible Study"] }],
  templates: [{ id: "tmpl-1", slug: "bible-study", nameEn: "Bible Study", category: "general" as const }],
  serviceDateHint: "2026-09-06",
};

describe("parseRunSheetText", () => {
  it("assembles a prompt containing the text, mappings, and templates", async () => {
    const callModel: CallModel = vi.fn(async () => ({
      outputText: JSON.stringify(validParsed),
      raw: { id: "resp_1" },
    }));

    await parseRunSheetText(baseInput, { callModel });

    expect(callModel).toHaveBeenCalledTimes(1);
    const call = (callModel as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.userPrompt).toContain("Étude biblique");
    expect(call.userPrompt).toContain("bible-study");
    expect(call.userPrompt).toContain("Bible Study");
    expect(call.userPrompt).toContain("tmpl-1");
    expect(call.userPrompt).toContain("2026-09-06");
    expect(call.systemPrompt).toContain("Never rewrite, paraphrase, correct spelling, or translate");
    expect(call.schemaName).toBe("parsed_run_sheet");
    expect(call.jsonSchema).toHaveProperty("properties");
    expect(call.model).toBe(process.env.OPENAI_MODEL ?? "gpt-4.1");
  });

  it("returns the validated parsed result, raw payload, and model on success", async () => {
    const callModel: CallModel = vi.fn(async () => ({
      outputText: JSON.stringify(validParsed),
      raw: { id: "resp_1" },
    }));

    const result = await parseRunSheetText(baseInput, { callModel });
    expect(result.parsed).toEqual(validParsed);
    expect(result.raw).toEqual({ id: "resp_1" });
    expect(result.model).toBe(process.env.OPENAI_MODEL ?? "gpt-4.1");
  });

  it("retries once with a repair prompt when the first response fails schema validation", async () => {
    const calls: string[] = [];
    const callModel: CallModel = vi.fn(async ({ userPrompt }) => {
      calls.push(userPrompt);
      if (calls.length === 1) {
        return { outputText: JSON.stringify({ not: "valid" }), raw: { id: "resp_bad" } };
      }
      return { outputText: JSON.stringify(validParsed), raw: { id: "resp_good" } };
    });

    const result = await parseRunSheetText(baseInput, { callModel });

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(calls[1]).toContain("failed schema validation");
    expect(calls[1]).toContain(calls[0]);
    expect(result.parsed).toEqual(validParsed);
    expect(result.raw).toEqual({ id: "resp_good" });
  });

  it("retries once on malformed JSON, then succeeds", async () => {
    let attempt = 0;
    const callModel: CallModel = vi.fn(async () => {
      attempt++;
      if (attempt === 1) {
        return { outputText: "not json at all {{{", raw: {} };
      }
      return { outputText: JSON.stringify(validParsed), raw: {} };
    });

    const result = await parseRunSheetText(baseInput, { callModel });
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(result.parsed).toEqual(validParsed);
  });

  it("throws ParseValidationError carrying the raw output when both attempts fail", async () => {
    const callModel: CallModel = vi.fn(async () => ({
      outputText: JSON.stringify({ garbage: true }),
      raw: { id: "resp_final" },
    }));

    await expect(parseRunSheetText(baseInput, { callModel })).rejects.toBeInstanceOf(ParseValidationError);
    expect(callModel).toHaveBeenCalledTimes(2);

    try {
      await parseRunSheetText(baseInput, { callModel });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ParseValidationError);
      expect((error as InstanceType<typeof ParseValidationError>).raw).toEqual({ id: "resp_final" });
    }
  });

  it("handles empty mappings/templates lists without crashing the prompt builder", async () => {
    const callModel: CallModel = vi.fn(async () => ({ outputText: JSON.stringify(validParsed), raw: {} }));
    await parseRunSheetText({ ...baseInput, mappings: [], templates: [] }, { callModel });
    const call = (callModel as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.userPrompt).toContain("no known recurring-announcement mappings");
    expect(call.userPrompt).toContain("no templates are configured yet");
  });
});
