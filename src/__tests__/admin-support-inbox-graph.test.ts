import { afterEach, describe, expect, it } from "vitest";
import {
  getSupportInboxConnectionStatus,
  getSupportInboxMailbox,
  resetSupportInboxTokenCacheForTests,
  resolveSupportInboxAuthMode,
} from "@/lib/admin-support-inbox-graph";

describe("admin support inbox graph config", () => {
  const envKeys = [
    "MICROSOFT_SUPPORT_INBOX_CLIENT_ID",
    "MICROSOFT_SUPPORT_INBOX_CLIENT_SECRET",
    "MICROSOFT_SUPPORT_INBOX_TENANT_ID",
    "MICROSOFT_SUPPORT_INBOX_REFRESH_TOKEN",
    "MATCH_FIT_SUPPORT_EMAIL",
  ] as const;

  const snapshot: Record<string, string | undefined> = {};
  for (const key of envKeys) snapshot[key] = process.env[key];

  afterEach(() => {
    for (const key of envKeys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
    resetSupportInboxTokenCacheForTests();
  });

  it("defaults mailbox to support@match-fit.net", () => {
    delete process.env.MATCH_FIT_SUPPORT_EMAIL;
    expect(getSupportInboxMailbox()).toBe("support@match-fit.net");
  });

  it("reports unconfigured when Graph credentials are missing", () => {
    delete process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_ID;
    delete process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_SECRET;
    delete process.env.MICROSOFT_SUPPORT_INBOX_TENANT_ID;
    delete process.env.MICROSOFT_SUPPORT_INBOX_REFRESH_TOKEN;

    const status = getSupportInboxConnectionStatus();
    expect(status.configured).toBe(false);
    expect(status.provider).toBe("unconfigured");
    expect(status.mode).toBeNull();
    expect(status.mailbox).toBe("support@match-fit.net");
  });

  it("prefers delegated mode when a refresh token is present", () => {
    process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_ID = "client-id";
    process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_SUPPORT_INBOX_TENANT_ID = "00000000-0000-0000-0000-000000000001";
    process.env.MICROSOFT_SUPPORT_INBOX_REFRESH_TOKEN = "refresh-token";

    expect(resolveSupportInboxAuthMode()).toBe("delegated");
    expect(getSupportInboxConnectionStatus().configured).toBe(true);
    expect(getSupportInboxConnectionStatus().provider).toBe("outlook");
  });

  it("uses application mode when tenant id is set without refresh token", () => {
    process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_ID = "client-id";
    process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_SUPPORT_INBOX_TENANT_ID = "00000000-0000-0000-0000-000000000001";
    delete process.env.MICROSOFT_SUPPORT_INBOX_REFRESH_TOKEN;

    expect(resolveSupportInboxAuthMode()).toBe("application");
    expect(getSupportInboxConnectionStatus().mode).toBe("application");
  });
});
