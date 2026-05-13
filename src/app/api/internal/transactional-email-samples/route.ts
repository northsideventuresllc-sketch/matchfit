import { formatTransactionalEmailSubject } from "@/lib/match-fit-email-shell";
import { RESEND_DEV_INBOX } from "@/lib/resend-client";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { buildTransactionalEmail, sampleContextForTransactionalEmail } from "@/lib/transactional-email-templates";
import { transactionalEmailKindSampleLabel, TRANSACTIONAL_EMAIL_KINDS } from "@/lib/transactional-email-kinds";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAllowed(req: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const secret = process.env.MATCHFIT_TRANSACTIONAL_EMAIL_SAMPLES_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  return bearer === secret;
}

/**
 * POST — sends one sample of each transactional template to the dev inbox (see RESEND_DEV_INBOX).
 * Local: no auth. Production: MATCHFIT_TRANSACTIONAL_EMAIL_SAMPLES_SECRET + Authorization: Bearer.
 */
export async function POST(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const to = RESEND_DEV_INBOX.trim();
  const sent: string[] = [];
  const errors: { kind: string; message: string }[] = [];

  for (const kind of TRANSACTIONAL_EMAIL_KINDS) {
    try {
      const ctx = sampleContextForTransactionalEmail(kind);
      const { subject, text, html } = buildTransactionalEmail(kind, ctx);
      await sendMatchFitBrandedEmail({
        to,
        subject: formatTransactionalEmailSubject(
          `[Sample] ${transactionalEmailKindSampleLabel(kind)} — ${subject}`,
        ),
        text: `Template kind: ${kind}\n\n${text}`,
        html,
      });
      sent.push(kind);
    } catch (e) {
      errors.push({ kind, message: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 260));
  }

  return NextResponse.json({
    ok: true,
    to,
    sentCount: sent.length,
    kinds: sent,
    errors: errors.length ? errors : undefined,
  });
}
