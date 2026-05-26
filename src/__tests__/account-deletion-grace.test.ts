import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  accountDeletionScheduledLoginNext,
  accountDeletionGraceMs,
  computeAccountDeletionFinalizeAt,
  isAccountDeidentified,
  isAccountDeletionGraceActive,
  isAccountDeletionOverdue,
  isAccountPendingDeletion,
} from "@/lib/account-deletion-grace";

describe("account-deletion-grace", () => {
  it("uses a 30-day grace window", () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
    expect(accountDeletionGraceMs()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("computes finalize_at from requested_at", () => {
    const requested = new Date("2026-05-21T12:00:00.000Z");
    const finalize = computeAccountDeletionFinalizeAt(requested);
    expect(finalize.getTime() - requested.getTime()).toBe(accountDeletionGraceMs());
  });

  it("detects active grace, overdue, and pending states", () => {
    const requested = new Date(Date.now() - 120_000);
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);

    expect(
      isAccountPendingDeletion({
        accountDeletionRequestedAt: requested,
        accountDeletionFinalizeAt: future,
      }),
    ).toBe(true);
    expect(
      isAccountDeletionGraceActive({
        accountDeletionRequestedAt: requested,
        accountDeletionFinalizeAt: future,
      }),
    ).toBe(true);
    expect(
      isAccountDeletionOverdue({
        accountDeletionRequestedAt: requested,
        accountDeletionFinalizeAt: past,
      }),
    ).toBe(true);
    expect(
      isAccountDeletionGraceActive({
        accountDeletionRequestedAt: requested,
        accountDeletionFinalizeAt: past,
      }),
    ).toBe(false);
    expect(
      isAccountPendingDeletion({
        accountDeletionRequestedAt: null,
        accountDeletionFinalizeAt: null,
      }),
    ).toBe(false);
    expect(
      isAccountPendingDeletion({
        accountDeletionRequestedAt: requested,
        accountDeletionFinalizeAt: future,
        deidentifiedAt: new Date(),
      } as {
        accountDeletionRequestedAt: Date | null;
        accountDeletionFinalizeAt: Date | null;
      }),
    ).toBe(false);
  });

  it("treats deidentified accounts as no longer pending deletion", () => {
    expect(isAccountDeidentified(new Date("2026-05-21T00:00:00.000Z"))).toBe(true);
    expect(isAccountDeidentified(null)).toBe(false);
    expect(
      isAccountPendingDeletion({
        accountDeletionRequestedAt: new Date("2026-05-20T00:00:00.000Z"),
        accountDeletionFinalizeAt: new Date("2026-05-25T00:00:00.000Z"),
        deidentifiedAt: new Date("2026-05-22T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("returns the role-specific account deletion status page", () => {
    expect(accountDeletionScheduledLoginNext("client")).toBe("/client/account-deletion-scheduled");
    expect(accountDeletionScheduledLoginNext("trainer")).toBe("/trainer/account-deletion-scheduled");
  });
});
