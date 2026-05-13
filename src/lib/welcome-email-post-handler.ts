import { sendMatchFitWelcomeEmail } from "@/lib/match-fit-welcome-email";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(80).optional(),
});

/**
 * Shared POST handler: sends the transactional welcome email (Resend SDK).
 * Secured with `MATCHFIT_WELCOME_EMAIL_SECRET`: `Authorization: Bearer <secret>`.
 */
export async function welcomeEmailPostHandler(req: Request): Promise<Response> {
  try {
    const secret = process.env.MATCHFIT_WELCOME_EMAIL_SECRET?.trim();
    if (!secret || secret.length < 16) {
      return NextResponse.json({ error: "Welcome email route is not configured." }, { status: 503 });
    }
    const auth = req.headers.get("authorization")?.trim();
    const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    if (bearer !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body. Expected { email, firstName? }." }, { status: 400 });
    }

    await sendMatchFitWelcomeEmail({
      to: parsed.data.email,
      firstName: parsed.data.firstName,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not send welcome email.", {
      logLabel: "[Match Fit welcome email]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
