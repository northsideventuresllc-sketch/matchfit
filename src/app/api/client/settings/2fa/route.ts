import { deliverSignupOtp } from "@/lib/deliver-otp";
import type { OtpChannel } from "@/lib/deliver-otp";
import { generateSixDigitCode, hashOtp, verifyOtp } from "@/lib/otp";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { settings2faSchema } from "@/lib/validations/client-register";
import { NextResponse } from "next/server";

const MAX_CHANNELS = 8;

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await req.json();
    const parsed = settings2faSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const body = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (body.action === "abandon_unverified_channels") {
      await prisma.clientTwoFactorChannel.deleteMany({
        where: { clientId, verified: false },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "disable") {
      if (!client.twoFactorEnabled) {
        return NextResponse.json({ error: "Two-factor authentication is already off." }, { status: 400 });
      }
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
      await prisma.clientTwoFactorChannel.deleteMany({ where: { clientId } });
      await prisma.client.update({
        where: { id: clientId },
        data: {
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
          twoFactorLoginAttempts: 0,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "request_add_channel") {
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }

      const delivery = body.delivery as OtpChannel;
      const email = body.email?.trim().toLowerCase() ?? "";
      const phoneRaw = body.phone?.trim() ?? "";
      const phoneDigits = normalizePhoneDigits(phoneRaw);

      if (delivery === "EMAIL") {
        if (!email) {
          return NextResponse.json({ error: "Enter an email address for email delivery." }, { status: 400 });
        }
      } else if (!phoneDigits || phoneDigits.length < 10) {
        return NextResponse.json({ error: "Enter a valid phone number for text or call delivery." }, { status: 400 });
      }

      const count = await prisma.clientTwoFactorChannel.count({ where: { clientId } });
      if (count >= MAX_CHANNELS) {
        return NextResponse.json(
          { error: `You can add at most ${MAX_CHANNELS} sign-in methods. Remove one to add another.` },
          { status: 400 },
        );
      }

      const existing = await prisma.clientTwoFactorChannel.findMany({ where: { clientId } });
      for (const c of existing) {
        if (c.delivery === "EMAIL" && delivery === "EMAIL" && c.email?.toLowerCase() === email) {
          return NextResponse.json({ error: "That email is already added." }, { status: 409 });
        }
        if (c.delivery !== "EMAIL" && delivery !== "EMAIL") {
          const ex = normalizePhoneDigits(c.phone ?? "");
          if (ex && ex === phoneDigits) {
            return NextResponse.json({ error: "That phone number is already added." }, { status: 409 });
          }
        }
      }

      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const row = await prisma.clientTwoFactorChannel.create({
        data: {
          clientId,
          delivery,
          email: delivery === "EMAIL" ? email : null,
          phone: delivery !== "EMAIL" ? phoneRaw : null,
          verified: false,
          verifyOtpHash: otpHash,
          verifyOtpExpires: otpExpiresAt,
          isDefaultLogin: false,
        },
      });

      let addMeta: { devPhoneMock?: boolean } = {};
      try {
        addMeta = await deliverSignupOtp(delivery, {
          email: delivery === "EMAIL" ? email : client.email,
          phone: delivery !== "EMAIL" ? phoneRaw : client.phone,
          code,
        });
      } catch (deliverErr) {
        console.error("[settings 2FA] add-channel delivery failed; removing pending row.", deliverErr);
        await prisma.clientTwoFactorChannel.delete({ where: { id: row.id } });
        throw deliverErr;
      }

      return NextResponse.json({
        ok: true,
        channelId: row.id,
        ...(addMeta?.devPhoneMock ? { devPhoneMock: true } : {}),
      });
    }

    if (body.action === "resend_channel_verify") {
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
      const row = await prisma.clientTwoFactorChannel.findFirst({
        where: { id: body.channelId, clientId },
      });
      if (!row || row.verified) {
        return NextResponse.json({ error: "That sign-in method is not pending verification." }, { status: 400 });
      }
      const code = generateSixDigitCode();
      const otpHash = hashOtp(code);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.clientTwoFactorChannel.update({
        where: { id: row.id },
        data: { verifyOtpHash: otpHash, verifyOtpExpires: otpExpiresAt },
      });
      const delivery = row.delivery as OtpChannel;
      let resendMeta: { devPhoneMock?: boolean } = {};
      try {
        resendMeta = await deliverSignupOtp(delivery, {
          email: delivery === "EMAIL" ? (row.email ?? client.email) : client.email,
          phone: delivery !== "EMAIL" ? (row.phone ?? client.phone) : client.phone,
          code,
        });
      } catch (deliverErr) {
        console.error("[settings 2FA] resend verify failed; clearing pending OTP.", deliverErr);
        await prisma.clientTwoFactorChannel.update({
          where: { id: row.id },
          data: { verifyOtpHash: null, verifyOtpExpires: null },
        });
        throw deliverErr;
      }
      return NextResponse.json({ ok: true, ...(resendMeta?.devPhoneMock ? { devPhoneMock: true } : {}) });
    }

    if (body.action === "confirm_add_channel") {
      const row = await prisma.clientTwoFactorChannel.findFirst({
        where: { id: body.channelId, clientId },
      });
      if (!row || row.verified) {
        return NextResponse.json({ error: "Nothing to confirm for that sign-in method." }, { status: 400 });
      }
      if (!row.verifyOtpHash || !row.verifyOtpExpires) {
        return NextResponse.json({ error: "Request a new verification code." }, { status: 400 });
      }
      if (row.verifyOtpExpires < new Date()) {
        return NextResponse.json({ error: "That code has expired. Resend a code or start again." }, { status: 400 });
      }
      if (!verifyOtp(body.code, row.verifyOtpHash)) {
        return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
      }

      const hasDefault = await prisma.clientTwoFactorChannel.findFirst({
        where: { clientId, verified: true, isDefaultLogin: true },
      });

      await prisma.clientTwoFactorChannel.update({
        where: { id: row.id },
        data: {
          verified: true,
          verifyOtpHash: null,
          verifyOtpExpires: null,
          isDefaultLogin: !hasDefault,
        },
      });

      await prisma.client.update({
        where: { id: clientId },
        data: {
          twoFactorEnabled: true,
          twoFactorMethod: row.delivery as OtpChannel,
          twoFactorOtpHash: null,
          twoFactorOtpExpires: null,
          twoFactorLoginAttempts: 0,
        },
      });

      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete_channel") {
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
      const row = await prisma.clientTwoFactorChannel.findFirst({
        where: { id: body.channelId, clientId },
      });
      if (!row) {
        return NextResponse.json({ error: "Sign-in method not found." }, { status: 404 });
      }

      const wasDefault = row.isDefaultLogin;
      await prisma.clientTwoFactorChannel.delete({ where: { id: row.id } });

      const remainingVerified = await prisma.clientTwoFactorChannel.findMany({
        where: { clientId, verified: true },
        orderBy: { createdAt: "asc" },
      });

      if (remainingVerified.length === 0) {
        await prisma.client.update({
          where: { id: clientId },
          data: {
            twoFactorEnabled: false,
            twoFactorMethod: "NONE",
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            twoFactorLoginAttempts: 0,
          },
        });
      } else if (wasDefault) {
        const next = remainingVerified[0];
        await prisma.clientTwoFactorChannel.updateMany({
          where: { clientId },
          data: { isDefaultLogin: false },
        });
        await prisma.clientTwoFactorChannel.update({
          where: { id: next.id },
          data: { isDefaultLogin: true },
        });
        await prisma.client.update({
          where: { id: clientId },
          data: { twoFactorMethod: next.delivery as OtpChannel },
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (body.action === "set_default_login_channel") {
      const ok = await verifyPassword(body.password, client.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
      }
      const row = await prisma.clientTwoFactorChannel.findFirst({
        where: { id: body.channelId, clientId, verified: true },
      });
      if (!row) {
        return NextResponse.json({ error: "Choose a verified sign-in method." }, { status: 400 });
      }
      await prisma.clientTwoFactorChannel.updateMany({
        where: { clientId },
        data: { isDefaultLogin: false },
      });
      await prisma.clientTwoFactorChannel.update({
        where: { id: row.id },
        data: { isDefaultLogin: true },
      });
      await prisma.client.update({
        where: { id: clientId },
        data: { twoFactorMethod: row.delivery as OtpChannel },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update two-factor settings. Try again.", {
      logLabel: "[Match Fit settings 2FA]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
