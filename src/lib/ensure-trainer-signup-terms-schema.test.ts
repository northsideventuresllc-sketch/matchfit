import { describe, expect, it } from "vitest";
import {
  isMissingTrainerSignupTermsColumnError,
  isTrainerSignupTermsAccessError,
} from "@/lib/ensure-trainer-signup-terms-schema";
import { Prisma } from "@/generated/prisma/client";

describe("ensure-trainer-signup-terms-schema", () => {
  it("detects missing terms columns from Prisma P2022", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Column privacyPolicyAcceptedAt does not exist", {
      code: "P2022",
      clientVersion: "test",
      meta: { column: "privacyPolicyAcceptedAt" },
    });
    expect(isMissingTrainerSignupTermsColumnError(err)).toBe(true);
  });

  it("detects row-level security write failures", () => {
    expect(
      isTrainerSignupTermsAccessError(new Error('new row violates row-level security policy for table "trainers"')),
    ).toBe(true);
  });
});
