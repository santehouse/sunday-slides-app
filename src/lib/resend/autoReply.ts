import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";
import { extractEmailAddress } from "@/lib/engines/senderAllowlist";
import { routing } from "@/i18n/routing";

/**
 * Courtesy reply to an allowed sender whose email could not be turned into a run sheet
 * (no usable attachment, or too many). Bilingual (every UI locale, French first), plain
 * text, and never sent to automated senders — a bounce loop is worse than silence.
 */

export type InboundRejectionReason = "unsupported" | "ambiguous";

export interface InboundRejectionReplyInput {
  /** Raw `From` header of the inbound email (display name allowed). */
  to: string;
  /** Subject of the inbound email, quoted back so the sender knows which one. */
  originalSubject: string;
  /** RFC 5322 Message-ID of the inbound email, for threading. */
  messageId?: string | null;
  reason: InboundRejectionReason;
  /** How many .docx/.pdf candidates there were, for the "ambiguous" wording. */
  candidateCount?: number;
  churchName: string;
  inboundEmail: string | null;
}

const AUTOMATED_LOCAL_PARTS = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|bounces|notifications?)([+.-]|@|$)/i;

/** False for addresses that will never read a reply (and might answer with another bounce). */
export function isAutomatedSender(from: string, ...ownAddresses: Array<string | null | undefined>): boolean {
  const address = extractEmailAddress(from);
  if (!address.includes("@")) return true;
  if (AUTOMATED_LOCAL_PARTS.test(address)) return true;
  return ownAddresses.some((own) => own && extractEmailAddress(own) === address);
}

/** Lists the reply's subject and body, French first, then every other UI locale. */
export async function composeInboundRejectionReply(
  input: Pick<InboundRejectionReplyInput, "originalSubject" | "reason" | "candidateCount" | "churchName" | "inboundEmail">,
): Promise<{ subject: string; text: string }> {
  const locales = [...routing.locales].sort((a, b) => (a === "fr-CA" ? -1 : b === "fr-CA" ? 1 : 0));
  const subjects: string[] = [];
  const sections: string[] = [];

  for (const locale of locales) {
    const t = await getTranslations({ locale, namespace: "emails.inboundRejected" });
    const values = {
      churchName: input.churchName,
      inboundEmail: input.inboundEmail ?? "",
      count: input.candidateCount ?? 0,
    };
    subjects.push(t("subject", values));
    sections.push(
      [
        t("greeting"),
        "",
        t("intro", values),
        t(input.reason === "ambiguous" ? "ambiguous" : "unsupported", values),
        "",
        t("nextStep", values),
        "",
        t("signoff", values),
      ].join("\n"),
    );
  }

  const subject = `${subjects.join(" · ")} — Re: ${input.originalSubject}`.trim();
  return { subject, text: sections.join("\n\n———\n\n") };
}

export type AutoReplyOutcome = "sent" | "skipped_not_configured" | "skipped_automated_sender";

/** Sends the courtesy reply through Resend. Never throws — the webhook must still answer 200. */
export async function sendInboundRejectionReply(input: InboundRejectionReplyInput): Promise<AutoReplyOutcome> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    console.warn("resend/autoReply: RESEND_API_KEY / RESEND_FROM_EMAIL not set — not replying");
    return "skipped_not_configured";
  }
  if (isAutomatedSender(input.to, env.RESEND_FROM_EMAIL, input.inboundEmail)) {
    return "skipped_automated_sender";
  }

  const { subject, text } = await composeInboundRejectionReply(input);
  const headers: Record<string, string> = { "Auto-Submitted": "auto-replied" };
  if (input.messageId) {
    headers["In-Reply-To"] = input.messageId;
    headers["References"] = input.messageId;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: extractEmailAddress(input.to),
    ...(input.inboundEmail ? { replyTo: input.inboundEmail } : {}),
    subject,
    text,
    headers,
  });
  if (error) {
    throw new Error(`Resend emails.send failed: ${error.message}`);
  }
  return "sent";
}
