-- Platform runtime secrets (Stripe bootstrap when Vercel env has placeholders).
CREATE TABLE IF NOT EXISTS "platform_secrets" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_secrets_pkey" PRIMARY KEY ("key")
);
