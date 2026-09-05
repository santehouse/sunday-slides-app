import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSundaySession } from "@/lib/auth/sunday-session";
import { getAdminSession } from "@/lib/auth/admin-session";
import { runExport, type ExportBlocked } from "@/lib/sunday/exports";

/**
 * JPG/MP4 export (section 8 of BUILD_HANDOFF.md). Headless Chromium + ffmpeg can take a
 * few seconds, hence the generous `maxDuration` (matches `/api/render/preview`).
 */
export const runtime = "nodejs";
export const maxDuration = 300;

const exportRequestSchema = z.object({
  sundayId: z.string().min(1),
  format: z.enum(["jpg", "mp4"]),
  scope: z.enum(["current", "all", "custom"]),
  slideNumbers: z.array(z.number().int()).optional(),
  currentSlideId: z.string().optional(),
});

/** RFC 5987 `filename*=UTF-8''...` — safe for any headline-derived filename, accents included. */
function contentDispositionHeader(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
  return `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encoded}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const [sundaySession, adminSession] = await Promise.all([getSundaySession(), getAdminSession()]);
  if (!sundaySession && !adminSession) {
    return NextResponse.json({ error: "unauthorized" } satisfies ExportBlocked | { error: string }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await runExport(parsed.data);
    if (!result.ok) {
      return NextResponse.json(result satisfies ExportBlocked, { status: 422 });
    }

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": contentDispositionHeader(result.filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("api/export: unexpected failure", err);
    return NextResponse.json(
      { ok: false, error: "render_failed", message: err instanceof Error ? err.message : String(err) } satisfies ExportBlocked,
      { status: 500 },
    );
  }
}
