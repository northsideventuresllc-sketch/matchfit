-- Premium trainer promotion tokens: balance, ledger, post boosts, weekly grants, service sales, client gifts

CREATE TABLE "trainer_token_balances" (
    "trainerId" TEXT NOT NULL PRIMARY KEY,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "trainer_token_balances_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "trainer_token_ledger_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceKey" TEXT,
    "metaJson" TEXT,
    CONSTRAINT "trainer_token_ledger_entries_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_token_ledger_entries_trainerId_createdAt_idx" ON "trainer_token_ledger_entries"("trainerId", "createdAt");
CREATE INDEX "trainer_token_ledger_entries_trainerId_reason_referenceKey_idx" ON "trainer_token_ledger_entries"("trainerId", "reason", "referenceKey");

CREATE TABLE "trainer_fit_hub_post_promotions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "tokensSpent" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "regionZipPrefix" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    CONSTRAINT "trainer_fit_hub_post_promotions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "trainer_fit_hub_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_fit_hub_post_promotions_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_fit_hub_post_promotions_postId_startsAt_endsAt_idx" ON "trainer_fit_hub_post_promotions"("postId", "startsAt", "endsAt");
CREATE INDEX "trainer_fit_hub_post_promotions_trainerId_endsAt_idx" ON "trainer_fit_hub_post_promotions"("trainerId", "endsAt");

CREATE TABLE "trainer_weekly_token_grants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    CONSTRAINT "trainer_weekly_token_grants_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_weekly_token_grants_trainerId_weekKey_key" ON "trainer_weekly_token_grants"("trainerId", "weekKey");

CREATE TABLE "trainer_client_service_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'STRIPE_CHECKOUT',
    "stripeCheckoutSessionId" TEXT,
    "idempotencyKey" TEXT,
    "trainerSaleTokensGrantedAt" DATETIME,
    CONSTRAINT "trainer_client_service_transactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_client_service_transactions_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_client_service_transactions_stripeCheckoutSessionId_key" ON "trainer_client_service_transactions"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "trainer_client_service_transactions_idempotencyKey_key" ON "trainer_client_service_transactions"("idempotencyKey");
CREATE INDEX "trainer_client_service_transactions_clientId_trainerId_completedAt_idx" ON "trainer_client_service_transactions"("clientId", "trainerId", "completedAt");

CREATE TABLE "client_trainer_token_gifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "weekKey" TEXT NOT NULL,
    CONSTRAINT "client_trainer_token_gifts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_trainer_token_gifts_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "client_trainer_token_gifts_clientId_trainerId_weekKey_idx" ON "client_trainer_token_gifts"("clientId", "trainerId", "weekKey");
