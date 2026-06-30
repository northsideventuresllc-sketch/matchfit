-- CreateTable
CREATE TABLE IF NOT EXISTS "transactional_email_template_overrides" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "transactional_email_template_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pending_transactional_email_template_changes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedByAdminId" TEXT NOT NULL,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "pending_transactional_email_template_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transactional_email_template_overrides_kind_key" ON "transactional_email_template_overrides"("kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pending_transactional_email_template_changes_kind_status_idx" ON "pending_transactional_email_template_changes"("kind", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pending_transactional_email_template_changes_requestedByAdminId_idx" ON "pending_transactional_email_template_changes"("requestedByAdminId");

-- AddForeignKey
ALTER TABLE "transactional_email_template_overrides" DROP CONSTRAINT IF EXISTS "transactional_email_template_overrides_updatedByAdminId_fkey";
ALTER TABLE "transactional_email_template_overrides" ADD CONSTRAINT "transactional_email_template_overrides_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "administrators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_transactional_email_template_changes" DROP CONSTRAINT IF EXISTS "pending_transactional_email_template_changes_requestedByAdminId_fkey";
ALTER TABLE "pending_transactional_email_template_changes" ADD CONSTRAINT "pending_transactional_email_template_changes_requestedByAdminId_fkey" FOREIGN KEY ("requestedByAdminId") REFERENCES "administrators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
