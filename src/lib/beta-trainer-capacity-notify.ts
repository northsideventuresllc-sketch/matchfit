import { betaMaxInPersonTrainers, isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import { getTrainerBetaSlotSnapshot } from "@/lib/beta-trainer-slot-caps";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

const NOTIFY_STATE_ID = "singleton";

export type BetaTrainerCapacityNotifyResult = {
  virtualCapacityEmailsSent: number;
  inPersonCapacityEmailsSent: number;
  effectiveVirtualMax: number;
  inPersonMax: number;
};

/**
 * When virtual or in-person bucket caps increase, notify queued waitlist coaches from noreply@match-fit.net.
 * Safe to call after registration, deletion, cron promotion, or geo-circle expansion.
 */
export async function notifyBetaTrainerCapacityExpansionIfNeeded(): Promise<BetaTrainerCapacityNotifyResult> {
  if (!isBetaLaunchGatesEnabled()) {
    const snapshot = await getTrainerBetaSlotSnapshot();
    return {
      virtualCapacityEmailsSent: 0,
      inPersonCapacityEmailsSent: 0,
      effectiveVirtualMax: snapshot.effectiveVirtualMax,
      inPersonMax: snapshot.inPersonMax,
    };
  }

  const snapshot = await getTrainerBetaSlotSnapshot();
  const inPersonMax = betaMaxInPersonTrainers();
  const effectiveVirtualMax = snapshot.effectiveVirtualMax;

  const state = await prisma.betaTrainerCapacityNotifyState.upsert({
    where: { id: NOTIFY_STATE_ID },
    create: {
      id: NOTIFY_STATE_ID,
      lastEffectiveVirtualMax: effectiveVirtualMax,
      lastInPersonMax: inPersonMax,
    },
    update: {},
  });

  let virtualCapacityEmailsSent = 0;
  let inPersonCapacityEmailsSent = 0;
  const base = appBaseUrlForEmail().replace(/\/$/, "");

  if (effectiveVirtualMax > state.lastEffectiveVirtualMax) {
    const rows = await prisma.betaTrainerWaitlistEntry.findMany({
      where: {
        status: "QUEUED",
        desiredOfferingVirtual: true,
      },
      select: { email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    });
    for (const row of rows) {
      void sendTransactionalEmailIfAllowed({
        kind: "BETA_WAITLIST_TRAINER_VIRTUAL_CAPACITY",
        to: row.email,
        audience: "TRAINER",
        variables: {
          firstName: row.firstName,
          signupUrl: `${base}/trainer/signup`,
          waitlistUrl: `${base}/waitlist/trainer`,
        },
      }).catch((e) => console.error("[beta trainer virtual capacity email]", e));
      virtualCapacityEmailsSent += 1;
    }
  }

  if (inPersonMax > state.lastInPersonMax) {
    const rows = await prisma.betaTrainerWaitlistEntry.findMany({
      where: {
        status: "QUEUED",
        desiredOfferingInPerson: true,
      },
      select: { email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    });
    for (const row of rows) {
      void sendTransactionalEmailIfAllowed({
        kind: "BETA_WAITLIST_TRAINER_IN_PERSON_CAPACITY",
        to: row.email,
        audience: "TRAINER",
        variables: {
          firstName: row.firstName,
          signupUrl: `${base}/trainer/signup`,
          waitlistUrl: `${base}/waitlist/trainer`,
        },
      }).catch((e) => console.error("[beta trainer in-person capacity email]", e));
      inPersonCapacityEmailsSent += 1;
    }
  }

  if (effectiveVirtualMax !== state.lastEffectiveVirtualMax || inPersonMax !== state.lastInPersonMax) {
    await prisma.betaTrainerCapacityNotifyState.update({
      where: { id: NOTIFY_STATE_ID },
      data: {
        lastEffectiveVirtualMax: effectiveVirtualMax,
        lastInPersonMax: inPersonMax,
      },
    });
  }

  return {
    virtualCapacityEmailsSent,
    inPersonCapacityEmailsSent,
    effectiveVirtualMax,
    inPersonMax,
  };
}

/** Recompute effective virtual max from current usage and notify waitlist if it increased. */
export async function refreshBetaTrainerDynamicVirtualCapacity(): Promise<BetaTrainerCapacityNotifyResult> {
  return notifyBetaTrainerCapacityExpansionIfNeeded();
}
