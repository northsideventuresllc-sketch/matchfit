import { lookupUsStateFromZip } from "@/lib/us-zip-to-state";
import { normalizeTrainerServiceZip } from "@/lib/trainer-service-zip";
import { US_STATE_POSTAL_OPTIONS } from "@/lib/trainer-profile-demography-options";
import type { W9StoredSupport } from "@/lib/w9-support-redaction";

const VALID_STATE_CODES = new Set(US_STATE_POSTAL_OPTIONS.map((o) => o.value));

export type TrainerBackgroundCheckJurisdiction = {
  state: string;
  zip: string;
  city?: string;
  source: "w9" | "service_zip";
};

export function normalizeUsStateCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  if (!code || !VALID_STATE_CODES.has(code)) return null;
  return code;
}

export function parseTrainerW9Json(w9Json: string | null | undefined): W9StoredSupport | null {
  if (!w9Json?.trim()) return null;
  try {
    return JSON.parse(w9Json) as W9StoredSupport;
  } catch {
    return null;
  }
}

/**
 * Resolve the US state Checkr should screen against.
 * Virtual / nationwide coaches use their signup service ZIP (home base), not Atlanta/GA by default.
 */
export function resolveTrainerBackgroundCheckJurisdiction(profile: {
  serviceZipCode?: string | null;
  w9Json?: string | null;
  betaSlotInPersonHeld?: boolean;
}): TrainerBackgroundCheckJurisdiction | { error: string } {
  void profile.betaSlotInPersonHeld;

  const w9 = parseTrainerW9Json(profile.w9Json);
  const w9State = normalizeUsStateCode(w9?.state);
  const w9Zip = normalizeTrainerServiceZip(w9?.zip);
  const serviceZip = normalizeTrainerServiceZip(profile.serviceZipCode);

  if (w9State) {
    const zip = w9Zip ?? serviceZip;
    if (!zip) {
      return {
        error: "Your W-9 state is on file but we need a ZIP to run screening in your state.",
      };
    }
    const zipState = lookupUsStateFromZip(zip);
    if (zipState && zipState !== w9State) {
      return {
        error: "Your W-9 state does not match your ZIP code. Update your W-9 before continuing.",
      };
    }
    return {
      state: w9State,
      zip,
      city: w9?.city?.trim() || undefined,
      source: "w9",
    };
  }

  if (!serviceZip) {
    return {
      error:
        "Enter your home ZIP on trainer sign-up so we can run your background check in your state of residence.",
    };
  }

  const stateFromZip = lookupUsStateFromZip(serviceZip);
  if (!stateFromZip) {
    return {
      error: "We could not determine your state from your ZIP code. Contact support@match-fit.net.",
    };
  }

  return {
    state: stateFromZip,
    zip: serviceZip,
    source: "service_zip",
  };
}
