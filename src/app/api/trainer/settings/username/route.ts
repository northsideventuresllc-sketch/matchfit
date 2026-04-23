import { isTrainerUsernameTakenByAnother } from "@/lib/trainer-queries";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSessionTrainerId } from "@/lib/session";
import { firstZodErrorMessage, settingsUsernameSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsUsernameSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { username, currentPassword } = parsed.data;

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const pwOk = await verifyPassword(currentPassword, trainer.passwordHash);
    if (!pwOk) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    if (username === trainer.username) {
      return NextResponse.json({ error: "That is already your username." }, { status: 400 });
    }

    if (await isTrainerUsernameTakenByAnother(username, trainerId)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
    }

    const updated = await prisma.trainer.update({
      where: { id: trainerId },
      data: { username },
      select: { username: true },
    });

    return NextResponse.json({ ok: true, username: updated.username });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update username." }, { status: 500 });
  }
}
