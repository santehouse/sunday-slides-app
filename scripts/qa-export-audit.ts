/**
 * QA audit for the export pipeline (BUILD_HANDOFF sections 9/10/13/48).
 *
 * Run with:
 *   CP_MOCK_DATA=1 pnpm tsx --tsconfig scripts/tsconfig.json scripts/qa-export-audit.ts
 *
 * Verifies, against the mock demo Sunday:
 *  - JPG single + ZIP export (content type, filenames = index + headline slug)
 *  - MP4 export duration == (slides with includeInVideo) x defaultSlideHoldSeconds
 *  - the broadcast safe-zone overlay never reaches an exported JPEG
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { chromium } from "@playwright/test";
import { getDb } from "@/lib/data";
import { runExport } from "@/lib/sunday/exports";
import { buildRenderInput } from "@/lib/sunday/render-input";
import { renderSlidesToJpegs } from "@/lib/renderer/server";

const FFMPEG = "node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg";
const DEMO_DATE = "2026-09-06";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** MP4 duration in seconds, read from the `mvhd` box (no ffprobe dependency). */
function mp4DurationSeconds(bytes: Uint8Array): number {
  const buf = Buffer.from(bytes);
  const idx = buf.indexOf(Buffer.from("mvhd"));
  if (idx < 0) throw new Error("mvhd box not found");
  const version = buf.readUInt8(idx + 4);
  if (version === 1) {
    const timescale = buf.readUInt32BE(idx + 8 + 16);
    const duration = Number(buf.readBigUInt64BE(idx + 8 + 20));
    return duration / timescale;
  }
  const timescale = buf.readUInt32BE(idx + 8 + 8);
  const duration = buf.readUInt32BE(idx + 8 + 12);
  return duration / timescale;
}

/**
 * Samples the bottom-left region of a JPEG in a real browser canvas and reports the
 * most "indigo" pixel found. The safe-zone overlay is drawn in `--bg-primary`
 * (#4f46e5) plus a dashed outline and a "LIVE CAMERA SAFE ZONE" label; if any of it
 * survived into the export, that region contains blue-dominant pixels.
 */
async function maxIndigoInBottomLeft(jpeg: Uint8Array): Promise<{ found: boolean; sample: number[] }> {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  try {
    const page = await browser.newPage();
    const dataUri = `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
    return await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      // The global safe zone lives in the lower-left quadrant (1920x1080 space).
      const x = Math.round(canvas.width * 0.02);
      const y = Math.round(canvas.height * 0.5);
      const w = Math.round(canvas.width * 0.45);
      const h = Math.round(canvas.height * 0.45);
      const { data } = ctx.getImageData(x, y, w, h);
      let worst: number[] = [0, 0, 0];
      let found = false;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        // Indigo #4f46e5: blue clearly dominant over both red and green.
        if (b > 140 && b - r > 60 && b - g > 60) {
          found = true;
          if (b - r > worst[2]! - worst[0]!) worst = [r, g, b];
        }
      }
      return { found, sample: worst };
    }, dataUri);
  } finally {
    await browser.close();
  }
}

async function main() {
  const db = getDb();
  const sunday = await db.getSundayByDate(DEMO_DATE);
  if (!sunday) throw new Error(`demo Sunday ${DEMO_DATE} missing from the mock store`);
  const slides = (await db.listSlidesForSunday(sunday.id)).sort((a, b) => a.sortOrder - b.sortOrder);
  console.log(`Sunday ${DEMO_DATE}: ${slides.length} slides, hold ${sunday.defaultSlideHoldSeconds}s\n`);

  // --- JPG (single) -------------------------------------------------------------
  const single = await runExport({
    sundayId: sunday.id,
    format: "jpg",
    scope: "current",
    currentSlideId: slides[0]!.id,
  });
  check("JPG single export succeeds", single.ok, single.ok ? "" : JSON.stringify(single));
  if (single.ok) {
    check("JPG single content type", single.contentType === "image/jpeg", single.contentType);
    check("JPG filename is index + headline slug", /^01-[a-z0-9-]+\.jpg$/.test(single.filename), single.filename);
    check("JPG bytes are a real JPEG", single.bytes[0] === 0xff && single.bytes[1] === 0xd8);
  }

  // --- JPG (zip) ----------------------------------------------------------------
  const zipped = await runExport({ sundayId: sunday.id, format: "jpg", scope: "all" });
  check("JPG zip export succeeds", zipped.ok, zipped.ok ? "" : JSON.stringify(zipped));
  if (zipped.ok) {
    check("ZIP content type", zipped.contentType === "application/zip", zipped.contentType);
    const zip = await JSZip.loadAsync(Buffer.from(zipped.bytes));
    const names = Object.keys(zip.files).sort();
    check("ZIP holds one JPG per slide", names.length === slides.length, `${names.length} files`);
    check(
      "ZIP filenames are numbered in flow order",
      names.every((n, i) => n.startsWith(String(i + 1).padStart(2, "0") + "-")),
      names.join(", "),
    );
    check(
      "ZIP filenames are accent-normalised slugs",
      names.every((n) => /^\d\d-[a-z0-9-]+\.jpg$/.test(n)),
      names.join(", "),
    );
  }

  // --- MP4 -----------------------------------------------------------------------
  const included = slides.filter((s) => s.includeInVideo);
  const mp4 = await runExport({ sundayId: sunday.id, format: "mp4", scope: "all" });
  check("MP4 export succeeds", mp4.ok, mp4.ok ? "" : JSON.stringify(mp4));
  if (mp4.ok) {
    check("MP4 content type", mp4.contentType === "video/mp4", mp4.contentType);
    check("MP4 filename", mp4.filename === `${DEMO_DATE}-sunday-flow.mp4`, mp4.filename);

    const expected = included.length * sunday.defaultSlideHoldSeconds;
    const boxDuration = mp4DurationSeconds(mp4.bytes);
    check(
      `MP4 duration == ${included.length} included slides x ${sunday.defaultSlideHoldSeconds}s = ${expected}s`,
      Math.abs(boxDuration - expected) < 0.2,
      `mvhd reports ${boxDuration.toFixed(3)}s`,
    );

    const dir = mkdtempSync(join(tmpdir(), "cp-qa-"));
    const file = join(dir, "out.mp4");
    writeFileSync(file, Buffer.from(mp4.bytes));
    try {
      const probe = execFileSync(FFMPEG, ["-i", file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      console.log("      (ffmpeg -i produced no stderr?)", probe.slice(0, 80));
    } catch (err) {
      const stderr = String((err as { stderr?: Buffer }).stderr ?? "");
      const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
      if (m) {
        const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        check(
          `ffmpeg agrees on MP4 duration (${expected}s)`,
          Math.abs(secs - expected) < 0.35,
          `ffmpeg reports ${secs}s`,
        );
      } else {
        check("ffmpeg could read the MP4", false, stderr.split("\n").slice(-3).join(" "));
      }
      const res = /Video:.*?(\d{3,5})x(\d{3,5})/.exec(stderr);
      check("MP4 is 1920x1080", res?.[1] === "1920" && res?.[2] === "1080", res ? `${res[1]}x${res[2]}` : "unknown");
      check("MP4 video stream is H.264", /Video:\s*h264/.test(stderr), stderr.match(/Video:[^\n]*/)?.[0] ?? "");
    }
  }

  // --- Safe zone never exported ---------------------------------------------------
  const veillee = slides.find((s) => /veill/i.test(s.headline)) ?? slides[0]!;
  const [withOverlay] = await renderSlidesToJpegs([
    await buildRenderInput(veillee, { showSafeZone: true, safeZoneLabel: "LIVE CAMERA SAFE ZONE" }),
  ]);
  const [withoutOverlay] = await renderSlidesToJpegs([await buildRenderInput(veillee, { showSafeZone: false })]);

  const on = await maxIndigoInBottomLeft(withOverlay!.jpeg);
  const off = await maxIndigoInBottomLeft(withoutOverlay!.jpeg);
  check("control: the safe-zone overlay IS visible when requested", on.found, `sample rgb(${on.sample})`);
  check(
    "exported JPEG has no safe-zone overlay pixels (showSafeZone: false)",
    !off.found,
    off.found ? `found rgb(${off.sample})` : "no indigo in the bottom-left region",
  );

  // The export path must not even accept a "show safe zone" option.
  const exportSource = readFileSync("src/lib/sunday/exports.ts", "utf8");
  check(
    "runExport hardcodes showSafeZone: false",
    /buildRenderInput\(slide, \{ showSafeZone: false \}\)/.test(exportSource),
  );

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
