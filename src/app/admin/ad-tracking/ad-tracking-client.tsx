"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminPortalAlert,
  AdminPortalBetaNotice,
  AdminLoadingBar,
  AdminCollapsibleSection,
  adminAccentButtonClass,
  adminInputClassSm,
  adminLabelClass,
  adminLinkClass,
  adminPanelClass,
  adminSecondaryButtonClass,
  adminSectionTitleClass,
} from "@/components/admin/admin-portal-ui";
import {
  AD_LANDING_PATHS,
  buildTrackedAdUrl,
  type AdCampaignPlatform,
  type AdLandingFunnel,
  type AdPlatform,
  type AdTrackingEvent,
  type AdUtmPreset,
} from "@/lib/ad-tracking-config";
import { MATCH_FIT_MARKETING_PLAYBOOK_STEPS } from "@/lib/match-fit-marketing-playbook";
import { B2cRunbookPhasePanel } from "@/components/admin/b2c-runbook-phase-panel";
import { AdTrackingAiChat } from "./ad-tracking-ai-chat";
import type { AdPerformancePanel } from "@/lib/ad-platform-performance";

const VENTURE_LABELS: Record<string, string> = {
  match_fit: "Match Fit",
  ni: "NORTHSiDE Intelligence",
  ncc: "NCC",
};

function ventureLabel(venture: string): string {
  return VENTURE_LABELS[venture] ?? venture;
}

type TrackingConfigResponse = {
  pixels: {
    meta: { id: string; label: string; eventsManagerUrl: string; testEventsUrl: string };
    google: { id: string; label: string; conversionsUrl: string };
  };
  events: AdTrackingEvent[];
  utmPresets: AdUtmPreset[];
  landingPaths: typeof AD_LANDING_PATHS;
  trainerOnboardingSteps: { step_id: string; step_name: string }[];
  integrations: {
    platform: AdPlatform;
    configured: boolean;
    missingEnv: string[];
    spendSyncStatus?: "not_configured" | "credentials_present" | "insights_ok" | "insights_error";
    spendSyncDetail?: string | null;
  }[];
  serverConversions: {
    metaCapi: {
      configured: boolean;
      missingEnv: string[];
      capiSyncStatus?: "not_configured" | "credentials_present" | "capi_ok" | "capi_error";
      capiSyncDetail?: string | null;
      usedAdsTokenFallback?: boolean;
    };
    ga4: { configured: boolean; missingEnv: string[] };
  };
  googleConversions: {
    clientSignup: { envKey: string; sendTo: string | null; configured: boolean };
    trainerSignup: { envKey: string; sendTo: string | null; configured: boolean };
  };
  verificationSnippets: { meta: string; google: string };
  defaultBaseUrl: string;
};

type AdCampaignRow = {
  id: string;
  campaignId: string;
  platform: AdCampaignPlatform;
  name: string;
  venture: string;
  budgetCents: number | null;
  weekOf: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type CampaignsResponse = {
  campaigns: AdCampaignRow[];
  migrationPending?: boolean;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/60 hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: AdCampaignPlatform }) {
  const labels: Record<AdCampaignPlatform, string> = {
    meta: "Meta",
    google: "Google",
    tiktok: "TikTok",
  };
  const colors: Record<AdCampaignPlatform, string> = {
    meta: "border-[#1877F2]/40 bg-[#1877F2]/10 text-[#8CB9FF]",
    google: "border-[#34A853]/40 bg-[#34A853]/10 text-[#9BE7B0]",
    tiktok: "border-[#FE2C55]/40 bg-[#FE2C55]/10 text-[#FF9BB5]",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${colors[platform]}`}
    >
      {labels[platform]}
    </span>
  );
}

export function AdTrackingClient() {
  const [config, setConfig] = useState<TrackingConfigResponse | null>(null);
  const [panel, setPanel] = useState<AdPerformancePanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<AdCampaignRow[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignMigrationPending, setCampaignMigrationPending] = useState(false);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [campaignPlatform, setCampaignPlatform] = useState<AdCampaignPlatform>("meta");
  const [campaignName, setCampaignName] = useState("");
  const [campaignVenture, setCampaignVenture] = useState("match_fit");
  const [campaignBudgetUsd, setCampaignBudgetUsd] = useState("");
  const [campaignWeekOf, setCampaignWeekOf] = useState("");
  const [campaignNotes, setCampaignNotes] = useState("");

  const [baseUrl, setBaseUrl] = useState("https://match-fit.net");
  const [funnel, setFunnel] = useState<AdLandingFunnel>("client");
  const [utmSource, setUtmSource] = useState("facebook");
  const [utmMedium, setUtmMedium] = useState("paid_social");
  const [utmCampaign, setUtmCampaign] = useState("client_beta_launch");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [configRes, perfRes, campaignsRes] = await Promise.all([
        fetch("/api/admin/ad-tracking/config"),
        fetch("/api/admin/ad-tracking/performance?days=7"),
        fetch("/api/admin/ad-tracking/campaigns"),
      ]);
      if (!configRes.ok || !perfRes.ok) throw new Error("Could not load ad tracking data.");
      const configJson = (await configRes.json()) as TrackingConfigResponse;
      const perfJson = (await perfRes.json()) as { panel: AdPerformancePanel };
      setConfig(configJson);
      setPanel(perfJson.panel);
      setBaseUrl(configJson.defaultBaseUrl);
      if (campaignsRes.ok) {
        const campaignsJson = (await campaignsRes.json()) as CampaignsResponse;
        setCampaigns(campaignsJson.campaigns);
        setCampaignMigrationPending(Boolean(campaignsJson.migrationPending));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ad tracking.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const trackedUrl = useMemo(
    () =>
      buildTrackedAdUrl({
        baseUrl,
        funnel,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_content: utmContent || undefined,
        utm_term: utmTerm || undefined,
      }),
    [baseUrl, funnel, utmSource, utmMedium, utmCampaign, utmContent, utmTerm],
  );

  async function syncPerformance() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/admin/ad-tracking/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      const json = (await res.json()) as {
        synced?: AdPlatform[];
        errors?: Partial<Record<AdPlatform, string>>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Sync failed.");
      const parts: string[] = [];
      if (json.synced?.length) parts.push(`Synced: ${json.synced.join(", ")}`);
      if (json.errors?.meta) parts.push(`Meta: ${json.errors.meta}`);
      if (json.errors?.google) parts.push(`Google: ${json.errors.google}`);
      if (json.errors?.tiktok) parts.push(`TikTok: ${json.errors.tiktok}`);
      if (!parts.length) parts.push("No API credentials configured — add env vars to enable sync.");
      setSyncMessage(parts.join(" · "));
      await load();
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  function applyPreset(preset: AdUtmPreset) {
    setFunnel(preset.funnel);
    setUtmSource(preset.utm_source);
    setUtmMedium(preset.utm_medium);
    setUtmCampaign(preset.utm_campaign);
    setUtmContent("");
    setUtmTerm("");
  }

  async function registerCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCampaignSaving(true);
    setCampaignMessage(null);
    try {
      const budgetUsd = campaignBudgetUsd.trim();
      const budgetCents =
        budgetUsd.length > 0 ? Math.round(parseFloat(budgetUsd) * 100) : undefined;
      if (budgetUsd.length > 0 && (Number.isNaN(budgetCents) || budgetCents! < 0)) {
        throw new Error("Budget must be a valid dollar amount.");
      }
      const res = await fetch("/api/admin/ad-tracking/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId.trim(),
          platform: campaignPlatform,
          name: campaignName.trim(),
          venture: campaignVenture.trim(),
          budgetCents,
          weekOf: campaignWeekOf.trim() || undefined,
          notes: campaignNotes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { campaign?: AdCampaignRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not register campaign.");
      setCampaignMessage(`Registered campaign ${json.campaign?.name ?? campaignName}.`);
      setCampaignId("");
      setCampaignName("");
      setCampaignBudgetUsd("");
      setCampaignNotes("");
      await load();
    } catch (err) {
      setCampaignMessage(err instanceof Error ? err.message : "Could not register campaign.");
    } finally {
      setCampaignSaving(false);
    }
  }

  return (
    <AdminPortalShell
      current="ad-tracking"
      maxWidth="full"
      title="Ad Tracking HQ"
      description="Default Match Fit ads surface. Steps 1, 5–8 of the marketing playbook — plan budget, confirm pixels, build links, register campaigns, and review paid performance."
      contentClassName="space-y-6"
    >
        <AdminPortalBetaNotice className="mt-0" />

        <AdminCollapsibleSection
          eyebrow="Instructions"
          heading="8-step marketing playbook"
          className="border-[#FF7E00]/15 bg-[#FF7E00]/[0.04]"
          defaultOpen={false}
        >
          <ol className="space-y-2 text-sm leading-relaxed text-white/60">
            {MATCH_FIT_MARKETING_PLAYBOOK_STEPS.map((step) => (
              <li key={step.id}>
                <strong className="text-white/85">
                  Step {step.step} — {step.title}:
                </strong>{" "}
                {step.description}
                {step.jbLane ? (
                  <span className="text-white/40"> (your lane — outside the admin portal)</span>
                ) : null}
              </li>
            ))}
          </ol>
        </AdminCollapsibleSection>

        {error ? <AdminPortalAlert variant="error">{error}</AdminPortalAlert> : null}
        {syncMessage ? <AdminPortalAlert variant="info">{syncMessage}</AdminPortalAlert> : null}
        {campaignMessage ? <AdminPortalAlert variant="info">{campaignMessage}</AdminPortalAlert> : null}
        {loading ? <AdminLoadingBar label="Loading ad tracking…" /> : null}

        {config ? (
          <B2cRunbookPhasePanel
            phaseId="5b_confirm_client_tags"
            readiness5b={{
              clientSignupConversionConfigured: config.googleConversions.clientSignup.configured,
              trainerSignupConversionConfigured: config.googleConversions.trainerSignup.configured,
              metaCapiConfigured: config.serverConversions.metaCapi.configured,
              ga4Configured: config.serverConversions.ga4.configured,
            }}
          />
        ) : null}

        <AdminCollapsibleSection
          eyebrow="Ask AI About Your Ads"
          heading="Ads Copilot"
          description="Ask questions about spend, clicks, conversions, and which campaigns need attention. Answers use your live ad tracking numbers."
          defaultOpen
        >
          <AdTrackingAiChat />
        </AdminCollapsibleSection>

        <div className="space-y-8">
          <AdminCollapsibleSection
            eyebrow="Connected Pixels · Runbook 5b"
            heading="Live Tags in the App"
            description="These are the tracking tags already running on match-fit.net. You do not need to paste code — use the IDs here to verify setup in Meta Events Manager and Google Ads."
            defaultOpen
          >
            {config ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={adminPanelClass + " p-4"}>
                  <div className="flex items-center justify-between gap-2">
                    <PlatformBadge platform="meta" />
                    <a href={config.pixels.meta.eventsManagerUrl} className={adminLinkClass} target="_blank" rel="noreferrer">
                      Events Manager
                    </a>
                  </div>
                  <p className="mt-3 font-mono text-sm text-[#FFD34E]">{config.pixels.meta.id}</p>
                  <p className="mt-2 text-xs text-white/45">{config.pixels.meta.label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton text={config.pixels.meta.id} label="Copy pixel ID" />
                    <a href={config.pixels.meta.testEventsUrl} className={adminSecondaryButtonClass} target="_blank" rel="noreferrer">
                      Test events
                    </a>
                  </div>
                </div>
                <div className={adminPanelClass + " p-4"}>
                  <div className="flex items-center justify-between gap-2">
                    <PlatformBadge platform="google" />
                    <a href={config.pixels.google.conversionsUrl} className={adminLinkClass} target="_blank" rel="noreferrer">
                      Conversions
                    </a>
                  </div>
                  <p className="mt-3 font-mono text-sm text-[#FFD34E]">{config.pixels.google.id}</p>
                  <p className="mt-2 text-xs text-white/45">{config.pixels.google.label}</p>
                  <div className="mt-3 space-y-1 text-[11px] text-white/50">
                    <p>
                      Client signup conversion:{" "}
                      {config.googleConversions.clientSignup.configured ? (
                        <span className="text-[#9BE7B0]">Connected</span>
                      ) : (
                        <span className="text-white/35">Not configured — ask your developer to finish Google signup conversion setup</span>
                      )}
                    </p>
                    <p>
                      Trainer signup conversion:{" "}
                      {config.googleConversions.trainerSignup.configured ? (
                        <span className="text-[#9BE7B0]">Connected</span>
                      ) : (
                        <span className="text-white/35">Not configured — ask your developer to finish Google signup conversion setup</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </AdminCollapsibleSection>

          {config ? (
            <AdminCollapsibleSection
              eyebrow="Server Conversions"
              heading="Meta CAPI and GA4 (Ad-Blocker Safe)"
              description="Signup milestones also fire server-side so ad blockers cannot drop them. These use separate credentials from the reporting API tokens above."
              defaultOpen={false}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className={adminPanelClass + " p-4"}>
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform="meta" />
                    <span
                      className={
                        config.serverConversions.metaCapi.capiSyncStatus === "capi_ok"
                          ? "text-[11px] font-bold text-[#9BE7B0]"
                          : config.serverConversions.metaCapi.configured
                            ? "text-[11px] font-bold text-amber-200/90"
                            : "text-[11px] font-bold text-white/40"
                      }
                    >
                      {config.serverConversions.metaCapi.capiSyncStatus === "capi_ok"
                        ? "CAPI connected"
                        : config.serverConversions.metaCapi.capiSyncStatus === "capi_error"
                          ? "CAPI token set — Meta rejected probe"
                          : config.serverConversions.metaCapi.configured
                            ? "CAPI credentials present"
                            : "CAPI not configured"}
                    </span>
                  </div>
                  {config.serverConversions.metaCapi.capiSyncDetail ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                      {config.serverConversions.metaCapi.capiSyncDetail}
                    </p>
                  ) : !config.serverConversions.metaCapi.configured ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                      Add META_PIXEL_ID and META_ACCESS_TOKEN (Conversions API system user token from Events Manager).
                    </p>
                  ) : null}
                </div>
                <div className={adminPanelClass + " p-4"}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[#E37400]">GA4</span>
                    <span
                      className={
                        config.serverConversions.ga4.configured
                          ? "text-[11px] font-bold text-[#9BE7B0]"
                          : "text-[11px] font-bold text-white/40"
                      }
                    >
                      {config.serverConversions.ga4.configured ? "Measurement Protocol connected" : "GA4 not configured"}
                    </span>
                  </div>
                  {!config.serverConversions.ga4.configured ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                      Add GA_MEASUREMENT_ID and GA_API_SECRET from Admin → Data Streams → Measurement Protocol.
                    </p>
                  ) : null}
                </div>
              </div>
            </AdminCollapsibleSection>
          ) : null}

          <AdminCollapsibleSection
            eyebrow="Campaign Link Builder · Runbook 6b"
            heading="Generate Client Tracking URLs"
            description="Runbook 6b — default to client sign-up. Use waitlist only when the beta client cap is full. Copy the final URL into your ad creative."
            defaultOpen={false}
          >
            {config ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={adminAccentButtonClass}
                  onClick={() => {
                    const preset = config.utmPresets.find((p) => p.id === "meta_client_beta");
                    if (preset) applyPreset(preset);
                    setFunnel("client");
                  }}
                >
                  Apply client beta preset (6b)
                </button>
                {config.utmPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={adminSecondaryButtonClass}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className={adminLabelClass}>Base URL</span>
                <input className={adminInputClassSm} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Landing page</span>
                <select
                  className={adminInputClassSm}
                  value={funnel}
                  onChange={(e) => setFunnel(e.target.value as AdLandingFunnel)}
                >
                  {Object.entries(AD_LANDING_PATHS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label} ({val.path})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Source (utm_source)</span>
                <input
                  className={adminInputClassSm}
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  placeholder="facebook, google, instagram"
                />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Medium (utm_medium)</span>
                <input
                  className={adminInputClassSm}
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  placeholder="paid_social, cpc"
                />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Campaign (utm_campaign)</span>
                <input
                  className={adminInputClassSm}
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="client_beta_launch"
                />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Content (optional)</span>
                <input className={adminInputClassSm} value={utmContent} onChange={(e) => setUtmContent(e.target.value)} />
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className={adminLabelClass}>Keyword (optional)</span>
                <input className={adminInputClassSm} value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={adminLabelClass}>Final URL</p>
                <CopyButton text={trackedUrl} label="Copy URL" />
              </div>
              <p className="mt-2 break-all font-mono text-xs text-[#FFD34E]">{trackedUrl}</p>
            </div>
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            eyebrow="Campaign Registry"
            heading="Register Campaign ID"
            description="Playbook step 8 · Runbook after 6b — after you launch a client campaign, record its platform campaign ID here with the same week and budget from step 1."
            defaultOpen
          >
            {campaignMigrationPending ? (
              <p className="text-sm text-white/45">
                Campaign registry is turning on — it will be ready after the next deploy. No action needed from you.
              </p>
            ) : null}

            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void registerCampaign(e)}>
              <label className="block space-y-2 sm:col-span-2">
                <span className={adminLabelClass}>Platform campaign ID</span>
                <input
                  className={adminInputClassSm}
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  placeholder="From Ads Manager / Google Ads / TikTok Ads"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Platform</span>
                <select
                  className={adminInputClassSm}
                  value={campaignPlatform}
                  onChange={(e) => setCampaignPlatform(e.target.value as AdCampaignPlatform)}
                >
                  <option value="meta">Meta</option>
                  <option value="google">Google</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Venture</span>
                <select
                  className={adminInputClassSm}
                  value={campaignVenture}
                  onChange={(e) => setCampaignVenture(e.target.value)}
                >
                  <option value="match_fit">Match Fit</option>
                  <option value="ni">NORTHSiDE Intelligence</option>
                  <option value="ncc">NCC</option>
                </select>
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className={adminLabelClass}>Campaign name</span>
                <input
                  className={adminInputClassSm}
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="MF Meta Reel boost — July W1"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Budget (USD)</span>
                <input
                  className={adminInputClassSm}
                  type="number"
                  min="0"
                  step="0.01"
                  value={campaignBudgetUsd}
                  onChange={(e) => setCampaignBudgetUsd(e.target.value)}
                  placeholder="45.00"
                />
              </label>
              <label className="block space-y-2">
                <span className={adminLabelClass}>Week of (YYYY-MM-DD)</span>
                <input
                  className={adminInputClassSm}
                  value={campaignWeekOf}
                  onChange={(e) => setCampaignWeekOf(e.target.value)}
                  placeholder="2026-07-07"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className={adminLabelClass}>Notes (optional)</span>
                <input
                  className={adminInputClassSm}
                  value={campaignNotes}
                  onChange={(e) => setCampaignNotes(e.target.value)}
                  placeholder="Paused until Phase 0 green"
                />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={adminAccentButtonClass} disabled={campaignSaving}>
                  {campaignSaving ? "Saving…" : "Register campaign"}
                </button>
              </div>
            </form>

            {campaigns.length > 0 ? (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wide text-white/40">
                      <th className="py-2 pr-3">Platform</th>
                      <th className="py-2 pr-3">Campaign ID</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Venture</th>
                      <th className="py-2 pr-3">Budget</th>
                      <th className="py-2">Week of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((row) => {
                      const expanded = expandedCampaignId === row.id;
                      const needle = row.campaignId.toLowerCase();
                      const nameNeedle = row.name.toLowerCase();
                      const linkedAttribution = (panel?.attribution ?? []).filter((a) => {
                        const campaign = a.utmCampaign.toLowerCase();
                        return campaign.includes(needle) || (nameNeedle.length > 0 && campaign.includes(nameNeedle));
                      });
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className="cursor-pointer border-b border-white/[0.06] text-white/60 hover:bg-white/[0.03]"
                            onClick={() => setExpandedCampaignId(expanded ? null : row.id)}
                            aria-expanded={expanded}
                          >
                            <td className="py-3 pr-3">
                              <PlatformBadge platform={row.platform} />
                            </td>
                            <td className="py-3 pr-3 font-mono text-[11px] text-[#FFD34E]">{row.campaignId}</td>
                            <td className="py-3 pr-3 text-white/75">{row.name}</td>
                            <td className="py-3 pr-3">{ventureLabel(row.venture)}</td>
                            <td className="py-3 pr-3 tabular-nums">
                              {row.budgetCents != null ? formatUsd(row.budgetCents) : "—"}
                            </td>
                            <td className="py-3 tabular-nums">{row.weekOf ?? "—"}</td>
                          </tr>
                          {expanded ? (
                            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                              <td colSpan={6} className="px-3 py-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-white/40">
                                      Campaign details
                                    </p>
                                    <dl className="mt-2 space-y-1 text-[11px] text-white/60">
                                      <div className="flex justify-between gap-3">
                                        <dt className="text-white/40">Venture</dt>
                                        <dd>{ventureLabel(row.venture)}</dd>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <dt className="text-white/40">Week of</dt>
                                        <dd>{row.weekOf ?? "—"}</dd>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <dt className="text-white/40">Budget</dt>
                                        <dd>{row.budgetCents != null ? formatUsd(row.budgetCents) : "—"}</dd>
                                      </div>
                                      <div className="flex justify-between gap-3">
                                        <dt className="text-white/40">Notes</dt>
                                        <dd className="text-right">{row.notes ?? "—"}</dd>
                                      </div>
                                    </dl>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-white/40">
                                      On-site traffic linked to this campaign
                                    </p>
                                    {linkedAttribution.length > 0 ? (
                                      <ul className="mt-2 space-y-1.5 text-[11px] text-white/60">
                                        {linkedAttribution.map((a) => (
                                          <li key={`${a.utmSource}-${a.utmCampaign}`} className="flex justify-between gap-3">
                                            <span className="text-white/75">
                                              {a.utmSource} · {a.utmCampaign}
                                            </span>
                                            <span className="tabular-nums">
                                              {a.pageViews} views · {a.signupPageViews} signup views
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="mt-2 text-[11px] text-white/40">
                                        No on-site traffic linked to this campaign yet. Traffic links when a tracking
                                        link&apos;s campaign tag matches this campaign&apos;s ID or name.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/40">No campaigns registered yet.</p>
            )}
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            eyebrow="Conversion Events"
            heading="Events Match Fit Sends Automatically"
            description="When someone signs up, Match Fit fires these events to Meta and Google. Create matching conversion actions in each ad platform using the names below — no custom code required on your side."
            defaultOpen={false}
          >
            {config ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wide text-white/40">
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3">Meta</th>
                      <th className="py-2 pr-3">Google</th>
                      <th className="py-2">Trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.events.map((ev) => (
                      <tr key={ev.id} className="border-b border-white/[0.06] text-white/60">
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-white/85">{ev.label}</p>
                          <p className="mt-0.5 text-[11px] text-white/40">{ev.description}</p>
                        </td>
                        <td className="py-3 pr-3 font-mono text-[11px] text-[#8CB9FF]">{ev.metaEvent ?? "—"}</td>
                        <td className="py-3 pr-3 font-mono text-[11px] text-[#9BE7B0]">
                          {ev.googleConversionKind ?? "—"}
                        </td>
                        <td className="py-3 text-[11px]">{ev.trigger}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            eyebrow="Performance"
            heading="Ad Platform Metrics (7 Days)"
            description="Pull spend and clicks from Meta, Google, and TikTok, then compare with visitors who arrived via your tracking links."
            defaultOpen
            headerExtra={
              <button type="button" className={adminAccentButtonClass} disabled={syncing} onClick={() => void syncPerformance()}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            }
          >
            {panel ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Meta spend" value={formatUsd(panel.totals.meta.spendCents)} />
                  <StatTile label="Meta clicks" value={panel.totals.meta.clicks} />
                  <StatTile label="Google spend" value={formatUsd(panel.totals.google.spendCents)} />
                  <StatTile label="Google clicks" value={panel.totals.google.clicks} />
                  <StatTile label="TikTok spend" value={formatUsd(panel.totals.tiktok.spendCents)} />
                  <StatTile label="TikTok clicks" value={panel.totals.tiktok.clicks} />
                  <StatTile label="Attributed page views" value={panel.totals.attributedPageViews} />
                  <StatTile label="Attributed signup views" value={panel.totals.attributedSignupViews} />
                  <StatTile label="Meta conversions (API)" value={panel.totals.meta.conversions} />
                  <StatTile label="Google conversions (API)" value={panel.totals.google.conversions} />
                  <StatTile label="TikTok conversions (API)" value={panel.totals.tiktok.conversions} />
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {panel.integrations.map((integration) => {
                    const status = integration.spendSyncStatus ?? (integration.configured ? "credentials_present" : "not_configured");
                    const statusLabel =
                      status === "insights_ok"
                        ? "Insights spend ready"
                        : status === "insights_error"
                          ? "Insights error"
                          : status === "credentials_present"
                            ? integration.platform === "meta"
                              ? "Credentials set — Insights not verified"
                              : "API credentials set"
                            : "Not configured";
                    const statusClass =
                      status === "insights_ok"
                        ? "text-[11px] font-bold text-[#9BE7B0]"
                        : status === "insights_error"
                          ? "text-[11px] font-bold text-[#FF8A8A]"
                          : status === "credentials_present"
                            ? "text-[11px] font-bold text-[#FFD34E]"
                            : "text-[11px] font-bold text-white/40";
                    return (
                      <div key={integration.platform} className={adminPanelClass + " p-4"}>
                        <div className="flex flex-wrap items-center gap-2">
                          <PlatformBadge platform={integration.platform} />
                          <span className={statusClass}>{statusLabel}</span>
                        </div>
                        {integration.spendSyncDetail ? (
                          <p className="mt-3 text-[11px] leading-relaxed text-white/55">{integration.spendSyncDetail}</p>
                        ) : null}
                        {!integration.configured ? (
                          <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                            API sync is not set up yet. Ask your developer to add{" "}
                            {integration.platform === "meta"
                              ? "Meta (System User with ads_read + correct act_ Ad Account ID)"
                              : integration.platform === "google"
                                ? "Google"
                                : "TikTok"}{" "}
                            ad API credentials in production environment variables. Tracking links and on-site pixels still
                            work.
                          </p>
                        ) : null}
                        {integration.platform === "meta" && status === "credentials_present" ? (
                          <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                            Credentials alone are not enough. Meta spend sync requires Insights to return costs for the
                            System User token on the matching act_ ad account. Use Sync now to refresh.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {panel.attribution.length > 0 ? (
                  <div className="mt-6">
                    <p className={adminSectionTitleClass}>On-Site Attribution</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wide text-white/40">
                            <th className="py-2 pr-3">Source</th>
                            <th className="py-2 pr-3">Campaign</th>
                            <th className="py-2 pr-3">Page views</th>
                            <th className="py-2 pr-3">Visitors</th>
                            <th className="py-2">Signup views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {panel.attribution.map((row) => (
                            <tr key={`${row.utmSource}-${row.utmCampaign}`} className="border-b border-white/[0.06]">
                              <td className="py-2 pr-3 text-white/70">{row.utmSource}</td>
                              <td className="py-2 pr-3 text-white/55">{row.utmCampaign}</td>
                              <td className="py-2 pr-3 tabular-nums">{row.pageViews}</td>
                              <td className="py-2 pr-3 tabular-nums">{row.uniqueVisitors}</td>
                              <td className="py-2 tabular-nums">{row.signupPageViews}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-white/40">
                    No UTM-attributed traffic yet. Use the link builder above in your ad creatives.
                  </p>
                )}
              </>
            ) : null}
          </AdminCollapsibleSection>

          {config ? (
            <AdminCollapsibleSection
              eyebrow="Verification"
              heading="Tag Snippets (Already Deployed)"
              description="Reference only if Meta or Google asks you to verify domain ownership. These tags are already live on every public page."
              defaultOpen={false}
            >
              <div className="space-y-4">
                {(["meta", "google"] as const).map((key) => (
                  <div key={key} className={adminPanelClass + " p-4"}>
                    <div className="flex items-center justify-between gap-2">
                      <PlatformBadge platform={key} />
                      <CopyButton text={config.verificationSnippets[key]} />
                    </div>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-white/55">
                      {config.verificationSnippets[key]}
                    </pre>
                  </div>
                ))}
              </div>
            </AdminCollapsibleSection>
          ) : null}
        </div>
    </AdminPortalShell>
  );
}
