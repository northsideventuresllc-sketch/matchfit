import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLoginOtpDelivery } from "@/lib/login-two-factor-target";
import { prisma } from "@/lib/prisma";
import { LOGIN_CHALLENGE_COOKIE, verifyLoginChallengeToken } from "@/lib/session";
import { safeInternalNextPath } from "@/lib/safe-internal-next-path";
import { Verify2faClient } from "./verify-2fa-client";

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function Verify2faPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const nextAfterLogin = safeInternalNextPath(sp.next);
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

  return (
    <Verify2faClient
      deliveryMethod={delivery.delivery}
      showDevPhoneMockBanner={showDevPhoneMockBanner}
      redirectAfterVerify={nextAfterLogin}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
    />
  );
}
