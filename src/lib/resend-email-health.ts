import "server-only";

import { matchFitProductionFromHeader } from "@/lib/resend-client";

export type ResendEmailHealth = {
  configured: boolean;
  apiReachable: boolean;
  fromAddress: string | null;
  domainVerified: boolean | null;
  error: string | null;
};

/** Confirms RESEND_API_KEY is valid and the match-fit.net sending domain is verified. */
export async function resendEmailHealth(): Promise<ResendEmailHealth> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return {
      configured: false,
      apiReachable: false,
      fromAddress: null,
      domainVerified: null,
      error: "RESEND_API_KEY is not set.",
    };
  }

  const fromAddress = matchFitProductionFromHeader();

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const raw = await res.text();
    if (!res.ok) {
      return {
        configured: true,
        apiReachable: false,
        fromAddress,
        domainVerified: null,
        error: `Resend HTTP ${res.status}: ${raw.slice(0, 180)}`,
      };
    }

    let domainVerified: boolean | null = null;
    try {
      const parsed = JSON.parse(raw) as { data?: Array<{ name?: string; status?: string }> };
      const domains = parsed.data ?? [];
      const matchFit = domains.find((d) => d.name === "match-fit.net");
      domainVerified = matchFit?.status === "verified";
    } catch {
      domainVerified = null;
    }

    return {
      configured: true,
      apiReachable: true,
      fromAddress,
      domainVerified,
      error: null,
    };
  } catch (e) {
    return {
      configured: true,
      apiReachable: false,
      fromAddress,
      domainVerified: null,
      error: e instanceof Error ? e.message : "Resend API call failed.",
    };
  }
}

/** Sends a probe OTP_2FA email (used by health checks and ops scripts). */
export async function sendProbeOtpEmail(to: string): Promise<{ ok: true; resendId?: string } | { ok: false; error: string }> {
  const { sendMatchFitBrandedEmail } = await import("@/lib/match-fit-branded-email");
  const { buildTransactionalEmail } = await import("@/lib/transactional-email-templates");

  try {
    const { subject, text, html } = buildTransactionalEmail("OTP_2FA", { code: "000000" });
    const resendId = await sendMatchFitBrandedEmail({
      to,
      subject: `[Match Fit probe] ${subject}`,
      text: `This is a delivery probe — not a real login code.\n\n${text}`,
      html,
    });
    return { ok: true, resendId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Probe send failed." };
  }
}
