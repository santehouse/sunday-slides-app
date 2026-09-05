/** Shared domain-object factories for plan.ts / pipeline.ts unit tests. */
import type {
  AnnouncementMapping,
  DefaultStructuralSlide,
  ParsedAnnouncement,
  Slide,
  Template,
  TemplateCategory,
} from "@/lib/domain/types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function resetFixtureIds(): void {
  idCounter = 0;
}

export function makeTemplate(overrides: Partial<Template> & { id: string }): Template {
  return {
    slug: overrides.id,
    nameEn: overrides.id,
    nameFr: overrides.id,
    category: "general",
    status: "published",
    rendererKey: "generic-v1",
    backgroundType: "color",
    backgroundValue: "#000000",
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: [],
    allowedAssetIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeMapping(overrides: Partial<AnnouncementMapping> & { id: string; templateId: string }): AnnouncementMapping {
  return {
    canonicalName: overrides.id,
    canonicalKey: overrides.id,
    active: true,
    aliases: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function alias(mappingId: string, text: string) {
  return { id: nextId("alias"), mappingId, alias: text, locale: null };
}

export function makeStructuralDefault(
  overrides: Partial<DefaultStructuralSlide> & { id: string; templateId: string },
): DefaultStructuralSlide {
  return {
    nameEn: overrides.id,
    nameFr: overrides.id,
    insertionRule: "always",
    defaultSortZone: "opening",
    sortOrder: 0,
    enabled: true,
    removableBySundayTeam: false,
    includeInVideoDefault: true,
    defaultContent: {},
    ...overrides,
  };
}

export function makeAnnouncement(overrides: Partial<ParsedAnnouncement> & { headline: string }): ParsedAnnouncement {
  return {
    sourceOrder: 0,
    sourceText: overrides.headline,
    canonicalKey: null,
    category: "general" as TemplateCategory,
    line1: null,
    line2: null,
    suggestedMappingId: null,
    suggestedTemplateId: null,
    confidence: 0.95,
    reviewReasons: [],
    ...overrides,
  };
}

export function makeSlide(overrides: Partial<Slide> & { id: string }): Slide {
  return {
    sundayId: "sunday-1",
    templateId: "tmpl-x",
    headline: "Headline",
    content: {},
    assetId: null,
    backgroundMode: "color",
    approvedColorId: null,
    sortOrder: 0,
    includeInVideo: true,
    status: "ready",
    isStructural: false,
    structuralDefaultId: null,
    parserConfidence: null,
    mappingId: null,
    sourceAnnouncement: null,
    manuallyEdited: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
