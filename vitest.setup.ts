import path from "node:path";
import { vi } from "vitest";
import { testCookieJar } from "./src/test/next-cookie-jar";

/** Isolated DB + secrets for API route tests (see `src/__tests__/login-2fa.integration.test.ts`). */
process.env.AUTH_SECRET = "devtest-secret-32-chars-minimum!!";
process.env.DATABASE_URL = "file:" + path.join(process.cwd(), "prisma", "test_login_2fa.db");
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
