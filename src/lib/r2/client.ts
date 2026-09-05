import "server-only";

/**
 * Cloudflare R2 access via the S3-compatible API (section 29 of BUILD_HANDOFF.md).
 * `getObjectStore()` picks the real R2 client when `hasR2()` is true, otherwise the
 * filesystem-backed `localObjectStore` — every consumer should go through the top-level
 * `putObject`/`getObject`/etc. functions here (or `getObjectStore()` directly) rather
 * than reaching for the S3 client itself, so mock mode keeps working unchanged.
 */
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, hasR2 } from "@/lib/env";
import { localObjectStore } from "./localStore";
import type { ObjectStore } from "./types";

export type { ObjectStore } from "./types";
export { localObjectStore } from "./localStore";

let cachedClient: S3Client | null = null;

function r2Endpoint(): string {
  return env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

/** The raw AWS SDK client — only `./lifecycle.ts` should need this directly. */
export function getRawS3Client(): S3Client {
  if (cachedClient) return cachedClient;
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("r2/client: R2 credentials are not configured (check hasR2() before calling this).");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint: r2Endpoint(),
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  return cachedClient;
}

export function getBucketName(): string {
  if (!env.R2_BUCKET) throw new Error("r2/client: R2_BUCKET is not configured.");
  return env.R2_BUCKET;
}

const r2Store: ObjectStore = {
  async putObject(key, body, contentType) {
    await getRawS3Client().send(
      new PutObjectCommand({ Bucket: getBucketName(), Key: key, Body: body, ContentType: contentType }),
    );
  },

  async getObject(key) {
    const res = await getRawS3Client().send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`r2/client: empty body for key "${key}"`);
    return bytes;
  },

  async deleteObject(key) {
    await getRawS3Client().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
  },

  async getSignedReadUrl(key, expiresSeconds = 3600) {
    return getSignedUrl(getRawS3Client(), new GetObjectCommand({ Bucket: getBucketName(), Key: key }), {
      expiresIn: expiresSeconds,
    });
  },

  async getSignedUploadUrl(key, contentType, expiresSeconds = 900) {
    return getSignedUrl(
      getRawS3Client(),
      new PutObjectCommand({ Bucket: getBucketName(), Key: key, ContentType: contentType }),
      { expiresIn: expiresSeconds },
    );
  },
};

/** Picks the real R2-backed store when `hasR2()`, otherwise the local filesystem fallback. */
export function getObjectStore(): ObjectStore {
  return hasR2() ? r2Store : localObjectStore;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  return getObjectStore().putObject(key, body, contentType);
}

export async function getObject(key: string): Promise<Uint8Array> {
  return getObjectStore().getObject(key);
}

export async function deleteObject(key: string): Promise<void> {
  return getObjectStore().deleteObject(key);
}

export async function getSignedReadUrl(key: string, expiresSeconds?: number): Promise<string> {
  return getObjectStore().getSignedReadUrl(key, expiresSeconds);
}

export async function getSignedUploadUrl(key: string, contentType: string, expiresSeconds?: number): Promise<string> {
  return getObjectStore().getSignedUploadUrl(key, contentType, expiresSeconds);
}

/** R2 key layout — section 29 of BUILD_HANDOFF.md ("permanent" vs. temporary-with-lifecycle prefixes). */
export const keys = {
  // Permanent — never auto-expired.
  templates: (id: string, ext: string) => `templates/${id}.${ext}`,
  assets: (id: string, ext: string) => `assets/${id}.${ext}`,
  fonts: (id: string, ext: string) => `fonts/${id}.${ext}`,

  // Temporary — expired by the R2 lifecycle rule in ./lifecycle.ts.
  runSheets: (sundayDate: string, id: string, ext: string) => `run-sheets/${sundayDate}/${id}.${ext}`,
  exportsJpg: (sundayDate: string, id: string, ext: string = "jpg") => `exports/jpg/${sundayDate}/${id}.${ext}`,
  exportsZip: (sundayDate: string, id: string, ext: string = "zip") => `exports/zip/${sundayDate}/${id}.${ext}`,
  exportsMp4: (sundayDate: string, id: string, ext: string = "mp4") => `exports/mp4/${sundayDate}/${id}.${ext}`,
  tmp: (id: string, ext: string) => `tmp/${id}.${ext}`,
};
