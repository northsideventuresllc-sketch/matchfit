-- Customizable Quick Links on client dashboard home (max 4; JSON array of string ids).
ALTER TABLE "clients" ADD COLUMN "dashboardQuickLinkIdsJson" TEXT;
