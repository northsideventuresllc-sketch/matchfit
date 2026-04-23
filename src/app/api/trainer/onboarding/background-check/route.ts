import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { mockInitiateTrainerBackgroundCheck } from "@/lib/trainer-onboarding-mocks";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  devPassword: z.string(),
  /// Skeleton flag: pretend the trainer paid the background check fee (optional for mocks).
  mockBackgroundFeePaid: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !verifyTrainerOnboardingDevPassword(parsed.data.devPassword)) {
      return NextResponse.json({ error: "Incorrect development password." }, { status: 403 });
    }
    const { mockBackgroundFeePaid } = parsed.data;

    const vendor = await mockInitiateTrainerBackgroundCheck({ trainerId });

    await prisma.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        hasPaidBackgroundFee: mockBackgroundFeePaid,
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
      },
      update: {
        hasPaidBackgroundFee: mockBackgroundFeePaid,
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
      },
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({
      ok: true,
      mockVendor: vendor,
      backgroundCheckStatus: "APPROVED" as const,
      message: "Background screening marked APPROVED for this test profile.",
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start background check.", {
      logLabel: "[Match Fit trainer background check]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
