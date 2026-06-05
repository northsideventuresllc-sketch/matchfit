import { normalizeAdministratorCodeInput } from "@/lib/admin-code";
import { ensureAdminPortalSchema, isAdminPortalSchemaError } from "@/lib/ensure-admin-portal-schema";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
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

    await ensureAdminPortalSchema();

    const code = normalizeAdministratorCodeInput(parsed.data.adminCode);
    const admin = await prisma.administrator.findUnique({ where: { adminCode: code } });

    const ok = admin ? await verifyPassword(parsed.data.password, admin.passwordHash) : false;

    await new Promise((r) => setTimeout(r, 320));

    if (!admin || !ok) {
      return NextResponse.json(
        {
          error:
            "Invalid administrator code or password. Sign in with your 8-character administrator code (not your email). If you recently requested access, wait for the approval email first.",
        },
        { status: 401 },
      );
    }

    const rememberMe = parsed.data.stayLoggedIn !== false;
    const res = NextResponse.json({
      ok: true,
      next: "/admin",
    });
    await applyAdminSessionToNextResponse(res, admin.id, rememberMe, false);
    return res;
  } catch (e) {
    if (isAdminPortalSchemaError(e)) {
      try {
        await ensureAdminPortalSchema();
        return NextResponse.json(
          { error: "Please try signing in again — we just finished a quick database update." },
          { status: 503 },
        );
      } catch (repairErr) {
        console.error("[admin login] schema repair failed", repairErr);
      }
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Could Not Sign You In.", {
      logLabel: "[admin login]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
