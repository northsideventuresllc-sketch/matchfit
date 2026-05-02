-- Client star reviews and optional testimonials for trainers (archived in-app; public window = latest 10).

CREATE TABLE "client_trainer_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "testimonialText" TEXT,
    "testimonialModeratedAt" DATETIME,
    "removedByClientAt" DATETIME,
    "trainerRemovalRequestedAt" DATETIME,
    "fiveStarTokensGrantedAt" DATETIME,
    CONSTRAINT "client_trainer_reviews_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_trainer_reviews_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "client_trainer_reviews_trainerId_createdAt_idx" ON "client_trainer_reviews"("trainerId", "createdAt");
CREATE INDEX "client_trainer_reviews_clientId_trainerId_idx" ON "client_trainer_reviews"("clientId", "trainerId");
