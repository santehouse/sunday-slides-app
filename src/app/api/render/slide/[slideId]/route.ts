import { NextResponse, type NextRequest } from "next/server";
import { getSundaySession } from "@/lib/auth/sunday-session";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getDb } from "@/lib/data";
import { buildRenderInput } from "@/lib/sunday/render-input";
import { renderSlideToJpeg } from "@/lib/renderer/server";

/**
 * Server-rendered JPEG of one stored slide — debugging/preview parity with the real
 * export pipeline (`?safe=1` draws the broadcast safe-zone guide, section 13). Headless
 * Chromium needs the Node runtime and a generous timeout, same as `/api/render/preview`
 * and `/api/export`.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slideId: string }> },
): Promise<NextResponse> {
  const [sundaySession, adminSession] = await Promise.all([getSundaySession(), getAdminSession()]);
  if (!sundaySession && !adminSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slideId } = await params;
  const showSafeZone = request.nextUrl.searchParams.get("safe") === "1";

  const db = getDb();
  const slide = await db.getSlide(slideId);
  if (!slide) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const input = await buildRenderInput(slide, { showSafeZone });
    const rendered = await renderSlideToJpeg(input);
    return new NextResponse(Buffer.from(rendered.jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Slide-Fit-Exportable": String(rendered.fit.exportable),
      },
    });
  } catch (err) {
    console.error(`api/render/slide/${slideId}: failed to render slide`, err);
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
