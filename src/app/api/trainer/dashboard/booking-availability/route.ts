import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { defaultTrainerBookingAvailability, trainerBookingAvailabilitySchema } from "@/lib/booking-availability";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { bookingAvailabilityJson: true, bookingTimezone: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "No profile." }, { status: 404 });
    }
    let document = defaultTrainerBookingAvailability();
    if (profile.bookingAvailabilityJson?.trim()) {
      try {
        const parsed = trainerBookingAvailabilitySchema.safeParse(JSON.parse(profile.bookingAvailabilityJson) as unknown);
        if (parsed.success) document = parsed.data;
      } catch {
        /* keep default */
      }
    }
    return NextResponse.json({
      timezone: profile.bookingTimezone,
      document,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load availability." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { profile: { select: { dashboardActivatedAt: true, hasSignedTOS: true, hasUploadedW9: true, backgroundCheckStatus: true, backgroundCheckClearedAt: true, onboardingTrackCpt: true, onboardingTrackNutrition: true, onboardingTrackSpecialist: true, certificationReviewStatus: true, nutritionistCertificationReviewStatus: true, specialistCertificationReviewStatus: true } } },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const json = await req.json().catch(() => null) as {
      document?: unknown;
      timezone?: string;
    } | null;
    if (!json?.document) {
      return NextResponse.json({ error: "document required." }, { status: 400 });
    }
    const parsed = trainerBookingAvailabilitySchema.safeParse(json.document);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid availability document." }, { status: 400 });
    }
    const tz = typeof json.timezone === "string" && json.timezone.trim().length > 2 ? json.timezone.trim().slice(0, 64) : undefined;

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        bookingAvailabilityJson: JSON.stringify(parsed.data),
        ...(tz ? { bookingTimezone: tz } : {}),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save availability." }, { status: 500 });
  }
}
