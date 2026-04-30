-- Published services/pricing live outside Match Me; see `serviceOfferingsJson`.
ALTER TABLE "trainer_profiles" ADD COLUMN "serviceOfferingsJson" TEXT;
