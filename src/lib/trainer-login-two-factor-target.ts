import type { OtpChannel } from "@/lib/deliver-otp";
import { prisma } from "@/lib/prisma";

export type TrainerLoginOtpDelivery = {
  delivery: OtpChannel;
  email: string;
  phone: string;
};

export async function getTrainerLoginOtpDelivery(trainerId: string): Promise<TrainerLoginOtpDelivery | null> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { email: true, phone: true, twoFactorEnabled: true, twoFactorMethod: true },
  });
  if (!trainer?.twoFactorEnabled) return null;

  const ch = await prisma.trainerTwoFactorChannel.findFirst({
    where: { trainerId, verified: true, isDefaultLogin: true },
    orderBy: { createdAt: "asc" },
  });
  if (ch) {
    const delivery = ch.delivery as OtpChannel;
    if (delivery === "EMAIL") {
      const email = (ch.email ?? trainer.email).trim().toLowerCase();
      return { delivery: "EMAIL", email, phone: trainer.phone };
    }
    const phone = (ch.phone ?? trainer.phone).trim();
    return { delivery, email: trainer.email, phone };
  }

  const method = trainer.twoFactorMethod;
  if (method && method !== "NONE") {
    return {
      delivery: method as OtpChannel,
      email: trainer.email,
      phone: trainer.phone,
    };
  }

  return null;
}
