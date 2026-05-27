import { beforeEach, describe, expect, it, vi } from "vitest";

const getTurnstileRuntimeStatusMock = vi.hoisted(() => vi.fn());
const probeTurnstileSecretKeyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/turnstile-verify", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/turnstile-verify")>();
  return {
    ...mod,
    getTurnstileRuntimeStatus: getTurnstileRuntimeStatusMock,
    probeTurnstileSecretKey: probeTurnstileSecretKeyMock,
  };
});

import { GET, dynamic } from "@/app/api/public/turnstile-status/route";

describe("GET /api/public/turnstile-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTurnstileRuntimeStatusMock.mockReturnValue({
      clientWidgetEnabled: true,
      serverVerificationEnabled: true,
      fullyConfigured: true,
      strictMode: false,
    });
    probeTurnstileSecretKeyMock.mockResolvedValue("ok");
  });

  it("is force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("reports healthy when fully configured and secret probe ok", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.healthy).toBe(true);
    expect(body.secretAcceptedByCloudflare).toBe(true);
  });

  it("reports unhealthy when secret probe fails", async () => {
    probeTurnstileSecretKeyMock.mockResolvedValueOnce("invalid");
    const res = await GET();
    const body = await res.json();
    expect(body.healthy).toBe(false);
    expect(body.secretProbe).toBe("invalid");
  });
});
