import { prisma } from "@/lib/prisma";

const pairOr: (trainerId: string, clientId: string) => Array<{
  blockerIsTrainer: boolean;
  blockerId: string;
  blockedIsTrainer: boolean;
  blockedId: string;
}> = (trainerId, clientId) => [
  {
    blockerIsTrainer: true,
    blockerId: trainerId,
    blockedIsTrainer: false,
    blockedId: clientId,
  },
  {
    blockerIsTrainer: false,
    blockerId: clientId,
    blockedIsTrainer: true,
    blockedId: trainerId,
  },
];

/** True when either side has disabled direct chat for this pair. */
export async function isTrainerClientChatBlocked(trainerId: string, clientId: string): Promise<boolean> {
  const n = await prisma.userBlock.count({
    where: {
      blockDirectChat: true,
      OR: pairOr(trainerId, clientId),
    },
  });
  return n > 0;
}

/** Trainer ids the client must not see in chat-style surfaces when chat is blocked. */
export async function getTrainerIdsWithChatBlockedForClient(clientId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: {
      blockDirectChat: true,
      OR: [
        { blockerIsTrainer: false, blockerId: clientId, blockedIsTrainer: true },
        { blockerIsTrainer: true, blockedIsTrainer: false, blockedId: clientId },
      ],
    },
    select: { blockerIsTrainer: true, blockerId: true, blockedIsTrainer: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerIsTrainer) ids.add(r.blockerId);
    else if (r.blockedIsTrainer) ids.add(r.blockedId);
  }
  return ids;
}

/** Client ids the trainer must not see in chat-style surfaces when chat is blocked. */
export async function getClientIdsWithChatBlockedForTrainer(trainerId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: {
      blockDirectChat: true,
      OR: [
        { blockerIsTrainer: true, blockerId: trainerId, blockedIsTrainer: false },
        { blockerIsTrainer: false, blockedIsTrainer: true, blockedId: trainerId },
      ],
    },
    select: { blockerIsTrainer: true, blockerId: true, blockedIsTrainer: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerIsTrainer && !r.blockedIsTrainer) ids.add(r.blockedId);
    if (!r.blockerIsTrainer && r.blockedIsTrainer) ids.add(r.blockerId);
  }
  return ids;
}

/** Client’s match / browse surfaces should not surface this trainer. */
export async function clientHasTrainerHiddenFromMatchFeed(clientId: string, trainerId: string): Promise<boolean> {
  const n = await prisma.userBlock.count({
    where: {
      hideTrainerFromClientMatchFeed: true,
      OR: pairOr(trainerId, clientId),
    },
  });
  return n > 0;
}

/** Client’s FitHub feed should not include this trainer’s posts. */
export async function clientHasTrainerHiddenFromFithub(clientId: string, trainerId: string): Promise<boolean> {
  const n = await prisma.userBlock.count({
    where: {
      hideTrainerFromClientFithub: true,
      OR: pairOr(trainerId, clientId),
    },
  });
  return n > 0;
}

/**
 * Checkout, reviews, and nudges: block when chat is closed or the coach is removed from the client’s match surfaces.
 * FitHub-only mutes do not trigger this.
 */
export async function isTrainerClientInteractionRestricted(trainerId: string, clientId: string): Promise<boolean> {
  if (await isTrainerClientChatBlocked(trainerId, clientId)) return true;
  if (await clientHasTrainerHiddenFromMatchFeed(clientId, trainerId)) return true;
  return false;
}

/** @deprecated Prefer isTrainerClientChatBlocked or isTrainerClientInteractionRestricted. */
export async function isTrainerClientPairBlocked(trainerId: string, clientId: string): Promise<boolean> {
  return isTrainerClientInteractionRestricted(trainerId, clientId);
}

export async function isClientHiddenFromTrainerDiscover(trainerId: string, clientId: string): Promise<boolean> {
  const n = await prisma.userBlock.count({
    where: {
      blockerIsTrainer: true,
      blockerId: trainerId,
      blockedIsTrainer: false,
      blockedId: clientId,
      hideClientFromTrainerDiscover: true,
    },
  });
  return n > 0;
}

export async function isTrainerHiddenFromTrainerFithubViewer(
  viewerTrainerId: string,
  authorTrainerId: string,
): Promise<boolean> {
  if (viewerTrainerId === authorTrainerId) return false;
  const n = await prisma.userBlock.count({
    where: {
      blockerIsTrainer: true,
      blockerId: viewerTrainerId,
      blockedIsTrainer: true,
      blockedId: authorTrainerId,
      hideBlockedTrainerFromViewerTrainerFithub: true,
    },
  });
  return n > 0;
}

export async function getTrainerIdsHiddenFromClientMatchFeed(clientId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: {
      hideTrainerFromClientMatchFeed: true,
      OR: [
        { blockerIsTrainer: false, blockerId: clientId, blockedIsTrainer: true },
        { blockerIsTrainer: true, blockedIsTrainer: false, blockedId: clientId },
      ],
    },
    select: { blockerIsTrainer: true, blockerId: true, blockedIsTrainer: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerIsTrainer) ids.add(r.blockerId);
    else if (r.blockedIsTrainer) ids.add(r.blockedId);
  }
  return ids;
}

export async function getTrainerIdsHiddenFromClientFithub(clientId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: {
      hideTrainerFromClientFithub: true,
      OR: [
        { blockerIsTrainer: false, blockerId: clientId, blockedIsTrainer: true },
        { blockerIsTrainer: true, blockedIsTrainer: false, blockedId: clientId },
      ],
    },
    select: { blockerIsTrainer: true, blockerId: true, blockedIsTrainer: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerIsTrainer) ids.add(r.blockerId);
    else if (r.blockedIsTrainer) ids.add(r.blockedId);
  }
  return ids;
}

export async function getTrainerIdsMutedInTrainerFithub(viewerTrainerId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: {
      blockerIsTrainer: true,
      blockerId: viewerTrainerId,
      blockedIsTrainer: true,
      hideBlockedTrainerFromViewerTrainerFithub: true,
    },
    select: { blockedId: true },
  });
  return new Set(rows.map((r) => r.blockedId));
}

export type UserBlockScopeRow = {
  id: string;
  createdAt: Date;
  blockerIsTrainer: boolean;
  blockedIsTrainer: boolean;
  targetUsername: string;
  targetDisplayName: string;
  hideTrainerFromClientMatchFeed: boolean;
  hideTrainerFromClientFithub: boolean;
  hideClientFromTrainerDiscover: boolean;
  hideBlockedTrainerFromViewerTrainerFithub: boolean;
  blockDirectChat: boolean;
};

export async function listBlocksInitiatedByClient(clientId: string): Promise<UserBlockScopeRow[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerIsTrainer: false, blockerId: clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      blockerIsTrainer: true,
      blockedIsTrainer: true,
      blockedId: true,
      hideTrainerFromClientMatchFeed: true,
      hideTrainerFromClientFithub: true,
      hideClientFromTrainerDiscover: true,
      hideBlockedTrainerFromViewerTrainerFithub: true,
      blockDirectChat: true,
    },
  });
  const trainerIds = rows.filter((r) => r.blockedIsTrainer).map((r) => r.blockedId);
  const trainers =
    trainerIds.length > 0
      ? await prisma.trainer.findMany({
          where: { id: { in: trainerIds } },
          select: { id: true, username: true, firstName: true, lastName: true, preferredName: true },
        })
      : [];
  const tmap = new Map(trainers.map((t) => [t.id, t]));
  const out: UserBlockScopeRow[] = [];
  for (const r of rows) {
    if (!r.blockedIsTrainer) continue;
    const t = tmap.get(r.blockedId);
    if (!t) continue;
    const display =
      t.preferredName?.trim() || [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.username;
    out.push({
      id: r.id,
      createdAt: r.createdAt,
      blockerIsTrainer: r.blockerIsTrainer,
      blockedIsTrainer: r.blockedIsTrainer,
      targetUsername: t.username,
      targetDisplayName: display,
      hideTrainerFromClientMatchFeed: r.hideTrainerFromClientMatchFeed,
      hideTrainerFromClientFithub: r.hideTrainerFromClientFithub,
      hideClientFromTrainerDiscover: r.hideClientFromTrainerDiscover,
      hideBlockedTrainerFromViewerTrainerFithub: r.hideBlockedTrainerFromViewerTrainerFithub,
      blockDirectChat: r.blockDirectChat,
    });
  }
  return out;
}

export async function listBlocksInitiatedByTrainer(trainerId: string): Promise<UserBlockScopeRow[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerIsTrainer: true, blockerId: trainerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      blockerIsTrainer: true,
      blockedIsTrainer: true,
      blockedId: true,
      hideTrainerFromClientMatchFeed: true,
      hideTrainerFromClientFithub: true,
      hideClientFromTrainerDiscover: true,
      hideBlockedTrainerFromViewerTrainerFithub: true,
      blockDirectChat: true,
    },
  });
  const clientIds = rows.filter((r) => !r.blockedIsTrainer).map((r) => r.blockedId);
  const trainerIds = rows.filter((r) => r.blockedIsTrainer).map((r) => r.blockedId);
  const [clients, trainers] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, username: true, firstName: true, lastName: true, preferredName: true },
        })
      : [],
    trainerIds.length
      ? prisma.trainer.findMany({
          where: { id: { in: trainerIds } },
          select: { id: true, username: true, firstName: true, lastName: true, preferredName: true },
        })
      : [],
  ]);
  const cmap = new Map(clients.map((c) => [c.id, c]));
  const tmap = new Map(trainers.map((t) => [t.id, t]));
  const out: UserBlockScopeRow[] = [];
  for (const r of rows) {
    const subject = r.blockedIsTrainer ? tmap.get(r.blockedId) : cmap.get(r.blockedId);
    if (!subject) continue;
    const display =
      "preferredName" in subject && subject.preferredName?.trim()
        ? subject.preferredName.trim()
        : [subject.firstName, subject.lastName].filter(Boolean).join(" ").trim() || subject.username;
    out.push({
      id: r.id,
      createdAt: r.createdAt,
      blockerIsTrainer: r.blockerIsTrainer,
      blockedIsTrainer: r.blockedIsTrainer,
      targetUsername: subject.username,
      targetDisplayName: display,
      hideTrainerFromClientMatchFeed: r.hideTrainerFromClientMatchFeed,
      hideTrainerFromClientFithub: r.hideTrainerFromClientFithub,
      hideClientFromTrainerDiscover: r.hideClientFromTrainerDiscover,
      hideBlockedTrainerFromViewerTrainerFithub: r.hideBlockedTrainerFromViewerTrainerFithub,
      blockDirectChat: r.blockDirectChat,
    });
  }
  return out;
}
