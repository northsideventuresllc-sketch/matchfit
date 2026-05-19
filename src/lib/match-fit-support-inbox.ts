import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";
import { MATCH_FIT_SUPPORT_INBOX } from "@/lib/match-fit-support-inbox-constant";

export { MATCH_FIT_SUPPORT_INBOX } from "@/lib/match-fit-support-inbox-constant";

/** Staff-facing notification (bug reports, product ideas, etc.). */
export async function notifyMatchFitSupportInbox(params: {
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  await sendMatchFitBrandedEmail({
    to: MATCH_FIT_SUPPORT_INBOX,
    subject: params.subject,
    text: params.text,
    replyTo: params.replyTo,
  });
}
