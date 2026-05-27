import type { ReactNode } from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const {
  getFeaturedTrainersForHomepageMock,
  clientFindUniqueMock,
  redirectStayLoggedInClientToDashboardMock,
  getSessionClientIdMock,
  getSessionTrainerIdMock,
  featuredCarouselPropsMock,
  homeLoginMenuPropsMock,
  homeInfoSectionsPropsMock,
} = vi.hoisted(() => ({
  getFeaturedTrainersForHomepageMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  redirectStayLoggedInClientToDashboardMock: vi.fn(),
  getSessionClientIdMock: vi.fn(),
  getSessionTrainerIdMock: vi.fn(),
  featuredCarouselPropsMock: vi.fn(),
  homeLoginMenuPropsMock: vi.fn(),
  homeInfoSectionsPropsMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.priority;
    const altText = typeof imageProps.alt === "string" ? imageProps.alt : "mocked next image";
    delete imageProps.alt;
    return <div role="img" aria-label={altText} {...imageProps} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/featured-trainers-carousel", () => ({
  FeaturedTrainersCarousel: ({ trainers }: { trainers: unknown[] }) => {
    featuredCarouselPropsMock({ trainers });
    return <div data-featured-count={trainers.length} />;
  },
}));

vi.mock("@/components/home-brand-banner", () => ({
  HomeBrandBanner: () => <div data-home-brand-banner />,
}));

vi.mock("@/components/home-info-sections", () => ({
  HomeInfoSections: ({ homeAuth }: { homeAuth: { clientLoggedIn: boolean; trainerLoggedIn: boolean } }) => {
    homeInfoSectionsPropsMock({ homeAuth });
    return <div data-home-info-sections />;
  },
}));

vi.mock("@/components/home-login-menu", () => ({
  HomeLoginMenu: ({ homeAuth }: { homeAuth: { clientLoggedIn: boolean; trainerLoggedIn: boolean } }) => {
    homeLoginMenuPropsMock({ homeAuth });
    return <div data-home-login-menu />;
  },
}));

vi.mock("@/lib/featured-homepage-data", () => ({
  getFeaturedTrainersForHomepage: getFeaturedTrainersForHomepageMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/redirect-stay-logged-in-client", () => ({
  redirectStayLoggedInClientToDashboard: redirectStayLoggedInClientToDashboardMock,
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: getSessionClientIdMock,
  getSessionTrainerId: getSessionTrainerIdMock,
}));

import Home from "@/app/page";

const originalEnv = { ...process.env };

async function renderHome(searchParams?: Promise<{ zip?: string }>) {
  const markup = await Home({ searchParams });
  return renderToStaticMarkup(markup);
}

describe("app/page Home component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    getFeaturedTrainersForHomepageMock.mockResolvedValue([]);
    redirectStayLoggedInClientToDashboardMock.mockResolvedValue(undefined);
    getSessionClientIdMock.mockResolvedValue(null);
    getSessionTrainerIdMock.mockResolvedValue(null);
    clientFindUniqueMock.mockResolvedValue(null);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("skips DB-dependent calls when DATABASE_URL is absent", async () => {
    delete process.env.DATABASE_URL;

    getSessionTrainerIdMock.mockResolvedValue("trainer-1");
    const markup = await renderHome(Promise.resolve({ zip: "30301" }));

    expect(markup).toContain("Current Promos");
    expect(redirectStayLoggedInClientToDashboardMock).not.toHaveBeenCalled();
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(getFeaturedTrainersForHomepageMock).not.toHaveBeenCalled();
    expect(featuredCarouselPropsMock).toHaveBeenCalledWith({ trainers: [] });
    expect(homeLoginMenuPropsMock).toHaveBeenCalledWith({
      homeAuth: { clientLoggedIn: false, trainerLoggedIn: true },
    });
    expect(homeInfoSectionsPropsMock).toHaveBeenCalledWith({
      homeAuth: { clientLoggedIn: false, trainerLoggedIn: true },
    });
  });

  it("prefers a logged-in client's zip code over query params for featured trainer lookup", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    const featuredRows = [{ id: "trainer-1" }];
    getSessionClientIdMock.mockResolvedValue("client-1");
    clientFindUniqueMock.mockResolvedValue({ zipCode: " 30324 " });
    getFeaturedTrainersForHomepageMock.mockResolvedValue(featuredRows);

    await renderHome(Promise.resolve({ zip: " 30301 " }));

    expect(redirectStayLoggedInClientToDashboardMock).toHaveBeenCalledTimes(1);
    expect(clientFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "client-1" },
      select: { zipCode: true },
    });
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: "30324" });
    expect(featuredCarouselPropsMock).toHaveBeenCalledWith({ trainers: featuredRows });
    expect(homeLoginMenuPropsMock).toHaveBeenCalledWith({
      homeAuth: { clientLoggedIn: true, trainerLoggedIn: false },
    });
    expect(homeInfoSectionsPropsMock).toHaveBeenCalledWith({
      homeAuth: { clientLoggedIn: true, trainerLoggedIn: false },
    });
  });

  it("uses a trimmed query zip when no client session is present", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    await renderHome(Promise.resolve({ zip: " 30318 " }));

    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: "30318" });
  });

  it("passes null zip to featured trainer lookup when neither query nor profile zip are valid", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    getSessionClientIdMock.mockResolvedValue("client-2");
    clientFindUniqueMock.mockResolvedValue({ zipCode: "    " });

    await renderHome(Promise.resolve({ zip: "   " }));

    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: null });
  });
});
