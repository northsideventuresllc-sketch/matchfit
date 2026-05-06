import { describe, expect, it } from "vitest";
import {
  gateAPostSessionDeadlineAt,
  checkInWindowStartAt,
  defaultSessionEndAt,
  deriveCheckInUiPhase,
  FOREGO_PARTIAL_REFUND_NET_SLICE,
  payoutBufferEndsAtFromGates,
  type GateSnapshot,
} from "@/lib/session-check-in";

function baseConfirmed(override: Partial<GateSnapshot>): GateSnapshot {
  return {
    status: "CLIENT_CONFIRMED",
    fulfillmentStatus: "SCHEDULED",
    scheduledStartAt: new Date("2026-06-10T15:00:00.000Z"),
    scheduledEndAt: new Date("2026-06-10T16:00:00.000Z"),
    gateASatisfiedAt: null,
    gateARevokedBeforeStartAt: null,
    trainerGateBCompletedAt: null,
    payoutBufferEndsAt: null,
    payoutFundsFrozen: false,
    disputeOpenedAt: null,
    ...override,
  };
}

describe("session check-in window", () => {
  it("defaults session end to start + 1h when end missing", () => {
    const start = new Date("2026-06-01T12:00:00.000Z");
    const end = defaultSessionEndAt({ scheduledStartAt: start, scheduledEndAt: null });
    expect(end.toISOString()).toBe("2026-06-01T13:00:00.000Z");
  });

  it("opens check-in 24h before start", () => {
    const start = new Date("2026-06-01T12:00:00.000Z");
    const w = checkInWindowStartAt(start);
    expect(w.toISOString()).toBe("2026-05-31T12:00:00.000Z");
  });

  it("Gate A silence deadline is 24h after session end", () => {
    const start = new Date("2026-06-01T12:00:00.000Z");
    const d = gateAPostSessionDeadlineAt({ scheduledStartAt: start, scheduledEndAt: null });
    expect(d.toISOString()).toBe("2026-06-02T13:00:00.000Z");
  });

  it("derive phases for a confirmed session (Gate A UX)", () => {
    const start = new Date("2026-06-10T15:00:00.000Z");
    const end = new Date("2026-06-10T16:00:00.000Z");
    const before = new Date("2026-06-09T10:00:00.000Z");
    const midPresession = new Date("2026-06-10T14:00:00.000Z");
    const afterDeadline = new Date("2026-06-12T20:00:00.000Z");

    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "SCHEDULED",
        }),
        now: before,
      }),
    ).toBe("upcoming");

    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "CHECK_IN_ACTIVE",
        }),
        now: midPresession,
      }),
    ).toBe("gate_a_open_presession");

    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "SCHEDULED",
        }),
        now: afterDeadline,
      }),
    ).toBe("waiting_trainer_gate_b");
  });

  it("payout buffer requires max of Gate A/B timestamps + 48h", () => {
    const a = new Date("2026-01-01T10:00:00.000Z");
    const b = new Date("2026-01-01T12:00:00.000Z");
    const out = payoutBufferEndsAtFromGates({ gateASatisfiedAt: a, trainerGateBCompletedAt: b });
    const want = new Date(b);
    want.setHours(want.getHours() + 48);
    expect(out.toISOString()).toBe(want.toISOString());
  });

  it("waiting on trainer after Gate A closed", () => {
    const start = new Date("2026-06-10T15:00:00.000Z");
    const end = new Date("2026-06-10T16:00:00.000Z");
    const later = new Date("2026-06-15T15:00:00.000Z");
    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "WAITING_TRAINER_GATE_B",
          gateASatisfiedAt: new Date("2026-06-10T18:00:00.000Z"),
        }),
        now: later,
      }),
    ).toBe("waiting_trainer_gate_b");
  });

  it("48h dispute buffer after both gates closed", () => {
    const start = new Date("2026-06-10T15:00:00.000Z");
    const end = new Date("2026-06-10T16:00:00.000Z");
    const ga = new Date("2026-06-11T08:00:00.000Z");
    const gb = new Date("2026-06-11T10:00:00.000Z");
    const bufferEnd = payoutBufferEndsAtFromGates({ gateASatisfiedAt: ga, trainerGateBCompletedAt: gb });
    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "GATES_IN_PAYOUT_BUFFER",
          gateASatisfiedAt: ga,
          trainerGateBCompletedAt: gb,
          payoutBufferEndsAt: bufferEnd,
        }),
        now: new Date(bufferEnd.getTime() - 60_000),
      }),
    ).toBe("payout_dispute_window");
    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "GATES_IN_PAYOUT_BUFFER",
          gateASatisfiedAt: ga,
          trainerGateBCompletedAt: gb,
          payoutBufferEndsAt: bufferEnd,
        }),
        now: new Date(bufferEnd.getTime() + 60_000),
      }),
    ).toBe("closed");
  });

  it("awaiting follow-up stays visible after nominal auto Gate A deadline", () => {
    const start = new Date("2026-06-10T15:00:00.000Z");
    const end = new Date("2026-06-10T16:00:00.000Z");
    const late = new Date("2026-06-13T00:00:00.000Z");
    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "AWAITING_CLIENT_FOLLOWUP",
        }),
        now: late,
      }),
    ).toBe("awaiting_followup");
  });

  it("forego refund fraction is one half of net slice", () => {
    expect(FOREGO_PARTIAL_REFUND_NET_SLICE).toBe(0.5);
  });

  it("frozen dispute stays in payout_dispute_frozen (not closed)", () => {
    const start = new Date("2026-06-10T15:00:00.000Z");
    const end = new Date("2026-06-10T16:00:00.000Z");
    expect(
      deriveCheckInUiPhase({
        ...baseConfirmed({
          scheduledStartAt: start,
          scheduledEndAt: end,
          fulfillmentStatus: "PAYOUT_DISPUTE_FROZEN",
          disputeOpenedAt: new Date("2026-06-12T10:00:00.000Z"),
          payoutFundsFrozen: true,
        }),
        now: new Date("2026-06-12T12:00:00.000Z"),
      }),
    ).toBe("payout_dispute_frozen");
  });
});
