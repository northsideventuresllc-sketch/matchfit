"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminPortalAlert,
  AdminPortalPageHeader,
  AdminPortalShell,
  adminCardClass,
  adminInputClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";

type SearchResult = {
  accountType: "client" | "trainer";
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  securityLockedAt: string | null;
};

type AccountDetail = Record<string, unknown> & { id: string };

/**
 * Account-help console: reset a password on someone's behalf, unlock a security-locked
 * account, fix a typo'd email/username, and see the same account info the person themselves
 * can see. Every action mirrors a self-service one — nothing here does anything a user
 * couldn't do for themselves, it just does it for them when they can't get in.
 */
export function AdminAccountSupportClient() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ type: "client" | "trainer"; id: string } | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");

  async function runSearch() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/account/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { results?: SearchResult[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function openAccount(accountType: "client" | "trainer", id: string) {
    setSelected({ type: accountType, id });
    setDetail(null);
    setNotice(null);
    setError(null);
    const res = await fetch(`/api/admin/support/account/${accountType}/${id}`);
    const data = (await res.json()) as { account?: AccountDetail; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load this account.");
      return;
    }
    setDetail(data.account ?? null);
    setEditEmail(typeof data.account?.email === "string" ? data.account.email : "");
    setEditUsername(typeof data.account?.username === "string" ? data.account.username : "");
  }

  // Deep link from Outreach HQ's Successful Conversions tab: ?type=client|trainer&id=... opens
  // straight to that account, same as clicking it from a search result.
  useEffect(() => {
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    if ((type === "client" || type === "trainer") && id) {
      queueMicrotask(() => void openAccount(type, id));
    }
  }, [searchParams]);

  async function runAction(action: "reset-password" | "unlock", label: string) {
    if (!selected) return;
    setBusyAction(action);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/account/${selected.type}/${selected.id}/${action}`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Could not ${label.toLowerCase()}.`);
        return;
      }
      setNotice(`${label} — done.`);
      if (action === "unlock") void openAccount(selected.type, selected.id);
    } catch {
      setError(`Could not ${label.toLowerCase()}.`);
    } finally {
      setBusyAction(null);
    }
  }

  async function saveIdentityEdit() {
    if (!selected) return;
    setBusyAction("edit");
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/account/${selected.type}/${selected.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editEmail.trim(), username: editUsername.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save changes.");
        return;
      }
      setNotice("Email and username updated.");
      void openAccount(selected.type, selected.id);
    } catch {
      setError("Could not save changes.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AdminPortalShell>
      <AdminPortalPageHeader
        title="Account Help"
        description="Look up a client or coach by email or username to help them back into their account."
      />

      <div className={`${adminCardClass} mt-8`}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder="Email or username"
            className={`${adminInputClass} flex-1`}
          />
          <button type="button" onClick={() => void runSearch()} disabled={searching} className={adminSecondaryButtonClass}>
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {results.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {results.map((r) => (
              <button
                key={`${r.accountType}-${r.id}`}
                type="button"
                onClick={() => void openAccount(r.accountType, r.id)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm transition hover:border-white/25"
              >
                <span>
                  <span className="font-semibold text-white">
                    {r.firstName} {r.lastName}
                  </span>{" "}
                  <span className="text-white/50">@{r.username} · {r.email}</span>
                </span>
                <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
                  {r.securityLockedAt ? <span className="text-rose-300">Locked</span> : null}
                  {r.accountType}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4">
          <AdminPortalAlert>{error}</AdminPortalAlert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4">
          <AdminPortalAlert variant="success">{notice}</AdminPortalAlert>
        </div>
      ) : null}

      {selected && detail ? (
        <div className={`${adminCardClass} mt-6`}>
          <h2 className="text-sm font-black uppercase tracking-wide text-white/60">
            {selected.type === "client" ? "Client" : "Coach"} account
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {Object.entries(detail)
              .filter(([k]) => k !== "id")
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/5 py-1.5">
                  <dt className="text-white/40">{k}</dt>
                  <dd className="truncate text-right text-white/85">{String(v ?? "—")}</dd>
                </div>
              ))}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runAction("reset-password", "Reset link sent")}
              disabled={busyAction !== null}
              className={adminSecondaryButtonClass}
            >
              {busyAction === "reset-password" ? "Sending…" : "Send Password Reset"}
            </button>
            {detail.securityLockedAt ? (
              <button
                type="button"
                onClick={() => void runAction("unlock", "Account unlocked")}
                disabled={busyAction !== null}
                className={adminSecondaryButtonClass}
              >
                {busyAction === "unlock" ? "Unlocking…" : "Unlock Account"}
              </button>
            ) : null}
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <h3 className="text-xs font-black uppercase tracking-wide text-white/50">Fix Email / Username</h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={`${adminInputClass} flex-1`} placeholder="Email" />
              <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className={`${adminInputClass} flex-1`} placeholder="Username" />
              <button type="button" onClick={() => void saveIdentityEdit()} disabled={busyAction !== null} className={adminSecondaryButtonClass}>
                {busyAction === "edit" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPortalShell>
  );
}
