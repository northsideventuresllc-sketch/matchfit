import { hashPassword } from "@/lib/password";
import { verifyPasswordChangeToken } from "@/lib/password-change-jwt";
import { checkAndAdvancePasswordChangeRateLimit } from "@/lib/password-change-rate-limit";
import { deliverPasswordChangedNotice } from "@/lib/deliver-password-changed-notice";
import { prisma } from "@/lib/prisma";
import { clearAdminSession } from "@/lib/session";
import { firstZodErrorMessage, passwordPolicySchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
  newPassword: passwordPolicySchema,
});

/** Email-link reset only — no in-session admin settings page or 2FA-gated flow exists yet. */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const claims = await verifyPasswordChangeToken(parsed.data.token);
    if (!claims) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    const admin = await prisma.administrator.findUnique({ where: { id: claims.userId } });
    if (!admin?.passwordChangeNonce || !admin.passwordChangeExpires || admin.passwordChangeNonce !== claims.nonce) {
      return NextResponse.json(
        { error: "This reset link is no longer valid. Request a new one." },
        { status: 400 },
      );
    }
    if (admin.passwordChangeExpires < new Date()) {
      return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 400 });
    }

    const rateLimit = checkAndAdvancePasswordChangeRateLimit({
      passwordChangeCount24h: admin.passwordChangeCount24h,
      passwordChangeWindowStartsAt: admin.passwordChangeWindowStartsAt,
    });
    if (!rateLimit.ok) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.administrator.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        passwordChangeNonce: null,
        passwordChangeExpires: null,
        passwordChangeCount24h: rateLimit.nextState.passwordChangeCount24h,
        passwordChangeWindowStartsAt: rateLimit.nextState.passwordChangeWindowStartsAt,
      },
    });

    await deliverPasswordChangedNotice({ accountType: "admin", accountId: admin.id, email: admin.email, req });

    await clearAdminSession();
    return NextResponse.json({ ok: true, next: "/admin/login?passwordReset=1" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }
}
