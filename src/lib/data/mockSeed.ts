/**
 * Church Panels demo dataset — the Figma "EAJC" Sunday.
 *
 * Free of Next.js imports so it can run under both:
 *  - `src/lib/data/mockDb.ts` (in-memory store, CP_MOCK_DATA=1)
 *  - `scripts/seed.ts` (idempotent seed for a real Supabase project, via tsx)
 *
 * Everything here is expressed as plain "seed" shapes keyed by natural keys
 * (slug, canonicalKey, family+weight+style, hex) rather than database ids —
 * each consumer assigns/looks up real ids its own way (mockDb generates
 * stable in-memory ids; scripts/seed.ts upserts and reads back Supabase uuids).
 */
import bcrypt from "bcryptjs";
import type {
  AssetCategory,
  AssetStatus,
  BackgroundType,
  FontSource,
  FontStyle,
  Locale,
  OverflowMode,
  OverlayColor,
  ParsedAnnouncement,
  ParsedRunSheet,
  RunSheetParseStatus,
  RunSheetSourceType,
  SlideBackgroundMode,
  SlideContent,
  SlideStatus,
  StructuralInsertionRule,
  StructuralSortZone,
  SundayStatus,
  TemplateCategory,
  TemplateStatus,
  TextAlignment,
} from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Church / settings
// ---------------------------------------------------------------------------

export const CHURCH_NAME = "EAJC";
export const CHURCH_TIMEZONE = "America/Toronto";
export const SUNDAY_PIN = "53787";
export const SUNDAY_PIN_LENGTH = SUNDAY_PIN.length;
/** Slug the run-sheet planner falls back to when no mapping/template match is found. */
export const DEFAULT_TEMPLATE_SLUG = "general-announcement";

export function computeSundayPinHash(): string {
  return bcrypt.hashSync(SUNDAY_PIN, 10);
}

export const SETTINGS_SEED = {
  churchName: CHURCH_NAME,
  timezone: CHURCH_TIMEZONE,
  defaultLocale: "en" as Locale,
  sundayPinLength: SUNDAY_PIN_LENGTH,
  defaultSlideHoldSeconds: 5,
  inboundEmail: "announcements@eajc.example.org",
  autoProcessInbound: true,
  safeZone: { x: 96, y: 640, width: 640, height: 360 },
  temporaryRetentionDays: 60,
};

export const ADMIN_USER_SEED = {
  email: "josiah@santehouse.co",
  displayName: "Josiah",
  role: "owner" as const,
  locale: "en" as Locale,
};

// ---------------------------------------------------------------------------
// Fonts + approved colors (mirrors supabase/migrations/0001_init.sql seed)
// ---------------------------------------------------------------------------

export interface FontSeed {
  family: string;
  source: FontSource;
  sourceIdentifier: string | null;
  weight: number;
  style: FontStyle;
  enabled?: boolean;
}

export const FONT_SEEDS: FontSeed[] = [
  { family: "Arimo", source: "google", sourceIdentifier: "Arimo", weight: 400, style: "normal" },
  { family: "Arimo", source: "google", sourceIdentifier: "Arimo", weight: 700, style: "normal" },
  { family: "Arimo", source: "google", sourceIdentifier: "Arimo", weight: 400, style: "italic" },
  { family: "Arimo", source: "google", sourceIdentifier: "Arimo", weight: 700, style: "italic" },
  { family: "Tinos", source: "google", sourceIdentifier: "Tinos", weight: 400, style: "normal" },
  { family: "Tinos", source: "google", sourceIdentifier: "Tinos", weight: 700, style: "normal" },
  { family: "Tinos", source: "google", sourceIdentifier: "Tinos", weight: 400, style: "italic" },
  { family: "Tinos", source: "google", sourceIdentifier: "Tinos", weight: 700, style: "italic" },
];

export interface ApprovedColorSeed {
  nameEn: string;
  nameFr: string;
  hex: string;
  sortOrder: number;
  enabled?: boolean;
}

export const APPROVED_COLOR_SEEDS: ApprovedColorSeed[] = [
  { nameEn: "Navy", nameFr: "Marine", hex: "#0f172a", sortOrder: 1 },
  { nameEn: "Indigo", nameFr: "Indigo", hex: "#4f46e5", sortOrder: 2 },
  { nameEn: "Coral", nameFr: "Corail", hex: "#ff4233", sortOrder: 3 },
  { nameEn: "Yellow", nameFr: "Jaune", hex: "#f5c518", sortOrder: 4 },
  { nameEn: "Forest", nameFr: "Forêt", hex: "#14532d", sortOrder: 5 },
  { nameEn: "Cream", nameFr: "Crème", hex: "#f8f5ee", sortOrder: 6 },
];

const COLOR_HEX: Record<string, string> = Object.fromEntries(
  APPROVED_COLOR_SEEDS.map((c) => [c.nameEn.toLowerCase(), c.hex]),
);

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface AssetSeed {
  slug: string;
  nameEn: string;
  nameFr: string;
  category: AssetCategory;
  status?: AssetStatus;
  tags?: string[];
  width: number;
  height: number;
  /** Solid placeholder color used by mockAssetUrl's generated SVG. */
  color: string;
}

export const ASSET_SEEDS: AssetSeed[] = [
  {
    slug: "bg-mountain-sunrise",
    nameEn: "Mountain sunrise",
    nameFr: "Lever de soleil sur la montagne",
    category: "backgrounds",
    width: 1920,
    height: 1080,
    color: "#1e293b",
  },
  {
    slug: "bg-city-lights",
    nameEn: "City lights",
    nameFr: "Lumières de la ville",
    category: "backgrounds",
    width: 1920,
    height: 1080,
    color: "#312e81",
  },
  {
    slug: "photo-community-gathering",
    nameEn: "Community gathering",
    nameFr: "Rassemblement communautaire",
    category: "photography",
    width: 1920,
    height: 1080,
    color: "#7c3aed",
  },
  {
    slug: "photo-worship-hands",
    nameEn: "Worship",
    nameFr: "Louange",
    category: "photography",
    width: 1920,
    height: 1080,
    color: "#4f46e5",
  },
  {
    slug: "bg-abstract-texture",
    nameEn: "Abstract texture",
    nameFr: "Texture abstraite",
    category: "backgrounds",
    width: 1920,
    height: 1080,
    color: "#0f172a",
  },
  {
    slug: "photo-baptism-pool",
    nameEn: "Baptism pool",
    nameFr: "Bassin de baptême",
    category: "special",
    width: 1920,
    height: 1080,
    color: "#0e7490",
  },
];

/**
 * Deterministic inline SVG data URI standing in for a real asset image in
 * mock mode — shows the asset's English name over a solid color tile.
 */
export function mockAssetUrl(asset: { nameEn: string; color?: string }): string {
  const bg = asset.color ?? "#334155";
  const label = escapeXml(asset.nameEn);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">` +
    `<rect width="1920" height="1080" fill="${bg}"/>` +
    `<text x="960" y="540" fill="#ffffff" font-family="Arimo, sans-serif" font-size="56" ` +
    `font-weight="700" text-anchor="middle" dominant-baseline="middle" opacity="0.85">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateFieldSeed {
  fieldKey: string;
  labelEn: string;
  labelFr: string;
  teamEditable: boolean;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  lineHeight: number;
  letterSpacing: number;
  alignment: TextAlignment;
  textColor: string;
  maxLines: number;
  overflowMode: OverflowMode;
  textTransform: "none" | "uppercase";
  sortOrder: number;
}

/** The standard headline/line1/line2 layout shared by nearly every template. */
function standardFields(textColor: string): TemplateFieldSeed[] {
  return [
    {
      fieldKey: "headline",
      labelEn: "Headline",
      labelFr: "Titre",
      teamEditable: true,
      required: true,
      x: 96,
      y: 120,
      width: 1300,
      height: 300,
      fontFamily: "Arimo",
      fontSize: 120,
      minFontSize: 72,
      fontWeight: 700,
      fontStyle: "normal",
      lineHeight: 1.05,
      letterSpacing: 0,
      alignment: "left",
      textColor,
      maxLines: 2,
      overflowMode: "auto_fit",
      textTransform: "uppercase",
      sortOrder: 0,
    },
    {
      fieldKey: "line1",
      labelEn: "Line 1",
      labelFr: "Ligne 1",
      teamEditable: true,
      required: false,
      x: 96,
      y: 460,
      width: 1300,
      height: 80,
      fontFamily: "Arimo",
      fontSize: 56,
      minFontSize: 56,
      fontWeight: 400,
      fontStyle: "normal",
      lineHeight: 1.1,
      letterSpacing: 0,
      alignment: "left",
      textColor,
      maxLines: 1,
      overflowMode: "fixed",
      textTransform: "none",
      sortOrder: 1,
    },
    {
      fieldKey: "line2",
      labelEn: "Line 2",
      labelFr: "Ligne 2",
      teamEditable: true,
      required: false,
      x: 96,
      y: 560,
      width: 1300,
      height: 80,
      fontFamily: "Arimo",
      fontSize: 56,
      minFontSize: 56,
      fontWeight: 400,
      fontStyle: "normal",
      lineHeight: 1.1,
      letterSpacing: 0,
      alignment: "left",
      textColor,
      maxLines: 1,
      overflowMode: "fixed",
      textTransform: "none",
      sortOrder: 2,
    },
  ];
}

export interface TemplateSeed {
  slug: string;
  nameEn: string;
  nameFr: string;
  category: TemplateCategory;
  status: TemplateStatus;
  rendererKey?: string;
  backgroundType: BackgroundType;
  /** Hex color for `color` backgrounds, or an asset slug (from ASSET_SEEDS) for `image` backgrounds. */
  backgroundValue: string;
  overlayColor: OverlayColor;
  overlayOpacity: number;
  includeInVideoDefault: boolean;
  allowTeamBackgroundChoice: boolean;
  fields: TemplateFieldSeed[];
  allowedAssetSlugs: string[];
}

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    slug: "welcome",
    nameEn: "Welcome",
    nameFr: "Bienvenue",
    category: "welcome",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.navy,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "annual-theme",
    nameEn: "Annual theme",
    nameFr: "Thème annuel",
    category: "theme",
    status: "published",
    backgroundType: "image",
    backgroundValue: "bg-mountain-sunrise",
    overlayColor: "black",
    overlayOpacity: 0.35,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: true,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: ["bg-mountain-sunrise", "bg-city-lights", "bg-abstract-texture"],
  },
  {
    slug: "rendez-vous",
    nameEn: "Rendez-vous de la semaine",
    nameFr: "Rendez-vous de la semaine",
    category: "general",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.indigo,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "bible-study",
    nameEn: "Bible Study",
    nameFr: "Étude biblique",
    category: "general",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.forest,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "baptisms",
    nameEn: "Baptisms",
    nameFr: "Baptêmes",
    category: "events",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.indigo,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "event-coral-editorial",
    nameEn: "Event · Coral editorial",
    nameFr: "Événement · Éditorial corail",
    category: "events",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.coral,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "giving",
    nameEn: "Giving",
    nameFr: "Dons",
    category: "giving",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.yellow,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: false,
    allowTeamBackgroundChoice: false,
    fields: standardFields(COLOR_HEX.navy),
    allowedAssetSlugs: [],
  },
  {
    slug: "see-you-next-week",
    nameEn: "See you next week",
    nameFr: "À la semaine prochaine",
    category: "closing",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.navy,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: DEFAULT_TEMPLATE_SLUG,
    nameEn: "General announcement",
    nameFr: "Annonce générale",
    category: "general",
    status: "published",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.navy,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "condolences",
    nameEn: "Condolences",
    nameFr: "Condoléances",
    category: "special",
    status: "draft",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.navy,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: [],
  },
  {
    slug: "photo-announcement",
    nameEn: "Photo announcement",
    nameFr: "Annonce avec photo",
    category: "general",
    status: "draft",
    backgroundType: "image",
    backgroundValue: "photo-community-gathering",
    overlayColor: "black",
    overlayOpacity: 0.35,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: true,
    fields: standardFields("#ffffff"),
    allowedAssetSlugs: ["photo-community-gathering", "photo-worship-hands", "photo-baptism-pool", "bg-abstract-texture"],
  },
  {
    slug: "legacy-event",
    nameEn: "Legacy event",
    nameFr: "Événement (archivé)",
    category: "events",
    status: "archived",
    backgroundType: "color",
    backgroundValue: COLOR_HEX.cream,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: standardFields(COLOR_HEX.navy),
    allowedAssetSlugs: [],
  },
];

// ---------------------------------------------------------------------------
// Announcement mappings + suggestions
// ---------------------------------------------------------------------------

export interface MappingAliasSeed {
  alias: string;
  locale: Locale | null;
}

export interface MappingSeed {
  canonicalName: string;
  canonicalKey: string;
  templateSlug: string;
  aliases: MappingAliasSeed[];
}

export const MAPPING_SEEDS: MappingSeed[] = [
  {
    canonicalName: "Étude biblique",
    canonicalKey: "etude-biblique",
    templateSlug: "bible-study",
    aliases: [
      { alias: "Bible Study", locale: "en" },
      { alias: "Étude de la Bible", locale: "fr-CA" },
    ],
  },
  {
    canonicalName: "Dîmes et offrandes",
    canonicalKey: "dimes-et-offrandes",
    templateSlug: "giving",
    aliases: [
      { alias: "Giving", locale: "en" },
      { alias: "Tithes & Offerings", locale: "en" },
    ],
  },
  {
    canonicalName: "Baptêmes",
    canonicalKey: "baptemes",
    templateSlug: "baptisms",
    aliases: [
      { alias: "Baptisms", locale: "en" },
      { alias: "Baptême", locale: "fr-CA" },
    ],
  },
  {
    canonicalName: "Veillée des hommes",
    canonicalKey: "veillee-des-hommes",
    templateSlug: "event-coral-editorial",
    aliases: [
      { alias: "Men's prayer night", locale: "en" },
      { alias: "Veillée hommes", locale: "fr-CA" },
    ],
  },
  {
    canonicalName: "Prière matinale des femmes",
    canonicalKey: "priere-matinale-des-femmes",
    templateSlug: "event-coral-editorial",
    aliases: [{ alias: "Women's morning prayer", locale: "en" }],
  },
  {
    canonicalName: "Culte d'adoration",
    canonicalKey: "culte-d-adoration",
    templateSlug: "rendez-vous",
    aliases: [
      { alias: "Sunday worship", locale: "en" },
      { alias: "Worship service", locale: "en" },
    ],
  },
];

/** Unmapped announcements seen in run sheets — surfaced as review suggestions. */
export const MAPPING_SUGGESTION_SEEDS: string[] = ["Changements de classes", "Conférence EAJC"];

// ---------------------------------------------------------------------------
// Default structural slides
// ---------------------------------------------------------------------------

export interface StructuralDefaultSeed {
  nameEn: string;
  nameFr: string;
  templateSlug: string;
  insertionRule: StructuralInsertionRule;
  defaultSortZone: StructuralSortZone;
  sortOrder: number;
  removableBySundayTeam: boolean;
  includeInVideoDefault: boolean;
  defaultContent: SlideContent;
}

export const STRUCTURAL_DEFAULT_SEEDS: StructuralDefaultSeed[] = [
  {
    nameEn: "Welcome",
    nameFr: "Bienvenue",
    templateSlug: "welcome",
    insertionRule: "always",
    defaultSortZone: "opening",
    sortOrder: 0,
    removableBySundayTeam: false,
    includeInVideoDefault: true,
    defaultContent: { headline: "BIENVENUE", line1: CHURCH_NAME },
  },
  {
    nameEn: "Annual theme",
    nameFr: "Thème annuel",
    templateSlug: "annual-theme",
    insertionRule: "default",
    defaultSortZone: "opening",
    sortOrder: 1,
    removableBySundayTeam: true,
    includeInVideoDefault: true,
    defaultContent: { headline: "JE SUIS AVEC VOUS" },
  },
  {
    nameEn: "Rendez-vous de la semaine",
    nameFr: "Rendez-vous de la semaine",
    templateSlug: "rendez-vous",
    insertionRule: "default",
    defaultSortZone: "before_announcements",
    sortOrder: 0,
    removableBySundayTeam: true,
    includeInVideoDefault: true,
    defaultContent: { headline: "RENDEZ-VOUS DE LA SEMAINE" },
  },
  {
    nameEn: "See you next week",
    nameFr: "À la semaine prochaine",
    templateSlug: "see-you-next-week",
    insertionRule: "always",
    defaultSortZone: "closing",
    sortOrder: 0,
    removableBySundayTeam: false,
    includeInVideoDefault: true,
    defaultContent: { headline: "À LA SEMAINE PROCHAINE" },
  },
];

// ---------------------------------------------------------------------------
// Sundays: run sheets + slides
// ---------------------------------------------------------------------------

export interface RunSheetSeed {
  sourceType: RunSheetSourceType;
  originalFilename: string;
  mimeType: string;
  r2Key: string;
  extractedText?: string | null;
  parseStatus: RunSheetParseStatus;
  parsedJson?: ParsedRunSheet | null;
  /** Minutes ago (from "now") the run sheet was received. */
  receivedMinutesAgo: number;
  processed?: boolean;
}

export interface SlideSeed {
  templateSlug: string;
  headline: string;
  content: SlideContent;
  backgroundMode: SlideBackgroundMode;
  assetSlug?: string | null;
  approvedColorName?: string | null;
  sortOrder: number;
  includeInVideo?: boolean;
  status?: SlideStatus;
  isStructural?: boolean;
  structuralDefaultNameEn?: string | null;
  parserConfidence?: number | null;
  mappingCanonicalKey?: string | null;
  sourceAnnouncement?: ParsedAnnouncement | null;
}

export interface SundaySeed {
  serviceDate: string;
  status: SundayStatus;
  defaultSlideHoldSeconds?: number;
  runSheet?: RunSheetSeed | null;
  slides: SlideSeed[];
}

function announcement(
  order: number,
  sourceText: string,
  overrides: Partial<ParsedAnnouncement>,
): ParsedAnnouncement {
  return {
    sourceOrder: order,
    sourceText,
    canonicalKey: null,
    category: "general",
    headline: "",
    line1: null,
    line2: null,
    suggestedMappingId: null,
    suggestedTemplateId: null,
    confidence: 0.9,
    reviewReasons: [],
    ...overrides,
  };
}

const sep06Announcements: ParsedAnnouncement[] = [
  announcement(1, "Étude biblique : mercredi, de 19h00 à 20h00.", {
    canonicalKey: "etude-biblique",
    category: "general",
    headline: "ÉTUDE BIBLIQUE",
    line1: "Mercredi",
    line2: "19h00 à 20h00",
    confidence: 0.98,
  }),
  announcement(2, "Baptêmes le dimanche 13 septembre. Inscription à l'accueil.", {
    canonicalKey: "baptemes",
    category: "events",
    headline: "BAPTÊMES",
    line1: "Dimanche 13 septembre",
    line2: "Inscription à l'accueil",
    confidence: 0.95,
  }),
  announcement(3, "Veillée des hommes, vendredi 11 septembre de 21h00 à 23h00.", {
    canonicalKey: "veillee-des-hommes",
    category: "events",
    headline: "VEILLÉE DES HOMMES",
    line1: "Vendredi 11 septembre",
    line2: "21h00–23h00",
    confidence: 0.62,
    reviewReasons: ["template_uncertain"],
  }),
  announcement(4, "Prière matinale des femmes, samedi 12 septembre à 7h00.", {
    canonicalKey: "priere-matinale-des-femmes",
    category: "events",
    headline: "PRIÈRE MATINALE DES FEMMES",
    line1: "Samedi 12 septembre",
    line2: "7h00",
    confidence: 0.93,
  }),
  announcement(5, "Conférence EAJC — plus de détails à venir.", {
    canonicalKey: null,
    category: "special",
    headline: "CONFÉRENCE EAJC",
    line1: "Plus de détails à venir",
    line2: null,
    suggestedMappingId: null,
    suggestedTemplateId: null,
    confidence: 0.7,
    reviewReasons: ["unmapped_announcement"],
  }),
  announcement(6, "Merci à tous nos bénévoles pour leur engagement cette saison.", {
    category: "general",
    headline: "MERCI À NOS BÉNÉVOLES",
    confidence: 0.85,
  }),
  announcement(7, "Café communautaire après le service, au sous-sol.", {
    category: "general",
    headline: "CAFÉ COMMUNAUTAIRE",
    line1: "Après le service",
    confidence: 0.88,
  }),
];

export const SUNDAY_SEEDS: SundaySeed[] = [
  {
    serviceDate: "2026-09-06",
    status: "needs_review",
    runSheet: {
      sourceType: "email",
      originalFilename: "260906.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      r2Key: "run-sheets/2026-09-06/260906.docx",
      parseStatus: "added_to_flow",
      receivedMinutesAgo: 45,
      processed: true,
      parsedJson: {
        serviceDate: "2026-09-06",
        documentLanguage: "fr",
        sections: [{ title: "Annonces de la semaine", announcements: sep06Announcements }],
      },
    },
    slides: [
      {
        templateSlug: "welcome",
        headline: "BIENVENUE",
        content: { headline: "BIENVENUE", line1: CHURCH_NAME },
        backgroundMode: "color",
        sortOrder: 0,
        isStructural: true,
        structuralDefaultNameEn: "Welcome",
      },
      {
        templateSlug: "annual-theme",
        headline: "JE SUIS AVEC VOUS",
        content: { headline: "JE SUIS AVEC VOUS" },
        backgroundMode: "image",
        assetSlug: "bg-mountain-sunrise",
        sortOrder: 1,
        isStructural: true,
        structuralDefaultNameEn: "Annual theme",
      },
      {
        templateSlug: "rendez-vous",
        headline: "RENDEZ-VOUS DE LA SEMAINE",
        content: { headline: "RENDEZ-VOUS DE LA SEMAINE" },
        backgroundMode: "color",
        sortOrder: 2,
        isStructural: true,
        structuralDefaultNameEn: "Rendez-vous de la semaine",
      },
      {
        templateSlug: "bible-study",
        headline: "ÉTUDE BIBLIQUE",
        content: { headline: "ÉTUDE BIBLIQUE", line1: "Mercredi", line2: "19h00 à 20h00" },
        backgroundMode: "color",
        sortOrder: 3,
        mappingCanonicalKey: "etude-biblique",
        parserConfidence: 0.98,
        sourceAnnouncement: sep06Announcements[0],
      },
      {
        templateSlug: "baptisms",
        headline: "BAPTÊMES",
        content: {
          headline: "BAPTÊMES",
          line1: "Dimanche 13 septembre",
          line2: "Inscription à l'accueil",
        },
        backgroundMode: "color",
        sortOrder: 4,
        mappingCanonicalKey: "baptemes",
        parserConfidence: 0.95,
        sourceAnnouncement: sep06Announcements[1],
      },
      {
        templateSlug: "event-coral-editorial",
        headline: "VEILLÉE DES HOMMES",
        content: {
          headline: "VEILLÉE DES HOMMES",
          line1: "Vendredi 11 septembre",
          line2: "21h00–23h00",
        },
        backgroundMode: "color",
        sortOrder: 5,
        status: "needs_review",
        mappingCanonicalKey: "veillee-des-hommes",
        parserConfidence: 0.62,
        sourceAnnouncement: sep06Announcements[2],
      },
      {
        templateSlug: "event-coral-editorial",
        headline: "PRIÈRE MATINALE DES FEMMES",
        content: {
          headline: "PRIÈRE MATINALE DES FEMMES",
          line1: "Samedi 12 septembre",
          line2: "7h00",
        },
        backgroundMode: "color",
        sortOrder: 6,
        mappingCanonicalKey: "priere-matinale-des-femmes",
        parserConfidence: 0.93,
        sourceAnnouncement: sep06Announcements[3],
      },
      {
        templateSlug: "see-you-next-week",
        headline: "À LA SEMAINE PROCHAINE",
        content: { headline: "À LA SEMAINE PROCHAINE" },
        backgroundMode: "color",
        sortOrder: 7,
        isStructural: true,
        structuralDefaultNameEn: "See you next week",
      },
    ],
  },
  {
    serviceDate: "2026-08-30",
    status: "exported",
    runSheet: {
      sourceType: "email",
      originalFilename: "260830.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      r2Key: "run-sheets/2026-08-30/260830.docx",
      parseStatus: "added_to_flow",
      receivedMinutesAgo: 60 * 24 * 7,
      processed: true,
      parsedJson: {
        serviceDate: "2026-08-30",
        documentLanguage: "fr",
        sections: [{ title: "Annonces de la semaine", announcements: [] }],
      },
    },
    slides: [
      {
        templateSlug: "welcome",
        headline: "BIENVENUE",
        content: { headline: "BIENVENUE", line1: CHURCH_NAME },
        backgroundMode: "color",
        sortOrder: 0,
        isStructural: true,
        structuralDefaultNameEn: "Welcome",
      },
      {
        templateSlug: "annual-theme",
        headline: "JE SUIS AVEC VOUS",
        content: { headline: "JE SUIS AVEC VOUS" },
        backgroundMode: "image",
        assetSlug: "bg-mountain-sunrise",
        sortOrder: 1,
        isStructural: true,
        structuralDefaultNameEn: "Annual theme",
      },
      {
        templateSlug: "rendez-vous",
        headline: "RENDEZ-VOUS DE LA SEMAINE",
        content: { headline: "RENDEZ-VOUS DE LA SEMAINE" },
        backgroundMode: "color",
        sortOrder: 2,
        isStructural: true,
        structuralDefaultNameEn: "Rendez-vous de la semaine",
      },
      {
        templateSlug: "bible-study",
        headline: "ÉTUDE BIBLIQUE",
        content: { headline: "ÉTUDE BIBLIQUE", line1: "Mercredi", line2: "19h00 à 20h00" },
        backgroundMode: "color",
        sortOrder: 3,
        mappingCanonicalKey: "etude-biblique",
        parserConfidence: 0.97,
      },
      {
        templateSlug: "giving",
        headline: "DÎMES ET OFFRANDES",
        content: { headline: "DÎMES ET OFFRANDES", line1: "Merci pour votre fidélité" },
        backgroundMode: "color",
        sortOrder: 4,
        includeInVideo: false,
        mappingCanonicalKey: "dimes-et-offrandes",
        parserConfidence: 0.96,
      },
      {
        templateSlug: "event-coral-editorial",
        headline: "PRIÈRE MATINALE DES FEMMES",
        content: { headline: "PRIÈRE MATINALE DES FEMMES", line1: "Samedi", line2: "7h00" },
        backgroundMode: "color",
        sortOrder: 5,
        mappingCanonicalKey: "priere-matinale-des-femmes",
        parserConfidence: 0.9,
      },
      {
        templateSlug: DEFAULT_TEMPLATE_SLUG,
        headline: "RENTRÉE DES MINISTÈRES",
        content: { headline: "RENTRÉE DES MINISTÈRES", line1: "Dimanche prochain" },
        backgroundMode: "color",
        sortOrder: 6,
        parserConfidence: 0.8,
      },
      {
        templateSlug: DEFAULT_TEMPLATE_SLUG,
        headline: "PROGRAMME JEUNESSE",
        content: { headline: "PROGRAMME JEUNESSE", line1: "Vendredi 19h00" },
        backgroundMode: "color",
        sortOrder: 7,
        parserConfidence: 0.82,
      },
      {
        templateSlug: "see-you-next-week",
        headline: "À LA SEMAINE PROCHAINE",
        content: { headline: "À LA SEMAINE PROCHAINE" },
        backgroundMode: "color",
        sortOrder: 8,
        isStructural: true,
        structuralDefaultNameEn: "See you next week",
      },
    ],
  },
  {
    serviceDate: "2026-08-23",
    status: "exported",
    runSheet: {
      sourceType: "manual",
      originalFilename: "260823.pdf",
      mimeType: "application/pdf",
      r2Key: "run-sheets/2026-08-23/260823.pdf",
      parseStatus: "added_to_flow",
      receivedMinutesAgo: 60 * 24 * 14,
      processed: true,
      parsedJson: {
        serviceDate: "2026-08-23",
        documentLanguage: "fr",
        sections: [{ title: "Annonces de la semaine", announcements: [] }],
      },
    },
    slides: [
      {
        templateSlug: "welcome",
        headline: "BIENVENUE",
        content: { headline: "BIENVENUE", line1: CHURCH_NAME },
        backgroundMode: "color",
        sortOrder: 0,
        isStructural: true,
        structuralDefaultNameEn: "Welcome",
      },
      {
        templateSlug: "rendez-vous",
        headline: "RENDEZ-VOUS DE LA SEMAINE",
        content: { headline: "RENDEZ-VOUS DE LA SEMAINE" },
        backgroundMode: "color",
        sortOrder: 1,
        isStructural: true,
        structuralDefaultNameEn: "Rendez-vous de la semaine",
      },
      {
        templateSlug: "bible-study",
        headline: "ÉTUDE BIBLIQUE",
        content: { headline: "ÉTUDE BIBLIQUE", line1: "En pause cette semaine" },
        backgroundMode: "color",
        sortOrder: 2,
        mappingCanonicalKey: "etude-biblique",
        parserConfidence: 0.9,
      },
      {
        templateSlug: "baptisms",
        headline: "BAPTÊMES",
        content: { headline: "BAPTÊMES", line1: "Dimanche 23 août" },
        backgroundMode: "color",
        sortOrder: 3,
        mappingCanonicalKey: "baptemes",
        parserConfidence: 0.94,
      },
      {
        templateSlug: DEFAULT_TEMPLATE_SLUG,
        headline: "ÉCOLE DU DIMANCHE",
        content: { headline: "ÉCOLE DU DIMANCHE", line1: "Reprise le 6 septembre" },
        backgroundMode: "color",
        sortOrder: 4,
        parserConfidence: 0.78,
      },
      {
        templateSlug: DEFAULT_TEMPLATE_SLUG,
        headline: "COLLECTE DE VÊTEMENTS",
        content: { headline: "COLLECTE DE VÊTEMENTS", line1: "Jusqu'au 30 août" },
        backgroundMode: "color",
        sortOrder: 5,
        parserConfidence: 0.81,
      },
      {
        templateSlug: "see-you-next-week",
        headline: "À LA SEMAINE PROCHAINE",
        content: { headline: "À LA SEMAINE PROCHAINE" },
        backgroundMode: "color",
        sortOrder: 6,
        isStructural: true,
        structuralDefaultNameEn: "See you next week",
      },
    ],
  },
  {
    serviceDate: "2026-08-16",
    status: "draft",
    runSheet: null,
    slides: [
      {
        templateSlug: "welcome",
        headline: "BIENVENUE",
        content: { headline: "BIENVENUE", line1: CHURCH_NAME },
        backgroundMode: "color",
        sortOrder: 0,
        isStructural: true,
        structuralDefaultNameEn: "Welcome",
      },
      {
        templateSlug: "annual-theme",
        headline: "JE SUIS AVEC VOUS",
        content: { headline: "JE SUIS AVEC VOUS" },
        backgroundMode: "image",
        assetSlug: "bg-mountain-sunrise",
        sortOrder: 1,
        isStructural: true,
        structuralDefaultNameEn: "Annual theme",
      },
      {
        templateSlug: "rendez-vous",
        headline: "RENDEZ-VOUS DE LA SEMAINE",
        content: { headline: "RENDEZ-VOUS DE LA SEMAINE" },
        backgroundMode: "color",
        sortOrder: 2,
        isStructural: true,
        structuralDefaultNameEn: "Rendez-vous de la semaine",
      },
      {
        templateSlug: "see-you-next-week",
        headline: "À LA SEMAINE PROCHAINE",
        content: { headline: "À LA SEMAINE PROCHAINE" },
        backgroundMode: "color",
        sortOrder: 3,
        isStructural: true,
        structuralDefaultNameEn: "See you next week",
      },
    ],
  },
];
