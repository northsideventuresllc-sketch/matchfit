import { NextResponse } from "next/server";
import { trainerRequestReviewRemoval } from "@/lib/client-trainer-reviews";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reviewId: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { reviewId } = await ctx.params;
    if (!reviewId?.trim()) {
      return NextResponse.json({ error: "Invalid review." }, { status: 400 });
    }
    const result = await trainerRequestReviewRemoval({ trainerId, reviewId: reviewId.trim() });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not send request.", {
      logLabel: "[trainer/reviews/request-removal POST]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
