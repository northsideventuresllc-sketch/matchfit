import { isEmailTaken, isUsernameTaken } from "@/lib/client-queries";
import { hashPassword } from "@/lib/password";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import { setRegistrationHoldCookie } from "@/lib/session";
import {
  firstZodErrorMessage,
  normalizeRegisterJson,
  registerSkipSchema,
} from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

function isAtLeast18(birthYmd: string): boolean {
  const [y, m, d] = birthYmd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const birth = new Date(y, m - 1, d);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birth <= cutoff;
}

const HOLD_TTL_MS = 72 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const json = await req.json();
    const parsed = registerSkipSchema.safeParse(normalizeRegisterJson(json));
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;
    if (!isAtLeast18(body.dateOfBirth)) {
      return NextResponse.json({ error: "You must be at least 18 years old." }, { status: 400 });
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();

    if (await isUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);

    const pending = await prisma.pendingClientRegistration.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        preferredName: body.preferredName,
        username,
        phone: body.phone.trim(),
        email,
        passwordHash,
        zipCode: body.zipCode,
        dateOfBirth: body.dateOfBirth,
        termsAcceptedAt: new Date(),
        status: "AWAITING_PAYMENT",
        twoFactorEnabled: false,
        twoFactorMethod: "NONE",
        otpHash: null,
        otpExpiresAt: null,
        stayLoggedIn: body.stayLoggedIn,
        expiresAt: new Date(Date.now() + HOLD_TTL_MS),
      },
    });

    await setRegistrationHoldCookie(pending.id);
    return NextResponse.json({ ok: true, pendingId: pending.id, next: "/client/subscribe" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
