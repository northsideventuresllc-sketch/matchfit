-- Per-administrator dashboard section visibility and order (JSON blob).
ALTER TABLE "administrators" ADD COLUMN IF NOT EXISTS "adminDashboardLayoutJson" TEXT;
