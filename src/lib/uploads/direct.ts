/**
 * Browser-side half of direct-to-storage uploads. Server Actions cap request bodies (4 MB
 * here, 4.5 MB on Vercel), so pictures never travel through a function: the server hands
 * out a short-lived signed PUT URL ("ticket") for the object store and the browser sends
 * the bytes straight there. Without an object store (local/mock without R2) the ticket
 * says "action" and callers fall back to the classic FormData Server Action.
 */
export type UploadTicket =
  | { mode: "direct"; url: string; key: string }
  | { mode: "action" }
  | { mode: "error"; error: "unsupported_file" | "file_too_large" };

export async function putFileDirect(url: string, file: File): Promise<void> {
  const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!res.ok) throw new Error(`direct upload failed: HTTP ${res.status}`);
}

/** Pixel size of an image file, decoded in the browser (no bytes sent anywhere). */
export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
