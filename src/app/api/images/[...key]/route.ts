import { NextResponse, type NextRequest } from "next/server";
import { getSundaySession } from "@/lib/auth/sunday-session";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getObjectStore } from "@/lib/r2/client";
import { isSlideImageKey } from "@/lib/renderer/imageUrls";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Serves a Sunday-team-uploaded picture (an image-field value such as a conference
 * speaker photo) for browser previews. Only `slide-images/…` keys are ever served, and
 * only to a signed-in Sunday team or admin session; exports read the object store
 * directly and never go through here.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }): Promise<NextResponse> {
  const [sundaySession, adminSession] = await Promise.all([getSundaySession(), getAdminSession()]);
  if (!sundaySession && !adminSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { key: parts } = await params;
  const key = parts.join("/");
  if (!isSlideImageKey(key)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const bytes = await getObjectStore().getObject(key);
    const ext = key.split(".").pop()?.toLowerCase() ?? "jpg";
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "image/jpeg",
        // Keys are unique per upload, so the bytes never change for a given URL.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("api/images: failed to read stored picture", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
