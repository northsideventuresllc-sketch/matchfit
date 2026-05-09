import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminSessionToNextResponse,
  verifyAdminSessionToken,
} from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  enabled: z.boolean(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = token ? await verifyAdminSessionToken(token) : null;
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

    const exists = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, testMode: parsed.data.enabled });
    await applyAdminSessionToNextResponse(res, sess.adminId, sess.rememberMe, parsed.data.enabled);
    return res;
  } catch (e) {
    console.error("[admin test-mode]", e);
    return NextResponse.json({ error: "Could not update test mode." }, { status: 500 });
  }
}
