-- Match Fit: track Microsoft OAuth grant path (direct vs Supabase Entra/Azure link).
ALTER TABLE "trainer_video_conference_connections" ADD COLUMN "oauthGrantSource" TEXT NOT NULL DEFAULT 'direct';
