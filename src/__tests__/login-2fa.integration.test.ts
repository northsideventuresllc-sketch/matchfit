import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

vi.mock("@/lib/deliver-otp", () => ({
  deliverSignupOtp: vi.fn(async () => ({})),
}));

import * as otpModule from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { CLIENT_SESSION_COOKIE, LOGIN_CHALLENGE_COOKIE } from "@/lib/session";
import { POST as loginPost } from "@/app/api/client/login/route";
import { POST as complete2faPost } from "@/app/api/client/login/complete-2fa/route";
import { POST as resend2faPost } from "@/app/api/client/login/resend-2fa/route";
import { clearTestCookieJar, testCookieJar } from "@/test/next-cookie-jar";

describe("login 2FA API", () => {
  const passwordPlain = "TestPass1!X";
  const username = "twofa_tester";
  const email = "twofa_tester@example.test";

  beforeAll(() => {
    execSync("npx prisma db push --skip-generate", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearTestCookieJar();
    await prisma.client.deleteMany({});
    vi.clearAllMocks();
    vi.spyOn(otpModule, "generateSixDigitCode").mockReset();
    let i = 0;
    const codes = ["111111", "222222"];
    vi.spyOn(otpModule, "generateSixDigitCode").mockImplementation(() => codes[i++] ?? "999999");

    const passwordHash = await bcrypt.hash(passwordPlain, 8);
    await prisma.client.create({
      data: {
        firstName: "Two",
        lastName: "Fa",
        preferredName: "TF",
        username,
        phone: "5555555555",
        email,
        passwordHash,
        zipCode: "30301",
        dateOfBirth: "1990-01-15",
        termsAcceptedAt: new Date(),
        twoFactorEnabled: true,
        twoFactorMethod: "EMAIL",
        stayLoggedIn: true,
      },
    });
  });

  function challengeCookieHeader(): string {
    const v = testCookieJar.get(LOGIN_CHALLENGE_COOKIE);
    if (!v) throw new Error("missing login challenge in test cookie jar");
    return `${LOGIN_CHALLENGE_COOKIE}=${v}`;
  }

  it("returns needsTwoFactor and stores challenge cookie but not session cookie", async () => {
    const req = new NextRequest("http://localhost/api/client/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: email,
        password: passwordPlain,
        stayLoggedIn: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await loginPost(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { needsTwoFactor?: boolean; next?: string };
    expect(body.needsTwoFactor).toBe(true);
    expect(body.next).toBe("/client/verify-2fa");
    expect(testCookieJar.get(LOGIN_CHALLENGE_COOKIE)).toBeTruthy();
    expect(testCookieJar.get(CLIENT_SESSION_COOKIE)).toBeUndefined();
  });

  it("issues session after correct code and applies stayLoggedIn=false", async () => {
    const loginReq = new NextRequest("http://localhost/api/client/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: email,
        password: passwordPlain,
        stayLoggedIn: false,
      }),
      headers: { "content-type": "application/json" },
    });
    const loginRes = await loginPost(loginReq);
    expect(loginRes.status).toBe(200);

    const completeReq = new NextRequest("http://localhost/api/client/login/complete-2fa", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: challengeCookieHeader(),
      },
      body: JSON.stringify({ code: "111111" }),
    });
    const completeRes = await complete2faPost(completeReq);
    expect(completeRes.status).toBe(200);
    expect(testCookieJar.get(CLIENT_SESSION_COOKIE)).toBeTruthy();
    expect(testCookieJar.get(LOGIN_CHALLENGE_COOKIE)).toBeUndefined();
    const c = await prisma.client.findUnique({ where: { email }, select: { stayLoggedIn: true } });
    expect(c?.stayLoggedIn).toBe(false);
  });

  it("locks after 3 wrong codes, then resend + correct code succeeds", async () => {
    const loginReq = new NextRequest("http://localhost/api/client/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: email,
        password: passwordPlain,
        stayLoggedIn: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const loginRes = await loginPost(loginReq);
    expect(loginRes.status).toBe(200);
    const cookieHeader = challengeCookieHeader();

    for (let k = 0; k < 3; k++) {
      const bad = new NextRequest("http://localhost/api/client/login/complete-2fa", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieHeader },
        body: JSON.stringify({ code: "000000" }),
      });
      const badRes = await complete2faPost(bad);
      expect(badRes.status).toBe(400);
      const j = (await badRes.json()) as { codeInvalidated?: boolean; tooManyAttempts?: boolean };
      if (k < 2) {
        expect(j.codeInvalidated).toBeFalsy();
      } else {
        expect(j.codeInvalidated).toBe(true);
        expect(j.tooManyAttempts).toBe(true);
      }
    }

    const resendRes = await resend2faPost();
    expect(resendRes.status).toBe(200);

    const okReq = new NextRequest("http://localhost/api/client/login/complete-2fa", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ code: "222222" }),
    });
    const okRes = await complete2faPost(okReq);
    expect(okRes.status).toBe(200);
    expect(testCookieJar.get(CLIENT_SESSION_COOKIE)).toBeTruthy();
  });
});
