import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignupFormProgressUpsert } = vi.hoisted(() => ({
  mockSignupFormProgressUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signupFormProgress: {
      upsert: mockSignupFormProgressUpsert,
    },
  },
}));

import {
  CLIENT_SIGNUP_FIELDS,
  TRAINER_SIGNUP_FIELDS,
  computeSignupProgressPercent,
  listFilledSignupFields,
  parseSignupFieldsJson,
  resolveSignupProgressStage,
  signupFieldsForRole,
  upsertSignupFormProgress,
} from "@/lib/signup-form-progress";

describe("signup-form-progress helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignupFormProgressUpsert.mockResolvedValue(undefined);
  });

  it("returns role-specific field lists", () => {
    expect(signupFieldsForRole("client")).toEqual(CLIENT_SIGNUP_FIELDS);
    expect(signupFieldsForRole("trainer")).toEqual(TRAINER_SIGNUP_FIELDS);
  });

  it("computes progress percentage from filled fields", () => {
    expect(computeSignupProgressPercent("client", { firstName: true, lastName: true })).toBe(25);
    expect(computeSignupProgressPercent("trainer", {})).toBe(0);
  });

  it("resolves completed and basic-info signup stages", () => {
    const basicClientFields = {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      password: true,
      zipCode: true,
      dateOfBirth: true,
    };

    expect(resolveSignupProgressStage("client", { ...basicClientFields, agreedToTerms: true })).toBe("completed");
    expect(resolveSignupProgressStage("client", { ...basicClientFields, agreedToTerms: false })).toBe(
      "basic_info_complete",
    );
    expect(resolveSignupProgressStage("client", { firstName: true })).toBe("started_signup");
  });

  it("parses stored fields JSON and keeps only strict true values", () => {
    expect(parseSignupFieldsJson('{"firstName":true,"email":false,"zipCode":"true"}')).toEqual({
      firstName: true,
    });
    expect(parseSignupFieldsJson("not-json")).toEqual({});
    expect(parseSignupFieldsJson(null)).toEqual({});
  });

  it("lists filled and missing fields for a role", () => {
    expect(listFilledSignupFields("trainer", { firstName: true, username: true })).toEqual({
      filled: ["firstName", "username"],
      missing: [
        "lastName",
        "phone",
        "email",
        "password",
        "serviceZipCode",
        "agreedToTerms",
      ],
    });
  });

  it("does not upsert when visitor id is blank after trimming", async () => {
    await upsertSignupFormProgress({
      role: "client",
      visitorId: "   ",
      fields: { firstName: true },
    });

    expect(mockSignupFormProgressUpsert).not.toHaveBeenCalled();
  });

  it("normalizes payload values before upserting progress", async () => {
    await upsertSignupFormProgress({
      role: "trainer",
      visitorId: "  visitor_123  ",
      fields: { firstName: true, agreedToTerms: true },
      email: "  TRAINER@Example.com  ",
      username: "  coach-one  ",
    });

    expect(mockSignupFormProgressUpsert).toHaveBeenCalledWith({
      where: { role_visitorId: { role: "trainer", visitorId: "visitor_123" } },
      create: {
        role: "trainer",
        visitorId: "visitor_123",
        email: "trainer@example.com",
        username: "coach-one",
        fieldsJson: JSON.stringify({ firstName: true, agreedToTerms: true }),
        stage: "started_signup",
      },
      update: {
        email: "trainer@example.com",
        username: "coach-one",
        fieldsJson: JSON.stringify({ firstName: true, agreedToTerms: true }),
        stage: "started_signup",
      },
    });
  });
});
