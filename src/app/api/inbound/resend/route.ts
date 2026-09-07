import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { getDb } from "@/lib/data";
import { env, isProduction } from "@/lib/env";
import { ingestRunSheet } from "@/lib/sunday/intake";
import {
  pickRunSheetAttachment,
  resolveTargetSundayDate,
  sanitizeFilename,
  verifyResendWebhook,
  type InboundAttachment,
} from "@/lib/resend/inbound";

/**
 * Resend inbound-email webhook (sections 16/32 of BUILD_HANDOFF.md). Always answers 200
 * quickly (Resend retries on non-2xx) — genuine problems are recorded as a
 * `system_checks` row rather than surfaced as an HTTP error, except an unverifiable
 * signature, which really is a request we should refuse.
 */
export const runtime = "nodejs";

interface RawInboundAttachment {
  id: string;
  filename: string | null;
  content_type: string;
  content_disposition?: string | null;
  /** Some payloads inline small attachments as base64 — fetched from the API when absent. */
  content?: string;
}

interface EmailReceivedData {
  email_id: string;
  subject?: string;
  text?: string;
  created_at?: string;
  attachments?: RawInboundAttachment[];
}

function collectSvixHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const key of ["svix-id", "svix-timestamp", "svix-signature"]) {
    const value = request.headers.get(key);
    if (value) headers[key] = value;
  }
  return headers;
}

/** Fetches an attachment's bytes — inline base64 when present, else via the Resend API. */
async function fetchAttachmentBytes(emailId: string, attachment: RawInboundAttachment): Promise<Uint8Array> {
  if (attachment.content) {
    return new Uint8Array(Buffer.from(attachment.content, "base64"));
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured — cannot fetch inbound attachment content");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.receiving.attachments.get({ emailId, id: attachment.id });
  if (error || !data) {
    throw new Error(`Resend attachments.get failed: ${error?.message ?? "no data returned"}`);
  }

  const res = await fetch(data.download_url);
  if (!res.ok) {
    throw new Error(`Failed to download inbound attachment from Resend: HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  let payload: unknown;
  if (env.RESEND_INBOUND_WEBHOOK_SECRET) {
    try {
      payload = verifyResendWebhook(rawBody, collectSvixHeaders(request), env.RESEND_INBOUND_WEBHOOK_SECRET);
    } catch (err) {
      console.error("api/inbound/resend: webhook signature verification failed", err);
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
  } else if (isProduction()) {
    console.error("api/inbound/resend: RESEND_INBOUND_WEBHOOK_SECRET is not set — refusing in production");
    return NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 401 });
  } else {
    console.warn("api/inbound/resend: RESEND_INBOUND_WEBHOOK_SECRET is not set — accepting UNVERIFIED (dev only)");
    try {
      payload = rawBody === "" ? undefined : JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }
  }

  const event = payload as { type?: string; data?: EmailReceivedData } | undefined;
  if (!event?.type || event.type !== "email.received" || !event.data) {
    // Some other Resend event (delivered, bounced, ...) — nothing for us to do.
    return NextResponse.json({ ok: true });
  }

  const data = event.data;
  const db = getDb();

  const existing = await db.findRunSheetByInboundEventId(data.email_id);
  if (existing) {
    return NextResponse.json({ ok: true, runSheetId: existing.id });
  }

  const attachmentsMeta = data.attachments ?? [];
  const pickCandidates: InboundAttachment[] = attachmentsMeta.map((a) => ({
    filename: a.filename ?? "attachment",
    contentType: a.content_type,
    size: 0,
  }));
  const picked = pickRunSheetAttachment(pickCandidates);

  if (!picked.ok) {
    if (picked.ambiguous) {
      await db.recordSystemCheck("inbound_ambiguous", "warn", {
        emailId: data.email_id,
        candidates: picked.candidates.map((c) => c.filename),
      });
    } else {
      await db.recordSystemCheck("inbound_unsupported", "warn", { emailId: data.email_id, attachmentCount: attachmentsMeta.length });
    }
    return NextResponse.json({ ok: true });
  }

  const chosenIndex = pickCandidates.indexOf(picked.attachment);
  const chosenMeta = attachmentsMeta[chosenIndex];

  let bytes: Uint8Array;
  try {
    bytes = await fetchAttachmentBytes(data.email_id, chosenMeta);
  } catch (err) {
    console.error("api/inbound/resend: failed to fetch attachment content", err);
    await db.recordSystemCheck("inbound_attachment_fetch_failed", "error", {
      emailId: data.email_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true });
  }

  const settings = await db.getSettings();
  const targetDate = resolveTargetSundayDate(
    data.subject ?? "",
    data.text ?? "",
    data.created_at ?? new Date().toISOString(),
    settings.timezone,
  );
  const filename = sanitizeFilename(picked.attachment.filename);

  // Store the attachment and create the run sheet with parseStatus "queued" only — no
  // extraction/parse, no auto-apply. A Sunday Team member parses it on demand from the
  // Import modal's "Received files" list ("Use this file") — the single-screen IA always
  // reviews before applying, so there is no "quiet auto-apply" path any more.
  const runSheet = await ingestRunSheet({
    bytes,
    filename,
    mimeType: chosenMeta.content_type,
    sourceType: "email",
    sundayDate: targetDate,
    inboundEventId: data.email_id,
    parse: false,
  });

  return NextResponse.json({ ok: true, runSheetId: runSheet.id });
}
