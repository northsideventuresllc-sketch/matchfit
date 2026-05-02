import { CLIENT_TRAINER_PASS_COOLDOWN_DAYS } from "@/lib/client-trainer-browse";
import { prisma } from "@/lib/prisma";

const MS_PER_DAY = 86_400_000;

export type UnmatchActor = "CLIENT" | "TRAINER";

export function unmatchArchiveRetentionMs(): number {
  return CLIENT_TRAINER_PASS_COOLDOWN_DAYS * MS_PER_DAY;
}

/** Deletes archived conversations past retention and both browse-pass rows for the pair. */
export async function purgeExpiredArchivedConversations(): Promise<number> {
  const now = new Date();
  const expired = await prisma.trainerClientConversation.findMany({
    where: { archiveExpiresAt: { lte: now } },
    select: { id: true, clientId: true, trainerId: true },
  });
  if (expired.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const row of expired) {
      await tx.clientTrainerBrowsePass.deleteMany({
        where: { clientId: row.clientId, trainerId: row.trainerId },
      });
      await tx.trainerClientBrowsePass.deleteMany({
        where: { trainerId: row.trainerId, clientId: row.clientId },
      });
      await tx.trainerClientConversation.delete({ where: { id: row.id } });
    }
  });

  return expired.length;
}

/**
 * Archive / unmatch: clears live chat, removes saved interest, applies 90-day browse exclusion for the actor’s side.
 */
export async function archiveTrainerClientPair(args: {
  actor: UnmatchActor;
  clientId: string;
  trainerId: string;
}): Promise<{ ok: true } | { error: string; code?: string }> {
  const { actor, clientId, trainerId } = args;
  const existing = await prisma.trainerClientConversation.findUnique({
    where: { trainerId_clientId: { trainerId, clientId } },
    select: { id: true, archivedAt: true },
  });
  if (existing?.archivedAt) {
    return { error: "This conversation is already archived.", code: "ALREADY_ARCHIVED" };
  }

  const now = new Date();
  const archiveExpiresAt = new Date(now.getTime() + unmatchArchiveRetentionMs());

  await prisma.$transaction(async (tx) => {
    await tx.trainerClientConversation.upsert({
      where: { trainerId_clientId: { trainerId, clientId } },
      create: {
        trainerId,
        clientId,
        relationshipStage: "POTENTIAL_CLIENT",
        archivedAt: now,
        archiveExpiresAt,
        unmatchInitiatedBy: actor,
        officialChatStartedAt: null,
      },
      update: {
        archivedAt: now,
        archiveExpiresAt,
        unmatchInitiatedBy: actor,
        officialChatStartedAt: null,
        updatedAt: now,
      },
    });

    await tx.clientSavedTrainer.deleteMany({ where: { clientId, trainerId } });

    if (actor === "CLIENT") {
      await tx.clientTrainerBrowsePass.upsert({
        where: { clientId_trainerId: { clientId, trainerId } },
        create: { clientId, trainerId, lastPassedAt: now },
        update: { lastPassedAt: now },
      });
    } else {
      await tx.trainerClientBrowsePass.upsert({
        where: { trainerId_clientId: { trainerId, clientId } },
        create: { trainerId, clientId, lastPassedAt: now },
        update: { lastPassedAt: now },
      });
    }
  });

  return { ok: true };
}

/** Restores chat for the pair; only the original archiver may call within the archive window. */
export async function reviveTrainerClientPair(args: {
  actor: UnmatchActor;
  clientId: string;
  trainerId: string;
}): Promise<{ ok: true } | { error: string; code?: string }> {
  const { actor, clientId, trainerId } = args;
  const conv = await prisma.trainerClientConversation.findUnique({
    where: { trainerId_clientId: { trainerId, clientId } },
  });
  if (!conv?.archivedAt || !conv.archiveExpiresAt) {
    return { error: "No archived conversation to revive.", code: "NOT_ARCHIVED" };
  }
  if (new Date() > conv.archiveExpiresAt) {
    return { error: "This archive has expired.", code: "ARCHIVE_EXPIRED" };
  }
  if (conv.unmatchInitiatedBy !== actor) {
    return {
      error: "Only the person who deleted this chat can revive it.",
      code: "NOT_INITIATOR",
    };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.trainerClientConversation.update({
      where: { id: conv.id },
      data: {
        archivedAt: null,
        archiveExpiresAt: null,
        unmatchInitiatedBy: null,
        officialChatStartedAt: now,
        updatedAt: now,
      },
    }),
    prisma.clientTrainerBrowsePass.deleteMany({ where: { clientId, trainerId } }),
    prisma.trainerClientBrowsePass.deleteMany({ where: { trainerId, clientId } }),
  ]);

  return { ok: true };
}

export function conversationArchiveMetaForActor(args: {
  conv: {
    archivedAt: Date | null;
    archiveExpiresAt: Date | null;
    unmatchInitiatedBy: string | null;
  } | null;
  actor: UnmatchActor;
}): {
  archived: boolean;
  canRevive: boolean;
  archiveExpiresAt: string | null;
  unmatchInitiatedBy: UnmatchActor | null;
} {
  const { conv, actor } = args;
  if (!conv?.archivedAt || !conv.archiveExpiresAt) {
    return {
      archived: false,
      canRevive: false,
      archiveExpiresAt: null,
      unmatchInitiatedBy: null,
    };
  }
  const now = Date.now();
  const expired = conv.archiveExpiresAt.getTime() <= now;
  const initiator =
    conv.unmatchInitiatedBy === "CLIENT" || conv.unmatchInitiatedBy === "TRAINER"
      ? conv.unmatchInitiatedBy
      : null;
  const canRevive = !expired && initiator === actor;
  return {
    archived: true,
    canRevive,
    archiveExpiresAt: conv.archiveExpiresAt.toISOString(),
    unmatchInitiatedBy: initiator,
  };
}
