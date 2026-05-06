import { prisma } from "@/lib/prisma";
import { clientHasPaidTrainerOnce } from "@/lib/trainer-client-booking-credits";
import { twilioVoiceConfigured } from "@/lib/twilio-voice-bridge";

export type PhoneCallEligibility = {
  paid: boolean;
  twilioConfigured: boolean;
  clientOptIn: boolean;
  trainerOptIn: boolean;
  ready: boolean;
  archived: boolean;
};

export async function getPhoneCallEligibility(args: {
  clientId: string;
  trainerId: string;
  archived: boolean;
}): Promise<PhoneCallEligibility> {
  if (args.archived) {
    return {
      paid: false,
      twilioConfigured: twilioVoiceConfigured(),
      clientOptIn: false,
      trainerOptIn: false,
      ready: false,
      archived: true,
    };
  }
  const [paid, client, trainer] = await Promise.all([
    clientHasPaidTrainerOnce(args.clientId, args.trainerId),
    prisma.client.findUnique({
      where: { id: args.clientId },
      select: { allowPhoneBridge: true },
    }),
    prisma.trainer.findUnique({
      where: { id: args.trainerId },
      select: { allowPhoneBridge: true },
    }),
  ]);
  const twilio = twilioVoiceConfigured();
  const clientOptIn = Boolean(client?.allowPhoneBridge);
  const trainerOptIn = Boolean(trainer?.allowPhoneBridge);
  return {
    paid,
    twilioConfigured: twilio,
    clientOptIn,
    trainerOptIn,
    ready: Boolean(paid && twilio && clientOptIn && trainerOptIn),
    archived: false,
  };
}
