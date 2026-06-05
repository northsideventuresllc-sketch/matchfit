import { describe, expect, it } from "vitest";
import {
  isMissingTrainerRegisterSchemaError,
  TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED,
} from "@/lib/ensure-trainer-register-schema";

describe("ensure-trainer-register-schema", () => {
  it("tracks background check plan B columns in the required profile column set", () => {
    expect(TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED).toBeGreaterThanOrEqual(14);
  });

  it("detects missing backgroundCheckInviteRequestedAt from Prisma errors", () => {
    const err = new Error(
      "Invalid `prisma.trainerProfile.update()` invocation: The column `trainer_profiles.backgroundCheckInviteRequestedAt` does not exist in the current database.",
    );
    expect(isMissingTrainerRegisterSchemaError(err)).toBe(true);
  });
});
