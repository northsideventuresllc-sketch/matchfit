import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  betaInviteSlotDays,
  betaMaxClients,
  betaMaxTotalTrainers,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";
import { notifyBetaTrainerCapacityExpansionIfNeeded } from "@/lib/beta-trainer-capacity-notify";
import {
  canReserveTrainerBetaSlots,
  getTrainerBetaSlotSnapshot,
  trainerBetaSlotPrefsFromWaitlistEntry,
  trainerOfferingPrefsFromSignup,
  type TrainerBetaOfferingPrefs,
  type TrainerBetaSlotSnapshot,
} from "@/lib/beta-trainer-slot-caps";
import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { countLaunchClients, countLaunchTrainers } from "@/lib/launch-account-counts";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";

import type { Prisma } from "@/generated/prisma/client";

type BetaCapDb = Prisma.TransactionClient | typeof prisma;

export async function countTrainersForBetaCap(): Promise<number> {
  return countLaunchTrainers();
}

export async function countClientsForBetaCap(): Promise<number> {
  return countLaunchClients();
}

/** Non-expired waitlist invites reserve a beta slot until signup or expiry. */
export async function countActiveTrainerBetaInvites(db: BetaCapDb = prisma): Promise<number> {
  return db.betaTrainerWaitlistEntry.count({
    where: { status: "INVITED", slotExpiresAt: { gt: new Date() } },
  });
}

export async function countActiveClientBetaInvites(db: BetaCapDb = prisma): Promise<number> {
  return db.betaClientWaitlistEntry.count({
    where: { status: "INVITED", slotExpiresAt: { gt: new Date() } },
  });
}

export async function getTrainerBetaSlotSnapshotInTx(tx: Prisma.TransactionClient): Promise<TrainerBetaSlotSnapshot> {
  return getTrainerBetaSlotSnapshot(tx);
}

export async function trainerBetaSlotsUsed(db: BetaCapDb = prisma): Promise<number> {
  const snapshot = await getTrainerBetaSlotSnapshot(db);
  return snapshot.totalUsed;
}

export async function clientBetaSlotsUsed(db: BetaCapDb = prisma): Promise<number> {
  const [registered, invited] = await Promise.all([
    countClientsForBetaCap(),
    countActiveClientBetaInvites(db),
  ]);
  return registered + invited;
}

/** Total founding coach cap (30) reached — blocks new signups without invite. */
export async function isTrainerBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  const snapshot = await getTrainerBetaSlotSnapshot();
  return snapshot.totalRemaining <= 0;
}

export async function isTrainerVirtualBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  const snapshot = await getTrainerBetaSlotSnapshot();
  return snapshot.virtualRemaining <= 0;
}

export async function isTrainerInPersonBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  const snapshot = await getTrainerBetaSlotSnapshot();
  return snapshot.inPersonRemaining <= 0;
}

export async function isClientBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  return (await clientBetaSlotsUsed()) >= betaMaxClients();
}

function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

async function queuePositionTrainer(where: Prisma.BetaTrainerWaitlistEntryWhereInput): Promise<number> {
  return prisma.betaTrainerWaitlistEntry.count({ where });
}

async function queuePositionClient(): Promise<number> {
  return prisma.betaClientWaitlistEntry.count({
    where: { status: "QUEUED" },
  });
}

function waitlistConfirmKind(
  prefs: TrainerBetaOfferingPrefs,
): "BETA_WAITLIST_TRAINER_CONFIRM" | "BETA_WAITLIST_TRAINER_IN_PERSON_CONFIRM" | "BETA_WAITLIST_TRAINER_VIRTUAL_CONFIRM" {
  if (prefs.wantsInPerson && !prefs.wantsVirtual) return "BETA_WAITLIST_TRAINER_IN_PERSON_CONFIRM";
  if (prefs.wantsVirtual && !prefs.wantsInPerson) return "BETA_WAITLIST_TRAINER_VIRTUAL_CONFIRM";
  return "BETA_WAITLIST_TRAINER_CONFIRM";
}

export async function joinBetaTrainerWaitlist(args: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  desiredUsername: string;
  serviceZipCode: string;
  desiredOfferingVirtual?: boolean;
  desiredOfferingInPerson?: boolean;
}): Promise<{ ok: true; id: string } | { error: string }> {
  if (!isBetaLaunchGatesEnabled()) {
    return { error: "Waitlist is not open." };
  }

  const prefs = trainerOfferingPrefsFromSignup({
    wantsVirtual: args.desiredOfferingVirtual,
    wantsInPerson: args.desiredOfferingInPerson,
  });
  if (!prefs.wantsVirtual && !prefs.wantsInPerson) {
    return { error: "Select at least one offering type for the waitlist." };
  }

  const snapshot = await getTrainerBetaSlotSnapshot();
  const needsVirtualWaitlist = prefs.wantsVirtual && snapshot.virtualRemaining <= 0;
  const needsInPersonWaitlist = prefs.wantsInPerson && snapshot.inPersonRemaining <= 0;
  const needsTotalWaitlist = snapshot.totalRemaining <= 0;

  if (!needsVirtualWaitlist && !needsInPersonWaitlist && !needsTotalWaitlist) {
    return { error: "Trainer slots are still available — sign up instead of joining the waitlist." };
  }

  if (prefs.wantsInPerson && !isZipInBetaAtlantaMetroArea(args.serviceZipCode)) {
    return { error: "In-person waitlist entries require a ZIP inside the Atlanta metro beta area." };
  }

  const email = args.email.trim().toLowerCase();
  const desiredUsername = args.desiredUsername.trim();
  const taken = await isTrainerWaitlistUsernameConflict(desiredUsername);
  if (taken) {
    return { error: "That username is already taken or reserved." };
  }
  const dup = await prisma.betaTrainerWaitlistEntry.findFirst({
    where: {
      email,
      status: { in: ["QUEUED", "INVITED"] },
    },
    select: { id: true },
  });
  if (dup) {
    return { error: "This email is already on the trainer waitlist." };
  }

  const row = await prisma.betaTrainerWaitlistEntry.create({
    data: {
      status: "QUEUED",
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email,
      phone: args.phone.trim(),
      desiredUsername,
      serviceZipCode: args.serviceZipCode.trim(),
      desiredOfferingVirtual: prefs.wantsVirtual,
      desiredOfferingInPerson: prefs.wantsInPerson,
      updatedAt: new Date(),
    },
  });

  const pos = await queuePositionTrainer({ status: "QUEUED" });
  const base = appBaseUrlForEmail();
  void sendTransactionalEmailIfAllowed({
    kind: waitlistConfirmKind(prefs),
    to: email,
    audience: "TRAINER",
    variables: {
      firstName: args.firstName.trim(),
      queuePosition: String(pos),
      supportUrl: `${base.replace(/\/$/, "")}/`,
    },
  }).catch((e) => console.error("[beta waitlist trainer confirm email]", e));

  return { ok: true, id: row.id };
}

export async function joinBetaClientWaitlist(args: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  desiredUsername: string;
  homeZipCode: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  if (!isBetaLaunchGatesEnabled()) {
    return { error: "Waitlist is not open." };
  }
  if (!(await isClientBetaCapReached())) {
    return { error: "Client memberships are still available — sign up instead of joining the waitlist." };
  }
  const email = args.email.trim().toLowerCase();
  const desiredUsername = args.desiredUsername.trim();
  const taken = await isClientWaitlistUsernameConflict(desiredUsername);
  if (taken) {
    return { error: "That username is already taken or reserved." };
  }
  const dup = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      email,
      status: { in: ["QUEUED", "INVITED"] },
    },
    select: { id: true },
  });
  if (dup) {
    return { error: "This email is already on the client waitlist." };
  }

  const row = await prisma.betaClientWaitlistEntry.create({
    data: {
      status: "QUEUED",
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email,
      phone: args.phone.trim(),
      desiredUsername,
      homeZipCode: args.homeZipCode.trim(),
      updatedAt: new Date(),
    },
  });

  const pos = await queuePositionClient();
  const base = appBaseUrlForEmail();
  void sendTransactionalEmailIfAllowed({
    kind: "BETA_WAITLIST_CLIENT_CONFIRM",
    to: email,
    audience: "CLIENT",
    variables: {
      firstName: args.firstName.trim(),
      queuePosition: String(pos),
      supportUrl: `${base.replace(/\/$/, "")}/`,
    },
  }).catch((e) => console.error("[beta waitlist client confirm email]", e));

  return { ok: true, id: row.id };
}

/** Active INVITED reservation blocks the username. */
export async function isTrainerWaitlistUsernameConflict(username: string): Promise<boolean> {
  const u = username.trim();
  const now = new Date();
  const w = await prisma.betaTrainerWaitlistEntry.findFirst({
    where: {
      desiredUsername: u,
      OR: [{ status: "QUEUED" }, { status: "INVITED", slotExpiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(w);
}

export async function isClientWaitlistUsernameConflict(username: string): Promise<boolean> {
  const u = username.trim();
  const now = new Date();
  const w = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      desiredUsername: u,
      OR: [{ status: "QUEUED" }, { status: "INVITED", slotExpiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  return Boolean(w);
}

export type BetaInvitePayload =
  | {
      role: "trainer";
      entryId: string;
      email: string;
      desiredUsername: string;
      firstName: string;
      desiredOfferingVirtual: boolean;
      desiredOfferingInPerson: boolean;
    }
  | { role: "client"; entryId: string; email: string; desiredUsername: string; firstName: string };

export async function getValidBetaInvite(token: string | undefined): Promise<BetaInvitePayload | null> {
  const t = token?.trim();
  if (!t) return null;
  const tr = await prisma.betaTrainerWaitlistEntry.findFirst({
    where: {
      inviteToken: t,
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      desiredUsername: true,
      firstName: true,
      desiredOfferingVirtual: true,
      desiredOfferingInPerson: true,
    },
  });
  if (tr) {
    return {
      role: "trainer",
      entryId: tr.id,
      email: tr.email,
      desiredUsername: tr.desiredUsername,
      firstName: tr.firstName,
      desiredOfferingVirtual: tr.desiredOfferingVirtual,
      desiredOfferingInPerson: tr.desiredOfferingInPerson,
    };
  }
  const cl = await prisma.betaClientWaitlistEntry.findFirst({
    where: {
      inviteToken: t,
      status: "INVITED",
      slotExpiresAt: { gt: new Date() },
    },
    select: { id: true, email: true, desiredUsername: true, firstName: true },
  });
  if (cl) {
    return { role: "client", entryId: cl.id, email: cl.email, desiredUsername: cl.desiredUsername, firstName: cl.firstName };
  }
  return null;
}

export async function markTrainerWaitlistRegistered(entryId: string, trainerId: string): Promise<void> {
  await prisma.betaTrainerWaitlistEntry.updateMany({
    where: { id: entryId, status: "INVITED" },
    data: {
      status: "REGISTERED",
      registeredTrainerId: trainerId,
      updatedAt: new Date(),
    },
  });
}

export async function markClientWaitlistRegistered(entryId: string, clientId: string): Promise<void> {
  await prisma.betaClientWaitlistEntry.updateMany({
    where: { id: entryId, status: "INVITED" },
    data: {
      status: "REGISTERED",
      registeredClientId: clientId,
      updatedAt: new Date(),
    },
  });
}

async function promoteNextTrainerInvite(now: Date, slotMs: number, base: string): Promise<boolean> {
  const snapshot = await getTrainerBetaSlotSnapshot();
  if (snapshot.totalRemaining <= 0) return false;

  const queued = await prisma.betaTrainerWaitlistEntry.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  for (const next of queued) {
    const prefs = trainerBetaSlotPrefsFromWaitlistEntry(next);
    if (!canReserveTrainerBetaSlots(snapshot, prefs).ok) continue;

    const u = next.desiredUsername.trim();
    const takenTrainer = await prisma.trainer.findFirst({
      where: { username: u, deidentifiedAt: null },
      select: { id: true },
    });
    const otherWait = await prisma.betaTrainerWaitlistEntry.findFirst({
      where: {
        desiredUsername: u,
        NOT: { id: next.id },
        OR: [{ status: "QUEUED" }, { status: "INVITED", slotExpiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (takenTrainer || otherWait) {
      await prisma.betaTrainerWaitlistEntry.update({
        where: { id: next.id },
        data: { status: "CANCELLED", updatedAt: now },
      });
      continue;
    }

    const token = newInviteToken();
    const slotExpiresAt = new Date(Date.now() + slotMs);
    await prisma.betaTrainerWaitlistEntry.update({
      where: { id: next.id },
      data: {
        status: "INVITED",
        inviteToken: token,
        invitedAt: now,
        slotExpiresAt,
        updatedAt: now,
      },
    });
    const joinUrl = `${base}/trainer/signup?betaInvite=${encodeURIComponent(token)}`;
    void sendTransactionalEmailIfAllowed({
      kind: "BETA_WAITLIST_TRAINER_INVITE",
      to: next.email,
      audience: "TRAINER",
      variables: {
        firstName: next.firstName,
        joinUrl,
        reservedUsername: next.desiredUsername,
        slotExpiresLabel: slotExpiresAt.toLocaleDateString("en-US", { dateStyle: "long" }),
      },
    }).catch((e) => console.error("[beta trainer invite email]", e));
    return true;
  }
  return false;
}

export async function runBetaWaitlistCronJobs(): Promise<{
  trainerInvitesExpired: number;
  clientInvitesExpired: number;
  trainerInvitesSent: number;
  clientInvitesSent: number;
  virtualCapacityEmailsSent: number;
  inPersonCapacityEmailsSent: number;
}> {
  if (!isBetaLaunchGatesEnabled()) {
    return {
      trainerInvitesExpired: 0,
      clientInvitesExpired: 0,
      trainerInvitesSent: 0,
      clientInvitesSent: 0,
      virtualCapacityEmailsSent: 0,
      inPersonCapacityEmailsSent: 0,
    };
  }
  const now = new Date();
  let trainerInvitesExpired = 0;
  let clientInvitesExpired = 0;

  const exTr = await prisma.betaTrainerWaitlistEntry.updateMany({
    where: { status: "INVITED", slotExpiresAt: { lte: now } },
    data: { status: "EXPIRED", updatedAt: now, inviteToken: null },
  });
  trainerInvitesExpired = exTr.count;

  const exCl = await prisma.betaClientWaitlistEntry.updateMany({
    where: { status: "INVITED", slotExpiresAt: { lte: now } },
    data: { status: "EXPIRED", updatedAt: now, inviteToken: null },
  });
  clientInvitesExpired = exCl.count;

  let trainerInvitesSent = 0;
  let clientInvitesSent = 0;
  const slotMs = betaInviteSlotDays() * 24 * 60 * 60 * 1000;
  const base = appBaseUrlForEmail().replace(/\/$/, "");

  while ((await getTrainerBetaSlotSnapshot()).totalUsed < betaMaxTotalTrainers()) {
    const promoted = await promoteNextTrainerInvite(now, slotMs, base);
    if (!promoted) break;
    trainerInvitesSent += 1;
  }

  while ((await clientBetaSlotsUsed()) < betaMaxClients()) {
    const next = await prisma.betaClientWaitlistEntry.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    if (!next) break;
    const u = next.desiredUsername.trim();
    const takenClient = await prisma.client.findFirst({ where: { username: u, deidentifiedAt: null }, select: { id: true } });
    const otherWait = await prisma.betaClientWaitlistEntry.findFirst({
      where: {
        desiredUsername: u,
        NOT: { id: next.id },
        OR: [{ status: "QUEUED" }, { status: "INVITED", slotExpiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (takenClient || otherWait) {
      await prisma.betaClientWaitlistEntry.update({
        where: { id: next.id },
        data: { status: "CANCELLED", updatedAt: now },
      });
      continue;
    }
    const token = newInviteToken();
    const slotExpiresAt = new Date(Date.now() + slotMs);
    await prisma.betaClientWaitlistEntry.update({
      where: { id: next.id },
      data: {
        status: "INVITED",
        inviteToken: token,
        invitedAt: now,
        slotExpiresAt,
        updatedAt: now,
      },
    });
    const joinUrl = `${base}/client/sign-up?betaInvite=${encodeURIComponent(token)}`;
    void sendTransactionalEmailIfAllowed({
      kind: "BETA_WAITLIST_CLIENT_INVITE",
      to: next.email,
      audience: "CLIENT",
      variables: {
        firstName: next.firstName,
        joinUrl,
        reservedUsername: next.desiredUsername,
        slotExpiresLabel: slotExpiresAt.toLocaleDateString("en-US", { dateStyle: "long" }),
      },
    }).catch((e) => console.error("[beta client invite email]", e));
    clientInvitesSent += 1;
  }

  const capacityNotify = await notifyBetaTrainerCapacityExpansionIfNeeded();

  return {
    trainerInvitesExpired,
    clientInvitesExpired,
    trainerInvitesSent,
    clientInvitesSent,
    virtualCapacityEmailsSent: capacityNotify.virtualCapacityEmailsSent,
    inPersonCapacityEmailsSent: capacityNotify.inPersonCapacityEmailsSent,
  };
}

/** Run waitlist expiry + fill open beta slots (safe to call after account removal or on a schedule). */
export async function promoteBetaWaitlistIfCapacity(): Promise<{
  trainerInvitesExpired: number;
  clientInvitesExpired: number;
  trainerInvitesSent: number;
  clientInvitesSent: number;
  virtualCapacityEmailsSent: number;
  inPersonCapacityEmailsSent: number;
}> {
  return runBetaWaitlistCronJobs();
}
