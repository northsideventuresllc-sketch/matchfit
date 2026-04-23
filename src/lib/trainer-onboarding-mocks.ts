/**
 * Placeholders for third-party background screening (Checkr, Sterling, etc.).
 * Replace the body with real API calls when credentials are available.
 */
export async function mockInitiateTrainerBackgroundCheck(input: {
  trainerId: string;
}): Promise<{ externalReference: string; status: string }> {
  void input;
  return {
    externalReference: `mock-bg-${Date.now().toString(36)}`,
    status: "submitted",
  };
}

/**
 * Placeholder for W-9 collection (e-signature vendor or IRS PDF flow).
 */
export async function mockRecordTrainerW9Intent(input: { trainerId: string }): Promise<{ ok: true }> {
  void input;
  return { ok: true };
}
