import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { trainerAgreementsSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerAgreementsSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.trainer.update({
        where: { id: trainerId },
        data: {
          termsAcceptedAt: now,
          privacyPolicyAcceptedAt: now,
        },
      }),
      prisma.trainerProfile.update({
        where: { trainerId },
        data: { hasSignedTOS: true, updatedAt: now },
      }),
    ]);

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        hasPaidRegistrationFee: true,
        limitedDashboardUnlockedAt: true,
      },
    });

    return NextResponse.json({ ok: true, next: resolveTrainerSignupNextPath(profile) });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your agreement.", {
      logLabel: "[Match Fit trainer signup terms]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
