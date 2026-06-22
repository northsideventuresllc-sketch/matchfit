import { sendSupabaseSignupVerificationEmail } from "@/lib/supabase-signup-verification-email";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["trainer", "client"]),
  firstName: z.string().trim().optional(),
  turnstileToken: z.string().optional(),
  /** Trainer-only: rescued server-side so sign-up survives a lost tab/device before ToS. */
  draft: z
    .object({
      lastName: z.string().trim().max(80).optional(),
      username: z.string().trim().max(32).optional(),
      phone: z.string().trim().max(32).optional(),
      serviceZipCode: z.string().trim().max(12).optional(),
      betaInviteToken: z.string().trim().max(200).optional(),
      agreedToTerms: z.boolean().optional(),
      stayLoggedIn: z.boolean().optional(),
    })
    .strict()
    .optional(),
});

/**
 * Delivers Supabase signup confirmation links through Resend (match-fit.net).
 * Used after trainer/client Supabase signUp and for "Resend verification email".
 */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const result = await sendSupabaseSignupVerificationEmail({
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
      firstName: parsed.data.firstName,
      draft:
        parsed.data.role === "trainer" && parsed.data.draft
          ? { firstName: parsed.data.firstName, ...parsed.data.draft }
          : undefined,
    });

    if (!result.ok) {
      const status =
        result.code === "EMAIL_ALREADY_CONFIRMED"
          ? 409
          : result.code === "EMAIL_RATE_LIMIT" || result.code === "RESEND_COOLDOWN"
            ? 429
            : result.code === "SUPABASE_ADMIN_NOT_CONFIGURED" || result.code === "RESEND_NOT_CONFIGURED"
              ? 503
              : 400;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          retryAfterSeconds: result.retryAfterSeconds ?? null,
        },
        { status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[resend-signup-verification]", e);
    return NextResponse.json(
      { error: "We could not send the verification email. Please try again.", code: "UNEXPECTED" },
      { status: 500 },
    );
  }
}
