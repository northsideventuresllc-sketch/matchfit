-- Track when a client last marked a coach as "not interested" (swipe left / pass) for 90-day resurface rules.
ALTER TABLE "client_trainer_browse_passes" ADD COLUMN "lastPassedAt" DATETIME;
