import { findClientByIdentifier } from "@/lib/client-queries";
import { findTrainerByIdentifier } from "@/lib/trainer-queries";
import { prisma } from "@/lib/prisma";
import {
  clearClientSession,
  clearLoginChallengeCookie,
  clearTrainerLoginChallengeCookie,
  clearTrainerSession,
  setClientSession,
  setTrainerSession,
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
  return "/trainer/onboarding";
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
    await clearTrainerSession();
    await clearTrainerLoginChallengeCookie();
    await clearLoginChallengeCookie();
    await setClientSession(client.id, client.stayLoggedIn);
    return NextResponse.json({ ok: true, next: "/client/account" });
  }

  const trainer = await findTrainerByIdentifier(trainerIdent);
  if (!trainer) {
    return NextResponse.json(
      { error: `No trainer found for MATCH_FIT_DEV_TRAINER_IDENTIFIER (${trainerIdent}).` },
      { status: 404 },
    );
  }
  await clearClientSession();
  await clearLoginChallengeCookie();
  await clearTrainerLoginChallengeCookie();
  await setTrainerSession(trainer.id, trainer.stayLoggedIn);
  const next = await trainerShortcutPath(trainer.id);
  return NextResponse.json({ ok: true, next });
}
