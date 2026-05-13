import {
  MVP_WELCOME_TEST_RECIPIENT,
  sendMatchFitWelcomeMvpPreviewEmail,
} from "@/lib/match-fit-welcome-mvp-preview-email";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isSendWelcomeAllowed(req: Request): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const secret = process.env.MATCHFIT_SEND_WELCOME_PREVIEW_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return false;
  }
  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  return bearer === secret;
}

/**
 * POST — sends a branded welcome email from support@match-fit.net (Resend).
 * Recipient is the configured internal inbox. Local: no auth. Production: set MATCHFIT_SEND_WELCOME_PREVIEW_SECRET and send Authorization: Bearer &lt;secret&gt;.
 */
export async function POST(req: Request) {
  try {
    if (!isSendWelcomeAllowed(req)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await sendMatchFitWelcomeMvpPreviewEmail();

    return NextResponse.json({
      ok: true,
      to: MVP_WELCOME_TEST_RECIPIENT,
      message: "Welcome email sent.",
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not send welcome email.", {
      logLabel: "[Match Fit send-welcome]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
