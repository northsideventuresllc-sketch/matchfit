import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirectStayLoggedInClientToDashboard = vi.fn<() => Promise<void>>();
const mockGetFeaturedTrainersForHomepage = vi.fn<
  (args: { zipInput: string | null }) => Promise<unknown[]>
>();
const mockGetHomeUserCounts = vi.fn<() => Promise<Record<string, number>>>();
const mockGetSessionClientId = vi.fn<() => Promise<string | null>>();
const mockGetSessionTrainerId = vi.fn<() => Promise<string | null>>();
const mockFindClientById = vi.fn<() => Promise<{ zipCode: string | null } | null>>();

const mockHomeLoginMenu = vi.fn(({ homeAuth }: { homeAuth: { clientLoggedIn: boolean; trainerLoggedIn: boolean } }) => (
  <div data-testid="home-login-menu">
    {homeAuth.clientLoggedIn ? "client" : "guest"}-{homeAuth.trainerLoggedIn ? "trainer" : "no-trainer"}
  </div>
));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("@/components/featured-trainers-carousel", () => ({
  FeaturedTrainersCarousel: ({ trainers }: { trainers: unknown[] }) => (
    <div data-testid="featured-trainers">featured:{trainers.length}</div>
  ),
}));

vi.mock("@/components/home-brand-banner", () => ({
  HomeBrandBanner: () => <div data-testid="home-brand-banner">brand</div>,
}));

vi.mock("@/components/home-info-sections", () => ({
  HomeInfoSections: () => <div data-testid="home-info-sections">info-sections</div>,
}));

vi.mock("@/components/home-login-menu", () => ({
  HomeLoginMenu: (props: { homeAuth: { clientLoggedIn: boolean; trainerLoggedIn: boolean } }) =>
    mockHomeLoginMenu(props),
}));

vi.mock("@/components/home-user-counter", () => ({
  HomeUserCounter: ({ clients, trainers }: { clients?: number; trainers?: number }) => (
    <div data-testid="home-user-counter">
      counts:{clients ?? 0}:{trainers ?? 0}
    </div>
  ),
}));

vi.mock("@/lib/featured-homepage-data", () => ({
  getFeaturedTrainersForHomepage: (args: { zipInput: string | null }) => mockGetFeaturedTrainersForHomepage(args),
}));

vi.mock("@/lib/home-user-counts", () => ({
  getHomeUserCounts: () => mockGetHomeUserCounts(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: () => mockFindClientById(),
    },
  },
}));

vi.mock("@/lib/redirect-stay-logged-in-client", () => ({
  redirectStayLoggedInClientToDashboard: () => mockRedirectStayLoggedInClientToDashboard(),
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: () => mockGetSessionClientId(),
  getSessionTrainerId: () => mockGetSessionTrainerId(),
}));

import Home from "@/app/page";

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirectStayLoggedInClientToDashboard.mockResolvedValue(undefined);
    mockGetFeaturedTrainersForHomepage.mockResolvedValue([]);
    mockGetHomeUserCounts.mockResolvedValue({ clients: 12, trainers: 34 });
    mockGetSessionClientId.mockResolvedValue(null);
    mockGetSessionTrainerId.mockResolvedValue(null);
    mockFindClientById.mockResolvedValue(null);
  });

  it("renders the header version badge and uses query zip for featured trainers", async () => {
    const html = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({ zip: " 30303 " }) }));

    expect(html).toContain("Version BETA 1.0.0");
    expect(mockRedirectStayLoggedInClientToDashboard).toHaveBeenCalledTimes(1);
    expect(mockGetFeaturedTrainersForHomepage).toHaveBeenCalledWith({ zipInput: "30303" });
    expect(mockFindClientById).not.toHaveBeenCalled();
    expect(mockHomeLoginMenu).toHaveBeenCalledWith(
      { homeAuth: { clientLoggedIn: false, trainerLoggedIn: false } },
      undefined,
    );
  });

  it("prefers the logged-in client zip over the query zip", async () => {
    mockGetSessionClientId.mockResolvedValue("client_123");
    mockFindClientById.mockResolvedValue({ zipCode: " 30033 " });

    await Home({ searchParams: Promise.resolve({ zip: "99999" }) });

    expect(mockFindClientById).toHaveBeenCalledTimes(1);
    expect(mockGetFeaturedTrainersForHomepage).toHaveBeenCalledWith({ zipInput: "30033" });
  });
});
