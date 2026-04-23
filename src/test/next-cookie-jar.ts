/** In-memory cookie store for Vitest (`next/headers` mock). */
export const testCookieJar = new Map<string, string>();

export function clearTestCookieJar(): void {
  testCookieJar.clear();
}
