import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import {
  parseTrainerMatchQuestionnaireDraft,
  validateTrainerMatchQuestionnaireStep,
} from "@/lib/trainer-match-questionnaire-draft";
import {
  buildAiMatchProfileText,
  trainerMatchQuestionnaireSchema,
  type TrainerMatchQuestionnairePayload,
} from "@/lib/trainer-match-questionnaire";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const patchBodySchema = z.object({
  step: z.coerce.number().int().min(1).max(5),
  answers: z.unknown(),
});

/**
 * Save one section of the Match Me questionnaire. Accepts the full draft object; validates only `step`.
 * Marks `completed` only when the full strict schema passes.
 */
export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json: unknown = await req.json();
    const parsedBody = patchBodySchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { step, answers } = parsedBody.data;
    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid answers object." }, { status: 400 });
    }

    const incoming = parseTrainerMatchQuestionnaireDraft(answers);
    const stepErr = validateTrainerMatchQuestionnaireStep(incoming, step);
    if (stepErr) {
      return NextResponse.json({ error: stepErr }, { status: 400 });
    }

    let payload: TrainerMatchQuestionnairePayload | null = null;
    if (incoming.certifyAccurate === true) {
      const strict = trainerMatchQuestionnaireSchema.safeParse({ ...incoming, certifyAccurate: true as const });
      if (strict.success) payload = strict.data;
    }
    const aiMatchProfileText = payload ? buildAiMatchProfileText(payload) : null;

    await prisma.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        matchQuestionnaireAnswers: JSON.stringify(incoming),
        matchQuestionnaireStatus: payload ? "completed" : "in_progress",
        matchQuestionnaireCompletedAt: payload ? new Date() : null,
        aiMatchProfileText,
      },
      update: {
        matchQuestionnaireAnswers: JSON.stringify(incoming),
        matchQuestionnaireStatus: payload ? "completed" : "in_progress",
        matchQuestionnaireCompletedAt: payload ? new Date() : null,
        aiMatchProfileText,
      },
    });

    return NextResponse.json({ ok: true, completed: Boolean(payload) });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save questionnaire section.", {
      logLabel: "[Match Fit trainer match questionnaire PATCH]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
