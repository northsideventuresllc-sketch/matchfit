import { describe, expect, it } from "vitest";
import { defaultPreferredNameFromSignup, defaultUsernameFromEmail } from "@/lib/client-default-profile-fields";

describe("client default profile fields", () => {
  it("derives username from email local part", () => {
    expect(defaultUsernameFromEmail("john.doe@gmail.com")).toBe("john_doe");
    expect(defaultUsernameFromEmail("ab@example.com")).toBe("ab_user");
  });

  it("defaults preferred name to first name", () => {
    expect(defaultPreferredNameFromSignup("Jane", "Doe")).toBe("Jane");
    expect(defaultPreferredNameFromSignup("", "Doe", "Jay")).toBe("Jay");
  });
});
