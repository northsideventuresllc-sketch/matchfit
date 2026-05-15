"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  assertEmailResendCooldown,
  findClientEmailChannel,
  findTrainerEmailChannel,
  send2FACode,
  verifyStoredEmailCode,
} from "@/lib/auth-2fa-email";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";
import {
  clearLoginChallengeCookie,
  clearTrainerLoginChallengeCookie,
  LOGIN_CHALLENGE_COOKIE,
  setClientSession,
  setTrainerSession,
  TRAINER_LOGIN_CHALLENGE_COOKIE,
  verifyLoginChallengeToken,
  verifyTrainerLoginChallengeToken,
} from "@/lib/session";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";

const MAX_ATTEMPTS = 3;

export type Resend2FAResult = { ok: true } | { ok: false; error: string; waitSeconds?: number };

export async function resend2FACodeAction(): Promise<Resend2FAResult> {
  const store = await cookies();
  const clientCh = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
  const trainerCh = store.get(TRAINER_LOGIN_CHALLENGE_COOKIE)?.value;

  const clientParsed = clientCh ? await verifyLoginChallengeToken(clientCh) : null;
  if (clientParsed) {
    const delivery = await getLoginOtpDelivery(clientParsed.clientId);
    if (!delivery || delivery.delivery !== "EMAIL") {
      return { ok: false, error: "Resend is only available for email codes." };
    }
    const row = await findClientEmailChannel(clientParsed.clientId, delivery.email);
    if (row) {
      const cool = await assertEmailResendCooldown(row.lastEmailResendAt);
      if (!cool.ok) {
        return {
          ok: false,
          error: `Please wait ${cool.waitSeconds}s before requesting another code.`,
          waitSeconds: cool.waitSeconds,
        };
      }
    }
    try {
      await send2FACode(delivery.email, clientParsed.clientId, "CLIENT", { countTowardResendCooldown: true });
      await prisma.client.update({
        where: { id: clientParsed.clientId },
        data: { twoFactorLoginAttempts: 0 },
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not resend the code.";
      return { ok: false, error: msg };
    }
  }

  const trainerParsed = trainerCh ? await verifyTrainerLoginChallengeToken(trainerCh) : null;
  if (trainerParsed) {
    const delivery = await getTrainerLoginOtpDelivery(trainerParsed.trainerId);
    if (!delivery || delivery.delivery !== "EMAIL") {
      return { ok: false, error: "Resend is only available for email codes." };
    }
    const row = await findTrainerEmailChannel(trainerParsed.trainerId, delivery.email);
    if (row) {
      const cool = await assertEmailResendCooldown(row.lastEmailResendAt);
      if (!cool.ok) {
        return {
          ok: false,
          error: `Please wait ${cool.waitSeconds}s before requesting another code.`,
          waitSeconds: cool.waitSeconds,
        };
      }
    }
    try {
      await send2FACode(delivery.email, trainerParsed.trainerId, "TRAINER", { countTowardResendCooldown: true });
      await prisma.trainer.update({
        where: { id: trainerParsed.trainerId },
        data: { twoFactorLoginAttempts: 0 },
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not resend the code.";
      return { ok: false, error: msg };
    }
  }

  return { ok: false, error: "Verification session expired. Sign in again." };
}

export type Verify2FAResult = { ok: false; error: string };

export async function verify2FAAction(
  _prev: Verify2FAResult | null,
  formData: FormData,
): Promise<Verify2FAResult | null> {
  const hdrList = await headers();
  const forwarded = new Headers();
  for (const [k, v] of hdrList.entries()) {
    forwarded.set(k, v);
  }
  const req = new Request("https://match.fit", { headers: forwarded });

  const codeRaw = String(formData.get("code") ?? "").replace(/\D/g, "");
  const nextRaw = formData.get("next");
  const nextPath = safeInternalNextPath(typeof nextRaw === "string" ? nextRaw : undefined);
  const turnstileToken = formData.get("turnstileToken");
  const turn = await verifyTurnstileToken(typeof turnstileToken === "string" ? turnstileToken : undefined, req);
  if (!turn.ok) {
    return { ok: false, error: turn.error };
  }

  if (!/^\d{6}$/.test(codeRaw)) {
    return { ok: false, error: "Enter the complete 6-digit code." };
  }

  const store = await cookies();
  const clientCh = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
  const trainerCh = store.get(TRAINER_LOGIN_CHALLENGE_COOKIE)?.value;

  const clientParsed = clientCh ? await verifyLoginChallengeToken(clientCh) : null;
  if (clientParsed) {
    const { clientId, stayLoggedIn } = clientParsed;
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client?.twoFactorEnabled) {
      return { ok: false, error: "Two-factor authentication is not active for this account." };
    }
    const delivery = await getLoginOtpDelivery(clientId);
    if (!delivery) {
      return { ok: false, error: "Could not resolve your verification method." };
    }

    if (delivery.delivery === "EMAIL") {
      const ch = await findClientEmailChannel(clientId, delivery.email);
      const check = verifyStoredEmailCode(
        { lastCode: ch?.lastCode ?? null, expiresAt: ch?.expiresAt ?? null },
        codeRaw,
      );
      if (check.ok === false) {
        if (check.reason === "missing") {
          return { ok: false, error: "No active verification code. Request a new code or sign in again." };
        }
        if (check.reason === "expired") {
          return {
            ok: false,
            error: "That code has expired. Request a new code or sign in again.",
          };
        }
        const prev = client.twoFactorLoginAttempts ?? 0;
        const attempts = prev + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await prisma.$transaction(async (tx) => {
            await tx.client.update({
              where: { id: clientId },
              data: { twoFactorLoginAttempts: 0 },
            });
            if (ch) {
              await tx.clientTwoFactorChannel.update({
                where: { id: ch.id },
                data: { lastCode: null, expiresAt: null },
              });
            }
          });
          return {
            ok: false,
            error: "Too many incorrect codes. Request a new code from the sign-in page.",
          };
        }
        await prisma.client.update({
          where: { id: clientId },
          data: { twoFactorLoginAttempts: attempts },
        });
        const remaining = MAX_ATTEMPTS - attempts;
        return {
          ok: false,
          error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        };
      }

      if (!ch) {
        return { ok: false, error: "No active verification code. Request a new code or sign in again." };
      }

      const suspended = await prisma.client.findUnique({
        where: { id: clientId },
        select: { safetySuspended: true },
      });
      if (suspended?.safetySuspended) {
        return {
          ok: false,
          error:
            "Your client account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
        };
      }

      await prisma.$transaction([
        prisma.clientTwoFactorChannel.update({
          where: { id: ch.id },
          data: { lastCode: null, expiresAt: null },
        }),
        prisma.client.update({
          where: { id: clientId },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            twoFactorLoginAttempts: 0,
            stayLoggedIn,
          },
        }),
      ]);
      await clearLoginChallengeCookie();
      await setClientSession(clientId, stayLoggedIn);
      redirect(nextPath ?? "/client/dashboard");
    }

    if (!client.twoFactorOtpHash || !client.twoFactorOtpExpires) {
      return { ok: false, error: "No active verification code. Request a new code or sign in again." };
    }
    if (client.twoFactorOtpExpires < new Date()) {
      return { ok: false, error: "That code has expired. Request a new code or sign in again." };
    }
    if (!verifyOtp(codeRaw, client.twoFactorOtpHash)) {
      const prev = client.twoFactorLoginAttempts ?? 0;
      const attempts = prev + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.client.update({
          where: { id: clientId },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            twoFactorLoginAttempts: 0,
          },
        });
        return { ok: false, error: "Too many incorrect codes. Request a new code from the sign-in page." };
      }
      await prisma.client.update({
        where: { id: clientId },
        data: { twoFactorLoginAttempts: attempts },
      });
      const remaining = MAX_ATTEMPTS - attempts;
      return {
        ok: false,
        error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      };
    }

    const suspendedGate = await prisma.client.findUnique({
      where: { id: clientId },
      select: { safetySuspended: true },
    });
    if (suspendedGate?.safetySuspended) {
      return {
        ok: false,
        error:
          "Your client account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
      };
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        stayLoggedIn,
      },
    });
    await clearLoginChallengeCookie();
    await setClientSession(clientId, stayLoggedIn);
    redirect(nextPath ?? "/client/dashboard");
  }

  const trainerParsed = trainerCh ? await verifyTrainerLoginChallengeToken(trainerCh) : null;
  if (trainerParsed) {
    const { trainerId, stayLoggedIn, redirectAfter } = trainerParsed;
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer?.twoFactorEnabled) {
      return { ok: false, error: "Two-factor authentication is not active for this account." };
    }
    const delivery = await getTrainerLoginOtpDelivery(trainerId);
    if (!delivery) {
      return { ok: false, error: "Could not resolve your verification method." };
    }

    if (delivery.delivery === "EMAIL") {
      const ch = await findTrainerEmailChannel(trainerId, delivery.email);
      const check = verifyStoredEmailCode(
        { lastCode: ch?.lastCode ?? null, expiresAt: ch?.expiresAt ?? null },
        codeRaw,
      );
      if (check.ok === false) {
        if (check.reason === "missing") {
          return { ok: false, error: "No active verification code. Request a new code or sign in again." };
        }
        if (check.reason === "expired") {
          return {
            ok: false,
            error: "That code has expired. Request a new code or sign in again.",
          };
        }
        const prev = trainer.twoFactorLoginAttempts ?? 0;
        const attempts = prev + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await prisma.$transaction(async (tx) => {
            await tx.trainer.update({
              where: { id: trainerId },
              data: { twoFactorLoginAttempts: 0 },
            });
            if (ch) {
              await tx.trainerTwoFactorChannel.update({
                where: { id: ch.id },
                data: { lastCode: null, expiresAt: null },
              });
            }
          });
          return {
            ok: false,
            error: "Too many incorrect codes. Request a new code from the sign-in page.",
          };
        }
        await prisma.trainer.update({
          where: { id: trainerId },
          data: { twoFactorLoginAttempts: attempts },
        });
        const remaining = MAX_ATTEMPTS - attempts;
        return {
          ok: false,
          error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        };
      }

      if (!ch) {
        return { ok: false, error: "No active verification code. Request a new code or sign in again." };
      }

      const suspended = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: { safetySuspended: true },
      });
      if (suspended?.safetySuspended) {
        return {
          ok: false,
          error:
            "Your trainer account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
        };
      }

      await prisma.$transaction([
        prisma.trainerTwoFactorChannel.update({
          where: { id: ch.id },
          data: { lastCode: null, expiresAt: null },
        }),
        prisma.trainer.update({
          where: { id: trainerId },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            twoFactorLoginAttempts: 0,
            stayLoggedIn,
          },
        }),
      ]);
      await clearTrainerLoginChallengeCookie();
      await setTrainerSession(trainerId, stayLoggedIn);
      redirect(nextPath ?? redirectAfter ?? "/trainer/dashboard");
    }

    if (!trainer.twoFactorOtpHash || !trainer.twoFactorOtpExpires) {
      return { ok: false, error: "No active verification code. Request a new code or sign in again." };
    }
    if (trainer.twoFactorOtpExpires < new Date()) {
      return { ok: false, error: "That code has expired. Request a new code or sign in again." };
    }
    if (!verifyOtp(codeRaw, trainer.twoFactorOtpHash)) {
      const prev = trainer.twoFactorLoginAttempts ?? 0;
      const attempts = prev + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.trainer.update({
          where: { id: trainerId },
          data: {
            twoFactorOtpHash: null,
            twoFactorOtpExpires: null,
            twoFactorLoginAttempts: 0,
          },
        });
        return { ok: false, error: "Too many incorrect codes. Request a new code from the sign-in page." };
      }
      await prisma.trainer.update({
        where: { id: trainerId },
        data: { twoFactorLoginAttempts: attempts },
      });
      const remaining = MAX_ATTEMPTS - attempts;
      return {
        ok: false,
        error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      };
    }

    const suspendedGate = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { safetySuspended: true },
    });
    if (suspendedGate?.safetySuspended) {
      return {
        ok: false,
        error:
          "Your trainer account is suspended pending a Match Fit safety review. You will regain access once the review is complete.",
      };
    }

    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        twoFactorOtpHash: null,
        twoFactorOtpExpires: null,
        twoFactorLoginAttempts: 0,
        stayLoggedIn,
      },
    });
    await clearTrainerLoginChallengeCookie();
    await setTrainerSession(trainerId, stayLoggedIn);
    redirect(nextPath ?? redirectAfter ?? "/trainer/dashboard");
  }

  return { ok: false, error: "Verification session expired. Sign in again." };
}
