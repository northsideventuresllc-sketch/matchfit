import { BetaCapExceededError, completeTrainerSupabaseSignup } from "@/lib/complete-trainer-supabase-signup";
import { applyTrainerSessionToNextResponse } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * One-step trainer sign-up completion after Supabase Auth account exists.
 * Validates email/password server-side, creates the Match Fit trainer row, and
 * sets the trainer session cookie — no browser Supabase session required.
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

    const result = await completeTrainerSupabaseSignup(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }

    const res = NextResponse.json({ ok: true, next: result.next, trainerId: result.trainerId });
    await applyTrainerSessionToNextResponse(res, result.trainerId, parsed.data.stayLoggedIn);
    return res;
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
