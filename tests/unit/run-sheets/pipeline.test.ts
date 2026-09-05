import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processRunSheet } from "@/lib/run-sheets/pipeline";
import type { ParseRunSheetResult } from "@/lib/openai/client";
import type { ParsedRunSheet } from "@/lib/domain/types";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const stubParsed: ParsedRunSheet = {
  serviceDate: "2026-09-06",
  documentLanguage: "fr",
  sections: [],
};

function fakeParse(result: ParseRunSheetResult) {
  return async () => result;
}

describe("processRunSheet", () => {
  it("composes extract → parse and returns the combined success result", async () => {
    const filePath = resolve(__dirname, "../../fixtures/run-sheets/260906.docx");
    const buffer = new Uint8Array(readFileSync(filePath));

    const result = await processRunSheet({
      buffer,
      mimeType: DOCX_MIME,
      filename: "260906.docx",
      context: { mappings: [], templates: [], serviceDateHint: "2026-09-06" },
      parse: fakeParse({ parsed: stubParsed, raw: { id: "resp_1" }, model: "gpt-4.1" }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extractedText).toContain("ÉTUDE BIBLIQUE");
      expect(result.parsed).toEqual(stubParsed);
      expect(result.raw).toEqual({ id: "resp_1" });
      expect(result.warnings).toEqual([]);
    }
  });

  it("passes the extracted text through to the injected parse function", async () => {
    const filePath = resolve(__dirname, "../../fixtures/run-sheets/260906.docx");
    const buffer = new Uint8Array(readFileSync(filePath));

    let receivedText = "";
    const result = await processRunSheet({
      buffer,
      mimeType: DOCX_MIME,
      filename: "260906.docx",
      context: { mappings: [], templates: [] },
      parse: async (input) => {
        receivedText = input.text;
        return { parsed: stubParsed, raw: {}, model: "gpt-4.1" };
      },
    });

    expect(result.ok).toBe(true);
    expect(receivedText).toContain("DIMANCHE 06-09-2026");
  });

  it("returns a typed failure at the extract stage for an unsupported file, without calling parse", async () => {
    let parseCalled = false;
    const result = await processRunSheet({
      buffer: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      filename: "photo.png",
      context: { mappings: [], templates: [] },
      parse: async () => {
        parseCalled = true;
        return { parsed: stubParsed, raw: {}, model: "gpt-4.1" };
      },
    });

    expect(result).toEqual({ ok: false, stage: "extract", error: expect.stringContaining("Unsupported") });
    expect(parseCalled).toBe(false);
  });

  it("returns a typed failure at the parse stage when the injected parser throws", async () => {
    const filePath = resolve(__dirname, "../../fixtures/run-sheets/260906.docx");
    const buffer = new Uint8Array(readFileSync(filePath));

    const result = await processRunSheet({
      buffer,
      mimeType: DOCX_MIME,
      filename: "260906.docx",
      context: { mappings: [], templates: [] },
      parse: async () => {
        throw new Error("OpenAI structured output failed schema validation after one repair attempt: boom");
      },
    });

    expect(result).toEqual({ ok: false, stage: "parse", error: expect.stringContaining("boom") });
  });

  it("surfaces DOCX extraction warnings through to a successful result", async () => {
    // The real fixture has no mammoth warnings; this just asserts the plumbing exists.
    const filePath = resolve(__dirname, "../../fixtures/run-sheets/260906.docx");
    const buffer = new Uint8Array(readFileSync(filePath));
    const result = await processRunSheet({
      buffer,
      mimeType: DOCX_MIME,
      filename: "260906.docx",
      context: { mappings: [], templates: [] },
      parse: fakeParse({ parsed: stubParsed, raw: {}, model: "gpt-4.1" }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });
});
