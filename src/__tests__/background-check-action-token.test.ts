import { describe, expect, it } from "vitest";
import {
  signBackgroundCheckStaffToken,
  verifyBackgroundCheckStaffToken,
} from "@/lib/background-check-action-token";

describe("background-check-action-token", () => {
  it("round-trips confirm_invite_sent token", async () => {
    const token = await signBackgroundCheckStaffToken("trainer_abc", "confirm_invite_sent");
    const verified = await verifyBackgroundCheckStaffToken(token);
    expect(verified).toEqual({ trainerId: "trainer_abc", action: "confirm_invite_sent" });
  });

  it("round-trips approve and deny tokens", async () => {
    const approve = await verifyBackgroundCheckStaffToken(
      await signBackgroundCheckStaffToken("t1", "approve"),
    );
    const deny = await verifyBackgroundCheckStaffToken(await signBackgroundCheckStaffToken("t1", "deny"));
    expect(approve?.action).toBe("approve");
    expect(deny?.action).toBe("deny");
  });
});
