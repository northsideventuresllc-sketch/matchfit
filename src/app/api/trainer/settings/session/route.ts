import { prisma } from "@/lib/prisma";
import { getSessionTrainerId, setTrainerSession } from "@/lib/session";
import { firstZodErrorMessage, settingsSessionSchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsSessionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }

    await prisma.trainer.update({
      where: { id: trainerId },
      data: { stayLoggedIn: parsed.data.stayLoggedIn },
    });

    await setTrainerSession(trainerId, parsed.data.stayLoggedIn);
    return NextResponse.json({ ok: true, stayLoggedIn: parsed.data.stayLoggedIn });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update session preference." }, { status: 500 });
  }
}
