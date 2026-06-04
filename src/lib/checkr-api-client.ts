import { getCheckrApiKey } from "@/lib/checkr-config";
import {
  getCheckrApiBase,
  getCheckrPackageSlug,
  getCheckrWorkLocationCity,
  getCheckrWorkLocationState,
  isCheckrApiFullyConfigured,
} from "@/lib/checkr-integration";

type CheckrJson = Record<string, unknown>;

async function checkrFetch(path: string, init?: RequestInit): Promise<CheckrJson> {
  const key = getCheckrApiKey();
  if (!key) throw new Error("CHECKR_API_KEY is not configured.");
  const base = getCheckrApiBase().replace(/\/$/, "");
  const auth = Buffer.from(`${key}:`, "utf8").toString("base64");
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err =
      typeof body === "object" && body && "error" in (body as CheckrJson)
        ? String((body as CheckrJson).error)
        : res.statusText;
    throw new Error(`Checkr API ${res.status}: ${err}`);
  }
  return (body && typeof body === "object" ? body : {}) as CheckrJson;
}

function formBody(entries: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

export async function createCheckrCandidate(args: {
  email: string;
  firstName: string;
  lastName: string;
  trainerId: string;
}): Promise<{ candidateId: string }> {
  const data = await checkrFetch("/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      email: args.email,
      first_name: args.firstName,
      last_name: args.lastName,
      custom_id: args.trainerId,
    }),
  });
  const id = typeof data.id === "string" ? data.id : null;
  if (!id) throw new Error("Checkr did not return a candidate id.");
  return { candidateId: id };
}

export async function createCheckrInvitation(args: {
  candidateId: string;
  trainerId: string;
}): Promise<{ invitationId: string; invitationUrl: string | null }> {
  const packageSlug = getCheckrPackageSlug();
  if (!packageSlug) throw new Error("CHECKR_PACKAGE_SLUG is not configured.");

  const state = getCheckrWorkLocationState();
  const city = getCheckrWorkLocationCity();
  const fields: Record<string, string> = {
    candidate_id: args.candidateId,
    package: packageSlug,
    "work_locations[][country]": "US",
    "work_locations[][state]": state,
    "metadata[trainerId]": args.trainerId,
  };
  if (city) fields["work_locations[][city]"] = city;

  const data = await checkrFetch("/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody(fields),
  });
  const id = typeof data.id === "string" ? data.id : null;
  if (!id) throw new Error("Checkr did not return an invitation id.");
  const invitationUrl =
    typeof data.invitation_url === "string"
      ? data.invitation_url
      : typeof data.uri === "string"
        ? data.uri
        : null;
  return { invitationId: id, invitationUrl };
}

export async function tryAutomatedCheckrInvitation(args: {
  trainerId: string;
  email: string;
  firstName: string;
  lastName: string;
  existingCandidateId?: string | null;
}): Promise<
  | { ok: true; candidateId: string; invitationId: string; invitationUrl: string | null; automated: true }
  | { ok: false; reason: string }
> {
  if (!isCheckrApiFullyConfigured()) {
    return { ok: false, reason: "checkr_api_not_configured" };
  }
  try {
    let candidateId = args.existingCandidateId?.trim() || null;
    if (!candidateId) {
      const created = await createCheckrCandidate({
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        trainerId: args.trainerId,
      });
      candidateId = created.candidateId;
    }
    const invitation = await createCheckrInvitation({
      candidateId,
      trainerId: args.trainerId,
    });
    return {
      ok: true,
      candidateId,
      invitationId: invitation.invitationId,
      invitationUrl: invitation.invitationUrl,
      automated: true,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkr invitation failed.";
    return { ok: false, reason: message };
  }
}
