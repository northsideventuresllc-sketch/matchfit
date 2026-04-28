import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { TRAINER_LOGIN_CHALLENGE_COOKIE, verifyTrainerLoginChallengeToken } from "@/lib/session";
import { Verify2faClient } from "@/app/client/verify-2fa/verify-2fa-client";

export default async function TrainerVerify2faPage() {
  const store = await cookies();
  const raw = store.get(TRAINER_LOGIN_CHALLENGE_COOKIE)?.value;
  const challenge = raw ? await verifyTrainerLoginChallengeToken(raw) : null;
  if (!challenge) {
    redirect("/trainer/dashboard/login");
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: challenge.trainerId },
    select: { twoFactorEnabled: true },
  });

  const delivery = await getTrainerLoginOtpDelivery(challenge.trainerId);
  if (!trainer?.twoFactorEnabled || !delivery) {
    redirect("/trainer/dashboard/login");
  }

  const showDevPhoneMockBanner =
    process.env.NODE_ENV === "development" && (delivery.delivery === "SMS" || delivery.delivery === "VOICE");

  return (
    <Verify2faClient
      deliveryMethod={delivery.delivery}
      showDevPhoneMockBanner={showDevPhoneMockBanner}
      completeTwoFactorUrl="/api/trainer/login/complete-2fa"
      resendTwoFactorUrl="/api/trainer/login/resend-2fa"
      cancelTwoFactorUrl="/api/trainer/login/cancel-2fa"
      afterVerifyHref="/trainer/dashboard"
      cancelReturnHref="/trainer/dashboard/login"
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
    />
  );
}
