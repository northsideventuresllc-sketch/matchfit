import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const homePageMocks = vi.hoisted(() => ({
  getFeaturedTrainersForHomepage: vi.fn(),
  getHomeUserCounts: vi.fn(),
  redirectStayLoggedInClientToDashboard: vi.fn(),
  getSessionClientId: vi.fn(),
  getSessionTrainerId: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill,
    priority,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
  }) => (
    <div
      data-next-image-src={src}
      data-next-image-alt={alt}
      data-next-image-fill={fill ? "true" : undefined}
      data-next-image-priority={priority ? "true" : undefined}
      {...props}
    />
  ),
}));

vi.mock("@/components/featured-trainers-carousel", () => ({
  FeaturedTrainersCarousel: () => <div data-testid="featured-trainers-carousel" />,
}));

vi.mock("@/components/home-brand-banner", () => ({
  HomeBrandBanner: () => <div data-testid="home-brand-banner" />,
}));

vi.mock("@/components/home-login-menu", () => ({
  HomeLoginMenu: () => <div data-testid="home-login-menu" />,
}));

vi.mock("@/components/home-user-counter", () => ({
  HomeUserCounter: () => <div data-testid="home-user-counter" />,
}));

vi.mock("@/components/home-info-sections", () => ({
  HomeInfoSections: () => <div data-testid="home-info-sections" />,
}));

vi.mock("@/lib/featured-homepage-data", () => ({
  getFeaturedTrainersForHomepage: homePageMocks.getFeaturedTrainersForHomepage,
}));

vi.mock("@/lib/home-user-counts", () => ({
  getHomeUserCounts: homePageMocks.getHomeUserCounts,
}));

vi.mock("@/lib/redirect-stay-logged-in-client", () => ({
  redirectStayLoggedInClientToDashboard: homePageMocks.redirectStayLoggedInClientToDashboard,
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: homePageMocks.getSessionClientId,
  getSessionTrainerId: homePageMocks.getSessionTrainerId,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: homePageMocks.findUnique,
    },
  },
}));

describe("home page beta badge", () => {
  beforeEach(() => {
    homePageMocks.redirectStayLoggedInClientToDashboard.mockResolvedValue(undefined);
    homePageMocks.getSessionClientId.mockResolvedValue(null);
    homePageMocks.getSessionTrainerId.mockResolvedValue(null);
    homePageMocks.findUnique.mockResolvedValue(null);
    homePageMocks.getFeaturedTrainersForHomepage.mockResolvedValue([]);
    homePageMocks.getHomeUserCounts.mockResolvedValue({
      clients: 0,
      trainers: 0,
      activeClients: 0,
      activeTrainers: 0,
    });
  });

  it("renders the header version badge and uses query zip for featured trainers", async () => {
    const { default: Home } = await import("@/app/page");

    const html = renderToStaticMarkup(
      await Home({
        searchParams: Promise.resolve({ zip: " 30303 " }),
      }),
    );

    expect(html).toContain("Version BETA 1.0.0");
    expect(homePageMocks.getFeaturedTrainersForHomepage).toHaveBeenCalledWith({ zipInput: "30303" });
  });

  it("prefers the signed-in client zip over the query zip", async () => {
    const { default: Home } = await import("@/app/page");
    homePageMocks.getSessionClientId.mockResolvedValue("client-1");
    homePageMocks.findUnique.mockResolvedValue({ zipCode: " 30030 " });

    await Home({
      searchParams: Promise.resolve({ zip: " 30303 " }),
    });

    expect(homePageMocks.findUnique).toHaveBeenCalledWith({
      where: { id: "client-1" },
      select: { zipCode: true },
    });
    expect(homePageMocks.getFeaturedTrainersForHomepage).toHaveBeenCalledWith({ zipInput: "30030" });
  });
});
