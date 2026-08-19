"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import {
  AdminPortalAlert,
  AdminPortalBetaNotice,
  AdminLoadingBar,
  adminAccentButtonClass,
  adminCardClass,
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
import type { AdCampaignPerformanceRow, AdPerformancePanel } from "@/lib/ad-platform-performance";
import { AdminCollapsibleSection, AdminTechnicalDetails } from "@/components/admin/admin-collapsible-section";
import { AdTrackingChatWidget } from "@/components/admin/ad-tracking-chat-widget";

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

function findCampaignPerformance(
  campaign: { campaignId: string; platform: AdCampaignPlatform },
  rows: AdCampaignPerformanceRow[],
): AdCampaignPerformanceRow | null {
  return (
    rows.find((r) => r.campaignId === campaign.campaignId && r.platform === campaign.platform) ?? null
  );
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
      description="Plan budget, confirm your ad tags are live, build tracking links, register campaigns, and see how paid ads are performing — all in one place."
      contentClassName="space-y-6"
    >
        <AdminPortalBetaNotice className="mt-0" />

        <section className={`${adminCardClass} border-[#FF7E00]/15 bg-[#FF7E00]/[0.04]`}>
          <AdminCollapsibleSection
            defaultOpen
            title={
              <>
                <p className={adminSectionTitleClass}>INSTRUCTIONS</p>
                <h2 className="mt-2 text-lg font-bold">8-step marketing playbook</h2>
              </>
            }
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
        </section>

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

        <div className="space-y-8">
          <section className={adminCardClass}>
            <AdminCollapsibleSection
              defaultOpen
              title={
                <>
                  <p className={adminSectionTitleClass}>Connected Tags · RUNBOOK 5b</p>
                  <h2 className="mt-2 text-lg font-bold">Live Tags in the App</h2>
                </>
              }
              subtitle={
                <p className="text-sm text-white/50">
                  These are the tracking tags already running on match-fit.net. You do not need to paste any code — use
                  the IDs here to double-check setup inside Meta and Google&apos;s own ad dashboards.
                </p>
              }
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
          </section>

          {config ? (
            <section className={adminCardClass}>
              <AdminCollapsibleSection
                defaultOpen
                title={
                  <>
                    <p className={adminSectionTitleClass}>Backup Tracking</p>
                    <h2 className="mt-2 text-lg font-bold">Works Even With Ad Blockers</h2>
                  </>
                }
                subtitle={
                  <p className="text-sm text-white/50">
                    Signups are also recorded straight from Match Fit&apos;s servers, so an ad blocker on the visitor&apos;s
                    browser can&apos;t hide the signup from Meta or Google.
                  </p>
                }
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
                        ? "Connected"
                        : config.serverConversions.metaCapi.capiSyncStatus === "capi_error"
                          ? "Set up, but Meta rejected the test"
                          : config.serverConversions.metaCapi.configured
                            ? "Credentials saved — not tested yet"
                            : "Not set up"}
                    </span>
                  </div>
                  {config.serverConversions.metaCapi.capiSyncDetail ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                      {config.serverConversions.metaCapi.capiSyncDetail}
                    </p>
                  ) : !config.serverConversions.metaCapi.configured ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                      Ask your developer to finish backup Meta tracking setup.
                    </p>
                  ) : null}
                  {!config.serverConversions.metaCapi.configured ? (
                    <AdminTechnicalDetails>
                      Add <code>META_PIXEL_ID</code> and <code>META_ACCESS_TOKEN</code> (Conversions API system user
                      token from Events Manager).
                    </AdminTechnicalDetails>
                  ) : null}
                </div>
                <div className={adminPanelClass + " p-4"}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-[#E37400]">Google Analytics</span>
                    <span
                      className={
                        config.serverConversions.ga4.configured
                          ? "text-[11px] font-bold text-[#9BE7B0]"
                          : "text-[11px] font-bold text-white/40"
                      }
                    >
                      {config.serverConversions.ga4.configured ? "Connected" : "Not set up"}
                    </span>
                  </div>
                  {!config.serverConversions.ga4.configured ? (
                    <>
                      <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                        Ask your developer to finish backup Google Analytics tracking setup.
                      </p>
                      <AdminTechnicalDetails>
                        Add <code>GA_MEASUREMENT_ID</code> and <code>GA_API_SECRET</code> from Admin → Data Streams →
                        Measurement Protocol.
                      </AdminTechnicalDetails>
                    </>
                  ) : null}
                </div>
              </div>
              </AdminCollapsibleSection>
            </section>
          ) : null}

          <section className={adminCardClass}>
            <AdminCollapsibleSection
              defaultOpen
              title={
                <>
                  <p className={adminSectionTitleClass}>Campaign Link Builder · RUNBOOK 6b</p>
                  <h2 className="mt-2 text-lg font-bold">Generate Client Tracking URLs</h2>
                </>
              }
              subtitle={
                <p className="text-sm text-white/50">
                  Default to client sign-up. Use the waitlist option only when the beta client cap is full. Copy the
                  final URL into your ad creative.
                </p>
              }
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
          </section>

          <section className={adminCardClass}>
            <AdminCollapsibleSection
              defaultOpen
              title={
                <>
                  <p className={adminSectionTitleClass}>Campaign Registry · RUNBOOK after 6b</p>
                  <h2 className="mt-2 text-lg font-bold">Register Campaign ID</h2>
                </>
              }
              subtitle={
                <p className="text-sm text-white/50">
                  After you launch a client campaign, record its platform campaign ID here with the same week and
                  budget from step 1. This also lets the per-campaign drilldown below show real numbers for it.
                </p>
              }
            >
            {campaignMigrationPending ? (
              <p className="text-sm text-white/45">
                The campaign registry is not turned on in the database yet — it will activate automatically after the
                next deploy.
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
                    {campaigns.map((row) => (
                      <tr key={row.id} className="border-b border-white/[0.06] text-white/60">
                        <td className="py-3 pr-3">
                          <PlatformBadge platform={row.platform} />
                        </td>
                        <td className="py-3 pr-3 font-mono text-[11px] text-[#FFD34E]">{row.campaignId}</td>
                        <td className="py-3 pr-3 text-white/75">{row.name}</td>
                        <td className="py-3 pr-3">{row.venture}</td>
                        <td className="py-3 pr-3 tabular-nums">
                          {row.budgetCents != null ? formatUsd(row.budgetCents) : "—"}
                        </td>
                        <td className="py-3 tabular-nums">{row.weekOf ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/40">No campaigns registered yet.</p>
            )}
            </AdminCollapsibleSection>
          </section>

          {panel && campaigns.length > 0 ? (
            <section className={adminCardClass}>
              <AdminCollapsibleSection
                defaultOpen
                title={
                  <>
                    <p className={adminSectionTitleClass}>Per-Campaign Drilldown</p>
                    <h2 className="mt-2 text-lg font-bold">How Each Campaign Is Doing</h2>
                  </>
                }
                subtitle={
                  <p className="text-sm text-white/50">
                    Spend, clicks, and conversions pulled straight from each platform for the campaigns you&apos;ve
                    registered above. Use Sync now (in Performance below) to refresh these numbers.
                  </p>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wide text-white/40">
                        <th className="py-2 pr-3">Campaign</th>
                        <th className="py-2 pr-3">Platform</th>
                        <th className="py-2 pr-3">Budget</th>
                        <th className="py-2 pr-3">Spend</th>
                        <th className="py-2 pr-3">Clicks</th>
                        <th className="py-2">Conversions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((row) => {
                        const perf = findCampaignPerformance(row, panel.campaignPerformance);
                        return (
                          <tr key={row.id} className="border-b border-white/[0.06] text-white/60">
                            <td className="py-3 pr-3 text-white/75">
                              {row.name}
                              <span className="ml-2 font-mono text-[10px] text-white/35">{row.campaignId}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <PlatformBadge platform={row.platform} />
                            </td>
                            <td className="py-3 pr-3 tabular-nums">
                              {row.budgetCents != null ? formatUsd(row.budgetCents) : "—"}
                            </td>
                            {perf ? (
                              <>
                                <td className="py-3 pr-3 tabular-nums text-white/85">{formatUsd(perf.spendCents)}</td>
                                <td className="py-3 pr-3 tabular-nums">{perf.clicks}</td>
                                <td className="py-3 tabular-nums">{perf.conversions}</td>
                              </>
                            ) : (
                              <td className="py-3 text-white/35" colSpan={3}>
                                No synced data yet — click Sync now below.
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AdminCollapsibleSection>
            </section>
          ) : null}

          <section className={adminCardClass}>
            <AdminCollapsibleSection
              defaultOpen
              title={
                <>
                  <p className={adminSectionTitleClass}>Conversion Events</p>
                  <h2 className="mt-2 text-lg font-bold">Events Match Fit Sends Automatically</h2>
                </>
              }
              subtitle={
                <p className="text-sm text-white/50">
                  When someone signs up, Match Fit fires these events to Meta and Google. Create matching conversion actions in
                  each ad platform using the names below — no custom code required on your side.
                </p>
              }
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
          </section>

          <section className={adminCardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={adminSectionTitleClass}>Performance</p>
                <h2 className="mt-2 text-lg font-bold">Ad Platform Results (Last {panel?.windowDays ?? 7} Days)</h2>
                <p className="mt-1 text-sm text-white/50">
                  See how much you spent and how many clicks you got from Meta, Google, and TikTok, plus how that
                  compares with visitors who actually arrived via your tracking links.
                </p>
              </div>
              <button type="button" className={adminAccentButtonClass} disabled={syncing} onClick={() => void syncPerformance()}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>

            {panel ? (
              <AdminCollapsibleSection
                defaultOpen
                className="mt-5"
                title={<span className="text-[10px] font-black uppercase tracking-wide text-white/35">Detailed metrics</span>}
              >
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
                        ? "Spend syncing"
                        : status === "insights_error"
                          ? "Connected, but sync failed"
                          : status === "credentials_present"
                            ? integration.platform === "meta"
                              ? "Credentials saved — not verified yet"
                              : "Credentials saved"
                            : "Not connected";
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
                          <>
                            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                              Spend and click reporting for this platform isn&apos;t connected yet. Ask your developer to
                              set it up — your tracking links and on-site tags still work either way.
                            </p>
                            <AdminTechnicalDetails>
                              {integration.platform === "meta"
                                ? "Needs a Meta System User token with ads_read on the correct act_ Ad Account ID."
                                : integration.platform === "google"
                                  ? "Needs Google Ads API credentials."
                                  : "Needs TikTok Ads API credentials."}{" "}
                              Set the ad platform API credentials in production environment variables.
                            </AdminTechnicalDetails>
                          </>
                        ) : null}
                        {integration.platform === "meta" && status === "credentials_present" ? (
                          <>
                            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                              Credentials are saved, but spend reporting isn&apos;t confirmed working yet. Click Sync now
                              above to test it.
                            </p>
                            <AdminTechnicalDetails>
                              Meta spend sync requires Insights to return costs for the System User token on the
                              matching act_ ad account.
                            </AdminTechnicalDetails>
                          </>
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
              </AdminCollapsibleSection>
            ) : null}
          </section>

          {config ? (
            <section className={adminCardClass}>
              <AdminCollapsibleSection
                defaultOpen={false}
                title={
                  <>
                    <p className={adminSectionTitleClass}>Verification</p>
                    <h2 className="mt-2 text-lg font-bold">Domain Verification Codes</h2>
                  </>
                }
                subtitle={
                  <p className="text-sm text-white/50">
                    You only need this if Meta or Google ever asks you to verify you own match-fit.net. Hand the code
                    to your developer — these tags are already live on every public page.
                  </p>
                }
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
            </section>
          ) : null}

          <section className={adminCardClass}>
            <p className={adminSectionTitleClass}>Ads Copilot</p>
            <h2 className="mt-2 text-lg font-bold">Ask The AI About Your Ads</h2>
            <p className="mt-1 text-sm text-white/50">
              Get a plain-English read on spend, clicks, and campaigns using the live numbers above.
            </p>
            <div className="mt-5">
              <AdTrackingChatWidget />
            </div>
          </section>
        </div>
    </AdminPortalShell>
  );
}
