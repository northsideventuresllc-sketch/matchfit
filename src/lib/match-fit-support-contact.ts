/**
 * Support mailto links for account-access help. Subject lines are the only thing that varies —
 * change them here, not at each call site.
 */
export const MATCH_FIT_SUPPORT_EMAIL = "support@match-fit.net";

function mailto(subject: string): string {
  return `mailto:${MATCH_FIT_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export const MATCH_FIT_SUPPORT_MAILTO = {
  accountAccess: mailto("Account Access Help"),
};
