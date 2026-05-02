import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Inbox notifications auto-archive this long after they were created (if still in inbox). */
export const CLIENT_NOTIFICATION_AUTO_ARCHIVE_MS = 30 * 24 * 60 * 60 * 1000;
/** Archived rows are permanently deleted this long after archival. */
export const CLIENT_NOTIFICATION_ARCHIVE_DELETE_MS = 90 * 24 * 60 * 60 * 1000;

/** True when the DB is missing `client_notifications.archivedAt` (migration not applied). */
export function isClientNotificationArchivedAtSchemaError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2022" &&
    typeof e.message === "string" &&
    e.message.includes("archivedAt")
  );
}

const clientNotificationListSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  linkHref: true,
  readAt: true,
  createdAt: true,
  archivedAt: true,
} as const;

export type ClientNotificationListRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: Date | null;
  createdAt: Date;
  archivedAt: Date | null;
};

/**
 * Inbox or archive list + unread inbox count. Falls back when `client_notifications.archivedAt`
 * migration has not been applied (inbox only; archive returns empty).
 */
export async function queryClientNotificationsForApi(
  clientId: string,
  box: "inbox" | "archive",
): Promise<{ items: ClientNotificationListRow[]; unreadCount: number }> {
  const where =
    box === "archive" ? { clientId, archivedAt: { not: null } } : { clientId, archivedAt: null };
  const orderBy =
    box === "archive" ? ({ archivedAt: "desc" } as const) : ({ createdAt: "desc" } as const);

  try {
    const [items, unreadCount] = await Promise.all([
      prisma.clientNotification.findMany({
        where,
        orderBy,
        take: 120,
        select: clientNotificationListSelect,
      }),
      prisma.clientNotification.count({
        where: { clientId, readAt: null, archivedAt: null },
      }),
    ]);
    return { items, unreadCount };
  } catch (e) {
    if (!isClientNotificationArchivedAtSchemaError(e)) throw e;
    if (box === "archive") {
      return {
        items: [],
        unreadCount: await countClientUnreadInboxNotifications(clientId),
      };
    }
    const items = await prisma.clientNotification.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        linkHref: true,
        readAt: true,
        createdAt: true,
      },
    });
    return {
      items: items.map((n) => ({ ...n, archivedAt: null })),
      unreadCount: await countClientUnreadInboxNotifications(clientId),
    };
  }
}

/** Unread inbox count; falls back when `archivedAt` migration has not been applied yet. */
export async function countClientUnreadInboxNotifications(clientId: string): Promise<number> {
  try {
    return await prisma.clientNotification.count({
      where: { clientId, readAt: null, archivedAt: null },
    });
  } catch (e) {
    if (!isClientNotificationArchivedAtSchemaError(e)) throw e;
    return prisma.clientNotification.count({
      where: { clientId, readAt: null },
    });
  }
}

/**
 * Deletes long-archived rows, then auto-archives stale inbox items for this client.
 * Safe to call on common read paths (notifications GET, dashboard layout unread count).
 */
export async function runClientNotificationLifecycle(clientId: string): Promise<void> {
  const now = new Date();
  const deleteArchivedBefore = new Date(now.getTime() - CLIENT_NOTIFICATION_ARCHIVE_DELETE_MS);
  const autoArchiveCreatedBefore = new Date(now.getTime() - CLIENT_NOTIFICATION_AUTO_ARCHIVE_MS);

  try {
    await prisma.clientNotification.deleteMany({
      where: {
        clientId,
        archivedAt: { not: null, lt: deleteArchivedBefore },
      },
    });

    await prisma.clientNotification.updateMany({
      where: {
        clientId,
        archivedAt: null,
        createdAt: { lt: autoArchiveCreatedBefore },
      },
      data: { archivedAt: now },
    });
  } catch (e) {
    if (isClientNotificationArchivedAtSchemaError(e)) return;
    throw e;
  }
}
