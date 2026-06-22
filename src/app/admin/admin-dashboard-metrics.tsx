"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type {
  AdminBackgroundCheckEntry,
  AdminBackgroundChecksPanel,
  AdminClientPipelinePanel,
  AdminEmailStatsPanel,
  AdminFinanceWindowKey,
  AdminFinancesPanel,
  AdminLoginRecencyBuckets,
  AdminMemberOverviewPanel,
  AdminPlatformSummaryPanel,
  AdminPortalOverview,
  AdminPremiumTrainerActivityPanel,
  AdminRevenueSnapshot,
  AdminSiteActivityPanel,
  AdminTrainerPipelinePanel,
} from "@/lib/admin-portal-types";
import type { AdPerformancePanel } from "@/lib/ad-platform-performance";
import { formatUsdFromCents } from "@/lib/admin-portal-types";

const FINANCE_WINDOW_LABELS: Record<AdminFinanceWindowKey, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
  "5y": "5 years",
};

function StatCard(props: { label: string; value: string | number; hint?: string; accent?: "default" | "orange" | "violet" | "emerald" }) {
  const accent = props.accent ?? "default";
  const border =
    accent === "orange"
      ? "border-[#FF7E00]/25 bg-gradient-to-br from-[#FF7E00]/[0.12] to-[#0E1016]/90"
      : accent === "violet"
        ? "border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-[#0E1016]/90"
        : accent === "emerald"
          ? "border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-[#0E1016]/90"
          : "border-white/[0.06] bg-[#0E1016]/80";
  return (
    <div className={`rounded-xl border px-3 py-3 shadow-[0_20px_50px_-40px_rgba(255,126,0,0.45)] ${border}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{props.label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-white">{props.value}</p>
      {props.hint ? <p className="mt-1 text-[10px] text-white/35">{props.hint}</p> : null}
    </div>
  );
}

export function MemberOverviewSection({ panel }: { panel: AdminMemberOverviewPanel }) {
  const cards: { label: string; value: number; hint?: string; accent?: "default" | "orange" | "violet" | "emerald" }[] = [
    {
      label: "All Members Total",
      value: panel.allMembersTotal,
      hint: "Real clients and Fitness Pros past signup (excludes test/QA and deleted accounts)",
      accent: "orange",
    },
    { label: "VIP Clients (FREE trial)", value: panel.vipTrialClients, hint: "Complimentary card-free VIP trial at sign-up", accent: "violet" },
    { label: "Subscribed Clients", value: panel.subscribedClients, hint: "Active Subscribed Clients", accent: "emerald" },
    { label: "Free Plan Clients", value: panel.freePlanClients, hint: "Currently on Free plan" },
    { label: "Active VIP Clients", value: panel.activeVipClients, hint: "Paying VIP subscriptions", accent: "emerald" },
    { label: "Inactive Clients", value: panel.inactiveClients, hint: "No profile activity for 30+ days" },
    { label: "Unique Site Visitors", value: panel.uniqueSiteVisitorsAllTime, hint: "All-time distinct visitors" },
    { label: "Pending Fitness Pros", value: panel.pendingTrainers, hint: "Accepted Terms or onboarding started" },
    { label: "Compliant Active Fitness Pros", value: panel.compliantActiveTrainers, hint: "Fully onboarded + recent activity", accent: "emerald" },
    { label: "Inactive Fitness Pros", value: panel.inactiveTrainers, hint: "Onboarded but no recent platform activity" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} hint={c.hint} accent={c.accent} />
      ))}
    </div>
  );
}

function LoginRecencyGrid(props: { title: string; buckets: AdminLoginRecencyBuckets }) {
  const rows: { label: string; value: number }[] = [
    { label: "12h", value: props.buckets.h12 },
    { label: "24h", value: props.buckets.h24 },
    { label: "7d", value: props.buckets.d7 },
    { label: "30d", value: props.buckets.d30 },
    { label: "90d", value: props.buckets.d90 },
    { label: "180d", value: props.buckets.d180 },
    { label: "365d", value: props.buckets.d365 },
  ];
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{props.title}</p>
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border border-white/[0.05] bg-black/20 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase text-white/35">{r.label}</p>
            <p className="text-sm font-bold tabular-nums text-white">{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsSection(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 shadow-[0_34px_90px_-48px_rgba(227,43,43,0.35)] backdrop-blur-xl sm:p-5">
      <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">{props.title}</h2>
      {props.description ? <p className="mt-1 text-sm text-white/50">{props.description}</p> : null}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export function PlatformHealthSection({ panel }: { panel: AdminPlatformSummaryPanel }) {
  const { successRating, valuation, potentialRating, growthProjection } = panel;
  const [advancedStatsOpen, setAdvancedStatsOpen] = useState(false);
  const successHint = successRating.meta.performanceMetricsActive
    ? "Current composite score"
    : `Build phase · performance metrics activate in ${successRating.meta.performanceGraceDaysRemaining} day${successRating.meta.performanceGraceDaysRemaining === 1 ? "" : "s"}`;

  return (
    <MetricsSection
      title="Platform health, success & valuation"
      description={`Launch ${successRating.meta.launchDate} · Marketing from ${successRating.meta.marketingStartDate} ($${successRating.meta.marketingBudgetUsd} budget). Success rating uses stability and security during the first 90 days post-launch; potential rating shows a conservative-to-optimistic range from scenario models.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Success rating (0–10)" value={successRating.score.toFixed(1)} hint={successHint} />
        <StatCard
          label="Potential rating (0–10)"
          value={`${potentialRating.scoreLow.toFixed(1)} – ${potentialRating.scoreHigh.toFixed(1)}`}
          hint={`Current ${potentialRating.currentScore.toFixed(1)} · conservative to optimistic scenarios`}
        />
        <StatCard
          label="Est. platform valuation"
          value={formatUsdFromCents(valuation.valuationCents)}
          hint={`${valuation.revenueMultiple.toFixed(1)}× ARR + network value`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stability score" value={`${panel.stabilityScore}/100`} hint={panel.stabilityNotes.join(" · ") || undefined} />
        <StatCard label="Security score" value={`${panel.securityScore}/100`} hint={panel.securityNotes.join(" · ") || undefined} />
        <StatCard label="Lifetime revenue" value={formatUsdFromCents(panel.lifetimeRevenueCents)} />
        <StatCard label="Lifetime gross profit" value={formatUsdFromCents(panel.lifetimeGrossProfitCents)} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Realistic revenue (this month)"
          value={formatUsdFromCents(growthProjection.realisticMonthlyRevenueCents)}
          hint={`${formatUsdFromCents(growthProjection.realisticMonthlyGrossProfitCents)} platform profit · MRR base ${formatUsdFromCents(growthProjection.recurringMrrCents)}`}
        />
        <StatCard
          label="Indicative valuation range"
          value={`${formatUsdFromCents(growthProjection.valuationLowCents)} – ${formatUsdFromCents(growthProjection.valuationHighCents)}`}
          hint={`Mid: ${formatUsdFromCents(growthProjection.valuationMidCents)} · early marketplace ARR multiple`}
        />
        <StatCard
          label="Annualized subscription ARR"
          value={formatUsdFromCents(valuation.subscriptionArrCents)}
          hint="Client $10/mo + Fitness Pro premium $20/mo"
        />
        <StatCard
          label="Annualized 30d gross profit"
          value={formatUsdFromCents(valuation.transactionalArrCents)}
          hint="Service checkout profit × 12"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#FF7E00]/20 bg-[#FF7E00]/[0.05] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFD34E]/80">
            Do this to reach potential rating
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            {potentialRating.recommendations.map((r) => (
              <li key={r.id}>
                <span className="font-semibold uppercase text-white">{r.label}. </span>
                {r.action}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/40">
            <Link href="/admin/assistant" className="text-[#FF7E00] underline-offset-4 hover:underline">
              Run AI guidance for potential rating
            </Link>
          </p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/80">
            Do this to hit monthly revenue
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            {growthProjection.revenueRecommendations.map((r) => (
              <li key={r.id}>
                <span className="font-semibold uppercase text-white">{r.label}. </span>
                {r.action}
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-[10px] text-white/35">
            {growthProjection.assumptions.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/40">
            <Link href="/admin/assistant" className="text-[#FF7E00] underline-offset-4 hover:underline">
              Run AI guidance for revenue projection
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={() => setAdvancedStatsOpen((open) => !open)}
          className="text-xs font-semibold text-[#FF7E00] underline-offset-4 transition hover:text-[#FFD34E] hover:underline"
        >
          Advanced Statistics
        </button>
        {advancedStatsOpen ? (
          <ul className="mt-3 space-y-1.5 text-[11px] text-white/45">
            {successRating.factors.map((f) => (
              <li key={f.id}>
                {f.label}: raw {f.raw.toFixed(2)} → contribution {f.contribution.toFixed(2)} (weight{" "}
                {(f.weight * 100).toFixed(0)}%)
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </MetricsSection>
  );
}

export function SiteTrafficSection({ traffic }: { traffic: AdminPortalOverview["traffic"] }) {
  return (
    <MetricsSection
      title={`Site traffic (${traffic.windowDays}d)`}
      description="Public site analytics — page views, unique visitors, and engagement (bots filtered at ingest)."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="7D unique visitors" value={traffic.uniqueVisitors} accent="orange" hint="Distinct visitors this window" />
        <StatCard label="Page views" value={traffic.pageViews} />
        <StatCard label="Link clicks" value={traffic.linkClicks} />
        <StatCard label="Homepage views" value={traffic.topPages.find((p) => p.path === "/")?.views ?? 0} hint="In top pages window" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Form field focus" value={traffic.formEvents.fieldFocus} />
        <StatCard label="Form submit attempts" value={traffic.formEvents.submitAttempts} />
        <StatCard label="Form submit errors" value={traffic.formEvents.submitErrors} />
        <StatCard label="Form submit success" value={traffic.formEvents.submitSuccesses} />
      </div>
      {traffic.daily.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-[11px] text-white/55">
            <thead>
              <tr className="border-b border-white/10 text-white/35">
                <th className="py-2 pr-4 font-black uppercase tracking-wider">Day (UTC)</th>
                <th className="py-2 pr-4">Views</th>
                <th className="py-2">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {traffic.daily.map((d) => (
                <tr key={d.dayKey} className="border-b border-white/[0.04]">
                  <td className="py-1.5 pr-4 font-mono text-white/70">{d.dayKey}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{d.pageViews}</td>
                  <td className="py-1.5 tabular-nums">{d.uniqueVisitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Top pages</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/50">
            {traffic.topPages.length === 0 ? (
              <li>No page views in window.</li>
            ) : (
              traffic.topPages.map((p) => (
                <li key={p.path} className="flex justify-between gap-2">
                  <span className="truncate font-mono text-white/65">{p.path}</span>
                  <span className="shrink-0 tabular-nums">{p.views}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Top link clicks</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/50">
            {traffic.topLinks.length === 0 ? (
              <li>No link clicks in window.</li>
            ) : (
              traffic.topLinks.map((l) => (
                <li key={l.target} className="flex justify-between gap-2">
                  <span className="truncate">
                    {l.label ? `${l.label} → ` : ""}
                    <span className="font-mono text-white/65">{l.target}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{l.clicks}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      {traffic.recentEvents.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Recent events</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[10px] text-white/40">
            {traffic.recentEvents.map((e, i) => (
              <li key={`${e.at}-${i}`} className="font-mono">
                {e.kind} {e.path}
                {e.target ? ` → ${e.target}` : ""}
                {e.label ? ` (${e.label})` : ""} · {new Date(e.at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </MetricsSection>
  );
}

export function SiteActivitySection({ panel }: { panel: AdminSiteActivityPanel }) {
  return (
    <MetricsSection
      title="Site activity"
      description="Member-only engagement inside dashboards — login recency and top product actions (7d)."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active members now (~15m)" value={panel.activeMembersNow} accent="orange" hint="Dashboard page views" />
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <LoginRecencyGrid title="Client logins by recency" buckets={panel.clientLoginsByRecency} />
        <LoginRecencyGrid title="Fitness Pro logins by recency" buckets={panel.trainerLoginsByRecency} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Top client actions (7d)</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/50">
            {panel.topClientFunctions.map((f) => (
              <li key={f.key} className="flex justify-between">
                <span>{f.label}</span>
                <span className="tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Top Fitness Pro actions (7d)</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/50">
            {panel.topTrainerFunctions.map((f) => (
              <li key={f.key} className="flex justify-between">
                <span>{f.label}</span>
                <span className="tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MetricsSection>
  );
}

export function ClientPipelineSection({ panel }: { panel: AdminClientPipelinePanel }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <MetricsSection
      title="Client pipeline"
      description="From 50%+ signup completion through plan status. VIP trial, Free, VIP, and inactive counts mirror Member overview."
    >
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {panel.stages.map((s) => (
          <li key={s.id} className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-200/70">{s.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{s.count}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {panel.entries.length === 0 ? (
          <p className="text-sm text-white/45">No pending clients in pipeline.</p>
        ) : (
          panel.entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
              >
                <span className="text-sm font-semibold text-white">{e.label}</span>
                <span className="text-[10px] uppercase text-white/35">{expandedId === e.id ? "Hide" : "Details"}</span>
              </button>
              {expandedId === e.id ? (
                <div className="border-t border-white/[0.05] px-3 py-2 text-[11px] text-white/55">
                  <p>Filled: {e.filledFields.join(", ") || "—"}</p>
                  <p className="mt-1">Missing: {e.missingFields.join(", ") || "—"}</p>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </MetricsSection>
  );
}

export function PremiumTrainerActivitySection({ panel }: { panel: AdminPremiumTrainerActivityPanel }) {
  return (
    <MetricsSection title="Premium Fitness Pro activity" description="Premium studio, featured slots, ads, tokens, and bidding.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Premium Fitness Pros" value={panel.premiumTrainers} accent="orange" />
        <StatCard label="Featured slots today" value={panel.featuredSlotsToday} />
        <StatCard label="Active advertisements" value={panel.activeAdvertisements} />
        <StatCard label="Token revenue (30d)" value={formatUsdFromCents(panel.tokenRevenueCents)} accent="emerald" />
        <StatCard label="Bids today" value={panel.recentBids.length} hint="Featured placement bids" />
      </div>
      {panel.recentBids.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-[11px] text-white/55">
          {panel.recentBids.map((b, i) => (
            <li key={`${b.trainerUsername}-${i}`} className="flex justify-between gap-3 rounded-lg border border-white/[0.05] px-3 py-2">
              <span>
                @{b.trainerUsername} · ZIP {b.regionZipPrefix} · {b.displayDayKey}
              </span>
              <span className="shrink-0 font-semibold text-white">{formatUsdFromCents(b.amountCents)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </MetricsSection>
  );
}

export function FinancialDetailsSection({ finances, revenue }: { finances: AdminFinancesPanel; revenue: AdminRevenueSnapshot }) {
  return (
    <MetricsSection title="Financial details" description="Platform revenue, subscription health, and transaction history.">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/80">Lifetime platform revenue</p>
        <p className="mt-2 text-2xl font-black tabular-nums text-white">{formatUsdFromCents(revenue.revenueCents)}</p>
        <p className="mt-1 text-xs text-white/45">
          Gross profit {formatUsdFromCents(revenue.grossProfitCents)} · {revenue.eventCount} events
        </p>
      </div>
      <FinancesDetailSection finances={finances} embedded />
    </MetricsSection>
  );
}

export function AutomatedEmailStatsSection({ panel }: { panel: AdminEmailStatsPanel }) {
  return (
    <MetricsSection
      title="Automated email stats"
      description={`Transactional email delivery over the last ${panel.windowDays} days.`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total attempts" value={panel.totalAttempts} />
        <StatCard label="Sent" value={panel.sent} accent="emerald" />
        <StatCard label="Skipped (prefs)" value={panel.skippedPrefs} />
        <StatCard label="Skipped (no recipient)" value={panel.skippedNoRecipient} />
        <StatCard label="Failed" value={panel.failed} accent="orange" />
      </div>
      {panel.recent.length > 0 ? (
        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-[10px] text-white/45">
          {panel.recent.map((r) => (
            <li key={r.id}>
              {new Date(r.at).toLocaleString()} · {r.kind} · {r.status} · {r.toEmail}
            </li>
          ))}
        </ul>
      ) : null}
    </MetricsSection>
  );
}

export function AdPerformanceSection({ panel }: { panel: AdPerformancePanel }) {
  const metaConfigured = panel.integrations.find((i) => i.platform === "meta")?.configured ?? false;
  const googleConfigured = panel.integrations.find((i) => i.platform === "google")?.configured ?? false;

  return (
    <MetricsSection
      title="Ad performance"
      description="Google Ads and Meta metrics synced via API, plus on-site UTM attribution (7 days)."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Meta spend" value={formatUsdFromCents(panel.totals.meta.spendCents)} />
        <StatCard label="Google spend" value={formatUsdFromCents(panel.totals.google.spendCents)} />
        <StatCard label="UTM page views" value={panel.totals.attributedPageViews} />
        <StatCard label="UTM signup views" value={panel.totals.attributedSignupViews} />
      </div>
      <p className="mt-4 text-[11px] text-white/45">
        API sync: Meta {metaConfigured ? "connected" : "not configured"} · Google{" "}
        {googleConfigured ? "connected" : "not configured"}.{" "}
        <Link href="/admin/ad-tracking" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
          Open Ad Tracking HQ
        </Link>{" "}
        to build campaign URLs and run a manual sync.
      </p>
      {panel.attribution.length > 0 ? (
        <ul className="mt-4 space-y-1 text-[11px] text-white/50">
          {panel.attribution.slice(0, 5).map((row) => (
            <li key={`${row.utmSource}-${row.utmCampaign}`} className="flex justify-between gap-3">
              <span>
                {row.utmSource} / {row.utmCampaign}
              </span>
              <span className="tabular-nums text-white/70">{row.pageViews} views</span>
            </li>
          ))}
        </ul>
      ) : null}
    </MetricsSection>
  );
}

export function TrainerPipelineSection({ pipeline }: { pipeline: AdminTrainerPipelinePanel }) {
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const selected = pipeline.pendingTrainers.find((t) => t.trainerId === selectedTrainerId) ?? null;

  return (
    <MetricsSection
      title="Fitness Pro onboarding pipeline"
      description={`${pipeline.totalInPipeline} Fitness Pros past Terms of Service.`}
    >
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {pipeline.stages.map((s) => (
          <li key={s.id} className="rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#FFD34E]/80">{s.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{s.count}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Pending Fitness Pros</p>
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
          {pipeline.pendingTrainers.length === 0 ? (
            <p className="text-sm text-white/45">No pending Fitness Pros.</p>
          ) : (
            pipeline.pendingTrainers.map((t) => (
              <button
                key={t.trainerId}
                type="button"
                onClick={() => setSelectedTrainerId(t.trainerId === selectedTrainerId ? null : t.trainerId)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedTrainerId === t.trainerId
                    ? "border-[#FF7E00]/35 bg-[#FF7E00]/10 text-white"
                    : t.deidentified
                      ? "border-red-500/20 bg-red-500/[0.06] text-white/75 hover:bg-red-500/10"
                      : "border-white/[0.05] bg-black/20 text-white/75 hover:bg-white/[0.04]"
                }`}
              >
                {t.displayName}{" "}
                {t.deidentified ? (
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-red-300/80">Removed</span>
                ) : null}{" "}
                <span className="font-mono text-xs text-white/40">@{t.username}</span>
              </button>
            ))
          )}
        </div>
        {selected ? (
          <div className="mt-3 rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.06] p-3 text-[11px] text-white/70">
            {selected.deidentified ? (
              <p className="mb-2 font-semibold text-red-300/90">
                Account deidentified — hidden from marketplace and login. Search by username/email to locate.
              </p>
            ) : null}
            <p>Terms accepted: {selected.termsAccepted ? "Yes" : "No"}</p>
            <p className="mt-1">7-day compliance window started: {selected.complianceWindowStarted ? "Yes" : "No"}</p>
            <p className="mt-1">Onboarding fee paid: {selected.onboardingFeeCompleted ? "Yes" : "No"}</p>
            <p className="mt-1">
              Onboarding fee hold placed: {selected.onboardingFeeHoldPlaced ? "Yes" : "No"}
              {!selected.onboardingFeeCompleted && selected.onboardingFeeHoldPlaced ? (
                <span className="text-white/45"> (hold only — not captured yet)</span>
              ) : null}
            </p>
            <p className="mt-1">Background check: {selected.backgroundCheckStatus}</p>
            {selected.backgroundCheckReviewStatus ? (
              <p className="mt-1">BG review: {selected.backgroundCheckReviewStatus}</p>
            ) : null}
            <p className="mt-1">
              Documents: {selected.documentsComplete ? "Complete" : selected.documentsPending ? "Pending" : "Not uploaded"}
            </p>
          </div>
        ) : null}
      </div>
    </MetricsSection>
  );
}

export function FinancesDetailSection({ finances, embedded }: { finances: AdminFinancesPanel; embedded?: boolean }) {
  const body = (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clients in free trial"
          value={finances.clientsInFreeTrial}
          hint={`${finances.clientsInPlatformTrial ?? 0} platform trial · ${finances.clientsInStripeTrial ?? 0} Stripe trial`}
        />
        <StatCard
          label="Post-trial payment grace"
          value={finances.clientsInPlatformPaymentGrace}
          hint="Card-free trial ended; billing setup still required"
        />
        <StatCard
          label="Stripe billing grace"
          value={finances.paymentFailedInGrace}
          hint="Subscription lapsed; retry window before deactivation"
        />
        <StatCard label="Clients with card on file" value={finances.clientsWithCard} />
        <StatCard label="Active subscriptions" value={finances.activeSubscriptions} hint="Live Stripe billing" />
        <StatCard
          label="Premium Fitness Pros"
          value={finances.premiumTrainers}
          hint="Premium studio enabled (`premiumStudioEnabledAt` set)"
        />
        <StatCard label="Featured slots today" value={finances.featuredTrainersToday} />
        <StatCard label="Lifetime revenue events" value={finances.lifetime.eventCount} />
        <StatCard label="Lifetime platform fees (services)" value={formatUsdFromCents(finances.lifetime.platformFeesCents)} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(FINANCE_WINDOW_LABELS) as AdminFinanceWindowKey[]).map((key) => {
          const w = finances.windows[key];
          return (
            <div key={key} className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/70">
                {FINANCE_WINDOW_LABELS[key]}
              </p>
              <p className="mt-1 text-lg font-black text-white">{formatUsdFromCents(w.grossProfitCents)} profit</p>
              <p className="text-[10px] text-white/40">{formatUsdFromCents(w.revenueCents)} gross revenue</p>
            </div>
          );
        })}
      </div>
      {finances.bestSellers.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Best sellers (30d)</p>
          <ul className="mt-2 space-y-2">
            {finances.bestSellers.map((b) => (
              <li key={b.trainerId} className="rounded-lg border border-white/[0.05] px-3 py-2 text-[11px] text-white/55">
                <span className="font-semibold text-white">{b.displayName}</span> @{b.username} ·{" "}
                {formatUsdFromCents(b.volumeCents)} · {b.transactionCount} checkout
                {b.transactionCount === 1 ? "" : "s"}
                {b.topOfferingName ? ` · ${b.topOfferingName}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {finances.recentTransactions.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Recent transactions</p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[10px] text-white/45">
            {finances.recentTransactions.map((t) => (
              <li key={t.id}>
                {new Date(t.occurredAt).toLocaleString()} · {t.label} · {formatUsdFromCents(t.amountCents)} (
                {formatUsdFromCents(t.grossProfitCents)} profit) · {t.source}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  if (embedded) return <div className="mt-4">{body}</div>;

  return (
    <MetricsSection
      title="Finances & subscriptions"
      description="Revenue windows from platform_revenue_events; service admin fees from completed checkouts."
    >
      {body}
    </MetricsSection>
  );
}

function formatBgTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function platformModeLabel(mode: AdminBackgroundChecksPanel["platformMode"]): string {
  if (mode === "plan_a") return "Automated Checkr API";
  if (mode === "plan_b") return "Manual Checkr invite flow";
  return "Unconfigured";
}

function queueBadgeClass(kind: AdminBackgroundCheckEntry["queueKind"]): string {
  switch (kind) {
    case "awaiting_manual_invite":
      return "border-amber-400/35 bg-amber-500/15 text-amber-100";
    case "automated_invite_sent":
      return "border-sky-400/30 bg-sky-500/10 text-sky-100";
    case "manual_invite_sent":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
    case "plan_a_pending":
      return "border-violet-400/25 bg-violet-500/10 text-violet-100";
    case "failed":
      return "border-[#E32B2B]/30 bg-[#E32B2B]/10 text-[#FFB4B4]";
    default:
      return "border-white/10 bg-white/[0.04] text-white/60";
  }
}

function BackgroundCheckQueueTable({
  entries,
  confirmingId,
  onConfirmInviteSent,
}: {
  entries: AdminBackgroundCheckEntry[];
  confirmingId: string | null;
  onConfirmInviteSent: (trainerId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-6 text-center text-sm text-white/45">
        No active background check activity in the queue.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0E1016]/80">
      <table className="w-full min-w-[960px] text-left text-[11px] text-white/55">
        <thead>
          <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
            <th>Fitness Pro</th>
            <th className="px-3 py-3">Email</th>
            <th className="px-3 py-3">Queue</th>
            <th className="px-3 py-3 whitespace-nowrap">Invite requested</th>
            <th className="px-3 py-3 whitespace-nowrap">Invite sent</th>
            <th className="px-3 py-3">Latest email</th>
            <th className="px-3 py-3 whitespace-nowrap">Screening</th>
            <th className="px-4 py-3 pl-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const rowHighlight =
              entry.queueKind === "awaiting_manual_invite"
                ? "bg-amber-500/[0.06]"
                : entry.queueKind === "automated_invite_sent"
                  ? "bg-sky-500/[0.04]"
                  : "";

            return (
              <tr key={entry.trainerId} className={`border-b border-white/[0.04] align-top ${rowHighlight}`}>
                <td className="px-4 py-3 pr-3">
                  <p className="font-semibold text-white">{entry.displayName}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-white/40">@{entry.username}</p>
                </td>
                <td className="max-w-[12rem] px-3 py-3">
                  <p className="truncate text-white/70">{entry.email}</p>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-block max-w-[11rem] rounded-md border px-2 py-1 text-[10px] font-black uppercase leading-snug tracking-[0.08em] ${queueBadgeClass(entry.queueKind)}`}
                  >
                    {entry.queueLabel}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap tabular-nums text-white/70">
                  {formatBgTimestamp(entry.inviteRequestedAt)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap tabular-nums text-white/70">
                  {formatBgTimestamp(entry.inviteSentAt)}
                </td>
                <td className="max-w-[14rem] px-3 py-3">
                  {entry.latestEmail ? (
                    <>
                      <p className="truncate text-white/70">{entry.latestEmail.toEmail}</p>
                      <p className="mt-0.5 whitespace-nowrap tabular-nums text-[10px] text-white/40">
                        {formatBgTimestamp(entry.latestEmail.sentAt)}
                      </p>
                    </>
                  ) : (
                    <span className="text-white/35">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className="font-mono text-[10px] text-white/70">{entry.backgroundCheckStatus}</span>
                </td>
                <td className="px-4 py-3 pl-3 text-right">
                  {entry.canConfirmInviteSent ? (
                    <button
                      type="button"
                      disabled={confirmingId === entry.trainerId}
                      onClick={() => onConfirmInviteSent(entry.trainerId)}
                      className="inline-flex rounded-lg border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-50"
                    >
                      {confirmingId === entry.trainerId ? "Saving…" : "Confirm sent"}
                    </button>
                  ) : (
                    <span className="text-white/25">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BackgroundChecksSection({
  panel,
  onRefresh,
}: {
  panel: AdminBackgroundChecksPanel;
  onRefresh?: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function confirmInviteSent(trainerId: string) {
    setActionError(null);
    setConfirmingId(trainerId);
    try {
      const res = await fetch("/api/admin/background-checks/confirm-invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? "Could not confirm invite.");
        return;
      }
      onRefresh?.();
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <MetricsSection
      title="Background checks"
      description="See who is waiting for a manual Checkr link and when automated invites were emailed."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#07080c]/80 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Active screening mode</p>
            <p className="mt-1 text-sm font-semibold text-white">{platformModeLabel(panel.platformMode)}</p>
          </div>
          {panel.summary.awaitingManualInvite > 0 ? (
            <span className="rounded-md border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100">
              {panel.summary.awaitingManualInvite} awaiting manual invite
            </span>
          ) : (
            <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100">
              Manual queue clear
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Awaiting manual invite"
            value={panel.summary.awaitingManualInvite}
            accent={panel.summary.awaitingManualInvite > 0 ? "orange" : "default"}
            hint="Send Checkr link from dashboard, then confirm"
          />
          <StatCard
            label="Automated invites sent"
            value={panel.summary.automatedInvitesSent}
            hint="Invitation emailed automatically via Checkr API"
          />
          <StatCard label="Manual invites confirmed" value={panel.summary.manualInvitesSent} accent="emerald" />
          <StatCard label="Paid, awaiting Checkr" value={panel.summary.planAPending} accent="violet" />
        </div>

        {actionError ? (
          <p className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-2 text-sm text-[#FFB4B4]">
            {actionError}
          </p>
        ) : null}

        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Screening queue</p>
              <p className="mt-1 text-xs text-white/40">
                Sorted by urgency — action-required Fitness Pros appear first.
              </p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
              {panel.activeEntries.length} active
            </p>
          </div>
          <BackgroundCheckQueueTable
            entries={panel.activeEntries}
            confirmingId={confirmingId}
            onConfirmInviteSent={confirmInviteSent}
          />
        </div>
      </div>
    </MetricsSection>
  );
}

export { OperationalAlertsSection } from "@/app/admin/operational-alerts-section";

