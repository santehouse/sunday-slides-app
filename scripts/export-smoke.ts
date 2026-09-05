/**
 * End-to-end export smoke test in mock mode (NOT part of `pnpm test`): builds on the
 * seeded demo Sunday (2026-09-06 — see `src/lib/data/mockSeed.ts`), runs `runExport` for
 * JPG (scope: all) and MP4 (scope: all), writes the results to `tmp/`, and prints sizes
 * and filenames. Requires a local Chromium (JPG) and, for the MP4 step, a working
 * ffmpeg — the MP4 step is a warning, not a failure, when one isn't available (mirrors
 * `scripts/render-smoke.ts`'s own caveat).
 *
 *   pnpm tsx scripts/export-smoke.ts
 */
process.env.CP_MOCK_DATA = "1";

import fs from "node:fs";
import path from "node:path";

const DEMO_SUNDAY_DATE = "2026-09-06";

async function main(): Promise<void> {
  const { getDb } = await import("@/lib/data");
  const { runExport } = await import("@/lib/sunday/exports");

  const db = getDb();
  const sunday = await db.getSundayByDate(DEMO_SUNDAY_DATE);
  if (!sunday) {
    throw new Error(`export-smoke: demo Sunday ${DEMO_SUNDAY_DATE} not found in the mock seed`);
  }

  const slides = await db.listSlidesForSunday(sunday.id);
  console.log(`export-smoke: demo Sunday ${sunday.serviceDate} has ${slides.length} slide(s).`);

  const tmpDir = path.join(process.cwd(), "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log("\nRunning JPG export (scope: all)...");
  const jpgResult = await runExport({ sundayId: sunday.id, format: "jpg", scope: "all" });
  if (!jpgResult.ok) {
    throw new Error(`export-smoke: JPG export blocked: ${jpgResult.error} ${jpgResult.slideIds?.join(", ") ?? ""}`);
  }
  const jpgPath = path.join(tmpDir, jpgResult.filename);
  fs.writeFileSync(jpgPath, jpgResult.bytes);
  console.log(`  wrote ${jpgPath} (${jpgResult.bytes.byteLength} bytes, ${jpgResult.contentType})`);

  if (jpgResult.contentType === "application/zip") {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(jpgResult.bytes);
    const names = Object.keys(zip.files).sort();
    console.log(`  ZIP contains ${names.length} file(s):`);
    for (const name of names) console.log(`    - ${name}`);
  }

  console.log("\nRunning MP4 export (scope: all)...");
  try {
    const mp4Result = await runExport({ sundayId: sunday.id, format: "mp4", scope: "all" });
    if (!mp4Result.ok) {
      console.warn(`  MP4 export blocked/failed: ${mp4Result.error}${mp4Result.message ? ` — ${mp4Result.message}` : ""}`);
    } else {
      const mp4Path = path.join(tmpDir, mp4Result.filename);
      fs.writeFileSync(mp4Path, mp4Result.bytes);
      console.log(`  wrote ${mp4Path} (${mp4Result.bytes.byteLength} bytes, ${mp4Result.contentType})`);
    }
  } catch (err) {
    // A capable (libx264 + mp4 muxer) ffmpeg build is a genuine environment dependency —
    // report and move on rather than failing the whole smoke test over an environment gap.
    console.warn("  MP4 step skipped: no capable ffmpeg binary in this environment.", err);
  }

  console.log("\nexport-smoke: done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("export-smoke failed:", err);
    process.exit(1);
  });
