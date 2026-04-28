import { prisma } from "@/lib/prisma";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";

const MAX_DETAILS = 2000;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      targetUsername?: string;
      targetIsTrainer?: boolean;
      reasonCategory?: string | null;
      reasonDetails?: string | null;
    };

    const targetUsername = body.targetUsername?.trim();
    const targetIsTrainer = Boolean(body.targetIsTrainer);
    const reasonCategory = body.reasonCategory?.trim() || null;
    const reasonDetails =
      typeof body.reasonDetails === "string" ? body.reasonDetails.trim().slice(0, MAX_DETAILS) : null;

    if (!targetUsername) {
      return NextResponse.json({ error: "targetUsername is required." }, { status: 400 });
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
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      if (!targetIsTrainer) {
        return NextResponse.json({ error: "Clients can only block trainers from this endpoint." }, { status: 400 });
      }
      const trainer = await prisma.trainer.findUnique({
        where: { username: targetUsername },
        select: { id: true },
      });
      if (!trainer) {
        return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
      }
      await prisma.userBlock.upsert({
        where: {
          blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
            blockerIsTrainer: false,
            blockerId: clientId,
            blockedIsTrainer: true,
            blockedId: trainer.id,
          },
        },
        create: {
          blockerIsTrainer: false,
          blockerId: clientId,
          blockedIsTrainer: true,
          blockedId: trainer.id,
          reasonCategory,
          reasonDetails,
        },
        update: {
          reasonCategory: reasonCategory ?? undefined,
          reasonDetails: reasonDetails ?? undefined,
        },
      });
      return NextResponse.json({ ok: true });
    }

    const tid = trainerId!;
    const trainer = await prisma.trainer.findUnique({ where: { id: tid }, select: { id: true } });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (targetIsTrainer) {
      return NextResponse.json({ error: "Trainers can only block clients from this endpoint." }, { status: 400 });
    }
    const targetClient = await prisma.client.findUnique({
      where: { username: targetUsername },
      select: { id: true },
    });
    if (!targetClient) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    await prisma.userBlock.upsert({
      where: {
        blockerIsTrainer_blockerId_blockedIsTrainer_blockedId: {
          blockerIsTrainer: true,
          blockerId: tid,
          blockedIsTrainer: false,
          blockedId: targetClient.id,
        },
      },
      create: {
        blockerIsTrainer: true,
        blockerId: tid,
        blockedIsTrainer: false,
        blockedId: targetClient.id,
        reasonCategory,
        reasonDetails,
      },
      update: {
        reasonCategory: reasonCategory ?? undefined,
        reasonDetails: reasonDetails ?? undefined,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save block." }, { status: 500 });
  }
}
