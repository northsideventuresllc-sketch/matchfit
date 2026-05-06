import { deidentifyClientAccount } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { clearClientSession, getSessionClientId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { passwordHash: true, deidentifiedAt: true },
    });
    if (!client || client.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const ok = await verifyPassword(parsed.data.password, client.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    await deidentifyClientAccount(clientId);
    await clearClientSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not delete account.", {
      logLabel: "[client account delete]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
