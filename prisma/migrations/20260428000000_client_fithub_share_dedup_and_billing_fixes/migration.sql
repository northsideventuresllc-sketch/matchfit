-- Align legacy clients with no Stripe subscription to inactive (matches Prisma @default(false)).
UPDATE "clients"
SET "stripeSubscriptionActive" = 0
WHERE "stripeSubscriptionId" IS NULL OR TRIM("stripeSubscriptionId") = '';

-- CreateTable
CREATE TABLE "client_fit_hub_post_shares" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "client_fit_hub_post_shares_postId_fkey" FOREIGN KEY ("postId") REFERENCES "trainer_fit_hub_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_fit_hub_post_shares_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "client_fit_hub_post_shares_postId_clientId_key" ON "client_fit_hub_post_shares"("postId", "clientId");
CREATE INDEX "client_fit_hub_post_shares_clientId_idx" ON "client_fit_hub_post_shares"("clientId");
