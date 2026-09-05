// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildEngineBundle, renderGeneratedModule } from "@/lib/renderer/engineBundle";

describe("engine bundle", () => {
  it("engine.bundle.generated.ts is up to date (run `pnpm engine:bundle` if this fails)", async () => {
    const expected = renderGeneratedModule(await buildEngineBundle());
    const actual = readFileSync(path.resolve(process.cwd(), "src/lib/renderer/engine.bundle.generated.ts"), "utf8");
    expect(actual).toBe(expected);
  }, 30_000);

  it("exposes every function the headless page calls", async () => {
    const code = await buildEngineBundle();
    for (const name of ["computeSlideLayout", "ensureFontsLoaded", "createCanvasMeasurer"]) {
      expect(code).toContain(name);
    }
  }, 30_000);
});
