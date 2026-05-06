-- Let coaches control whether clients can purchase packages from the public profile vs. after connecting first.
ALTER TABLE "trainer_profiles" ADD COLUMN "clientsCanPurchaseServicesFromProfile" BOOLEAN NOT NULL DEFAULT true;
