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
    });

    if (!result.ok) {
      const status =
        result.code === "EMAIL_ALREADY_CONFIRMED"
          ? 409
          : result.code === "SUPABASE_ADMIN_NOT_CONFIGURED" || result.code === "RESEND_NOT_CONFIGURED"
            ? 503
            : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
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
