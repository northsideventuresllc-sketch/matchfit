import type { OtpChannel } from "@/lib/deliver-otp";
import { prisma } from "@/lib/prisma";

export type LoginOtpDelivery = {
  delivery: OtpChannel;
  email: string;
  phone: string;
};

/**
 * Resolves where login / resend 2FA OTPs are delivered: default verified channel, else legacy Client fields.
 */
export async function getLoginOtpDelivery(clientId: string): Promise<LoginOtpDelivery | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { email: true, phone: true, twoFactorEnabled: true, twoFactorMethod: true },
  });
  if (!client?.twoFactorEnabled) return null;

  const ch = await prisma.clientTwoFactorChannel.findFirst({
    where: { clientId, verified: true, isDefaultLogin: true },
    orderBy: { createdAt: "asc" },
  });
  if (ch) {
    const delivery = ch.delivery as OtpChannel;
    if (delivery === "EMAIL") {
      const email = (ch.email ?? client.email).trim().toLowerCase();
      return { delivery: "EMAIL", email, phone: client.phone };
    }
    const phone = (ch.phone ?? client.phone).trim();
    return { delivery, email: client.email, phone };
  }

  const method = client.twoFactorMethod;
  if (method && method !== "NONE") {
    return {
      delivery: method as OtpChannel,
      email: client.email,
      phone: client.phone,
    };
  }

  return null;
}
