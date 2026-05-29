import { initiateTrainerBackgroundCheck } from "@/lib/trainer-background-check-initiate";

/** Dev/QA shortcut — delegates to the real jurisdiction-aware Checkr initiation path. */
export async function mockInitiateTrainerBackgroundCheck(input: {
  trainerId: string;
}): Promise<{ externalReference: string; status: string; screeningState: string }> {
  const result = await initiateTrainerBackgroundCheck({ trainerId: input.trainerId });
  return {
    externalReference: result.externalReference,
    status: result.status,
    screeningState: result.screeningState,
  };
}

/**
 * Placeholder for W-9 collection (e-signature vendor or IRS PDF flow).
 */
export async function mockRecordTrainerW9Intent(input: { trainerId: string }): Promise<{ ok: true }> {
  void input;
  return { ok: true };
}
