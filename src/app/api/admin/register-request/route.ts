import { canonicalAdministratorCode } from "@/lib/admin-code";
import { sendAdministratorSignupReviewEmail } from "@/lib/admin-signup-email";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { httpStatusFromResendError } from "@/lib/resend-client";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().email().max(320),
  password: z.string().min(12).max(200),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Administrator signup email is not configured (RESEND_API_KEY)." },
        { status: 503 },
      );
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter your legal name, date of birth (YYYY-MM-DD), work email, and a password (12+ characters)." },
        { status: 400 },
      );
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const derived = canonicalAdministratorCode(
      parsed.data.firstName,
      parsed.data.lastName,
      parsed.data.dateOfBirth,
    );
    if (!derived) {
      return NextResponse.json(
        { error: "Could not derive your administrator code from that name and date of birth. Use letters only in names and ISO date YYYY-MM-DD." },
        { status: 400 },
      );
    }

    const existingAdmin = await prisma.administrator.findUnique({ where: { email } });
    if (existingAdmin) {
      return NextResponse.json({ error: "An administrator already uses this email." }, { status: 409 });
    }

    const pendingDup = await prisma.pendingAdministratorRegistration.findFirst({
      where: { email, status: "PENDING" },
    });
    if (pendingDup) {
      return NextResponse.json(
        { error: "A pending request already exists for this email. Wait for operator approval or contact Match Fit." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const pending = await prisma.pendingAdministratorRegistration.create({
      data: {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        dateOfBirth: parsed.data.dateOfBirth,
        email,
        passwordHash,
      },
    });

    const origin = getAppOriginFromRequest(req);

    try {
      await sendAdministratorSignupReviewEmail({
        pendingId: pending.id,
        firstName: pending.firstName,
        lastName: pending.lastName,
        dateOfBirth: pending.dateOfBirth,
        email: pending.email,
        origin,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send email.";
      if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
        await prisma.pendingAdministratorRegistration.delete({ where: { id: pending.id } }).catch(() => {});
        console.warn("[admin register-request] Email not sent (RESEND_API_KEY). Pending row rolled back.", msg);
        return NextResponse.json(
          {
            error:
              "Email could not be sent from this environment. Set RESEND_API_KEY in .env, then try again.",
          },
          { status: 503 },
        );
      }
      const status = msg.includes("Resend HTTP") ? httpStatusFromResendError(msg) : 500;
      console.error("[admin register-request]", e);
      return NextResponse.json(
        {
          error:
            "Your request was saved but the approval email could not be sent. Match Fit operators should check pending administrator rows in the database.",
        },
        { status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin register-request]", e);
    return NextResponse.json({ error: "Could not submit request." }, { status: 500 });
  }
}
