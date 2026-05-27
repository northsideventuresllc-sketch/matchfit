-- Stripe Connect sample: seller ↔ connected account mapping
CREATE TABLE "public"."stripe_connect_demo_sellers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "platformSubscriptionId" TEXT,
    "platformSubscriptionStatus" TEXT,

    CONSTRAINT "stripe_connect_demo_sellers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_connect_demo_sellers_stripeAccountId_key" ON "public"."stripe_connect_demo_sellers"("stripeAccountId");

CREATE INDEX "stripe_connect_demo_sellers_contactEmail_idx" ON "public"."stripe_connect_demo_sellers"("contactEmail");
