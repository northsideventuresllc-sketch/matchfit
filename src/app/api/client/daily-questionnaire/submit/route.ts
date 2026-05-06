import {
  mergeDailyAnswersIntoClientContext,
  validateAnswers,
  type DailyQuestionnaireQuestions,
} from "@/lib/client-daily-questionnaire";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      questionnaireId?: string;
      answers?: Record<string, string>;
    };
    const questionnaireId = body.questionnaireId?.trim();
    const answers = body.answers ?? {};
    if (!questionnaireId) {
      return NextResponse.json({ error: "questionnaireId is required." }, { status: 400 });
    }

    const row = await prisma.clientDailyQuestionnaire.findFirst({
      where: { id: questionnaireId, clientId, archivedAt: null },
    });
    if (!row) {
      return NextResponse.json({ error: "Questionnaire not found." }, { status: 404 });
    }
    if (row.completedAt) {
      return NextResponse.json({ error: "This questionnaire was already submitted." }, { status: 409 });
    }

    let questions: DailyQuestionnaireQuestions;
    try {
      questions = JSON.parse(row.questionsJson) as DailyQuestionnaireQuestions;
    } catch {
      return NextResponse.json({ error: "Invalid questionnaire data." }, { status: 500 });
    }

    const check = validateAnswers(questions, answers);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    await prisma.clientDailyQuestionnaire.update({
      where: { id: row.id },
      data: {
        answersJson: JSON.stringify(answers),
        completedAt: new Date(),
      },
    });

    await mergeDailyAnswersIntoClientContext(clientId, answers, questions);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save answers." }, { status: 500 });
  }
}
