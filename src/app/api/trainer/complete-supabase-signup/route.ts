import { BetaCapExceededError, completeTrainerSupabaseSignup } from "@/lib/complete-trainer-supabase-signup";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Validates Supabase email confirmation and signup fields, then routes to terms
 * (Match Fit trainer row is created when the Fitness Pro agreement is accepted).
 */
export async function POST(req: Request) {
  try {
    const parsed = trainerSignupSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid registration.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const result = await completeTrainerSupabaseSignup(parsed.data, { createAccount: false });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }

    return NextResponse.json({ ok: true, next: result.next });
  } catch (e) {
    if (e instanceof BetaCapExceededError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Registration failed. Please try again.", {
      logLabel: "[Match Fit trainer complete-supabase-signup]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
