import { NextResponse, type NextRequest } from "next/server";
import { getSundaySession } from "@/lib/auth/sunday-session";
import { getAdminSession } from "@/lib/auth/admin-session";
import { getDb } from "@/lib/data";
import { getObjectStore } from "@/lib/r2/client";

export const runtime = "nodejs";

/**
 * Streams a run sheet's stored bytes for the Import modal's PDF preview `<iframe>` when
 * R2 isn't configured (mock/local mode has no usable signed URL) — `getSignedReadUrl` is
 * used directly instead when `hasR2()` is true (see `sunday/actions.ts`).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const [sundaySession, adminSession] = await Promise.all([getSundaySession(), getAdminSession()]);
  if (!sundaySession && !adminSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const runSheet = await db.getRunSheet(id);
  if (!runSheet) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const bytes = await getObjectStore().getObject(runSheet.r2Key);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": runSheet.mimeType || "application/pdf",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("api/run-sheets/[id]/file: failed to read stored file", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
