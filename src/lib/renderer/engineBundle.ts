/**
 * Build-time helper (Node only): compiles the pure layout engine + canvas measurer into one
 * IIFE string exposing `window.__engine`. Kept separate from server.ts so it never ends up in
 * the serverless bundle — server.ts imports the generated string instead.
 */
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const ENTRY = path.resolve(process.cwd(), "src/lib/renderer/engine.entry.ts");
const OUT = path.resolve(process.cwd(), "src/lib/renderer/engine.bundle.generated.ts");

export async function buildEngineBundle(): Promise<string> {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__engine",
    target: ["chrome110"],
    minify: false,
    legalComments: "none",
    logLevel: "silent",
  });
  const code = result.outputFiles[0]?.text;
  if (!code) throw new Error("engine bundle: esbuild produced no output");
  return `${code}\nwindow.__engine = __engine;\n`;
}

export function renderGeneratedModule(code: string): string {
  return [
    "// GENERATED FILE — do not edit. Regenerate with `pnpm engine:bundle`.",
    "// Self-contained layout engine injected into the headless render page (see server.ts).",
    `export const ENGINE_BUNDLE = ${JSON.stringify(code)};`,
    "",
  ].join("\n");
}

export async function writeEngineBundle(code: string): Promise<string> {
  await writeFile(OUT, renderGeneratedModule(code), "utf8");
  return OUT;
}
