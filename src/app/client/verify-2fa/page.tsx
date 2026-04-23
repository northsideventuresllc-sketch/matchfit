import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { LOGIN_CHALLENGE_COOKIE, verifyLoginChallengeToken } from "@/lib/session";
import { Verify2faClient } from "./verify-2fa-client";

export default async function Verify2faPage() {
  const store = await cookies();
  const raw = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
  const challenge = raw ? await verifyLoginChallengeToken(raw) : null;
  if (!challenge) {
    redirect("/client");
  }

  const client = await prisma.client.findUnique({
    where: { id: challenge.clientId },
    select: { twoFactorEnabled: true },
  });

  const delivery = await getLoginOtpDelivery(challenge.clientId);
  if (!client?.twoFactorEnabled || !delivery) {
    redirect("/client");
  }

  const showDevPhoneMockBanner =
    process.env.NODE_ENV === "development" &&
    (delivery.delivery === "SMS" || delivery.delivery === "VOICE");

  return <Verify2faClient deliveryMethod={delivery.delivery} showDevPhoneMockBanner={showDevPhoneMockBanner} />;
}
