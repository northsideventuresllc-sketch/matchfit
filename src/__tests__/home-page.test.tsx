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
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(imageProps as React.ImgHTMLAttributes<HTMLImageElement>)} alt={(imageProps.alt as string) ?? ""} />;
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
  FeaturedTrainersCarousel: ({
    trainers,
    nationwide,
  }: {
    trainers: unknown[];
    nationwide?: boolean;
  }) => {
    featuredCarouselPropsMock({ trainers, nationwide });
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
import {
  defaultClientMatchPreferences,
  serializeClientMatchPreferences,
} from "@/lib/client-match-preferences";

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
    expect(featuredCarouselPropsMock).toHaveBeenCalledWith({ trainers: [], nationwide: false });
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
    clientFindUniqueMock.mockResolvedValue({
      zipCode: " 30324 ",
      matchPreferencesJson: serializeClientMatchPreferences({
        ...defaultClientMatchPreferences,
        deliveryModes: ["in_person"],
      }),
    });
    getFeaturedTrainersForHomepageMock.mockResolvedValue(featuredRows);

    await renderHome(Promise.resolve({ zip: " 30301 " }));

    expect(redirectStayLoggedInClientToDashboardMock).toHaveBeenCalledTimes(1);
    expect(clientFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "client-1" },
      select: { zipCode: true, matchPreferencesJson: true },
    });
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: "30324", nationwide: false });
    expect(featuredCarouselPropsMock).toHaveBeenCalledWith({ trainers: featuredRows, nationwide: false });
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
    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: "30318", nationwide: false });
  });

  it("passes null zip to featured trainer lookup when neither query nor profile zip are valid", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    getSessionClientIdMock.mockResolvedValue("client-2");
    clientFindUniqueMock.mockResolvedValue({
      zipCode: "    ",
      matchPreferencesJson: serializeClientMatchPreferences({
        ...defaultClientMatchPreferences,
        deliveryModes: ["in_person"],
      }),
    });

    await renderHome(Promise.resolve({ zip: "   " }));

    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({ zipInput: null, nationwide: false });
  });

  it("loads nationwide featured coaches for virtual-only clients in Atlanta", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    getSessionClientIdMock.mockResolvedValue("client-atl");
    clientFindUniqueMock.mockResolvedValue({
      zipCode: "30301",
      matchPreferencesJson: serializeClientMatchPreferences({
        ...defaultClientMatchPreferences,
        deliveryModes: ["virtual"],
      }),
    });

    await renderHome();

    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({
      zipInput: "30301",
      nationwide: true,
    });
    expect(featuredCarouselPropsMock).toHaveBeenCalledWith({
      trainers: [],
      nationwide: true,
    });
  });

  it("loads nationwide featured coaches for diy-only clients in Atlanta", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    getSessionClientIdMock.mockResolvedValue("client-atl-diy");
    clientFindUniqueMock.mockResolvedValue({
      zipCode: "30301",
      matchPreferencesJson: serializeClientMatchPreferences({
        ...defaultClientMatchPreferences,
        deliveryModes: ["diy"],
      }),
    });

    await renderHome();

    expect(getFeaturedTrainersForHomepageMock).toHaveBeenCalledWith({
      zipInput: "30301",
      nationwide: true,
    });
    expect(featuredCarouselPropsMock).toHaveBeenCalledWith({
      trainers: [],
      nationwide: true,
    });
  });
});
