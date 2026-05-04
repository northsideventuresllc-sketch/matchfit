-- In-person vs virtual booking + optional trainer virtual meeting UI prefs

ALTER TABLE "booked_training_sessions" ADD COLUMN "sessionDelivery" TEXT NOT NULL DEFAULT 'IN_PERSON';

UPDATE "booked_training_sessions" SET "sessionDelivery" = 'VIRTUAL' WHERE "videoConferenceJoinUrl" IS NOT NULL;

ALTER TABLE "trainer_profiles" ADD COLUMN "virtualMeetingSettingsJson" TEXT;
