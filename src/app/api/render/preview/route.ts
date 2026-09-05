import { NextResponse, type NextRequest } from "next/server";
import { renderSlideToJpeg } from "@/lib/renderer/server";
import type { RenderSlideInput } from "@/lib/renderer/types";

/**
 * Server-side JPEG preview of a single slide — used for template thumbnails, Add Slide
 * cards, and anywhere else a caller wants the exact export-quality render without going
 * through the full JPG/MP4 export pipeline. Headless Chromium needs the Node runtime and
 * can take a few seconds on a cold start, hence the generous `maxDuration` — see
 * docs/RENDERING.md.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

interface PreviewRequestBody {
  input?: RenderSlideInput;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: PreviewRequestBody;
  try {
    body = (await request.json()) as PreviewRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.input || typeof body.input !== "object") {
    return NextResponse.json({ error: 'Missing "input"' }, { status: 400 });
  }

  try {
    const rendered = await renderSlideToJpeg(body.input);
    return new NextResponse(Buffer.from(rendered.jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Slide-Fit-Exportable": String(rendered.fit.exportable),
      },
    });
  } catch (err) {
    console.error("api/render/preview: failed to render slide", err);
    return NextResponse.json({ error: "Failed to render slide" }, { status: 500 });
  }
}
