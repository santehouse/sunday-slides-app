import "server-only";

/**
 * R2 bucket bootstrap + lifecycle (section 29 of BUILD_HANDOFF.md). Permanent prefixes
 * (`templates/`, `assets/`, `fonts/`) are never auto-deleted; everything under
 * `run-sheets/`, `exports/jpg|zip|mp4/`, and `tmp/` expires after `temporaryRetentionDays`
 * (default 60 — `AppSettings.temporaryRetentionDays`). Prefer this over relying only on
 * application-level cleanup, per the handoff doc.
 */
import { CreateBucketCommand, HeadBucketCommand, PutBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { hasR2 } from "@/lib/env";
import { getBucketName, getRawS3Client } from "./client";

const DEFAULT_RETENTION_DAYS = 60;

const TEMPORARY_PREFIXES = ["run-sheets/", "exports/jpg/", "exports/zip/", "exports/mp4/", "tmp/"] as const;

async function bucketExists(client: S3Client, bucket: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates the R2 bucket if it doesn't exist, then (re)applies the lifecycle
 * configuration that expires the temporary prefixes. Safe to call repeatedly (e.g. from
 * the scheduled maintenance job — section 33) — it's idempotent. No-op when R2 isn't
 * configured: mock mode's `localObjectStore` never expires anything on its own.
 */
export async function ensureBucketAndLifecycle(temporaryRetentionDays: number = DEFAULT_RETENTION_DAYS): Promise<void> {
  if (!hasR2()) return;

  const client = getRawS3Client();
  const bucket = getBucketName();

  if (!(await bucketExists(client, bucket))) {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: TEMPORARY_PREFIXES.map((prefix, index) => ({
          ID: `church-panels-temporary-${index}`,
          Status: "Enabled",
          Filter: { Prefix: prefix },
          Expiration: { Days: temporaryRetentionDays },
        })),
      },
    }),
  );
}
