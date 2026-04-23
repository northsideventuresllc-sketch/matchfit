import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import {
  buildAiMatchProfileText,
  trainerMatchQuestionnaireSchema,
  type TrainerMatchQuestionnairePayload,
} from "@/lib/trainer-match-questionnaire";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        matchQuestionnaireStatus: true,
        matchQuestionnaireAnswers: true,
        matchQuestionnaireCompletedAt: true,
        aiMatchProfileText: true,
      },
    });

    let answers: unknown = null;
    const raw = profile?.matchQuestionnaireAnswers;
    if (raw) {
      try {
        answers = JSON.parse(raw) as unknown;
      } catch {
        answers = null;
      }
    }

    return NextResponse.json({
      status: profile?.matchQuestionnaireStatus ?? "not_started",
      completedAt: profile?.matchQuestionnaireCompletedAt?.toISOString() ?? null,
      answers,
      aiMatchProfileText: profile?.aiMatchProfileText ?? null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load questionnaire.", {
      logLabel: "[Match Fit trainer match questionnaire GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json: unknown = await req.json();
    const parsed = trainerMatchQuestionnaireSchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid questionnaire.";
      return NextResponse.json({ error: msg, issues: parsed.error.issues }, { status: 400 });
    }
    const payload: TrainerMatchQuestionnairePayload = parsed.data;
    const aiMatchProfileText = buildAiMatchProfileText(payload);

    await prisma.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        matchQuestionnaireAnswers: JSON.stringify(payload),
        matchQuestionnaireStatus: "completed",
        matchQuestionnaireCompletedAt: new Date(),
        aiMatchProfileText,
      },
      update: {
        matchQuestionnaireAnswers: JSON.stringify(payload),
        matchQuestionnaireStatus: "completed",
        matchQuestionnaireCompletedAt: new Date(),
        aiMatchProfileText,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save questionnaire.", {
      logLabel: "[Match Fit trainer match questionnaire POST]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
