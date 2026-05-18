import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  betaInviteSlotDays,
  betaMaxClients,
  betaMaxTrainers,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";
import { countLaunchClients, countLaunchTrainers } from "@/lib/launch-account-counts";
import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";

export async function countTrainersForBetaCap(): Promise<number> {
  return countLaunchTrainers();
}

export async function countClientsForBetaCap(): Promise<number> {
  return countLaunchClients();
}

export async function isTrainerBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  return (await countTrainersForBetaCap()) >= betaMaxTrainers();
}

export async function isClientBetaCapReached(): Promise<boolean> {
  if (!isBetaLaunchGatesEnabled()) return false;
  return (await countClientsForBetaCap()) >= betaMaxClients();
}

function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

async function queuePositionTrainer(): Promise<number> {
  return prisma.betaTrainerWaitlistEntry.count({
    where: { status: "QUEUED" },
  });
}

async function queuePositionClient(): Promise<number> {
  return prisma.betaClientWaitlistEntry.count({
    where: { status: "QUEUED" },
  });
}

export async function joinBetaTrainerWaitlist(args: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  desiredUsername: string;
  serviceZipCode: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  if (!isBetaLaunchGatesEnabled()) {
    return { error: "Waitlist is not open." };
  }
  if (!isZipInBetaAtlantaMetroArea(args.serviceZipCode)) {
    return { error: "That ZIP is outside the Atlanta metro beta area." };
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
      updatedAt: new Date(),
    },
  });

  const pos = await queuePositionTrainer();
  const base = appBaseUrlForEmail();
  void sendTransactionalEmailIfAllowed({
    kind: "BETA_WAITLIST_TRAINER_CONFIRM",
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
  if (!isZipInBetaAtlantaMetroArea(args.homeZipCode)) {
    return { error: "That ZIP is outside the Atlanta metro beta area." };
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
      OR: [
        { status: "QUEUED" },
        { status: "INVITED", slotExpiresAt: { gt: now } },
      ],
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
      OR: [
        { status: "QUEUED" },
        { status: "INVITED", slotExpiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
  return Boolean(w);
}

export type BetaInvitePayload =
  | { role: "trainer"; entryId: string; email: string; desiredUsername: string; firstName: string }
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
    select: { id: true, email: true, desiredUsername: true, firstName: true },
  });
  if (tr) {
    return { role: "trainer", entryId: tr.id, email: tr.email, desiredUsername: tr.desiredUsername, firstName: tr.firstName };
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

export async function runBetaWaitlistCronJobs(): Promise<{
  trainerInvitesExpired: number;
  clientInvitesExpired: number;
  trainerInvitesSent: number;
  clientInvitesSent: number;
}> {
  if (!isBetaLaunchGatesEnabled()) {
    return { trainerInvitesExpired: 0, clientInvitesExpired: 0, trainerInvitesSent: 0, clientInvitesSent: 0 };
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

  while ((await countTrainersForBetaCap()) < betaMaxTrainers()) {
    const next = await prisma.betaTrainerWaitlistEntry.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    if (!next) break;
    const u = next.desiredUsername.trim();
    const takenTrainer = await prisma.trainer.findFirst({ where: { username: u, deidentifiedAt: null }, select: { id: true } });
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
    trainerInvitesSent += 1;
  }

  while ((await countClientsForBetaCap()) < betaMaxClients()) {
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

  return { trainerInvitesExpired, clientInvitesExpired, trainerInvitesSent, clientInvitesSent };
}

/** Run waitlist expiry + fill open beta slots (safe to call after account removal or on a schedule). */
export async function promoteBetaWaitlistIfCapacity(): Promise<{
  trainerInvitesExpired: number;
  clientInvitesExpired: number;
  trainerInvitesSent: number;
  clientInvitesSent: number;
}> {
  return runBetaWaitlistCronJobs();
}
