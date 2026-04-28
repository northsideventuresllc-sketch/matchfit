-- FitHub: trainer posts, client engagement, feed prefs on client

ALTER TABLE "clients" ADD COLUMN "fitHubPrefsJson" TEXT;

CREATE TABLE "trainer_fit_hub_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "caption" TEXT,
    "bodyText" TEXT,
    "mediaUrl" TEXT,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "trainer_fit_hub_posts_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_fit_hub_posts_trainerId_createdAt_idx" ON "trainer_fit_hub_posts"("trainerId", "createdAt");

CREATE TABLE "trainer_fit_hub_post_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "trainer_fit_hub_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "trainer_fit_hub_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_fit_hub_post_likes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_fit_hub_post_likes_postId_clientId_key" ON "trainer_fit_hub_post_likes"("postId", "clientId");
CREATE INDEX "trainer_fit_hub_post_likes_clientId_idx" ON "trainer_fit_hub_post_likes"("clientId");

CREATE TABLE "trainer_fit_hub_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    CONSTRAINT "trainer_fit_hub_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "trainer_fit_hub_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_fit_hub_comments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_fit_hub_comments_postId_createdAt_idx" ON "trainer_fit_hub_comments"("postId", "createdAt");

CREATE TABLE "client_fit_hub_reposts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "client_fit_hub_reposts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "trainer_fit_hub_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_fit_hub_reposts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "client_fit_hub_reposts_postId_clientId_key" ON "client_fit_hub_reposts"("postId", "clientId");
CREATE INDEX "client_fit_hub_reposts_clientId_idx" ON "client_fit_hub_reposts"("clientId");
