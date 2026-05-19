import { CHECKR_API_BASE, getCheckrApiKey, isCheckrConfigured } from "@/lib/checkr/config";

export class CheckrNotConfiguredError extends Error {
  constructor() {
    super("Checkr is not configured. Set CHECKR_API_KEY in your environment.");
    this.name = "CheckrNotConfiguredError";
  }
}

type CheckrRequestInit = {
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
};

async function checkrFetch<T>(path: string, init?: CheckrRequestInit): Promise<T> {
  const apiKey = getCheckrApiKey();
  if (!apiKey) throw new CheckrNotConfiguredError();

  const res = await fetch(`${CHECKR_API_BASE}${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { raw: text };
    }
  }

  if (!res.ok) {
    const detail =
      json && typeof json === "object" && "error" in json
        ? String((json as { error?: string }).error)
        : text || res.statusText;
    throw new Error(`Checkr API ${res.status}: ${detail}`);
  }

  return json as T;
}

export type CheckrCandidate = {
  id: string;
  email?: string | null;
};

export type CheckrInvitation = {
  id: string;
  status?: string | null;
  report_id?: string | null;
  uri?: string | null;
};

export type CheckrReport = {
  id: string;
  status: string;
  result?: string | null;
  adjudication?: string | null;
  uri?: string | null;
  candidate_id?: string | null;
};

export async function createCheckrCandidate(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}): Promise<CheckrCandidate> {
  return checkrFetch<CheckrCandidate>("/candidates", {
    method: "POST",
    body: {
      email: input.email.trim().toLowerCase(),
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      work_locations: [{ country: "US" }],
    },
  });
}

export async function createCheckrInvitation(input: {
  candidateId: string;
  packageSlug: string;
}): Promise<CheckrInvitation> {
  return checkrFetch<CheckrInvitation>("/invitations", {
    method: "POST",
    body: {
      candidate_id: input.candidateId,
      package: input.packageSlug,
      work_locations: [{ country: "US" }],
    },
  });
}

export async function retrieveCheckrReport(reportId: string): Promise<CheckrReport> {
  return checkrFetch<CheckrReport>(`/reports/${encodeURIComponent(reportId)}`);
}

export function checkrIsConfiguredForRuntime(): boolean {
  return isCheckrConfigured();
}
