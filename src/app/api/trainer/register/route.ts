import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { applyTrainerSessionToNextResponse } from "@/lib/session";
import { isTrainerEmailTaken, isTrainerUsernameTaken } from "@/lib/trainer-queries";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const parsed = trainerSignupSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid registration.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;
    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();

    if (await isTrainerUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isTrainerEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);

    const trainer = await prisma.trainer.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        username,
        phone: body.phone.trim(),
        email,
        passwordHash,
        termsAcceptedAt: new Date(),
        profile: {
          create: {
            backgroundCheckStatus: "NOT_STARTED",
            certificationReviewStatus: "NOT_STARTED",
            nutritionistCertificationReviewStatus: "NOT_STARTED",
            backgroundCheckReviewStatus: "NOT_STARTED",
            onboardingTrackCpt: false,
            onboardingTrackNutrition: false,
          },
        },
      },
      select: { id: true },
    });

    const res = NextResponse.json({ ok: true, next: "/trainer/onboarding" });
    await applyTrainerSessionToNextResponse(res, trainer.id, body.stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Registration failed. Please try again.", {
      logLabel: "[Match Fit trainer register]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
