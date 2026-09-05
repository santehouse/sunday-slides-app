import "server-only";

/**
 * Filesystem-backed `ObjectStore` used whenever R2 isn't configured (`CP_MOCK_DATA=1`,
 * or missing `R2_*` env vars) so exports, run-sheet uploads, and asset/font storage keep
 * working end-to-end in mock mode. Files live under `.data/r2/<key>` — see `.gitignore`.
 *
 * "Signed" URLs here are `file://` URIs: good enough for local Node consumers (scripts,
 * tests) that read the path directly, but NOT something to hand to a browser — wiring up
 * a small dev-only serving route is a follow-up if mock mode ever needs that.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ObjectStore } from "./types";

const ROOT = path.join(process.cwd(), ".data", "r2");

function resolvePath(key: string): string {
  // Keys are our own (templates/x.jpg, exports/jpg/...); strip any accidental `..`
  // traversal defensively before joining onto the store root.
  const safe = key
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .join("/");
  return path.join(ROOT, safe);
}

function contentTypeSidecar(filePath: string): string {
  return `${filePath}.contenttype`;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export const localObjectStore: ObjectStore = {
  async putObject(key, body, contentType) {
    const filePath = resolvePath(key);
    await ensureParentDir(filePath);
    await fs.writeFile(filePath, body);
    await fs.writeFile(contentTypeSidecar(filePath), contentType, "utf8");
  },

  async getObject(key) {
    const filePath = resolvePath(key);
    const buf = await fs.readFile(filePath);
    return new Uint8Array(buf);
  },

  async deleteObject(key) {
    const filePath = resolvePath(key);
    await fs.rm(filePath, { force: true });
    await fs.rm(contentTypeSidecar(filePath), { force: true });
  },

  async getSignedReadUrl(key) {
    return `file://${resolvePath(key)}`;
  },

  async getSignedUploadUrl(key) {
    return `file://${resolvePath(key)}`;
  },
};
