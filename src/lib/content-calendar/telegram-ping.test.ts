import { beforeEach, describe, expect, it, vi } from "vitest";

// WF1.18 fix: the posting path must fire a Telegram ping itself instead of depending on an
// agent remembering to send it by hand — and a failed send must never throw back into the
// posting path that called it.

const { mockReadPlatformSecret } = vi.hoisted(() => ({
  mockReadPlatformSecret: vi.fn(),
}));

vi.mock("@/lib/platform-secrets", () => ({
  readPlatformSecret: mockReadPlatformSecret,
}));

import { sendTelegramPing } from "@/lib/content-calendar/telegram-ping";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("sendTelegramPing", () => {
  it("posts to the Telegram API when both secrets are configured", async () => {
    mockReadPlatformSecret.mockImplementation(async (key: string) =>
      key === "TELEGRAM_BOT_TOKEN" ? "test-token" : key === "TELEGRAM_CHAT_ID" ? "12345" : null,
    );
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    await sendTelegramPing("Static posted (instagram).");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chat_id: "12345", text: "Static posted (instagram)." }),
      }),
    );
  });

  it("no-ops without throwing when a secret is missing", async () => {
    mockReadPlatformSecret.mockResolvedValue(null);
    await expect(sendTelegramPing("hello")).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("swallows a failed send instead of throwing", async () => {
    mockReadPlatformSecret.mockImplementation(async (key: string) =>
      key === "TELEGRAM_BOT_TOKEN" ? "test-token" : "12345",
    );
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    await expect(sendTelegramPing("hello")).resolves.toBeUndefined();
  });
});
