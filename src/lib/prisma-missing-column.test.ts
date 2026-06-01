import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isPrismaMissingColumnError,
  isPrismaMissingTableError,
  isPrismaUnknownModelFieldError,
} from "@/lib/prisma-missing-column";

function knownRequestError(code: string, message: string): Prisma.PrismaClientKnownRequestError {
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

describe("prisma-missing-column helpers", () => {
  describe("isPrismaMissingColumnError", () => {
    it("returns true only for P2022 errors that include the column name", () => {
      const error = knownRequestError("P2022", 'column "dashboardQuickLinkIdsJson" does not exist');
      expect(isPrismaMissingColumnError(error, "dashboardQuickLinkIdsJson")).toBe(true);
      expect(isPrismaMissingColumnError(error, "otherColumn")).toBe(false);
    });

    it("returns false for non-P2022 errors and non-Prisma values", () => {
      expect(
        isPrismaMissingColumnError(
          knownRequestError("P2021", 'table "clients" does not exist'),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(false);
      expect(isPrismaMissingColumnError(new Error("column missing"), "dashboardQuickLinkIdsJson")).toBe(false);
      expect(isPrismaMissingColumnError("P2022 dashboardQuickLinkIdsJson", "dashboardQuickLinkIdsJson")).toBe(
        false,
      );
    });
  });

  describe("isPrismaMissingTableError", () => {
    it("detects generic missing-table message forms before Prisma type checks", () => {
      expect(
        isPrismaMissingTableError(
          new Error('relation "site_analytics_events" does not exist'),
          "site_analytics_events",
        ),
      ).toBe(true);
      expect(
        isPrismaMissingTableError(
          'Postgres error 42P01: relation "site_analytics_events" is missing',
          "site_analytics_events",
        ),
      ).toBe(true);
      expect(
        isPrismaMissingTableError(
          "Prisma failed with P2021 for table site_analytics_events",
          "site_analytics_events",
        ),
      ).toBe(true);
    });

    it("falls back to Prisma P2021 checks and rejects unrelated messages", () => {
      const prismaError = knownRequestError(
        "P2021",
        'The table `public.site_analytics_events` does not exist in the current database.',
      );
      expect(isPrismaMissingTableError(prismaError, "site_analytics_events")).toBe(true);
      expect(isPrismaMissingTableError(prismaError, "trainer_client_goals")).toBe(false);
      expect(
        isPrismaMissingTableError(
          new Error("The relation does not exist but table name is absent"),
          "site_analytics_events",
        ),
      ).toBe(false);
    });
  });

  describe("isPrismaUnknownModelFieldError", () => {
    it("matches validation errors for unknown field and argument variants", () => {
      expect(
        isPrismaUnknownModelFieldError(
          validationError("Unknown field `dashboardQuickLinkIdsJson` for select statement on model Client."),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(true);
      expect(
        isPrismaUnknownModelFieldError(
          validationError("Unknown argument `dashboardQuickLinkIdsJson`. Available options are listed in green."),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(true);
      expect(
        isPrismaUnknownModelFieldError(
          validationError("Unknown arg dashboardQuickLinkIdsJson in data.dashboardQuickLinkIdsJson for type Client."),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(true);
    });

    it("returns false when error type, marker text, or field name does not match", () => {
      expect(
        isPrismaUnknownModelFieldError(
          validationError("Unknown field `otherField` for select statement on model Client."),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(false);
      expect(
        isPrismaUnknownModelFieldError(
          validationError("Validation failed for reasons unrelated to field names."),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(false);
      expect(
        isPrismaUnknownModelFieldError(
          knownRequestError("P2002", "Unique constraint failed on the fields: (`email`)"),
          "dashboardQuickLinkIdsJson",
        ),
      ).toBe(false);
    });
  });
});
