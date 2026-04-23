-- CreateTable
CREATE TABLE "trainers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "termsAcceptedAt" DATETIME NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" TEXT NOT NULL DEFAULT 'NONE',
    "twoFactorOtpHash" TEXT,
    "twoFactorOtpExpires" DATETIME,
    "twoFactorLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "stayLoggedIn" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "trainer_two_factor_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "trainerId" TEXT NOT NULL,
    "delivery" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyOtpHash" TEXT,
    "verifyOtpExpires" DATETIME,
    "isDefaultLogin" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "trainer_two_factor_channels_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trainer_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "trainerId" TEXT NOT NULL,
    "hasSignedTOS" BOOLEAN NOT NULL DEFAULT false,
    "hasUploadedW9" BOOLEAN NOT NULL DEFAULT false,
    "hasPaidBackgroundFee" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckStatus" TEXT NOT NULL DEFAULT 'pending',
    "certificationUrl" TEXT,
    "certificationReviewStatus" TEXT NOT NULL DEFAULT 'none',
    "backgroundCheckReviewStatus" TEXT NOT NULL DEFAULT 'none',
    CONSTRAINT "trainer_profiles_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "trainers_username_key" ON "trainers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_email_key" ON "trainers"("email");

-- CreateIndex
CREATE INDEX "trainer_two_factor_channels_trainerId_idx" ON "trainer_two_factor_channels"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_profiles_trainerId_key" ON "trainer_profiles"("trainerId");
