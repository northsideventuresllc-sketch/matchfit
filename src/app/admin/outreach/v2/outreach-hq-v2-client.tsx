"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminPortalAlert, adminSecondaryButtonClass } from "@/components/admin/admin-portal-ui";
import { AdminNavBadge } from "@/components/admin/admin-nav-badge";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import { readJsonResponse } from "@/lib/read-json-response";
import type {
  OutreachArchiveLead,
  OutreachCoworkDispatchBatchRow,
  OutreachHubLead,
} from "@/lib/outreach-types";
import { groupHubLeadsByLane, selectManualQueuedLeads, tabBadgeCount, type OutreachV2Tab } from "./components/helpers";
import { LeadsPanel } from "./components/leads-panel";
import { PendingResponsesPanel } from "./components/pending-responses-panel";
import { OutreachHubPanel } from "./components/outreach-hub-panel";
import { DispatchPanel } from "./components/dispatch-panel";
import { PendingLeadsPanel } from "./components/pending-leads-panel";
import { ArchivesPanel } from "./components/archives-panel";

const TABS: { id: OutreachV2Tab; label: string }[] = [
  { id: "today", label: "Today's Leads" },
  { id: "past_due", label: "Past Due" },
  { id: "follow_ups", label: "Follow-ups" },
  { id: "pending_responses", label: "Pending Responses" },
  { id: "hub", label: "Outreach Hub" },
  { id: "dispatch", label: "Send Queue" },
  { id: "pending", label: "Pending Leads" },
  { id: "archives", label: "Archives" },
];

type FocusTarget = { tab: OutreachV2Tab; leadId: string };

export function OutreachHqV2Client(props: { aiStatus: AdminAiProviderStatus }) {
  const [tab, setTabState] = useState<OutreachV2Tab>("today");
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [hubEntries, setHubEntries] = useState<OutreachHubLead[]>([]);
  const [upcoming, setUpcoming] = useState<OutreachCoworkDispatchBatchRow[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<OutreachCoworkDispatchBatchRow[]>([]);
  const [archiveEntries, setArchiveEntries] = useState<OutreachArchiveLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hubRes, dispatchRes, archiveRes] = await Promise.all([
        fetch("/api/admin/outreach/hub", { credentials: "include" }),
        fetch("/api/admin/outreach/dispatch", { credentials: "include" }),
        fetch("/api/admin/outreach/archive", { credentials: "include" }),
      ]);
      const hubData = await readJsonResponse<{ leads?: OutreachHubLead[]; error?: string }>(hubRes);
      const dispatchData = await readJsonResponse<{
        upcoming?: OutreachCoworkDispatchBatchRow[];
        recentlyCompleted?: OutreachCoworkDispatchBatchRow[];
        error?: string;
      }>(dispatchRes);
      const archiveData = await readJsonResponse<{ entries?: OutreachArchiveLead[]; error?: string }>(archiveRes);

      if (hubRes.ok) setHubEntries(hubData.leads ?? []);
      else setError(hubData.error ?? "Could not load outreach leads.");
      if (dispatchRes.ok) {
        setUpcoming(dispatchData.upcoming ?? []);
        setRecentlyCompleted(dispatchData.recentlyCompleted ?? []);
      }
      if (archiveRes.ok) setArchiveEntries(archiveData.entries ?? []);
    } catch {
      setError("Could not load Outreach HQ. Refresh to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadAll());
  }, [loadAll]);

  const grouped = useMemo(() => groupHubLeadsByLane(hubEntries), [hubEntries]);

  const setTab = (next: OutreachV2Tab) => {
    setTabState(next);
    setFocus((prev) => (prev && prev.tab === next ? prev : null));
  };

  const navigate = (nextTab: OutreachV2Tab, leadId?: string) => {
    setTabState(nextTab);
    setFocus(leadId ? { tab: nextTab, leadId } : null);
  };

  const focusLeadId = focus && focus.tab === tab ? focus.leadId : null;
  const onError = (message: string) => setError(message || null);

  return (
    <AdminPortalShell
      current="outreach"
      maxWidth="full"
      title="Outreach HQ"
      description="Leads are generated Monday–Friday and pushed to Telegram for on-the-go approve, delete, or rewrite. Manual Send or Agent Send moves a lead to the Send Queue tab."
      headerActions={
        <>
          <button type="button" className={adminSecondaryButtonClass} disabled={loading} onClick={() => void loadAll()}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <Link href="/admin" className={adminSecondaryButtonClass}>
            Dashboard
          </Link>
        </>
      }
    >
      {!props.aiStatus.configured ? <AdminPortalAlert variant="info">{props.aiStatus.message}</AdminPortalAlert> : null}
      {error ? <AdminPortalAlert variant="error">{error}</AdminPortalAlert> : null}

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.06] pb-1" aria-label="Outreach HQ tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tab === t.id
                ? "relative rounded-lg border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#FFD34E]"
                : `relative ${adminSecondaryButtonClass}`
            }
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <AdminNavBadge count={tabBadgeCount(t.id, grouped)} />
          </button>
        ))}
      </nav>

      {tab === "today" ? (
        <LeadsPanel variant="today" grouped={grouped} focusLeadId={focusLeadId} onChanged={() => void loadAll()} onError={onError} />
      ) : null}
      {tab === "past_due" ? (
        <LeadsPanel variant="past_due" grouped={grouped} focusLeadId={focusLeadId} onChanged={() => void loadAll()} onError={onError} />
      ) : null}
      {tab === "follow_ups" ? (
        <LeadsPanel variant="follow_ups" grouped={grouped} focusLeadId={focusLeadId} onChanged={() => void loadAll()} onError={onError} />
      ) : null}
      {tab === "pending_responses" ? (
        <PendingResponsesPanel leads={grouped.pending_response} focusLeadId={focusLeadId} onError={onError} />
      ) : null}
      {tab === "hub" ? (
        <OutreachHubPanel grouped={grouped} archiveEntries={archiveEntries} onNavigate={navigate} />
      ) : null}
      {tab === "dispatch" ? (
        <DispatchPanel
          upcoming={upcoming}
          recentlyCompleted={recentlyCompleted}
          manualQueued={selectManualQueuedLeads(grouped)}
          onChanged={() => void loadAll()}
          onError={onError}
        />
      ) : null}
      {tab === "pending" ? (
        <PendingLeadsPanel leads={grouped.pending} focusLeadId={focusLeadId} onChanged={() => void loadAll()} onError={onError} />
      ) : null}
      {tab === "archives" ? <ArchivesPanel entries={archiveEntries} /> : null}
    </AdminPortalShell>
  );
}
