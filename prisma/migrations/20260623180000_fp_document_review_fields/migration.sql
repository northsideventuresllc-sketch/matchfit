-- FP document auto-analysis + human review polish fields

ALTER TABLE "public"."fp_documents" ADD COLUMN IF NOT EXISTS "autoSuggestedDecision" TEXT;
ALTER TABLE "public"."fp_documents" ADD COLUMN IF NOT EXISTS "autoAnalysisSummary" TEXT;
ALTER TABLE "public"."fp_documents" ADD COLUMN IF NOT EXISTS "autoAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "public"."fp_documents" ADD COLUMN IF NOT EXISTS "rejectionReasonRaw" TEXT;
ALTER TABLE "public"."fp_documents" ADD COLUMN IF NOT EXISTS "rejectionReasonPolished" TEXT;

CREATE INDEX IF NOT EXISTS "fp_documents_status_submittedAt_idx" ON "public"."fp_documents"("status", "submittedAt");
