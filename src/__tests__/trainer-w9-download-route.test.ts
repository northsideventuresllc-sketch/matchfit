import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSessionTrainerId, mockTrainerProfileFindUnique } = vi.hoisted(() => ({
  mockGetSessionTrainerId: vi.fn(),
  mockTrainerProfileFindUnique: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: {
      findUnique: mockTrainerProfileFindUnique,
    },
  },
}));

import { GET } from "@/app/api/trainer/compliance/w9-download/route";

describe("GET /api/trainer/compliance/w9-download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionTrainerId.mockResolvedValue("trainer_1");
    mockTrainerProfileFindUnique.mockResolvedValue({
      w9Json: JSON.stringify({
        legalName: "Taylor Doe",
        businessName: "Taylor Fitness LLC",
        federalTaxClassification: "LLC",
        addressLine1: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        tinType: "ein",
        tin: "123456789",
        submittedAt: "2026-05-20T00:00:00.000Z",
      }),
    });
  });

  it("returns 401 when trainer session is missing", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(mockTrainerProfileFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when no W-9 exists for the trainer", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({ w9Json: "  " });

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "No W-9 on file." });
  });

  it("returns 500 when stored W-9 JSON is invalid", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({ w9Json: "{bad-json}" });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "W-9 data could not be read." });
  });

  it("returns an HTML attachment with masked TIN and business name details", async () => {
    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="matchfit-w9-summary.html"');
    expect(html).toContain("Match Fit — W-9 Tax Form Summary");
    expect(html).toContain("Business Name / Disregarded Entity Name");
    expect(html).toContain("Taylor Fitness LLC");
    expect(html).toContain("TIN (EIN, Masked)");
    expect(html).toContain("*****6789");
  });

  it("fully masks short TIN values and omits business-name section when absent", async () => {
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      w9Json: JSON.stringify({
        legalName: "Jordan Roe",
        federalTaxClassification: "Individual",
        tin: "1234",
      }),
    });

    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Jordan Roe");
    expect(html).toContain(">****</span>");
    expect(html).not.toContain("Business Name / Disregarded Entity Name");
  });
});
