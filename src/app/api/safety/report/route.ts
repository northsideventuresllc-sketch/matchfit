import { parseSafetyReportCategory } from "@/lib/safety-constants";
import { createSuspensionRecordForReport } from "@/lib/suspension-lifecycle";
import { prisma } from "@/lib/prisma";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

const MAX_DETAILS = 8000;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      targetUsername?: string;
      targetIsTrainer?: boolean;
      category?: string;
      details?: string;
    };

    const targetUsername = body.targetUsername?.trim();
    const targetIsTrainer = Boolean(body.targetIsTrainer);
    const category = parseSafetyReportCategory(body.category);
    const details = typeof body.details === "string" ? body.details.trim().slice(0, MAX_DETAILS) : "";
    if (!targetUsername || !details) {
      return NextResponse.json({ error: "targetUsername and details are required." }, { status: 400 });
    }

    const clientId = await getSessionClientId();
    const trainerId = await getSessionTrainerId();
    if (clientId && trainerId) {
      return NextResponse.json({ error: "Invalid session state." }, { status: 400 });
    }
    if (!clientId && !trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (clientId) {
      if (!targetIsTrainer) {
        return NextResponse.json({ error: "Clients may only file reports against trainers here." }, { status: 400 });
      }
      const trainer = await prisma.trainer.findUnique({
        where: { username: targetUsername },
        select: { id: true },
      });
      if (!trainer) {
        return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
      }

      const report = await prisma.safetyReport.create({
        data: {
          reporterIsTrainer: false,
          reporterId: clientId,
          subjectIsTrainer: true,
          subjectId: trainer.id,
          category,
          details,
        },
      });

      await prisma.$transaction([
        prisma.trainer.update({
          where: { id: trainer.id },
          data: { safetySuspended: true, safetySuspendedAt: new Date() },
        }),
        createSuspensionRecordForReport({
          subjectIsTrainer: true,
          subjectId: trainer.id,
          reportId: report.id,
        }),
      ]);

      return NextResponse.json({
        ok: true,
        subjectSuspended: true,
        message:
          "Thank you — Match Fit has received your report. The trainer’s account is suspended pending human review.",
      });
    }

    const tid = trainerId!;
    if (targetIsTrainer) {
      return NextResponse.json({ error: "Trainers may only file reports against clients here." }, { status: 400 });
    }
    const targetClient = await prisma.client.findUnique({
      where: { username: targetUsername },
      select: { id: true },
    });
    if (!targetClient) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const report = await prisma.safetyReport.create({
      data: {
        reporterIsTrainer: true,
        reporterId: tid,
        subjectIsTrainer: false,
        subjectId: targetClient.id,
        category,
        details,
      },
    });

    await prisma.$transaction([
      prisma.client.update({
        where: { id: targetClient.id },
        data: { safetySuspended: true, safetySuspendedAt: new Date() },
      }),
      createSuspensionRecordForReport({
        subjectIsTrainer: false,
        subjectId: targetClient.id,
        reportId: report.id,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      subjectSuspended: true,
      message:
        "Thank you — Match Fit has received your report. The client’s account is suspended pending human review.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not file report." }, { status: 500 });
  }
}
