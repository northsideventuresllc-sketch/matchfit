import { welcomeEmailPostHandler } from "@/lib/welcome-email-post-handler";

export const dynamic = "force-dynamic";

/**
 * Sends the new-user welcome email via Resend (production From: Match Fit &lt;support@match-fit.net&gt;).
 * Requires `MATCHFIT_WELCOME_EMAIL_SECRET` and header `Authorization: Bearer &lt;secret&gt;`.
 */
export const POST = welcomeEmailPostHandler;
