-- Customizable Quick Links on trainer dashboard home (max 4; JSON array of string ids).
ALTER TABLE "trainer_profiles" ADD COLUMN "dashboardQuickLinkIdsJson" TEXT;
