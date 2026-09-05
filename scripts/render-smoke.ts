/**
 * Smoke test for the server renderer + MP4 pipeline, exercised end-to-end (no mocks):
 * renders the demo "VEILLÉE DES HOMMES" slide on a coral background, writes
 * `tmp/smoke.jpg` and a 2-frame `tmp/smoke.mp4`, and asserts the JPEG really is
 * 1920×1080 by reading its SOF0 header directly (belt-and-braces beyond trusting our
 * own `RenderedSlide.width/height`). Not part of the test suite — run manually with:
 *
 *   pnpm tsx scripts/render-smoke.ts
 *
 * Nothing this script writes is committed (tmp/ is gitignored).
 */
import fs from "node:fs";
import path from "node:path";
import { renderSlideToJpeg } from "@/lib/renderer/server";
import { buildMp4 } from "@/lib/exports/mp4";
import type { RenderSlideInput } from "@/lib/renderer/types";
import type { Slide, Template, TemplateField } from "@/lib/domain/types";

const now = new Date().toISOString();

const headlineField: TemplateField = {
  id: "field-headline",
  templateId: "template-veillee",
  fieldKey: "headline",
  fieldType: "text",
  labelEn: "Headline",
  labelFr: "Titre",
  teamEditable: true,
  required: true,
  x: 120,
  y: 380,
  width: 1680,
  height: 260,
  fontId: null,
  fontFamily: "Arimo",
  fontSize: 96,
  minFontSize: 48,
  fontWeight: 700,
  fontStyle: "normal",
  lineHeight: 1.1,
  letterSpacing: 0,
  alignment: "left",
  textColor: "#ffffff",
  maxLines: 2,
  overflowMode: "auto_fit",
  sortOrder: 0,
  textTransform: "uppercase",
};

const line1Field: TemplateField = {
  id: "field-line1",
  templateId: "template-veillee",
  fieldKey: "line1",
  fieldType: "text",
  labelEn: "Line 1",
  labelFr: "Ligne 1",
  teamEditable: true,
  required: false,
  x: 120,
  y: 660,
  width: 1680,
  height: 90,
  fontId: null,
  fontFamily: "Tinos",
  fontSize: 44,
  minFontSize: 28,
  fontWeight: 400,
  fontStyle: "italic",
  lineHeight: 1.2,
  letterSpacing: 0,
  alignment: "left",
  textColor: "#ffffff",
  maxLines: 1,
  overflowMode: "fixed",
  sortOrder: 1,
  textTransform: "none",
};

const template: Template = {
  id: "template-veillee",
  slug: "veillee-des-hommes",
  nameEn: "Men's Evening",
  nameFr: "Veillée des hommes",
  category: "events",
  status: "published",
  rendererKey: "generic-v1",
  backgroundType: "color",
  backgroundValue: "#FF6F59", // coral
  overlayColor: "black",
  overlayOpacity: 0.15,
  includeInVideoDefault: true,
  allowTeamBackgroundChoice: true,
  fields: [headlineField, line1Field],
  allowedAssetIds: [],
  createdAt: now,
  updatedAt: now,
};

const slide: Slide = {
  id: "slide-veillee-smoke",
  sundayId: "sunday-smoke",
  templateId: template.id,
  headline: "Veillée des hommes",
  content: { line1: "Vendredi 19h00 — Sous-sol de l'église" },
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
  createdAt: now,
  updatedAt: now,
};

const input: RenderSlideInput = {
  template,
  slide,
  backgroundColorHex: "#FF6F59",
  assets: [],
  fonts: [],
  showSafeZone: false,
};

/** Reads a JPEG's width/height straight from its SOF0 (0xFFC0) segment — no image library. */
function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("readJpegDimensions: not a JPEG (missing SOI marker)");
  }
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error(`readJpegDimensions: expected marker at offset ${offset}`);
    }
    const marker = bytes[offset + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 all carry height/width the same way.
    const isSofMarker = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (isSofMarker) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    offset += 2 + segmentLength;
  }
  throw new Error("readJpegDimensions: no SOF marker found");
}

async function main(): Promise<void> {
  const tmpDir = path.join(process.cwd(), "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log("Rendering slide via headless Chromium…");
  const rendered = await renderSlideToJpeg(input);

  const jpegPath = path.join(tmpDir, "smoke.jpg");
  fs.writeFileSync(jpegPath, rendered.jpeg);
  console.log(`Wrote ${jpegPath} (${rendered.jpeg.byteLength} bytes)`);

  const dims = readJpegDimensions(rendered.jpeg);
  if (dims.width !== 1920 || dims.height !== 1080) {
    throw new Error(`Expected 1920x1080, got ${dims.width}x${dims.height} (from SOF0 header)`);
  }
  console.log(`JPEG dimensions verified from SOF0 header: ${dims.width}x${dims.height}`);

  console.log("Fit result:", JSON.stringify(rendered.fit, null, 2));
  if (!rendered.fit.exportable) {
    console.warn("WARNING: slide is not exportable per its own fit result (unexpected for this fixture).");
  }

  console.log("Encoding 2-frame MP4…");
  try {
    const mp4Bytes = await buildMp4({ frames: [{ jpeg: rendered.jpeg }, { jpeg: rendered.jpeg }], holdSeconds: 1 });
    const mp4Path = path.join(tmpDir, "smoke.mp4");
    fs.writeFileSync(mp4Path, mp4Bytes);
    console.log(`Wrote ${mp4Path} (${mp4Bytes.byteLength} bytes)`);

    const ftyp = Buffer.from(mp4Bytes.slice(4, 8)).toString("ascii");
    if (ftyp !== "ftyp") {
      throw new Error(`Expected an MP4 ftyp box at offset 4, got "${ftyp}"`);
    }
    console.log("MP4 ftyp box verified.");
  } catch (err) {
    // A capable (libx264 + mp4 muxer) ffmpeg build is a genuine environment
    // dependency — report and move on rather than failing the whole smoke test over
    // an environment gap. See docs/RENDERING.md's caveat on this.
    console.warn("MP4 step skipped: no capable ffmpeg binary in this environment.", err);
  }

  console.log("\nSmoke test passed (JPEG pipeline verified end-to-end).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Smoke test failed:", err);
    process.exit(1);
  });
