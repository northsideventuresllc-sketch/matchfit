import { vi } from "vitest";
import { testCookieJar } from "./src/test/next-cookie-jar";

/** Isolated DB + secrets for API route tests (see `src/__tests__/login-2fa.integration.test.ts`). */
process.env.AUTH_SECRET = "devtest-secret-32-chars-minimum!!";
/** Integration tests must opt in with `TEST_DATABASE_URL` so `npm test` never touches `.env` Postgres by accident. */
delete process.env.DATABASE_URL;
const testDbUrl = process.env.TEST_DATABASE_URL?.trim();
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = testCookieJar.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    set(name: string, value: string) {
      testCookieJar.set(name, value);
    },
    delete(name: string) {
      testCookieJar.delete(name);
    },
    has(name: string) {
      return testCookieJar.has(name);
    },
    getAll() {
      return [...testCookieJar.entries()].map(([name, value]) => ({ name, value }));
    },
  }),
}));
