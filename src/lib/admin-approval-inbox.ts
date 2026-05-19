/** Match Fit operator inbox for new administrator requests (approve / deny links). */
import { MATCH_FIT_SUPPORT_INBOX } from "@/lib/match-fit-support-inbox-constant";

/** Staff routing for admin approvals (defaults to the public support inbox). */
export const ADMIN_APPROVAL_INBOX =
  process.env.MATCH_FIT_ADMIN_APPROVAL_INBOX?.trim() || MATCH_FIT_SUPPORT_INBOX;
