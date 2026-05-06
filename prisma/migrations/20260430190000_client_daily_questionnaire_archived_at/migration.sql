-- Allow superseding stale incomplete questionnaires without deleting history.
ALTER TABLE "client_daily_questionnaires" ADD COLUMN "archivedAt" DATETIME;
