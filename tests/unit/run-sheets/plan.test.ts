import { beforeEach, describe, expect, it } from "vitest";
import { planApply, READY_CONFIDENCE_THRESHOLD } from "@/lib/run-sheets/plan";
import type { ParsedRunSheet } from "@/lib/domain/types";
import {
  alias,
  makeAnnouncement,
  makeMapping,
  makeSlide,
  makeStructuralDefault,
  makeTemplate,
  resetFixtureIds,
} from "./planFixtures";

const GENERAL_TEMPLATE_ID = "tmpl-general";

function runSheet(sections: ParsedRunSheet["sections"]): ParsedRunSheet {
  return { serviceDate: "2026-09-06", documentLanguage: "fr", sections };
}

beforeEach(() => {
  resetFixtureIds();
});

describe("planApply — replace mode / ordering", () => {
  const bibleStudyTemplate = makeTemplate({ id: "tmpl-bible-study", category: "general" });
  const welcomeTemplate = makeTemplate({ id: "tmpl-welcome", category: "welcome" });
  const themeTemplate = makeTemplate({ id: "tmpl-theme", category: "theme" });
  const rendezVousTemplate = makeTemplate({ id: "tmpl-rendez-vous", category: "theme" });
  const closingTemplate = makeTemplate({ id: "tmpl-closing", category: "closing" });
  const generalTemplate = makeTemplate({ id: GENERAL_TEMPLATE_ID, category: "general" });

  const bibleStudyMapping = makeMapping({
    id: "bible-study",
    templateId: bibleStudyTemplate.id,
    aliases: [alias("bible-study", "Étude biblique")],
  });

  const structuralDefaults = [
    makeStructuralDefault({
      id: "welcome",
      templateId: welcomeTemplate.id,
      insertionRule: "always",
      defaultSortZone: "opening",
      sortOrder: 0,
      defaultContent: { headline: "Bienvenue" },
    }),
    makeStructuralDefault({
      id: "theme",
      templateId: themeTemplate.id,
      insertionRule: "always",
      defaultSortZone: "opening",
      sortOrder: 1,
      defaultContent: { headline: "Thème annuel" },
    }),
    makeStructuralDefault({
      id: "rendez-vous",
      templateId: rendezVousTemplate.id,
      insertionRule: "default",
      defaultSortZone: "before_announcements",
      sortOrder: 0,
      defaultContent: { headline: "Rendez-vous de la semaine" },
    }),
    makeStructuralDefault({
      id: "see-you-next-week",
      templateId: closingTemplate.id,
      insertionRule: "always",
      defaultSortZone: "closing",
      sortOrder: 0,
      defaultContent: { headline: "À la semaine prochaine" },
    }),
  ];

  it("orders opening → before_announcements → announcements → closing, and inserts missing structural slides (scenario C)", () => {
    const parsed = runSheet([
      {
        title: "Rendez-vous de la semaine",
        announcements: [
          makeAnnouncement({
            sourceOrder: 0,
            headline: "ÉTUDE BIBLIQUE",
            sourceText: "Étude biblique\nMercredi 19h00 à 20h00",
            line1: "Mercredi",
            line2: "19h00 à 20h00",
            confidence: 0.98,
          }),
        ],
      },
    ]);

    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, welcomeTemplate, themeTemplate, rendezVousTemplate, closingTemplate, generalTemplate],
      structuralDefaults,
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    // "Rendez-vous de la semaine" never appeared as its own announcement in
    // the run sheet, but the admin default says include it — it must still
    // be inserted, positioned before the announcement.
    const headlines = result.inserts.map((s) => s.headline);
    expect(headlines).toEqual(["Bienvenue", "Thème annuel", "Rendez-vous de la semaine", "ÉTUDE BIBLIQUE", "À la semaine prochaine"]);

    const sortOrders = result.inserts.map((s) => s.sortOrder);
    expect(sortOrders).toEqual([0, 1, 2, 3, 4]);

    const rendezVousSlide = result.inserts.find((s) => s.structuralDefaultId === "rendez-vous");
    expect(rendezVousSlide?.isStructural).toBe(true);
    expect(rendezVousSlide?.sortOrder).toBe(2);

    expect(result.summary).toEqual({ found: 1, mapped: 1, needsReview: 0 });
  });

  it("marks a matched announcement ready when confidence is high and there are no review reasons", () => {
    const parsed = runSheet([
      { title: "S1", announcements: [makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", confidence: 0.98 })] },
    ]);
    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.inserts[0].status).toBe("ready");
    expect(result.inserts[0].templateId).toBe(bibleStudyTemplate.id);
    expect(result.inserts[0].mappingId).toBe("bible-study");
  });

  it("marks a matched announcement needs_review when confidence is below threshold", () => {
    const parsed = runSheet([
      {
        title: "S1",
        announcements: [makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", confidence: READY_CONFIDENCE_THRESHOLD - 0.1 })],
      },
    ]);
    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.inserts[0].status).toBe("needs_review");
  });

  it("marks a matched announcement needs_review when the AI attached review reasons, even at high confidence", () => {
    const parsed = runSheet([
      {
        title: "S1",
        announcements: [
          makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", confidence: 0.99, reviewReasons: ["ambiguous_date"] }),
        ],
      },
    ]);
    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.inserts[0].status).toBe("needs_review");
  });

  it("routes an unmatched announcement to the default template, needs_review, and a suggestion", () => {
    const parsed = runSheet([
      { title: "S1", announcements: [makeAnnouncement({ headline: "CHANGEMENTS DE CLASSES", confidence: 0.9 })] },
    ]);
    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.inserts[0].templateId).toBe(GENERAL_TEMPLATE_ID);
    expect(result.inserts[0].status).toBe("needs_review");
    expect(result.inserts[0].mappingId).toBeNull();
    expect(result.suggestions).toEqual(["CHANGEMENTS DE CLASSES"]);
    expect(result.summary.mapped).toBe(0);
  });

  it("defaults includeInVideo from the resolved template (giving excluded by default)", () => {
    const givingTemplate = makeTemplate({ id: "tmpl-giving", category: "giving", includeInVideoDefault: false });
    const givingMapping = makeMapping({
      id: "giving",
      templateId: givingTemplate.id,
      aliases: [alias("giving", "Dîmes et offrandes")],
    });
    const parsed = runSheet([
      { title: "S1", announcements: [makeAnnouncement({ headline: "Dîmes et offrandes", confidence: 0.95 })] },
    ]);
    const result = planApply({
      parsed,
      mappings: [givingMapping],
      templates: [givingTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.inserts[0].includeInVideo).toBe(false);
  });

  it("replace mode deletes every existing slide and regenerates from scratch", () => {
    const parsed = runSheet([
      { title: "S1", announcements: [makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", confidence: 0.98 })] },
    ]);
    const existingSlides = [
      makeSlide({ id: "old-1", isStructural: false, sourceAnnouncement: makeAnnouncement({ headline: "OLD" }) }),
      makeSlide({ id: "old-2", isStructural: true, structuralDefaultId: "welcome" }),
    ];
    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides,
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.deletes.sort()).toEqual(["old-1", "old-2"]);
    expect(result.updates).toEqual([]);
  });
});

describe("planApply — scenario B: recurring item on break", () => {
  const bibleStudyTemplate = makeTemplate({ id: "tmpl-bible-study" });
  const generalTemplate = makeTemplate({ id: GENERAL_TEMPLATE_ID });
  const bibleStudyMapping = makeMapping({
    id: "bible-study",
    templateId: bibleStudyTemplate.id,
    aliases: [alias("bible-study", "Étude biblique")],
  });

  it("still picks the Bible Study template, using this week's break copy (replace mode)", () => {
    const parsed = runSheet([
      {
        title: "S1",
        announcements: [
          makeAnnouncement({
            headline: "ÉTUDE BIBLIQUE",
            sourceText: "Étude biblique\nEn pause cette semaine",
            line1: "En pause cette semaine",
            line2: null,
            confidence: 0.95,
          }),
        ],
      },
    ]);
    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [],
      mode: "replace",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });
    expect(result.inserts[0].templateId).toBe(bibleStudyTemplate.id);
    expect(result.inserts[0].content.line1).toBe("En pause cette semaine");
  });

  it("merge mode updates an untouched generated slide with this week's break copy, not last week's schedule", () => {
    const existing = makeSlide({
      id: "existing-bible-study",
      isStructural: false,
      manuallyEdited: false,
      mappingId: "bible-study",
      templateId: bibleStudyTemplate.id,
      headline: "ÉTUDE BIBLIQUE",
      content: { headline: "ÉTUDE BIBLIQUE", line1: "Mercredi", line2: "19h00 à 20h00" },
      sourceAnnouncement: makeAnnouncement({
        headline: "ÉTUDE BIBLIQUE",
        sourceText: "Étude biblique\nMercredi 19h00 à 20h00",
        line1: "Mercredi",
        line2: "19h00 à 20h00",
      }),
    });

    const parsed = runSheet([
      {
        title: "S1",
        announcements: [
          makeAnnouncement({
            headline: "ÉTUDE BIBLIQUE",
            sourceText: "Étude biblique\nEn pause cette semaine",
            line1: "En pause cette semaine",
            line2: null,
            confidence: 0.95,
          }),
        ],
      },
    ]);

    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [existing],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    expect(result.inserts).toEqual([]);
    expect(result.deletes).toEqual([]);
    const update = result.updates.find((u) => u.id === "existing-bible-study");
    expect(update?.patch.content).toEqual({ headline: "ÉTUDE BIBLIQUE", line1: "En pause cette semaine", line2: "" });
  });

  it("merge mode flags a manually-edited slide needs_review (source_changed) instead of silently overwriting or keeping stale copy", () => {
    const existing = makeSlide({
      id: "existing-bible-study",
      isStructural: false,
      manuallyEdited: true,
      mappingId: "bible-study",
      templateId: bibleStudyTemplate.id,
      headline: "ÉTUDE BIBLIQUE (custom wording)",
      content: { headline: "ÉTUDE BIBLIQUE (custom wording)", line1: "Mercredi", line2: "19h00" },
      sourceAnnouncement: makeAnnouncement({
        headline: "ÉTUDE BIBLIQUE",
        sourceText: "Étude biblique\nMercredi 19h00 à 20h00",
        line1: "Mercredi",
        line2: "19h00 à 20h00",
      }),
    });

    const parsed = runSheet([
      {
        title: "S1",
        announcements: [
          makeAnnouncement({
            headline: "ÉTUDE BIBLIQUE",
            sourceText: "Étude biblique\nEn pause cette semaine",
            line1: "En pause cette semaine",
            line2: null,
            confidence: 0.95,
          }),
        ],
      },
    ]);

    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [existing],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    const update = result.updates.find((u) => u.id === "existing-bible-study");
    expect(update?.patch.status).toBe("needs_review");
    expect(update?.patch.sourceAnnouncement?.reviewReasons).toContain("source_changed");
    // Content must remain the Sunday team's manual edit, not be silently overwritten.
    expect(update?.patch.content).toBeUndefined();
    expect(update?.patch.headline).toBeUndefined();
  });

  it("merge mode leaves a manually-edited slide fully untouched when the source text is materially unchanged", () => {
    const existing = makeSlide({
      id: "existing-bible-study",
      isStructural: false,
      manuallyEdited: true,
      mappingId: "bible-study",
      templateId: bibleStudyTemplate.id,
      headline: "Étude biblique (soirée spéciale)",
      content: { headline: "Étude biblique (soirée spéciale)", line1: "Mercredi", line2: "19h00 à 20h00" },
      sourceAnnouncement: makeAnnouncement({
        headline: "ÉTUDE BIBLIQUE",
        sourceText: "Étude biblique\nMercredi 19h00 à 20h00",
        line1: "Mercredi",
        line2: "19h00 à 20h00",
      }),
    });

    const parsed = runSheet([
      {
        title: "S1",
        announcements: [
          makeAnnouncement({
            headline: "ÉTUDE BIBLIQUE",
            sourceText: "Étude biblique\nMercredi 19h00 à 20h00",
            line1: "Mercredi",
            line2: "19h00 à 20h00",
            confidence: 0.98,
          }),
        ],
      },
    ]);

    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [existing],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    expect(result.updates).toEqual([]);
    expect(result.deletes).toEqual([]);
  });
});

describe("planApply — scenario D: merge (Sunday last-minute upload)", () => {
  const bibleStudyTemplate = makeTemplate({ id: "tmpl-bible-study" });
  const baptismTemplate = makeTemplate({ id: "tmpl-baptism" });
  const generalTemplate = makeTemplate({ id: GENERAL_TEMPLATE_ID });
  const bibleStudyMapping = makeMapping({
    id: "bible-study",
    templateId: bibleStudyTemplate.id,
    aliases: [alias("bible-study", "Étude biblique")],
  });
  const baptismMapping = makeMapping({
    id: "baptisms",
    templateId: baptismTemplate.id,
    aliases: [alias("baptisms", "Baptêmes")],
  });

  it("keeps a non-conflicting manual (Add Slide) slide untouched and in place", () => {
    const manualSlide = makeSlide({
      id: "manual-1",
      isStructural: false,
      manuallyEdited: false,
      sourceAnnouncement: null, // Add Slide origin — never touched by merge
      headline: "Custom announcement",
      sortOrder: 0,
    });
    const existingBibleStudy = makeSlide({
      id: "bs-1",
      isStructural: false,
      mappingId: "bible-study",
      templateId: bibleStudyTemplate.id,
      headline: "ÉTUDE BIBLIQUE",
      sortOrder: 1,
      sourceAnnouncement: makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", sourceText: "Étude biblique" }),
    });

    const parsed = runSheet([
      { title: "S1", announcements: [makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", sourceText: "Étude biblique", confidence: 0.98 })] },
    ]);

    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping],
      templates: [bibleStudyTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [manualSlide, existingBibleStudy],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    expect(result.deletes).toEqual([]);
    const manualUpdate = result.updates.find((u) => u.id === "manual-1");
    expect(manualUpdate).toBeUndefined();
  });

  it("adds a genuinely new announcement after the existing ones", () => {
    const existingBibleStudy = makeSlide({
      id: "bs-1",
      isStructural: false,
      mappingId: "bible-study",
      templateId: bibleStudyTemplate.id,
      headline: "ÉTUDE BIBLIQUE",
      sortOrder: 0,
      sourceAnnouncement: makeAnnouncement({ headline: "ÉTUDE BIBLIQUE", sourceText: "Étude biblique" }),
    });

    const parsed = runSheet([
      {
        title: "S1",
        announcements: [
          makeAnnouncement({ sourceOrder: 0, headline: "ÉTUDE BIBLIQUE", sourceText: "Étude biblique", confidence: 0.98 }),
          makeAnnouncement({ sourceOrder: 1, headline: "Baptêmes", sourceText: "Baptêmes dimanche prochain", confidence: 0.9 }),
        ],
      },
    ]);

    const result = planApply({
      parsed,
      mappings: [bibleStudyMapping, baptismMapping],
      templates: [bibleStudyTemplate, baptismTemplate, generalTemplate],
      structuralDefaults: [],
      existingSlides: [existingBibleStudy],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    expect(result.inserts).toHaveLength(1);
    expect(result.inserts[0].headline).toBe("Baptêmes");
    expect(result.inserts[0].sortOrder).toBe(1); // after the existing Bible Study slide (index 0)
  });

  it("deletes a generated announcement slide that disappeared from the new sheet", () => {
    const vanished = makeSlide({
      id: "vanished-1",
      isStructural: false,
      manuallyEdited: false,
      headline: "OLD ANNOUNCEMENT",
      sourceAnnouncement: makeAnnouncement({ headline: "OLD ANNOUNCEMENT", sourceText: "Old announcement" }),
    });
    const parsed = runSheet([{ title: "S1", announcements: [] }]);

    const result = planApply({
      parsed,
      mappings: [],
      templates: [generalTemplate],
      structuralDefaults: [],
      existingSlides: [vanished],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    expect(result.deletes).toEqual(["vanished-1"]);
  });

  it("keeps structural slides already present and only inserts genuinely missing ones", () => {
    const structuralDefaults = [
      makeStructuralDefault({ id: "welcome", templateId: "tmpl-welcome", defaultSortZone: "opening" }),
      makeStructuralDefault({ id: "closing", templateId: "tmpl-closing", defaultSortZone: "closing" }),
    ];
    const existingWelcome = makeSlide({
      id: "welcome-slide",
      isStructural: true,
      structuralDefaultId: "welcome",
      headline: "Bienvenue",
      sortOrder: 0,
    });
    const parsed = runSheet([{ title: "S1", announcements: [] }]);

    const result = planApply({
      parsed,
      mappings: [],
      templates: [generalTemplate],
      structuralDefaults,
      existingSlides: [existingWelcome],
      mode: "merge",
      defaultTemplateId: GENERAL_TEMPLATE_ID,
    });

    expect(result.deletes).not.toContain("welcome-slide");
    const insertedStructuralIds = result.inserts.filter((s) => s.isStructural).map((s) => s.structuralDefaultId);
    expect(insertedStructuralIds).toEqual(["closing"]);
  });
});

/**
 * End-to-end planner test against a hand-written ParsedRunSheet mirroring
 * the real church fixture at tests/fixtures/run-sheets/260906.docx (EAJC,
 * "DIMANCHE 06-09-2026"): a roster block that must NOT become announcements,
 * two items under "Rendez-vous de la semaine", four items under
 * "Événements à venir" (one with a typo the fuzzy matcher must still
 * catch), a combined giving section, and an unmatched conference item.
 */
describe("planApply — 260906.docx (EAJC) fixture scenario", () => {
  const templates = {
    welcome: makeTemplate({ id: "tmpl-welcome", category: "welcome" }),
    theme: makeTemplate({ id: "tmpl-theme", category: "theme" }),
    rendezVousStructural: makeTemplate({ id: "tmpl-rendez-vous-structural", category: "theme" }),
    closing: makeTemplate({ id: "tmpl-closing", category: "closing" }),
    bibleStudy: makeTemplate({ id: "tmpl-bible-study", category: "general" }),
    rendezVous: makeTemplate({ id: "tmpl-rendez-vous", category: "general" }),
    baptism: makeTemplate({ id: "tmpl-baptism", category: "special" }),
    eventCoral: makeTemplate({ id: "tmpl-event-coral", category: "events" }),
    giving: makeTemplate({ id: "tmpl-giving", category: "giving", includeInVideoDefault: false }),
    general: makeTemplate({ id: GENERAL_TEMPLATE_ID, category: "general" }),
  };

  const mappings = [
    makeMapping({ id: "bible-study", templateId: templates.bibleStudy.id, aliases: [alias("bible-study", "Étude biblique")] }),
    makeMapping({ id: "rendez-vous", templateId: templates.rendezVous.id, aliases: [alias("rendez-vous", "Culte d'adoration")] }),
    makeMapping({ id: "baptisms", templateId: templates.baptism.id, aliases: [alias("baptisms", "Baptêmes")] }),
    makeMapping({
      id: "event-coral-editorial",
      templateId: templates.eventCoral.id,
      aliases: [alias("event-coral-editorial", "Veillée des hommes"), alias("event-coral-editorial", "Prière matinale des femmes")],
    }),
    makeMapping({ id: "giving", templateId: templates.giving.id, aliases: [alias("giving", "Dîmes et offrandes")] }),
  ];

  const structuralDefaults = [
    makeStructuralDefault({ id: "welcome", templateId: templates.welcome.id, insertionRule: "always", defaultSortZone: "opening", sortOrder: 0, defaultContent: { headline: "Bienvenue" } }),
    makeStructuralDefault({ id: "theme", templateId: templates.theme.id, insertionRule: "always", defaultSortZone: "opening", sortOrder: 1, defaultContent: { headline: "Thème annuel" } }),
    makeStructuralDefault({ id: "rendez-vous-cover", templateId: templates.rendezVousStructural.id, insertionRule: "default", defaultSortZone: "before_announcements", sortOrder: 0, defaultContent: { headline: "Rendez-vous de la semaine" } }),
    makeStructuralDefault({ id: "see-you-next-week", templateId: templates.closing.id, insertionRule: "always", defaultSortZone: "closing", sortOrder: 0, defaultContent: { headline: "À la semaine prochaine" } }),
  ];

  const parsed: ParsedRunSheet = {
    serviceDate: "2026-09-06",
    documentLanguage: "fr",
    sections: [
      {
        title: "Service du dimanche",
        // Roster block (PRIÈRE / GERARD M, LOUANGE / LEANDRA ME, ...) — not announcements.
        announcements: [],
      },
      {
        title: "1.- Rendez-vous de la semaine",
        announcements: [
          makeAnnouncement({
            sourceOrder: 0,
            headline: "ÉTUDE BIBLIQUE",
            sourceText: "Mercredi de 19h00 à 20h00\nÉtude biblique\nLes portes ouvrent dès 18h00 pour la prière libre",
            line1: "Mercredi",
            line2: "19h00 à 20h00",
            confidence: 0.97,
          }),
          makeAnnouncement({
            sourceOrder: 1,
            headline: "CULTE D'ADORATION",
            sourceText: "Dimanche à 10h00\nCulte d'adoration",
            line1: "Dimanche",
            line2: "10h00",
            confidence: 0.97,
          }),
        ],
      },
      {
        title: "2.- Événements à venir",
        announcements: [
          makeAnnouncement({
            sourceOrder: 0,
            headline: "BAPTÊMES",
            sourceText:
              "Des baptêmes auront lieu dimanche prochain\nLes candidats au baptême doivent inscrire leurs noms et coordonnées sur le formulaire apposé au babillard.",
            confidence: 0.9,
          }),
          makeAnnouncement({
            sourceOrder: 1,
            headline: "VEILLÉE DES HOMMES",
            sourceText: "Veillée des hommes\nCe vendredi, le 11 septembre 2026 de 21h00 à 23h00",
            line1: "Vendredi 11 septembre 2026",
            line2: "21h00 à 23h00",
            confidence: 0.95,
          }),
          makeAnnouncement({
            sourceOrder: 2,
            headline: "CHANGEMENTS DE CLASSES DEDE",
            sourceText: "Changements de classes DEDE\nDimanche prochain, le 13 septembre 2026",
            line1: "Dimanche prochain",
            line2: "13 septembre 2026",
            confidence: 0.85,
          }),
          makeAnnouncement({
            sourceOrder: 3,
            // Real document typo ("matinales" instead of "matinale") — the fuzzy matcher must still catch it.
            headline: "PRIÈRE MATINALES DES FEMMES",
            sourceText: "Prière matinales des femmes\nMardi, le 22 septembre 2026 de 10h00 à 12h00",
            line1: "Mardi 22 septembre 2026",
            line2: "10h00 à 12h00",
            confidence: 0.9,
          }),
        ],
      },
      {
        title: "3.- Dîmes et offrandes",
        announcements: [
          makeAnnouncement({
            sourceOrder: 0,
            headline: "DÎMES ET OFFRANDES",
            sourceText:
              "Chèques / mandats / argent comptant\nEnveloppes et panier à l'arrière du sanctuaire\nVirements Interac en ligne\nEmail : secretariateajc@gmail.com\nQuestion : adresse\nRéponse : 6597",
            category: "giving",
            confidence: 0.95,
          }),
        ],
      },
      {
        title: "4.- Conférence EAJC",
        announcements: [
          makeAnnouncement({
            sourceOrder: 0,
            headline: "CONFÉRENCE EAJC",
            sourceText: "Conférence EAJC\nAppeler Pst Florent G.",
            confidence: 0.6,
            reviewReasons: ["unknown_announcement"],
          }),
        ],
      },
    ],
  };

  const result = planApply({
    parsed,
    mappings,
    templates: Object.values(templates),
    structuralDefaults,
    existingSlides: [],
    mode: "replace",
    defaultTemplateId: GENERAL_TEMPLATE_ID,
  });

  function findByHeadline(headline: string) {
    const slide = result.inserts.find((s) => s.headline === headline);
    if (!slide) throw new Error(`No inserted slide with headline "${headline}"`);
    return slide;
  }

  it("does not turn the service-roster section into any announcement slides", () => {
    // 8 real announcements total (2 + 4 + 1 + 1); the roster section contributes zero.
    expect(result.summary.found).toBe(8);
  });

  it("maps Étude biblique to the bible-study template, ready", () => {
    const slide = findByHeadline("ÉTUDE BIBLIQUE");
    expect(slide.templateId).toBe(templates.bibleStudy.id);
    expect(slide.mappingId).toBe("bible-study");
    expect(slide.status).toBe("ready");
  });

  it("maps Culte d'adoration to the rendez-vous mapping", () => {
    const slide = findByHeadline("CULTE D'ADORATION");
    expect(slide.mappingId).toBe("rendez-vous");
    expect(slide.templateId).toBe(templates.rendezVous.id);
  });

  it("maps Baptêmes to the baptisms mapping", () => {
    const slide = findByHeadline("BAPTÊMES");
    expect(slide.mappingId).toBe("baptisms");
    expect(slide.templateId).toBe(templates.baptism.id);
  });

  it("maps Veillée des hommes to event-coral-editorial", () => {
    const slide = findByHeadline("VEILLÉE DES HOMMES");
    expect(slide.mappingId).toBe("event-coral-editorial");
  });

  it("fuzzy-matches the 'Prière matinales des femmes' typo to event-coral-editorial", () => {
    const slide = findByHeadline("PRIÈRE MATINALES DES FEMMES");
    expect(slide.mappingId).toBe("event-coral-editorial");
  });

  it("leaves Changements de classes unmatched: default template, needs_review, suggested", () => {
    const slide = findByHeadline("CHANGEMENTS DE CLASSES DEDE");
    expect(slide.mappingId).toBeNull();
    expect(slide.templateId).toBe(GENERAL_TEMPLATE_ID);
    expect(slide.status).toBe("needs_review");
    expect(result.suggestions).toContain("CHANGEMENTS DE CLASSES DEDE");
  });

  it("maps Dîmes et offrandes to giving, excluded from MP4 by default", () => {
    const slide = findByHeadline("DÎMES ET OFFRANDES");
    expect(slide.mappingId).toBe("giving");
    expect(slide.includeInVideo).toBe(false);
  });

  it("leaves Conférence EAJC unmatched and needs_review", () => {
    const slide = findByHeadline("CONFÉRENCE EAJC");
    expect(slide.mappingId).toBeNull();
    expect(slide.status).toBe("needs_review");
    expect(result.suggestions).toContain("CONFÉRENCE EAJC");
  });

  it("inserts Welcome, Annual theme, and the Rendez-vous de la semaine cover before the announcements, and See you next week at the close", () => {
    const headlines = result.inserts.map((s) => s.headline);
    expect(headlines[0]).toBe("Bienvenue");
    expect(headlines[1]).toBe("Thème annuel");
    expect(headlines[2]).toBe("Rendez-vous de la semaine");
    expect(headlines[headlines.length - 1]).toBe("À la semaine prochaine");
    expect(headlines.indexOf("Rendez-vous de la semaine")).toBeLessThan(headlines.indexOf("ÉTUDE BIBLIQUE"));
  });

  it("summary reflects 6 mapped and 2 needing review", () => {
    expect(result.summary).toEqual({ found: 8, mapped: 6, needsReview: 2 });
  });
});
