import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isPrismaMissingColumnError,
  isPrismaMissingTableError,
  isPrismaUnknownModelFieldError,
} from "@/lib/prisma-missing-column";

function knownRequestError(message: string, code: string) {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "unit-test" });
}

describe("prisma missing-schema error helpers", () => {
  it("detects missing column errors only for P2022 with matching column needle", () => {
    const err = knownRequestError('The column `clients.internalQaSyntheticPersona` does not exist.', "P2022");
    expect(isPrismaMissingColumnError(err, "internalQaSyntheticPersona")).toBe(true);
    expect(isPrismaMissingColumnError(err, "stripeBillingLiveMode")).toBe(false);

    const wrongCode = knownRequestError("same message", "P2010");
    expect(isPrismaMissingColumnError(wrongCode, "internalQaSyntheticPersona")).toBe(false);
  });

  it("detects missing table errors from plain Postgres text messages", () => {
    const doesNotExist = new Error('relation "site_analytics_events" does not exist');
    expect(isPrismaMissingTableError(doesNotExist, "site_analytics_events")).toBe(true);

    const sqlStateMessage = new Error('error: relation "session_trainer_punch_ins" not found (42P01)');
    expect(isPrismaMissingTableError(sqlStateMessage, "session_trainer_punch_ins")).toBe(true);
  });

  it("falls back to Prisma P2021 detection for known request errors", () => {
    const err = knownRequestError("Table `public.site_analytics_events` does not exist.", "P2021");
    expect(isPrismaMissingTableError(err, "site_analytics_events")).toBe(true);

    const wrongNeedle = knownRequestError("Table `public.other_table` does not exist.", "P2021");
    expect(isPrismaMissingTableError(wrongNeedle, "site_analytics_events")).toBe(false);
  });

  it("rejects non-matching messages and non-table errors", () => {
    expect(isPrismaMissingTableError(new Error("database unavailable"), "site_analytics_events")).toBe(false);
    expect(isPrismaMissingTableError("timeout error", "site_analytics_events")).toBe(false);
  });

  it("detects unknown model fields from Prisma validation errors", () => {
    const err = new Prisma.PrismaClientValidationError(
      "Unknown field `stripeBillingLiveMode` for select statement on model Client.",
      { clientVersion: "unit-test" },
    );
    expect(isPrismaUnknownModelFieldError(err, "stripeBillingLiveMode")).toBe(true);

    const wrongNeedle = new Prisma.PrismaClientValidationError(
      "Unknown field `stripeSubscriptionActive` for select statement on model Client.",
      { clientVersion: "unit-test" },
    );
    expect(isPrismaUnknownModelFieldError(wrongNeedle, "stripeBillingLiveMode")).toBe(false);
  });
});
