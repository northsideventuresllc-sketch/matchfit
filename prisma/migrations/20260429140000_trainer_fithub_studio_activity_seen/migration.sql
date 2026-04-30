-- Premium FitHub studio: last time trainer reviewed in-app activity (unread counts vs digest).
ALTER TABLE "trainer_profiles" ADD COLUMN "fitHubStudioActivitySeenAt" DATETIME;
