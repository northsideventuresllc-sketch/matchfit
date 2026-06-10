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
  type AdLandingFunnel,
  type AdPlatform,
  type AdTrackingEvent,
  type AdUtmPreset,
} from "@/lib/ad-tracking-config";
import type { AdPerformancePanel } from "@/lib/ad-platform-performance";

type TrackingConfigResponse = {
  pixels: {
    meta: { id: string; label: string; eventsManagerUrl: string; testEventsUrl: string };
    google: { id: string; label: string; conversionsUrl: string };
  };
  events: AdTrackingEvent[];
  utmPresets: AdUtmPreset[];
  landingPaths: typeof AD_LANDING_PATHS;
  trainerOnboardingSteps: { step_id: string; step_name: string }[];
  integrations: { platform: AdPlatform; configured: boolean; missingEnv: string[] }[];
  googleConversions: {
    clientSignup: { envKey: string; sendTo: string | null; configured: boolean };
    trainerSignup: { envKey: string; sendTo: string | null; configured: boolean };
  };
  verificationSnippets: { meta: string; google: string };
  defaultBaseUrl: string;
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

function PlatformBadge({ platform }: { platform: AdPlatform }) {
  const label = platform === "meta" ? "Meta" : "Google";
  const color =
    platform === "meta"
      ? "border-[#1877F2]/40 bg-[#1877F2]/10 text-[#8CB9FF]"
      : "border-[#34A853]/40 bg-[#34A853]/10 text-[#9BE7B0]";
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${color}`}>
      {label}
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
      const [configRes, perfRes] = await Promise.all([
        fetch("/api/admin/ad-tracking/config"),
        fetch("/api/admin/ad-tracking/performance?days=7"),
      ]);
      if (!configRes.ok || !perfRes.ok) throw new Error("Could not load ad tracking data.");
      const configJson = (await configRes.json()) as TrackingConfigResponse;
      const perfJson = (await perfRes.json()) as { panel: AdPerformancePanel };
      setConfig(configJson);
      setPanel(perfJson.panel);
      setBaseUrl(configJson.defaultBaseUrl);
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

  return (
    <AdminPortalShell
      current="ad-tracking"
      maxWidth="full"
      title="Ad Tracking HQ"
      description="Build tracking links, confirm your pixels are live, and see whether Meta and Google ads are driving sign-ups — without digging through developer settings."
      contentClassName="space-y-6"
    >
        <AdminPortalBetaNotice className="mt-0" />

        <section className={`${adminCardClass} border-[#FF7E00]/15 bg-[#FF7E00]/[0.04]`}>
          <p className={adminSectionTitleClass}>Start here</p>
          <h2 className="mt-2 text-lg font-bold">How to use this page</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-white/60">
            <li>
              <strong className="text-white/85">Step 1 — Confirm tags:</strong> Check that Meta and Google IDs below match
              what you see in Events Manager and Google Ads.
            </li>
            <li>
              <strong className="text-white/85">Step 2 — Build links:</strong> Use the campaign link builder and paste the
              final URL into your ad creative (not the homepage without tracking).
            </li>
            <li>
              <strong className="text-white/85">Step 3 — Match conversions:</strong> In Meta and Google, create conversion
              goals using the event names in the catalog — Match Fit fires these automatically on sign-up.
            </li>
            <li>
              <strong className="text-white/85">Step 4 — Review results:</strong> Sync performance and compare ad platform
              numbers with on-site attribution.
            </li>
          </ol>
        </section>

        {error ? <AdminPortalAlert variant="error">{error}</AdminPortalAlert> : null}
        {syncMessage ? <AdminPortalAlert variant="info">{syncMessage}</AdminPortalAlert> : null}
        {loading ? <AdminLoadingBar label="Loading ad tracking…" /> : null}

        <div className="space-y-8">
          <section className={adminCardClass}>
            <p className={adminSectionTitleClass}>Connected Pixels</p>
            <h2 className="mt-2 text-lg font-bold">Live Tags in the App</h2>
            <p className="mt-1 text-sm text-white/50">
              These are the tracking tags already running on match-fit.net. You do not need to paste code — use the IDs
              here to verify setup in Meta Events Manager and Google Ads.
            </p>
            {config ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
          </section>

          <section className={adminCardClass}>
            <p className={adminSectionTitleClass}>Campaign Link Builder</p>
            <h2 className="mt-2 text-lg font-bold">Generate Tracking URLs</h2>
            <p className="mt-1 text-sm text-white/50">
              Pick a landing page and campaign preset. Copy the final URL into your ad — it tags visitors so Match Fit can
              attribute sign-ups back to the right campaign for 30 days.
            </p>

            {config ? (
              <div className="mt-4 flex flex-wrap gap-2">
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
          </section>

          <section className={adminCardClass}>
            <p className={adminSectionTitleClass}>Conversion Events</p>
            <h2 className="mt-2 text-lg font-bold">Events Match Fit Sends Automatically</h2>
            <p className="mt-1 text-sm text-white/50">
              When someone signs up, Match Fit fires these events to Meta and Google. Create matching conversion actions in
              each ad platform using the names below — no custom code required on your side.
            </p>
            {config ? (
              <div className="mt-5 overflow-x-auto">
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
          </section>

          <section className={adminCardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={adminSectionTitleClass}>Performance</p>
                <h2 className="mt-2 text-lg font-bold">Ad Platform Metrics (7 Days)</h2>
                <p className="mt-1 text-sm text-white/50">
                  Pull spend and clicks from Meta and Google, then compare with visitors who arrived via your tracking links.
                </p>
              </div>
              <button type="button" className={adminAccentButtonClass} disabled={syncing} onClick={() => void syncPerformance()}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>

            {panel ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Meta spend" value={formatUsd(panel.totals.meta.spendCents)} />
                  <StatTile label="Meta clicks" value={panel.totals.meta.clicks} />
                  <StatTile label="Google spend" value={formatUsd(panel.totals.google.spendCents)} />
                  <StatTile label="Google clicks" value={panel.totals.google.clicks} />
                  <StatTile label="Attributed page views" value={panel.totals.attributedPageViews} />
                  <StatTile label="Attributed signup views" value={panel.totals.attributedSignupViews} />
                  <StatTile label="Meta conversions (API)" value={panel.totals.meta.conversions} />
                  <StatTile label="Google conversions (API)" value={panel.totals.google.conversions} />
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {panel.integrations.map((integration) => (
                    <div key={integration.platform} className={adminPanelClass + " p-4"}>
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={integration.platform} />
                        <span
                          className={
                            integration.configured
                              ? "text-[11px] font-bold text-[#9BE7B0]"
                              : "text-[11px] font-bold text-white/40"
                          }
                        >
                          {integration.configured ? "API connected" : "Not configured"}
                        </span>
                      </div>
                      {!integration.configured ? (
                        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
                          API sync is not set up yet. Ask your developer to add {integration.platform === "meta" ? "Meta" : "Google"} ad
                          API credentials in production environment variables. Tracking links and on-site pixels still work.
                        </p>
                      ) : null}
                    </div>
                  ))}
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
          </section>

          {config ? (
            <section className={adminCardClass}>
              <p className={adminSectionTitleClass}>Verification</p>
              <h2 className="mt-2 text-lg font-bold">Tag Snippets (Already Deployed)</h2>
              <p className="mt-1 text-sm text-white/50">
                Reference only if Meta or Google asks you to verify domain ownership. These tags are already live on every
                public page.
              </p>
              <div className="mt-5 space-y-4">
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
            </section>
          ) : null}
        </div>
    </AdminPortalShell>
  );
}
