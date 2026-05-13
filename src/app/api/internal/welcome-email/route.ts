import { welcomeEmailPostHandler } from "@/lib/welcome-email-post-handler";

export const dynamic = "force-dynamic";

/** @deprecated Prefer POST /api/welcome-email (same behavior). */
export const POST = welcomeEmailPostHandler;
