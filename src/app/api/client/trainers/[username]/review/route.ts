import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clientMayReviewTrainer,
  getActiveClientTrainerReview,
  softRemoveClientTrainerReview,
  upsertClientTrainerReviewForPair,
} from "@/lib/client-trainer-reviews";
import { firstZodErrorMessage } from "@/lib/validations/client-register";
import { clientTrainerReviewUpsertSchema } from "@/lib/validations/client-trainer-review";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ username: string }> };

async function resolveTrainer(usernameParam: string) {
  const handle = decodeURIComponent(usernameParam).trim();
  const trainer = await prisma.trainer.findUnique({
    where: { username: handle },
    select: {
      id: true,
      deidentifiedAt: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
          hasSignedTOS: true,
          hasUploadedW9: true,
          backgroundCheckStatus: true,
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
  if (!trainer?.profile || trainer.deidentifiedAt) return null;
  const published =
    trainer.profile.dashboardActivatedAt != null && isTrainerComplianceComplete(trainer.profile);
  if (!published) return null;
  return { id: trainer.id, username: handle };
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { username } = await ctx.params;
    const trainer = await resolveTrainer(username);
    if (!trainer) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (await isTrainerClientInteractionRestricted(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const eligible = await clientMayReviewTrainer(clientId, trainer.id);
    const review = await getActiveClientTrainerReview(clientId, trainer.id);
    return NextResponse.json({
      eligible,
      review: review
        ? {
            id: review.id,
            stars: review.stars,
            testimonialText: review.testimonialText,
            testimonialModeratedAt: review.testimonialModeratedAt?.toISOString() ?? null,
            trainerRemovalRequestedAt: review.trainerRemovalRequestedAt?.toISOString() ?? null,
            createdAt: review.createdAt.toISOString(),
            updatedAt: review.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load review.", {
      logLabel: "[client/trainers/review GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { username } = await ctx.params;
    const trainer = await resolveTrainer(username);
    if (!trainer) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (await isTrainerClientInteractionRestricted(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const json = await req.json();
    const parsed = clientTrainerReviewUpsertSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const result = await upsertClientTrainerReviewForPair({
      clientId,
      trainerId: trainer.id,
      stars: parsed.data.stars,
      testimonialRaw: parsed.data.testimonial ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save review.", {
      logLabel: "[client/trainers/review POST]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { username } = await ctx.params;
    const trainer = await resolveTrainer(username);
    if (!trainer) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    if (await isTrainerClientInteractionRestricted(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const result = await softRemoveClientTrainerReview({ clientId, trainerId: trainer.id });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not remove review.", {
      logLabel: "[client/trainers/review DELETE]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
