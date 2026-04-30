import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

type OptionalQuestionnaireAnswer = {
  key: string;
  title: string;
  summary: string;
  disclaimer: string;
  completedAtIso: string;
};

type Ctx = { params: Promise<{ key: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { key } = await ctx.params;
    const normalized = decodeURIComponent(key).trim().toLowerCase();
    if (!normalized || normalized === "match-me") {
      return NextResponse.json({ error: "The Onboarding Questionnaire cannot be deleted." }, { status: 400 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { id: true, followUpQuestionnaireAnswersJson: true },
    });
    if (!profile?.id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    let parsed: OptionalQuestionnaireAnswer[] = [];
    if (profile.followUpQuestionnaireAnswersJson?.trim()) {
      try {
        const raw = JSON.parse(profile.followUpQuestionnaireAnswersJson) as unknown;
        if (Array.isArray(raw)) {
          parsed = raw
            .map((x) => (typeof x === "object" && x ? (x as OptionalQuestionnaireAnswer) : null))
            .filter((x): x is OptionalQuestionnaireAnswer => Boolean(x && typeof x.key === "string"));
        }
      } catch {
        parsed = [];
      }
    }

    const next = parsed.filter((item) => item.key.toLowerCase() !== normalized);
    const changed = next.length !== parsed.length;
    if (!changed) {
      return NextResponse.json({ ok: true, removed: false });
    }

    await prisma.trainerProfile.update({
      where: { id: profile.id },
      data: {
        followUpQuestionnaireAnswersJson: next.length ? JSON.stringify(next) : null,
      },
    });

    return NextResponse.json({ ok: true, removed: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete questionnaire answers." }, { status: 500 });
  }
}
