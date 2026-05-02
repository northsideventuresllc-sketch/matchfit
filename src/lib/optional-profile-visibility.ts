/**
 * Optional public-profile field visibility (Privacy Policy §2.3 / §9).
 * `null` / missing JSON means “show when data exists” (legacy default).
 */

export type TrainerOptionalProfileVisibility = {
  showPronouns?: boolean;
  showEthnicity?: boolean;
  showGenderIdentity?: boolean;
  showLanguagesSpoken?: boolean;
};

export type ClientOptionalProfileVisibility = {
  /** When false, public `/clients/...` hides bio. */
  showBioOnPublicProfile?: boolean;
  /** When false, hides the “Match snapshot” block on the public client page. */
  showMatchSnapshotOnPublicProfile?: boolean;
};

const TRAINER_DEFAULT: Required<TrainerOptionalProfileVisibility> = {
  showPronouns: true,
  showEthnicity: true,
  showGenderIdentity: true,
  showLanguagesSpoken: true,
};

const CLIENT_DEFAULT: Required<ClientOptionalProfileVisibility> = {
  showBioOnPublicProfile: true,
  showMatchSnapshotOnPublicProfile: true,
};

function parseJson<T>(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseTrainerOptionalProfileVisibility(
  raw: string | null | undefined,
): Required<TrainerOptionalProfileVisibility> {
  const o = parseJson(raw);
  return {
    showPronouns: o.showPronouns === false ? false : TRAINER_DEFAULT.showPronouns,
    showEthnicity: o.showEthnicity === false ? false : TRAINER_DEFAULT.showEthnicity,
    showGenderIdentity: o.showGenderIdentity === false ? false : TRAINER_DEFAULT.showGenderIdentity,
    showLanguagesSpoken: o.showLanguagesSpoken === false ? false : TRAINER_DEFAULT.showLanguagesSpoken,
  };
}

export function parseClientOptionalProfileVisibility(
  raw: string | null | undefined,
): Required<ClientOptionalProfileVisibility> {
  const o = parseJson(raw);
  return {
    showBioOnPublicProfile: o.showBioOnPublicProfile === false ? false : CLIENT_DEFAULT.showBioOnPublicProfile,
    showMatchSnapshotOnPublicProfile:
      o.showMatchSnapshotOnPublicProfile === false ? false : CLIENT_DEFAULT.showMatchSnapshotOnPublicProfile,
  };
}

export function serializeTrainerOptionalProfileVisibility(
  v: TrainerOptionalProfileVisibility,
  existingRaw: string | null | undefined,
): string {
  const cur = parseTrainerOptionalProfileVisibility(existingRaw);
  const next = { ...cur, ...v };
  return JSON.stringify(next);
}

export function serializeClientOptionalProfileVisibility(
  v: ClientOptionalProfileVisibility,
  existingRaw: string | null | undefined,
): string {
  const cur = parseClientOptionalProfileVisibility(existingRaw);
  const next = { ...cur, ...v };
  return JSON.stringify(next);
}
