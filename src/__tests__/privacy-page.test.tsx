import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_EFFECTIVE_DATE_DISPLAY } from "@/lib/legal-effective-date";

const { mockGetSessionClientId, mockGetSessionTrainerId, mockLegalPageFooterNav } = vi.hoisted(() => ({
  mockGetSessionClientId: vi.fn(),
  mockGetSessionTrainerId: vi.fn(),
  mockLegalPageFooterNav: vi.fn<(props: { role: "client" | "trainer" | "guest" }) => void>(),
}));

vi.mock("@/lib/session", () => ({
  getSessionClientId: mockGetSessionClientId,
  getSessionTrainerId: mockGetSessionTrainerId,
}));

vi.mock("@/components/legal-page-footer-nav", () => ({
  LegalPageFooterNav: (props: { role: "client" | "trainer" | "guest" }) => {
    mockLegalPageFooterNav(props);
    return <div data-component="legal-page-footer-nav" data-role={props.role} />;
  },
}));

import PrivacyPage from "@/app/privacy/page";

async function renderPrivacyPage() {
  const markup = await PrivacyPage();
  return renderToStaticMarkup(markup);
}

describe("PrivacyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionClientId.mockResolvedValue(null);
    mockGetSessionTrainerId.mockResolvedValue(null);
  });

  it("renders legal content and uses guest footer role when no session exists", async () => {
    const html = await renderPrivacyPage();

    expect(html).toContain("Privacy Policy");
    expect(html).toContain(`Effective Date: ${LEGAL_EFFECTIVE_DATE_DISPLAY}`);
    expect(html).toContain("support@match-fit.net");
    expect(html).toContain("1954 Airport Rd STE 1277, Chamblee, GA 30341, United States");
    expect(html).toContain("Vercel Web Analytics");
    expect(mockLegalPageFooterNav).toHaveBeenCalledWith({ role: "guest" });
  });

  it("prefers client role when both client and trainer sessions are present", async () => {
    mockGetSessionClientId.mockResolvedValueOnce("client_1");
    mockGetSessionTrainerId.mockResolvedValueOnce("trainer_1");

    await renderPrivacyPage();

    expect(mockLegalPageFooterNav).toHaveBeenCalledWith({ role: "client" });
  });

  it("uses trainer role when only a trainer session exists", async () => {
    mockGetSessionTrainerId.mockResolvedValueOnce("trainer_1");

    await renderPrivacyPage();

    expect(mockLegalPageFooterNav).toHaveBeenCalledWith({ role: "trainer" });
  });
});
