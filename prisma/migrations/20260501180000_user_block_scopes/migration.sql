-- Scoped privacy blocks: match feed, FitHub, chat, discover, and trainer-to-trainer FitHub mutes.
ALTER TABLE "user_blocks" ADD COLUMN "hideTrainerFromClientMatchFeed" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "user_blocks" ADD COLUMN "hideTrainerFromClientFithub" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "user_blocks" ADD COLUMN "hideClientFromTrainerDiscover" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "user_blocks" ADD COLUMN "hideBlockedTrainerFromViewerTrainerFithub" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "user_blocks" ADD COLUMN "blockDirectChat" BOOLEAN NOT NULL DEFAULT 1;
