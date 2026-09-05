/**
 * Bundles src/lib/renderer/engine.entry.ts into a self-contained IIFE and writes it to
 * src/lib/renderer/engine.bundle.generated.ts as an exported string. The server renderer
 * injects that string into the headless page. Runs before every `next build` (see the
 * `build` script) and is asserted fresh by tests/unit/renderer/engineBundle.test.ts.
 */
import { buildEngineBundle, writeEngineBundle } from "../src/lib/renderer/engineBundle";

async function main() {
  const code = await buildEngineBundle();
  const out = await writeEngineBundle(code);
  console.log(`engine bundle written: ${out} (${code.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
