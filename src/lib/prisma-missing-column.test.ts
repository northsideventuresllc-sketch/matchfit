import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isPrismaMissingColumnError,
  isPrismaMissingTableError,
  isPrismaUnknownModelFieldError,
} from "@/lib/prisma-missing-column";

function knownRequestError(message: string, code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "unit-test",
  });
}

function validationError(message: string): Prisma.PrismaClientValidationError {
  return new Prisma.PrismaClientValidationError(message, {
    clientVersion: "unit-test",
  });
}

describe("isPrismaMissingColumnError", () => {
  it("returns true for P2022 errors containing the expected column", () => {
    const err = knownRequestError(
      'The column `clients.stripeBillingLiveMode` does not exist in the current database.',
      "P2022",
    );

    expect(isPrismaMissingColumnError(err, "stripeBillingLiveMode")).toBe(true);
  });

  it("returns false for non-P2022 errors or messages without the column", () => {
    const wrongCode = knownRequestError("column exists but query failed", "P2021");
    const missingNeedle = knownRequestError("column `clients.email` missing", "P2022");

    expect(isPrismaMissingColumnError(wrongCode, "stripeBillingLiveMode")).toBe(false);
    expect(isPrismaMissingColumnError(missingNeedle, "stripeBillingLiveMode")).toBe(false);
    expect(isPrismaMissingColumnError(new Error("P2022 stripeBillingLiveMode"), "stripeBillingLiveMode")).toBe(
      false,
    );
  });
});

describe("isPrismaMissingTableError", () => {
  it("returns true for SQLSTATE/does-not-exist message signatures with table needle", () => {
    expect(
      isPrismaMissingTableError(
        new Error('relation "site_analytics_events" does not exist (SQLSTATE 42P01)'),
        "site_analytics_events",
      ),
    ).toBe(true);

    expect(isPrismaMissingTableError("P2021: table site_analytics_events missing", "site_analytics_events")).toBe(
      true,
    );
  });

  it("returns true for Prisma P2021 known request errors", () => {
    const err = knownRequestError("P2021: table site_analytics_events not found", "P2021");
    expect(isPrismaMissingTableError(err, "site_analytics_events")).toBe(true);
  });

  it("returns false when the target table is not referenced", () => {
    const err = knownRequestError("P2021: table site_analytics_events not found", "P2021");
    expect(isPrismaMissingTableError(err, "platform_revenue_events")).toBe(false);
    expect(isPrismaMissingTableError(new Error("42P01 relation missing"), "site_analytics_events")).toBe(false);
  });
});

describe("isPrismaUnknownModelFieldError", () => {
  it("returns true for validation errors with unknown field/arg markers", () => {
    const unknownField = validationError(
      "Unknown field `stripeBillingLiveMode` for where statement on model Client.",
    );
    const unknownArg = validationError("Unknown arg `stripeBillingLiveMode` in where.ClientWhereInput.");

    expect(isPrismaUnknownModelFieldError(unknownField, "stripeBillingLiveMode")).toBe(true);
    expect(isPrismaUnknownModelFieldError(unknownArg, "stripeBillingLiveMode")).toBe(true);
  });

  it("returns false for other error classes or mismatched field needles", () => {
    const validation = validationError("Unknown field `internalQaSyntheticPersona` for where statement.");
    const known = knownRequestError("Unknown field `stripeBillingLiveMode`", "P2022");

    expect(isPrismaUnknownModelFieldError(validation, "stripeBillingLiveMode")).toBe(false);
    expect(isPrismaUnknownModelFieldError(known, "stripeBillingLiveMode")).toBe(false);
    expect(isPrismaUnknownModelFieldError(new Error("Unknown field stripeBillingLiveMode"), "stripeBillingLiveMode")).toBe(false);
  });
});
