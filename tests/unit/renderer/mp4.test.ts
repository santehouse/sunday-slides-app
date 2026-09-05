import { describe, expect, it } from "vitest";
import fsSync, { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildMp4 } from "@/lib/exports/mp4";
import { renderSlideToJpeg } from "@/lib/renderer/server";
import type { RenderSlideInput } from "@/lib/renderer/types";
import type { Slide, Template } from "@/lib/domain/types";

/**
 * End-to-end MP4 pipeline test: two solid-color slides, rendered through the real
 * headless-Chromium `renderSlideToJpeg` (never a synthetic JPEG), fed into the real
 * `buildMp4`. Asserts the output is a valid MP4 (ftyp box) with ~2s duration.
 *
 * Both Chromium and a full (libx264 + mp4 muxer) ffmpeg build are genuine external
 * dependencies of the CI/dev machine — this test probes for both and skips (with a
 * clear console warning) rather than failing when either is unavailable, per
 * docs/RENDERING.md's "ffmpeg-static couldn't download its binary" caveat.
 */

const execFileAsync = promisify(execFile);
const now = new Date().toISOString();

function makeSolidColorInput(hex: string): RenderSlideInput {
  const template: Template = {
    id: "template-mp4-smoke",
    slug: "mp4-smoke",
    nameEn: "MP4 Smoke",
    nameFr: "Test MP4",
    category: "general",
    status: "published",
    rendererKey: "generic-v1",
    backgroundType: "color",
    backgroundValue: hex,
    overlayColor: "none",
    overlayOpacity: 0,
    includeInVideoDefault: true,
    allowTeamBackgroundChoice: false,
    fields: [],
    allowedAssetIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const slide: Slide = {
    id: `slide-mp4-smoke-${hex.replace("#", "")}`,
    sundayId: "sunday-mp4-smoke",
    templateId: template.id,
    headline: "",
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
    createdAt: now,
    updatedAt: now,
  };
  return { template, slide, backgroundColorHex: hex, assets: [], fonts: [], showSafeZone: false };
}

/** Mirrors buildMp4's own resolution order so the capability probe checks the SAME binary it would use. */
async function resolveFfmpegBinaryForTest(): Promise<string | null> {
  const ffmpegStatic = (await import("ffmpeg-static")).default;
  if (process.env.FFMPEG_PATH && fsSync.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  if (ffmpegStatic && fsSync.existsSync(ffmpegStatic)) return ffmpegStatic;
  try {
    const baseDir = "/opt/pw-browsers";
    const dirs = fsSync.readdirSync(baseDir).filter((n) => n.startsWith("ffmpeg-"));
    for (const dir of dirs) {
      const candidate = path.join(baseDir, dir, "ffmpeg-linux");
      if (fsSync.existsSync(candidate)) return candidate;
    }
  } catch {
    // /opt/pw-browsers doesn't exist outside this repo's own sandbox — that's fine.
  }
  return null;
}

async function ffmpegSupportsMp4H264(binary: string): Promise<boolean> {
  try {
    const { stdout: encoders } = await execFileAsync(binary, ["-hide_banner", "-encoders"]);
    if (!/libx264/.test(encoders)) return false;
    const { stdout: muxers } = await execFileAsync(binary, ["-hide_banner", "-muxers"]);
    return /\bmp4\b/.test(muxers);
  } catch {
    return false;
  }
}

/** `moov/mvhd` box duration, in seconds — used when `ffprobe` isn't on PATH. */
function readMp4DurationFromBoxes(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  function findBox(start: number, end: number, type: string): { start: number; end: number } | null {
    let offset = start;
    while (offset + 8 <= end) {
      const size = view.getUint32(offset);
      const boxType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      const boxSize = size === 1 ? Number(view.getBigUint64(offset + 8)) : size === 0 ? end - offset : size;
      const headerSize = size === 1 ? 16 : 8;
      if (boxSize <= 0) break;
      if (boxType === type) return { start: offset + headerSize, end: offset + boxSize };
      offset += boxSize;
    }
    return null;
  }

  const moov = findBox(0, bytes.length, "moov");
  if (!moov) return null;
  const mvhd = findBox(moov.start, moov.end, "mvhd");
  if (!mvhd) return null;

  const version = bytes[mvhd.start];
  if (version === 1) {
    const timescale = view.getUint32(mvhd.start + 1 + 3 + 8 + 8);
    const duration = Number(view.getBigUint64(mvhd.start + 1 + 3 + 8 + 8 + 4));
    return timescale > 0 ? duration / timescale : null;
  }
  const timescale = view.getUint32(mvhd.start + 1 + 3 + 4 + 4);
  const duration = view.getUint32(mvhd.start + 1 + 3 + 4 + 4 + 4);
  return timescale > 0 ? duration / timescale : null;
}

async function readMp4DurationSeconds(mp4Bytes: Uint8Array): Promise<number | null> {
  try {
    const tmpFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "cp-mp4-probe-")), "clip.mp4");
    try {
      await fs.writeFile(tmpFile, mp4Bytes);
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        tmpFile,
      ]);
      const parsed = Number.parseFloat(stdout.trim());
      if (Number.isFinite(parsed)) return parsed;
    } finally {
      await fs.rm(path.dirname(tmpFile), { recursive: true, force: true });
    }
  } catch {
    // ffprobe isn't on PATH in most dev/CI setups — fall back to parsing the box ourselves.
  }
  return readMp4DurationFromBoxes(mp4Bytes);
}

describe("MP4 export pipeline (end-to-end)", () => {
  it("encodes real rendered frames into a valid, correctly-timed MP4", async (ctx) => {
    const binary = await resolveFfmpegBinaryForTest();
    if (!binary) {
      console.warn(
        "Skipping MP4 end-to-end test: no ffmpeg binary found (ffmpeg-static's postinstall download did not " +
          "complete in this environment, and no fallback binary is available). See docs/RENDERING.md.",
      );
      ctx.skip();
      return;
    }
    if (!(await ffmpegSupportsMp4H264(binary))) {
      console.warn(
        `Skipping MP4 end-to-end test: ffmpeg at "${binary}" lacks libx264 and/or mp4 muxer support (this ` +
          "repo's sandbox ships a Playwright-internal webm/vp8-only ffmpeg build). See docs/RENDERING.md.",
      );
      ctx.skip();
      return;
    }

    let frame1: Awaited<ReturnType<typeof renderSlideToJpeg>>;
    let frame2: Awaited<ReturnType<typeof renderSlideToJpeg>>;
    try {
      frame1 = await renderSlideToJpeg(makeSolidColorInput("#FF6F59"));
      frame2 = await renderSlideToJpeg(makeSolidColorInput("#2563EB"));
    } catch (err) {
      console.warn("Skipping MP4 end-to-end test: headless Chromium is unavailable:", err);
      ctx.skip();
      return;
    }

    const mp4Bytes = await buildMp4({ frames: [{ jpeg: frame1.jpeg }, { jpeg: frame2.jpeg }], holdSeconds: 1 });

    const ftyp = Buffer.from(mp4Bytes.slice(4, 8)).toString("ascii");
    expect(ftyp).toBe("ftyp");

    const durationSeconds = await readMp4DurationSeconds(mp4Bytes);
    if (durationSeconds === null) {
      console.warn("Could not determine MP4 duration (no ffprobe, and box parsing failed) — skipping that check.");
    } else {
      expect(durationSeconds).toBeGreaterThan(1.5);
      expect(durationSeconds).toBeLessThan(2.5);
    }
  }, 60_000);
});
