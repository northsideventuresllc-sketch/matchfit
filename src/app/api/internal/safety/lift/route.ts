import { finalizeSuspensionRecordOnLift } from "@/lib/suspension-lifecycle";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Human ops tool: clears automated safety suspensions after review.
 * Protect with `MATCHFIT_INTERNAL_TOOLS_SECRET` (see `.env.example`).
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.MATCHFIT_INTERNAL_TOOLS_SECRET?.trim();
    if (!secret || secret.length < 16) {
      return NextResponse.json({ error: "Internal tools are not configured." }, { status: 503 });
    }
    const hdr = req.headers.get("x-matchfit-internal-secret");
    if (hdr !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json()) as { subjectIsTrainer?: boolean; subjectId?: string };
    if (typeof body.subjectIsTrainer !== "boolean" || !body.subjectId?.trim()) {
      return NextResponse.json({ error: "subjectIsTrainer (boolean) and subjectId are required." }, { status: 400 });
    }
    const subjectId = body.subjectId.trim();

    if (body.subjectIsTrainer) {
      await prisma.trainer.update({
        where: { id: subjectId },
        data: { safetySuspended: false, safetySuspendedAt: null },
      });
    } else {
      await prisma.client.update({
        where: { id: subjectId },
        data: { safetySuspended: false, safetySuspendedAt: null },
      });
    }

    await finalizeSuspensionRecordOnLift({
      subjectIsTrainer: body.subjectIsTrainer,
      subjectId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not lift suspension." }, { status: 500 });
  }
}
