-- AlterTable
ALTER TABLE "public"."client_two_factor_channels" ADD COLUMN "lastCode" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."trainer_two_factor_channels" ADD COLUMN "lastCode" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);
