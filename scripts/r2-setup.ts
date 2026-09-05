/**
 * One-off / re-runnable R2 bootstrap (section 29 of BUILD_HANDOFF.md): creates the
 * configured bucket if it doesn't exist yet and (re)applies the lifecycle rule that
 * expires the temporary prefixes (`run-sheets/`, `exports/jpg|zip|mp4/`, `tmp/`) after
 * `AppSettings.temporaryRetentionDays` (default 60). Safe to run repeatedly — idempotent.
 * No-ops (with a clear message) when R2 isn't configured.
 *
 *   pnpm tsx scripts/r2-setup.ts [retentionDays]
 */
import fs from "node:fs";
import path from "node:path";

loadDotEnvLocalIfPresent();

async function main(): Promise<void> {
  const { hasR2 } = await import("@/lib/env");
  if (!hasR2()) {
    console.log(
      "r2-setup: R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET) — " +
        "nothing to do. Mock mode's local object store (.data/r2/) needs no setup.",
    );
    return;
  }

  const { ensureBucketAndLifecycle } = await import("@/lib/r2/lifecycle");
  const { getBucketName } = await import("@/lib/r2/client");

  const retentionArg = process.argv[2];
  const retentionDays = retentionArg ? Number(retentionArg) : undefined;
  if (retentionArg && (!Number.isFinite(retentionDays) || (retentionDays as number) <= 0)) {
    console.error(`r2-setup: invalid retentionDays argument "${retentionArg}"`);
    process.exit(1);
  }

  console.log(`r2-setup: ensuring bucket "${getBucketName()}" exists and applying lifecycle rules...`);
  await ensureBucketAndLifecycle(retentionDays);
  console.log(
    `r2-setup: done. Temporary prefixes (run-sheets/, exports/jpg|zip|mp4/, tmp/) expire after ` +
      `${retentionDays ?? 60} day(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("r2-setup failed:", err);
    process.exit(1);
  });

/** Minimal .env.local loader — no dotenv dependency. Never overwrites an already-set var. */
function loadDotEnvLocalIfPresent(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
