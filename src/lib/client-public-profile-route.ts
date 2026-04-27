/**
 * Public client profile URL (trainers may open from search or shared link).
 * Keep in sync with `src/app/clients/[username]/page.tsx`.
 */
export function clientPublishedProfilePath(username: string): string {
  const u = username.trim();
  return `/clients/${encodeURIComponent(u)}`;
}
