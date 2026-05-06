import { deidentifyTrainerAccount } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { clearTrainerSession, getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { passwordHash: true, deidentifiedAt: true },
    });
    if (!trainer || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const ok = await verifyPassword(parsed.data.password, trainer.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    await deidentifyTrainerAccount(trainerId);
    await clearTrainerSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not delete account.", {
      logLabel: "[trainer account delete]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
