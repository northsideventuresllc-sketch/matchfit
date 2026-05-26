import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getFeaturedTrainersForHomepageMock,
  redirectStayLoggedInClientToDashboardMock,
  getSessionClientIdMock,
  getSessionTrainerIdMock,
  clientFindUniqueMock,
} = vi.hoisted(() => ({
  getFeaturedTrainersForHomepageMock: vi.fn(),
  redirectStayLoggedInClientToDashboardMock: vi.fn(),
  getSessionClientIdMock: vi.fn(),
  getSessionTrainerIdMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/featured-trainers-carousel", () => ({
  FeaturedTrainersCarousel: () => null,
}));

vi.mock("@/components/home-brand-banner", () => ({
  HomeBrandBanner: () => null,
}));

vi.mock("@/components/home-info-sections", () => ({
  HomeInfoSections: () => null,
}));

vi.mock("@/components/home-login-menu", () => ({
  HomeLoginMenu: () => null,
}));

vi.mock("@/lib/featured-homepage-data", () => ({
  getFeaturedTrainersForHomepage: getFeaturedTrainersForHomepageMock,
}));

vi.mock("@/lib/redirect-stay-logged-in-client", () => ({
  redirectStayLoggedInClientToDashboard: redirectStayLoggedInClientToDashboardMock,
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: getSessionClientIdMock,
  getSessionTrainerId: getSessionTrainerIdMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
    },
  },
}));

import Home from "@/app/page";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("Home page server component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionClientIdMock.mockResolvedValue(null);
    getSessionTrainerIdMock.mockResolvedValue(null);
    clientFindUniqueMock.mockResolvedValue(null);
    getFeaturedTrainersForHomepageMock.mockResolvedValue([]);
    redirectStayLoggedInClientToDashboardMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("skips all DB-dependent work when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    const page = await Home({
      searchParams: Promise.resolve({ zip: "30303" }),
    });

    expect(page).toBeTruthy();
    expect(redirectStayLoggedInClientToDashboardMock).not.toHaveBeenCalled();
    expect(getFeaturedTrainersForHomepageMock).not.toHaveBeenCalled();
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(getSessionClientIdMock).toHaveBeenCalledTimes(1);
    expect(getSessionTrainerIdMock).toHaveBeenCalledTimes(1);
  });

  it("uses trimmed query zip for featured trainers when no client session exists", async () => {
    process.env.DATABASE_URL = "postgresql://matchfit:matchfit@localhost:5432/matchfit";

    await Home({
      searchParams: Promise.resolve({ zip: " 30303 " }),
    });

    expect(redirectStayLoggedInClientToDashboardMock).toHaveBeenCalledTimes(1);
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({
      zipInput: "30303",
    });
  });

  it("prefers the signed-in client zip code over the query string", async () => {
    process.env.DATABASE_URL = "postgresql://matchfit:matchfit@localhost:5432/matchfit";
    getSessionClientIdMock.mockResolvedValue("client_123");
    clientFindUniqueMock.mockResolvedValue({
      zipCode: " 30309 ",
    });

    await Home({
      searchParams: Promise.resolve({ zip: "11111" }),
    });

    expect(clientFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "client_123" },
      select: { zipCode: true },
    });
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({
      zipInput: "30309",
    });
  });

  it("falls back to query zip when the signed-in client zip is blank", async () => {
    process.env.DATABASE_URL = "postgresql://matchfit:matchfit@localhost:5432/matchfit";
    getSessionClientIdMock.mockResolvedValue("client_123");
    clientFindUniqueMock.mockResolvedValue({
      zipCode: "   ",
    });

    await Home({
      searchParams: Promise.resolve({ zip: " 11211 " }),
    });

    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({
      zipInput: "11211",
    });
  });
});
