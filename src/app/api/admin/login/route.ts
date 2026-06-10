import { normalizeAdministratorCodeInput } from "@/lib/admin-code";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { applyAdminSessionToNextResponse } from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  adminCode: z.string().min(4).max(24),
  password: z.string().min(1),
  stayLoggedIn: z.boolean().optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const code = normalizeAdministratorCodeInput(parsed.data.adminCode);
    const admin = await prisma.administrator.findUnique({ where: { adminCode: code } });
    const ok = admin ? await verifyPassword(parsed.data.password, admin.passwordHash) : false;

    await new Promise((r) => setTimeout(r, 320));

    if (!admin || !ok) {
      return NextResponse.json({ error: "Invalid administrator code or password." }, { status: 401 });
    }

    const rememberMe = parsed.data.stayLoggedIn !== false;
    const res = NextResponse.json({
      ok: true,
      next: "/admin",
    });
    await applyAdminSessionToNextResponse(res, admin.id, rememberMe, false);
    return res;
  } catch (e) {
    console.error("[admin login]", e);
    return NextResponse.json({ error: "Could Not Sign You In." }, { status: 500 });
  }
}
