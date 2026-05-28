import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import {
  isPrismaMissingColumnError,
  isPrismaMissingTableError,
  isPrismaUnknownModelFieldError,
} from "@/lib/prisma-missing-column";

function knownRequestError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "unit-test",
  });
}

function validationError(message: string): Prisma.PrismaClientValidationError {
  const err = new Error(message);
  Object.setPrototypeOf(err, Prisma.PrismaClientValidationError.prototype);
  return err as Prisma.PrismaClientValidationError;
}

describe("prisma-missing-column helpers", () => {
  it("detects Prisma P2022 missing-column errors by message needle", () => {
    const err = knownRequestError("P2022", 'column "internalQaSyntheticPersona" does not exist');
    expect(isPrismaMissingColumnError(err, "internalQaSyntheticPersona")).toBe(true);
  });

  it("returns false for non-matching missing-column errors", () => {
    const err = knownRequestError("P2022", 'column "otherColumn" does not exist');
    expect(isPrismaMissingColumnError(err, "internalQaSyntheticPersona")).toBe(false);
  });

  it("detects missing tables from Postgres relation-missing messages", () => {
    const err = new Error('relation "site_analytics_events" does not exist (SQLSTATE 42P01)');
    expect(isPrismaMissingTableError(err, "site_analytics_events")).toBe(true);
  });

  it("detects missing tables from Prisma P2021 errors", () => {
    const err = knownRequestError("P2021", "The table `public.site_analytics_events` does not exist.");
    expect(isPrismaMissingTableError(err, "site_analytics_events")).toBe(true);
  });

  it("returns false for unrelated table errors", () => {
    const err = new Error("ECONNREFUSED localhost:5432");
    expect(isPrismaMissingTableError(err, "site_analytics_events")).toBe(false);
  });

  it("detects unknown model field validation errors", () => {
    const err = validationError("Unknown argument `internalQaSyntheticPersona` in where clause.");
    expect(isPrismaUnknownModelFieldError(err, "internalQaSyntheticPersona")).toBe(true);
  });

  it("returns false for unrelated validation failures", () => {
    const err = validationError("Argument id is missing.");
    expect(isPrismaUnknownModelFieldError(err, "internalQaSyntheticPersona")).toBe(false);
  });
});
