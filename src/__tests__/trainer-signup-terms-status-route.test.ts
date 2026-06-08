import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionTrainerIdMock } = vi.hoisted(() => ({
  getSessionTrainerIdMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: getSessionTrainerIdMock,
}));

import { GET, dynamic } from "@/app/api/trainer/signup/terms-status/route";

describe("GET /api/trainer/signup/terms-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports force-dynamic mode", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 401 when trainer session is missing", async () => {
    getSessionTrainerIdMock.mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false });
  });

  it("returns ok true when trainer session exists", async () => {
    getSessionTrainerIdMock.mockResolvedValueOnce("trainer_1");

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
