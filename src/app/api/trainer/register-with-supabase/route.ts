import { createServerClient } from "@supabase/ssr";
import { applyTrainerSessionToNextResponse } from "@/lib/session";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { isTrainerEmailBlockedFromRegistration } from "@/lib/trainer-background-check-deny";
import { isTrainerEmailTaken, isTrainerUsernameTaken } from "@/lib/trainer-queries";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Completes Match Fit trainer registration after Supabase email confirmation.
 * Requires `Authorization: Bearer <supabase_access_token>` where the token email matches the signup payload.
 */
export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anon) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    }

    const auth = req.headers.get("authorization")?.trim();
    const accessToken = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Missing Supabase session token." }, { status: 401 });
    }

    const supabaseAuth = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabaseAuth.auth.getUser(accessToken);
    if (userErr || !user?.email) {
      return NextResponse.json({ error: "Invalid or expired Supabase session." }, { status: 401 });
    }

    const supabaseEmail = user.email.trim().toLowerCase();

    const parsed = trainerSignupSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid registration.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const body = parsed.data;
    const email = body.email.trim().toLowerCase();
    if (email !== supabaseEmail) {
      return NextResponse.json({ error: "Email must match your verified Supabase sign-in." }, { status: 403 });
    }

    const username = body.username.trim();
    if (await isTrainerUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isTrainerEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    if (await isTrainerEmailBlockedFromRegistration(email)) {
      return NextResponse.json(
        {
          error:
            "This email cannot register a new trainer account. Contact support@match-fit.net if you believe this is an error.",
        },
        { status: 403 },
      );
    }

    const { id: trainerId, email: createdEmail } = await createTrainerRecord(body);

    const res = NextResponse.json({ ok: true, next: "/trainer/onboarding" });
    await applyTrainerSessionToNextResponse(res, trainerId, body.stayLoggedIn);
    void sendTrainerWelcomeEmail({
      to: createdEmail,
      firstName: body.firstName,
      trainerId,
    }).catch((err) => console.error("[trainer register-with-supabase] welcome email failed:", err));
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Registration failed. Please try again.", {
      logLabel: "[Match Fit trainer register-with-supabase]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
