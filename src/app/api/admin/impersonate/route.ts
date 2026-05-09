import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminImpersonationToNextResponse,
  CLIENT_SESSION_COOKIE,
  LOGIN_CHALLENGE_COOKIE,
  signAdminImpersonationToken,
  TRAINER_LOGIN_CHALLENGE_COOKIE,
  TRAINER_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  role: z.enum(["client", "trainer"]),
  userId: z.string().min(8),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = adminTok ? await verifyAdminSessionToken(adminTok) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const adminRow = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: { id: true },
    });
    if (!adminRow) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { role, userId } = parsed.data;

    if (role === "client") {
      const client = await prisma.client.findUnique({
        where: { id: userId },
        select: { id: true, deidentifiedAt: true },
      });
      if (!client || client.deidentifiedAt) {
        return NextResponse.json({ error: "Client not found." }, { status: 404 });
      }
    } else {
      const trainer = await prisma.trainer.findUnique({
        where: { id: userId },
        select: { id: true, deidentifiedAt: true },
      });
      if (!trainer || trainer.deidentifiedAt) {
        return NextResponse.json({ error: "Trainer not found." }, { status: 404 });
      }
    }

    const impTok = await signAdminImpersonationToken({
      adminId: sess.adminId,
      role,
      targetId: userId,
    });

    const next =
      role === "client"
        ? "/client/dashboard"
        : "/trainer/dashboard";

    const res = NextResponse.json({ ok: true, next });
    applyAdminImpersonationToNextResponse(res, impTok);

    res.cookies.delete(CLIENT_SESSION_COOKIE);
    res.cookies.delete(TRAINER_SESSION_COOKIE);
    res.cookies.delete(LOGIN_CHALLENGE_COOKIE);
    res.cookies.delete(TRAINER_LOGIN_CHALLENGE_COOKIE);

    return res;
  } catch (e) {
    console.error("[admin impersonate]", e);
    return NextResponse.json({ error: "Could not start impersonation." }, { status: 500 });
  }
}
