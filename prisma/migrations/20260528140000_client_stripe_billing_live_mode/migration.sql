-- Track Stripe live vs test mode for platform subscriber metrics (admin reporting).

ALTER TABLE "clients" ADD COLUMN "stripeBillingLiveMode" BOOLEAN;

-- Owner dev/test client (seed script) must not count as a live platform subscriber.
UPDATE "clients"
SET "stripeBillingLiveMode" = false
WHERE LOWER("username") = 'jbfitness6299'
   OR LOWER("email") = 'jonnybooth22@gmail.com';

-- Existing paid subscriptions with a Stripe subscription id are treated as live billing.
UPDATE "clients"
SET "stripeBillingLiveMode" = true
WHERE "stripeSubscriptionActive" = true
  AND "stripeSubscriptionId" IS NOT NULL
  AND TRIM("stripeSubscriptionId") <> ''
  AND "stripeBillingLiveMode" IS NULL;
