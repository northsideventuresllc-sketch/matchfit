import { findClientByIdentifier } from "@/lib/client-queries";
import { findTrainerByIdentifier } from "@/lib/trainer-queries";
import { prisma } from "@/lib/prisma";
import {
  applyClientSessionToNextResponse,
  applyTrainerSessionToNextResponse,
  CLIENT_SESSION_COOKIE,
  LOGIN_CHALLENGE_COOKIE,
  TRAINER_LOGIN_CHALLENGE_COOKIE,
  TRAINER_SESSION_COOKIE,
} from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  target: z.enum(["client", "trainer"]),
});

function devIdentifiersConfigured(): boolean {
  return Boolean(
    process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER?.trim() &&
      process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER?.trim(),
  );
}

async function trainerShortcutPath(trainerId: string): Promise<string> {
  const row = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { profile: { select: { dashboardActivatedAt: true } } },
  });
  if (row?.profile?.dashboardActivatedAt) {
    return "/trainer/dashboard";
  }
  return "/trainer/dashboard";
}

/**
 * Development-only: set an httpOnly session for a fixed test client or trainer (see .env.example).
 * Clears the opposite role session and login challenge cookies.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!devIdentifiersConfigured()) {
    return NextResponse.json(
      { error: "Set MATCH_FIT_DEV_CLIENT_IDENTIFIER and MATCH_FIT_DEV_TRAINER_IDENTIFIER in .env." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { target } = parsed.data;

  const clientIdent = process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER!.trim();
  const trainerIdent = process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER!.trim();

  if (target === "client") {
    const client = await findClientByIdentifier(clientIdent);
    if (!client) {
      return NextResponse.json(
        { error: `No client found for MATCH_FIT_DEV_CLIENT_IDENTIFIER (${clientIdent}).` },
        { status: 404 },
      );
    }
    const res = NextResponse.json({ ok: true, next: "/client/account" });
    res.cookies.delete(TRAINER_SESSION_COOKIE);
    res.cookies.delete(TRAINER_LOGIN_CHALLENGE_COOKIE);
    res.cookies.delete(LOGIN_CHALLENGE_COOKIE);
    await applyClientSessionToNextResponse(res, client.id, client.stayLoggedIn);
    return res;
  }

  const trainer = await findTrainerByIdentifier(trainerIdent);
  if (!trainer) {
    return NextResponse.json(
      { error: `No trainer found for MATCH_FIT_DEV_TRAINER_IDENTIFIER (${trainerIdent}).` },
      { status: 404 },
    );
  }
  const next = await trainerShortcutPath(trainer.id);
  const res = NextResponse.json({ ok: true, next });
  res.cookies.delete(CLIENT_SESSION_COOKIE);
  res.cookies.delete(LOGIN_CHALLENGE_COOKIE);
  res.cookies.delete(TRAINER_LOGIN_CHALLENGE_COOKIE);
  await applyTrainerSessionToNextResponse(res, trainer.id, trainer.stayLoggedIn);
  return res;
}
