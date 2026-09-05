import "server-only";

/**
 * MP4 export (section 10 of BUILD_HANDOFF.md): FFmpeg over the renderer's exact JPG
 * frames — never a second visual implementation. Hard cuts, no transitions: each frame
 * is simply held for `holdSeconds` and concatenated via ffmpeg's concat demuxer.
 */
import { execFile } from "node:child_process";
import fsSync, { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegStaticPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export class Mp4EncodeError extends Error {
  readonly stderr?: string;

  constructor(message: string, stderr?: string) {
    super(message);
    this.name = "Mp4EncodeError";
    this.stderr = stderr;
  }
}

function listFallbackDirs(baseDir: string, prefix: string): string[] {
  try {
    return fsSync
      .readdirSync(baseDir)
      .filter((name) => name.startsWith(prefix))
      .map((name) => path.join(baseDir, name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * `ffmpeg-static`'s postinstall download can fail in network-restricted environments
 * (this repo's own sandbox included) even though the package resolves a path — so we
 * verify the file actually exists, and fall back to a locally installed ffmpeg
 * (the `FFMPEG_PATH` env var, or an "ffmpeg-" prefixed directory under
 * /opt/pw-browsers containing an "ffmpeg-linux" binary, mirroring how
 * `renderer/server.ts` resolves a local Chromium) before giving up.
 */
function resolveFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fsSync.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  if (ffmpegStaticPath && fsSync.existsSync(ffmpegStaticPath)) {
    return ffmpegStaticPath;
  }
  const fallback = listFallbackDirs("/opt/pw-browsers", "ffmpeg-")
    .map((dir) => path.join(dir, "ffmpeg-linux"))
    .find((candidate) => fsSync.existsSync(candidate));
  if (fallback) return fallback;

  throw new Mp4EncodeError(
    "buildMp4: no ffmpeg binary found. ffmpeg-static did not download one for this platform, FFMPEG_PATH isn't " +
      "set, and none was found under /opt/pw-browsers.",
  );
}

export interface Mp4Frame {
  /** One rendered slide's JPEG bytes, in the exact order it should appear in the video. */
  jpeg: Uint8Array;
}

export interface BuildMp4Options {
  frames: Mp4Frame[];
  /** Seconds each frame is held on screen — the Sunday's default slide duration. */
  holdSeconds: number;
  fps?: number;
}

function buildConcatList(frameFileNames: string[], holdSeconds: number): string {
  const lines: string[] = [];
  for (const fileName of frameFileNames) {
    lines.push(`file '${fileName}'`);
    lines.push(`duration ${holdSeconds}`);
  }
  // ffmpeg concat-demuxer quirk: the duration on the LAST entry is ignored unless that
  // file is listed once more afterwards (with no duration of its own).
  lines.push(`file '${frameFileNames[frameFileNames.length - 1]}'`);
  return lines.join("\n");
}

/**
 * Encodes `frames` (already-rendered 1920×1080 JPEGs, in Sunday Flow order) into an
 * H.264 MP4 with `holdSeconds` per frame. Writes frames + a concat list to a temp
 * directory under `os.tmpdir()`, always cleaned up afterwards, success or failure.
 */
export async function buildMp4({ frames, holdSeconds, fps = 25 }: BuildMp4Options): Promise<Uint8Array> {
  if (frames.length === 0) {
    throw new Mp4EncodeError("buildMp4: at least one frame is required");
  }
  if (holdSeconds <= 0) {
    throw new Mp4EncodeError("buildMp4: holdSeconds must be positive");
  }
  const ffmpegPath = resolveFfmpegPath();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "church-panels-mp4-"));
  try {
    const frameFileNames: string[] = [];
    for (let i = 0; i < frames.length; i += 1) {
      const fileName = `frame_${String(i + 1).padStart(5, "0")}.jpg`;
      await fs.writeFile(path.join(tmpDir, fileName), frames[i].jpeg);
      frameFileNames.push(fileName);
    }

    const listPath = path.join(tmpDir, "frames.txt");
    await fs.writeFile(listPath, buildConcatList(frameFileNames, holdSeconds), "utf8");

    const outputPath = path.join(tmpDir, "output.mp4");
    await runFfmpeg(ffmpegPath, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      "scale=1920:1080",
      "-r",
      String(fps),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return new Uint8Array(await fs.readFile(outputPath));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function runFfmpeg(binary: string, args: string[]): Promise<void> {
  try {
    await execFileAsync(binary, args);
  } catch (err) {
    const stderr = isExecFileError(err) ? err.stderr : undefined;
    throw new Mp4EncodeError(`buildMp4: ffmpeg exited with an error${stderr ? ` — ${stderr}` : ""}`, stderr);
  }
}

function isExecFileError(err: unknown): err is { stderr?: string } {
  return typeof err === "object" && err !== null && "stderr" in err;
}
