import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterProfileInput } from "@/lib/client-register-profile-enrich";

const { defaultPreferredNameFromSignupMock, resolveUniqueClientUsernameMock, getValidBetaInviteMock } = vi.hoisted(
  () => ({
    defaultPreferredNameFromSignupMock: vi.fn(),
    resolveUniqueClientUsernameMock: vi.fn(),
    getValidBetaInviteMock: vi.fn(),
  }),
);

vi.mock("@/lib/client-default-profile-fields", () => ({
  defaultPreferredNameFromSignup: defaultPreferredNameFromSignupMock,
  resolveUniqueClientUsername: resolveUniqueClientUsernameMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  getValidBetaInvite: getValidBetaInviteMock,
}));

import { enrichClientRegisterProfile } from "@/lib/client-register-profile-enrich";

const baseBody: RegisterProfileInput = {
  firstName: "Jane",
  lastName: "Smith",
  preferredName: "JS",
  username: "jane_smith",
  phone: "4045550100",
  email: "jane@example.com",
  password: "TestPass1!",
  zipCode: "30301",
  dateOfBirth: "1990-01-01",
  agreedToTerms: true,
};

describe("enrichClientRegisterProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultPreferredNameFromSignupMock.mockReturnValue("Jane");
    resolveUniqueClientUsernameMock.mockResolvedValue("jane_unique");
    getValidBetaInviteMock.mockResolvedValue(null);
  });

  it("keeps a provided username (trimmed) and does not resolve a fallback username", async () => {
    const result = await enrichClientRegisterProfile({
      ...baseBody,
      username: "  chosen_name  ",
      preferredName: "",
    });

    expect(defaultPreferredNameFromSignupMock).toHaveBeenCalledWith("Jane", "Smith", "");
    expect(resolveUniqueClientUsernameMock).not.toHaveBeenCalled();
    expect(result.username).toBe("chosen_name");
    expect(result.preferredName).toBe("Jane");
  });

  it("uses a matching client beta invite username when username is missing", async () => {
    getValidBetaInviteMock.mockResolvedValueOnce({
      role: "client",
      email: "jane@example.com",
      desiredUsername: "  reserved_from_waitlist  ",
    });
    resolveUniqueClientUsernameMock.mockResolvedValueOnce("reserved_from_waitlist");

    const result = await enrichClientRegisterProfile({
      ...baseBody,
      username: undefined,
      email: "  Jane@Example.com ",
      betaInviteToken: "invite_123",
    });

    expect(getValidBetaInviteMock).toHaveBeenCalledWith("invite_123");
    expect(resolveUniqueClientUsernameMock).toHaveBeenCalledWith(
      "jane@example.com",
      "reserved_from_waitlist",
    );
    expect(result.username).toBe("reserved_from_waitlist");
  });

  it("ignores invite username when invite role/email do not match the signup", async () => {
    getValidBetaInviteMock.mockResolvedValueOnce({
      role: "trainer",
      email: "jane@example.com",
      desiredUsername: "trainer_name",
    });

    await enrichClientRegisterProfile({
      ...baseBody,
      username: undefined,
      betaInviteToken: "invite_123",
    });

    expect(resolveUniqueClientUsernameMock).toHaveBeenCalledWith("jane@example.com", undefined);
  });
});
