"use client";

import type { ReactNode } from "react";
import type {
  AdminAlertsPanel,
  AdminFinanceWindowKey,
  AdminFinancesPanel,
  AdminLoginRecencyBuckets,
  AdminPlatformSummaryPanel,
  AdminPortalOverview,
  AdminTrafficFunnelPanel,
  AdminTrainerPipelinePanel,
} from "@/lib/admin-portal-types";
import { formatUsdFromCents } from "@/lib/admin-portal-types";

const FINANCE_WINDOW_LABELS: Record<AdminFinanceWindowKey, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
  "5y": "5 years",
};

function StatCard(props: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{props.label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-white">{props.value}</p>
      {props.hint ? <p className="mt-1 text-[10px] text-white/35">{props.hint}</p> : null}
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
  const { successRating, potentialSuccess, valuation } = panel;
  return (
    <MetricsSection
      title="Platform health, success & valuation"
      description={`Launch ${successRating.meta.launchDate} · Marketing from ${successRating.meta.marketingStartDate} ($${successRating.meta.marketingBudgetUsd} budget). Current success rating blends live signals; potential success projects beta ceilings; valuation uses ARR + network heuristics.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Success rating (0–10)" value={successRating.score.toFixed(1)} hint="Current composite score" />
        <StatCard
          label="Potential success (0–10)"
          value={potentialSuccess.score.toFixed(1)}
          hint={`+${potentialSuccess.uplift.toFixed(1)} vs current · AI assistant uses this projection`}
        />
        <StatCard
          label="Est. platform valuation"
          value={formatUsdFromCents(valuation.valuationCents)}
          hint={`${valuation.revenueMultiple.toFixed(1)}× ARR + network value`}
        />
        <StatCard label="Stability score" value={`${panel.stabilityScore}/100`} hint={panel.stabilityNotes.join(" · ") || undefined} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Security score" value={`${panel.securityScore}/100`} hint={panel.securityNotes.join(" · ") || undefined} />
        <StatCard label="Lifetime revenue" value={formatUsdFromCents(panel.lifetimeRevenueCents)} />
        <StatCard label="Lifetime gross profit" value={formatUsdFromCents(panel.lifetimeGrossProfitCents)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Annualized subscription ARR"
          value={formatUsdFromCents(valuation.subscriptionArrCents)}
          hint="Client $10/mo + trainer premium $20/mo"
        />
        <StatCard
          label="Annualized 30d gross profit"
          value={formatUsdFromCents(valuation.transactionalArrCents)}
          hint="Service checkout profit × 12"
        />
      </div>
      <ul className="mt-4 space-y-1.5 text-[11px] text-white/45">
        {successRating.factors.map((f) => (
          <li key={f.id}>
            {f.label}: raw {f.raw.toFixed(2)} → contribution {f.contribution.toFixed(2)} (weight {(f.weight * 100).toFixed(0)}%)
          </li>
        ))}
      </ul>
    </MetricsSection>
  );
}

export function SiteTrafficSection({ traffic }: { traffic: AdminPortalOverview["traffic"] }) {
  return (
    <MetricsSection
      title={`Site traffic (${traffic.windowDays}d)`}
      description="Page views and link clicks from public site analytics (bots filtered at ingest)."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Page views" value={traffic.pageViews} />
        <StatCard label="Unique visitors" value={traffic.uniqueVisitors} />
        <StatCard label="Link clicks" value={traffic.linkClicks} />
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

export function AcquisitionFunnelSection({ funnel }: { funnel: AdminTrafficFunnelPanel }) {
  return (
    <MetricsSection
      title="Acquisition funnel & engagement"
      description={
        funnel.analyticsAvailable
          ? "Signup page views, live sessions, login recency, and top product actions (7d, excludes QA synthetic accounts)."
          : "Site analytics table not available — funnel page-view counts may be zero until reporting schema is applied."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Homepage visits (all time)" value={funnel.homepageVisits} />
        <StatCard label="Total site page views" value={funnel.totalSiteVisits} />
        <StatCard label="Active on site now (~15m)" value={funnel.activeOnSiteNow} />
        <StatCard label="Client signup page views" value={funnel.clientSignupPageViews} />
        <StatCard label="Trainer signup page views" value={funnel.trainerSignupPageViews} />
        <StatCard
          label="Reached client signup (no account)"
          value={funnel.clientsReachedSignupWithoutAccount}
          hint="Unique signup visitors minus live clients, plus active pending registrations"
        />
        <StatCard
          label="Reached trainer signup (no account)"
          value={funnel.trainersReachedSignupWithoutAccount}
          hint="Unique signup visitors minus live trainer accounts"
        />
        <StatCard
          label="Pending client registrations"
          value={funnel.pendingClientRegistrations.total}
          hint="Non-expired rows in PENDING_2FA or AWAITING_PAYMENT"
        />
        <StatCard
          label="Incomplete trainer signups"
          value={funnel.incompleteTrainerSignups}
          hint="Dashboard not live yet (`dashboardActivatedAt` null)"
        />
        <StatCard
          label="Trainers before terms"
          value={funnel.trainersBeforeTerms}
          hint="Account created but Terms of Service not accepted"
        />
        <StatCard
          label="Trainers pre registration payment"
          value={funnel.trainersBeforeRegistrationPayment}
          hint="No registration fee hold/capture and limited dashboard not unlocked"
        />
        <StatCard
          label="Clients in free trial"
          value={funnel.clientsInFreeTrial}
          hint={`${funnel.clientsInPlatformTrial ?? 0} card-free platform trial · ${funnel.clientsInStripeTrial ?? 0} Stripe trial (no paid invoice yet)`}
        />
        <StatCard
          label="Clients in post-trial payment grace"
          value={funnel.clientsInPlatformPaymentGrace}
          hint="Platform trial ended; card/subscription not connected yet"
        />
        <StatCard
          label="Active client subscriptions"
          value={funnel.activeClientSubscriptions}
          hint="Live Stripe billing with active subscription"
        />
      </div>
      {Object.keys(funnel.pendingClientRegistrations.byStatus).length > 0 ? (
        <ul className="mt-3 text-[11px] text-white/45">
          {Object.entries(funnel.pendingClientRegistrations.byStatus).map(([status, count]) => (
            <li key={status}>
              {status}: {count}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <LoginRecencyGrid title="Client logins by recency" buckets={funnel.clientLoginsByRecency} />
        <LoginRecencyGrid title="Trainer logins by recency" buckets={funnel.trainerLoginsByRecency} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Top client actions (7d)</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/50">
            {funnel.topClientFunctions.map((f) => (
              <li key={f.key} className="flex justify-between">
                <span>{f.label}</span>
                <span className="tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Top trainer actions (7d)</p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/50">
            {funnel.topTrainerFunctions.map((f) => (
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

export function TrainerPipelineSection({ pipeline }: { pipeline: AdminTrainerPipelinePanel }) {
  return (
    <MetricsSection
      title="Trainer onboarding pipeline"
      description={`${pipeline.totalInPipeline} trainers in pipeline (excludes deidentified and QA synthetic). Percentages are relative to trainers who accepted Terms of Service.`}
    >
      <ul className="space-y-2">
        {pipeline.stages.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm text-white/80">{s.label}</span>
            <span className="text-sm font-bold tabular-nums text-white">
              {s.count} <span className="text-white/40">({s.percentOfSignup}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </MetricsSection>
  );
}

export function FinancesDetailSection({ finances }: { finances: AdminFinancesPanel }) {
  return (
    <MetricsSection
      title="Finances & subscriptions"
      description="Revenue windows from platform_revenue_events; service admin fees from completed checkouts."
    >
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
          label="Premium trainers"
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
    </MetricsSection>
  );
}

export function OperationalAlertsSection({ alerts }: { alerts: AdminAlertsPanel }) {
  return (
    <MetricsSection title="Operational alerts" description="Trust, safety, billing, and product feedback queues.">
      <div className="space-y-4">
        {alerts.groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{g.label}</p>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                  g.severity === "critical"
                    ? "bg-[#E32B2B]/20 text-[#FFB4B4]"
                    : g.severity === "warning"
                      ? "bg-amber-500/20 text-amber-100"
                      : "bg-white/10 text-white/55"
                }`}
              >
                {g.severity} · {g.total}
              </span>
            </div>
            {g.items.length === 0 ? (
              <p className="mt-2 text-[11px] text-white/40">No items in preview.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.id} className="text-[11px] text-white/50">
                    <span className="font-medium text-white/75">{item.title}</span>
                    {item.detail ? ` — ${item.detail}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </MetricsSection>
  );
}

