-- FitHub: scheduling, visibility, hashtags, multi-image carousel

ALTER TABLE "trainer_fit_hub_posts" ADD COLUMN "scheduledPublishAt" DATETIME;
ALTER TABLE "trainer_fit_hub_posts" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "trainer_fit_hub_posts" ADD COLUMN "hashtagsJson" TEXT;
ALTER TABLE "trainer_fit_hub_posts" ADD COLUMN "mediaUrlsJson" TEXT;
