import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  findClientEmailChannel,
  findTrainerEmailChannel,
  initialResendCooldownSecondsFromLastSend,
} from "@/lib/auth-2fa-email";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";
import {
  LOGIN_CHALLENGE_COOKIE,
  TRAINER_LOGIN_CHALLENGE_COOKIE,
  verifyLoginChallengeToken,
  verifyTrainerLoginChallengeToken,
} from "@/lib/session";
import { getTrainerLoginOtpDelivery } from "@/lib/trainer-login-two-factor-target";
import { Verify2faUnifiedClient } from "./verify-2fa-unified-client";

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function Verify2faUnifiedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const nextAfterLogin = safeInternalNextPath(sp.next);
  const store = await cookies();

  const clientRaw = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
  const trainerRaw = store.get(TRAINER_LOGIN_CHALLENGE_COOKIE)?.value;
  const clientCh = clientRaw ? await verifyLoginChallengeToken(clientRaw) : null;
  const trainerCh = trainerRaw ? await verifyTrainerLoginChallengeToken(trainerRaw) : null;

  if (clientCh) {
    const client = await prisma.client.findUnique({
      where: { id: clientCh.clientId },
      select: { twoFactorEnabled: true },
    });
    const delivery = await getLoginOtpDelivery(clientCh.clientId);
    if (!client?.twoFactorEnabled || !delivery) {
      redirect("/client");
    }
    let initialResendCooldown = 0;
    if (delivery.delivery === "EMAIL") {
      const row = await findClientEmailChannel(clientCh.clientId, delivery.email);
      initialResendCooldown = initialResendCooldownSecondsFromLastSend(row?.lastEmailResendAt);
    }
    return (
      <Verify2faUnifiedClient
        role="client"
        deliveryMethod={delivery.delivery}
        nextAfterLogin={nextAfterLogin}
        initialResendCooldownSeconds={initialResendCooldown}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        cancelReturnHref="/client"
      />
    );
  }

  if (trainerCh) {
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerCh.trainerId },
      select: { twoFactorEnabled: true },
    });
    const delivery = await getTrainerLoginOtpDelivery(trainerCh.trainerId);
    if (!trainer?.twoFactorEnabled || !delivery) {
      redirect("/trainer");
    }
    let initialResendCooldown = 0;
    if (delivery.delivery === "EMAIL") {
      const row = await findTrainerEmailChannel(trainerCh.trainerId, delivery.email);
      initialResendCooldown = initialResendCooldownSecondsFromLastSend(row?.lastEmailResendAt);
    }
    return (
      <Verify2faUnifiedClient
        role="trainer"
        deliveryMethod={delivery.delivery}
        nextAfterLogin={nextAfterLogin}
        initialResendCooldownSeconds={initialResendCooldown}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        cancelReturnHref="/trainer"
      />
    );
  }

  redirect("/client");
}
