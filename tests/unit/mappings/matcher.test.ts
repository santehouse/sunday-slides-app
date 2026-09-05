import { describe, expect, it } from "vitest";
import { matchAnnouncement } from "@/lib/mappings/matcher";
import type { AnnouncementMapping } from "@/lib/domain/types";

function makeMapping(overrides: Partial<AnnouncementMapping> & { id: string }): AnnouncementMapping {
  return {
    canonicalName: overrides.id,
    canonicalKey: overrides.id,
    templateId: `tmpl-${overrides.id}`,
    active: true,
    aliases: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function alias(mappingId: string, text: string, locale: "en" | "fr-CA" | null = null) {
  return { id: `${mappingId}-${text}`, mappingId, alias: text, locale };
}

const bibleStudy = makeMapping({
  id: "bible-study",
  canonicalName: "Étude biblique",
  canonicalKey: "bible-study",
  aliases: [
    alias("bible-study", "Étude biblique", "fr-CA"),
    alias("bible-study", "Bible Study", "en"),
    alias("bible-study", "Étude de la Bible", "fr-CA"),
  ],
});

const morningPrayer = makeMapping({
  id: "morning-prayer",
  canonicalName: "Prière matinale des femmes",
  canonicalKey: "morning-prayer",
  aliases: [alias("morning-prayer", "Prière matinale des femmes", "fr-CA")],
});

const mensNight = makeMapping({
  id: "mens-night",
  canonicalName: "Veillée des hommes",
  canonicalKey: "mens-night",
  aliases: [alias("mens-night", "Veillée des hommes", "fr-CA")],
});

const mappings = [bibleStudy, morningPrayer, mensNight];

describe("matchAnnouncement", () => {
  it("matches an English alias exactly", () => {
    const result = matchAnnouncement({ headline: "Bible Study", sourceText: "Bible Study\nWednesday 7pm" }, mappings);
    expect(result).not.toBeNull();
    expect(result?.mapping.id).toBe("bible-study");
    expect(result?.method).toBe("exact");
    expect(result?.confidence).toBe(1);
  });

  it("matches a French alias exactly, accent-insensitively", () => {
    const result = matchAnnouncement(
      { headline: "ETUDE BIBLIQUE", sourceText: "Étude biblique\nMercredi 19h" },
      mappings,
    );
    expect(result?.mapping.id).toBe("bible-study");
    expect(result?.method).toBe("exact");
  });

  it("routes different aliases of the same recurring topic to the same canonical mapping", () => {
    const en = matchAnnouncement({ headline: "Bible Study", sourceText: "Bible Study" }, mappings);
    const fr = matchAnnouncement({ headline: "Étude de la Bible", sourceText: "Étude de la Bible" }, mappings);
    expect(en?.mapping.id).toBe(fr?.mapping.id);
    expect(en?.mapping.canonicalKey).toBe("bible-study");
  });

  it("matches via AI-suggested canonicalKey at confidence 0.95", () => {
    const result = matchAnnouncement(
      { headline: "Something unrelated wording", sourceText: "...", canonicalKey: "bible-study" },
      mappings,
    );
    expect(result?.mapping.id).toBe("bible-study");
    expect(result?.method).toBe("canonical");
    expect(result?.confidence).toBe(0.95);
  });

  it("falls through to fuzzy matching on a near-identical headline (typo)", () => {
    const result = matchAnnouncement(
      { headline: "PRIÈRE MATINALES DES FEMMES", sourceText: "PRIÈRE MATINALES DES FEMMES\nMardi 10h" },
      mappings,
    );
    expect(result?.mapping.id).toBe("morning-prayer");
    expect(result?.method).toBe("fuzzy");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.82);
  });

  it("does NOT produce a false positive between similarly-themed but distinct announcements", () => {
    const result = matchAnnouncement(
      { headline: "Prière matinale des femmes", sourceText: "Prière matinale des femmes\nMardi 10h" },
      [mensNight], // only the unrelated mapping is available
    );
    expect(result).toBeNull();
  });

  it("does not confuse men's night with women's morning prayer even when both mappings are present", () => {
    const result = matchAnnouncement(
      { headline: "Veillée des hommes", sourceText: "Veillée des hommes\nVendredi 21h" },
      mappings,
    );
    expect(result?.mapping.id).toBe("mens-night");
  });

  it("returns null below the fuzzy threshold with no containment", () => {
    const result = matchAnnouncement(
      { headline: "Vente de garage annuelle", sourceText: "Vente de garage annuelle ce samedi" },
      mappings,
    );
    expect(result).toBeNull();
  });

  it("matches via alias containment in the source text's first line even if the headline differs", () => {
    const withAliasInFirstLine = makeMapping({
      id: "special-event",
      canonicalName: "Special Event",
      aliases: [alias("special-event", "conférence eajc")],
    });
    const result = matchAnnouncement(
      {
        headline: "INFOS DIVERSES",
        sourceText: "4.- Conférence EAJC\nAppeler Pst Florent G.",
      },
      [withAliasInFirstLine],
    );
    expect(result?.mapping.id).toBe("special-event");
    expect(result?.method).toBe("fuzzy");
  });

  it("ignores inactive mappings", () => {
    const inactive = makeMapping({ ...bibleStudy, id: "bible-study", active: false });
    const result = matchAnnouncement({ headline: "Bible Study", sourceText: "Bible Study" }, [inactive]);
    expect(result).toBeNull();
  });

  it("preserves this week's changed copy independent of the match (weekly break scenario)", () => {
    const result = matchAnnouncement(
      { headline: "ÉTUDE BIBLIQUE", sourceText: "Étude biblique\nEn pause cette semaine" },
      mappings,
    );
    expect(result?.mapping.id).toBe("bible-study");
    // The matcher only ever returns mapping/confidence/method — it never
    // echoes back any "usual" content, so the caller is free to use this
    // week's own sourceText/line1/line2 for the slide.
    expect(result).not.toHaveProperty("content");
  });
});
