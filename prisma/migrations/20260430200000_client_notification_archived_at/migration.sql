-- Inbox vs archive; retention uses archivedAt timestamps.
ALTER TABLE "client_notifications" ADD COLUMN "archivedAt" DATETIME;
