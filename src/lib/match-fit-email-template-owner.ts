/** Bootstrap owner admin code — may edit email templates without approval workflow. */
export const MATCH_FIT_EMAIL_TEMPLATE_DIRECT_EDIT_ADMIN_CODE = "jobo0602";

/** Operator inbox for email template change approvals. */
export const MATCH_FIT_EMAIL_TEMPLATE_APPROVAL_INBOX = "jb@match-fit.net";

export function adminCanDirectEditEmailTemplates(adminCode: string): boolean {
  return adminCode.trim().toLowerCase() === MATCH_FIT_EMAIL_TEMPLATE_DIRECT_EDIT_ADMIN_CODE.toLowerCase();
}
