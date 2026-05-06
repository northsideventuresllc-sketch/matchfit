import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { createTrainerBookingInvite } from "@/lib/trainer-client-booking-service";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
  sessionDelivery: z.enum(["IN_PERSON", "VIRTUAL"]).default("IN_PERSON"),
});

type Ctx = { params: Promise<{ clientUsername: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (await isTrainerClientInteractionRestricted(trainerId, client.id)) {
      return NextResponse.json({ error: "Messaging is restricted for this thread." }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);

    const res = await createTrainerBookingInvite({
      trainerId,
      clientId: client.id,
      startsAt,
      endsAt,
      note: parsed.data.note,
      sessionDelivery: parsed.data.sessionDelivery,
    });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, bookingId: res.bookingId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send invite." }, { status: 500 });
  }
}
