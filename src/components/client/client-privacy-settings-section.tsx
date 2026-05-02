"use client";

import { useCallback, useEffect, useState } from "react";
import { CollapsibleSettingsSection } from "@/components/client/collapsible-settings-section";
import type { ClientOptionalProfileVisibility } from "@/lib/optional-profile-visibility";

const toggleRow =
  "flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:border-white/[0.12]";

function Toggle(props: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={toggleRow}>
      <span>
        <span className="block text-sm font-semibold text-white/90">{props.label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-white/45">{props.description}</span>
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 accent-[#FF7E00]"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  );
}

export function ClientPrivacySettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [v, setV] = useState<ClientOptionalProfileVisibility>({});
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState<string | null>(null);

  const [delPwd, setDelPwd] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  type BlockedProfileRow = {
    id: string;
    username: string;
    displayName: string;
    kind: "trainer";
    hideTrainerFromClientMatchFeed: boolean;
    hideTrainerFromClientFithub: boolean;
    blockDirectChat: boolean;
  };
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfileRow[]>([]);
  const [unblockBusyId, setUnblockBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/settings/privacy");
      const data = (await res.json()) as {
        visibility?: ClientOptionalProfileVisibility;
        privacyPolicyAcceptedAt?: string | null;
        blockedProfiles?: BlockedProfileRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load privacy settings.");
        return;
      }
      setV(data.visibility ?? {});
      setPrivacyAcceptedAt(data.privacyPolicyAcceptedAt ?? null);
      setBlockedProfiles(Array.isArray(data.blockedProfiles) ? data.blockedProfiles : []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePatch(patch: ClientOptionalProfileVisibility) {
    setSaving(true);
    setOk(null);
    setError(null);
    try {
      const res = await fetch("/api/client/settings/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { visibility?: ClientOptionalProfileVisibility; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      if (data.visibility) setV(data.visibility);
      setOk("Privacy preferences saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function scopeSummary(b: BlockedProfileRow): string {
    const bits: string[] = [];
    if (b.hideTrainerFromClientMatchFeed) bits.push("Match Browse");
    if (b.hideTrainerFromClientFithub) bits.push("FitHub");
    if (b.blockDirectChat) bits.push("Messages");
    return bits.length ? bits.join(" · ") : "—";
  }

  async function unblockRow(id: string) {
    setUnblockBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/safety/block", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not remove limit.");
        return;
      }
      setBlockedProfiles((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Network error.");
    } finally {
      setUnblockBusyId(null);
    }
  }

  async function deleteAccount() {
    setDelErr(null);
    if (!delPwd.trim()) {
      setDelErr("Enter your password to confirm.");
      return;
    }
    setDelBusy(true);
    try {
      const res = await fetch("/api/client/settings/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: delPwd }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDelErr(data.error ?? "Could not delete account.");
        return;
      }
      window.location.href = "/client";
    } catch {
      setDelErr("Network error.");
    } finally {
      setDelBusy(false);
    }
  }

  const showBio = v.showBioOnPublicProfile !== false;
  const showSnap = v.showMatchSnapshotOnPublicProfile !== false;

  return (
    <CollapsibleSettingsSection
      title="Privacy & Data"
      description="Control optional details on your public client page, review policy acceptance, or permanently delete your account."
      defaultOpen={false}
    >
      <div className="space-y-4">
        {privacyAcceptedAt ? (
          <p className="text-xs text-white/45">
            Privacy Policy Accepted:{" "}
            <span className="font-mono text-white/60">{new Date(privacyAcceptedAt).toLocaleString()}</span>
          </p>
        ) : (
          <p className="text-xs text-amber-200/80">No privacy policy acceptance timestamp on file for this account.</p>
        )}

        {loading ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : (
          <>
            {error ? (
              <p className="rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-2 text-sm text-[#FFB4B4]" role="alert">
                {error}
              </p>
            ) : null}
            {ok ? (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" role="status">
                {ok}
              </p>
            ) : null}

            <div className="space-y-3">
              <Toggle
                label="Show Bio on Public Profile"
                description="When off, your bio is hidden on the public page trainers may open from discovery."
                checked={showBio}
                disabled={saving}
                onChange={(checked) => {
                  setV((prev) => ({ ...prev, showBioOnPublicProfile: checked }));
                  void savePatch({ showBioOnPublicProfile: checked });
                }}
              />
              <Toggle
                label="Show Match Snapshot on Public Profile"
                description="When off, goals and service preferences are hidden from your public page."
                checked={showSnap}
                disabled={saving}
                onChange={(checked) => {
                  setV((prev) => ({ ...prev, showMatchSnapshotOnPublicProfile: checked }));
                  void savePatch({ showMatchSnapshotOnPublicProfile: checked });
                }}
              />
            </div>

            {blockedProfiles.length > 0 ? (
              <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Coaches You Limited</p>
                <ul className="mt-3 space-y-3">
                  {blockedProfiles.map((b) => (
                    <li key={b.id} className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-[#0B0C0F]/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white/90">{b.displayName}</p>
                        <p className="truncate text-xs text-white/45">@{b.username}</p>
                        <p className="mt-1 text-[10px] text-white/35">{scopeSummary(b)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={unblockBusyId === b.id}
                        onClick={() => void unblockRow(b.id)}
                        className="shrink-0 self-start rounded-lg border border-white/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/55 transition hover:border-emerald-400/30 hover:text-emerald-100/90 disabled:opacity-40"
                      >
                        {unblockBusyId === b.id ? "…" : "Remove Limits"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <div className="mt-8 rounded-2xl border border-[#E32B2B]/25 bg-[#E32B2B]/[0.06] p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#FFB4B4]/90">Delete Account</h3>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Permanently removes personal data from Match Fit, cancels an active subscription in Stripe, and signs you out.
            Minimal safety and billing audit metadata may be retained where the law requires.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current Password"
            value={delPwd}
            onChange={(e) => setDelPwd(e.target.value)}
            className="mt-4 w-full rounded-xl border border-white/10 bg-[#0B0C0F] px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-[#FF7E00]/50"
          />
          {delErr ? (
            <p className="mt-2 text-xs text-[#FFB4B4]" role="alert">
              {delErr}
            </p>
          ) : null}
          <button
            type="button"
            disabled={delBusy}
            onClick={() => void deleteAccount()}
            className="mt-4 w-full rounded-xl border border-[#E32B2B]/40 bg-[#E32B2B]/15 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#FFB4B4] transition hover:bg-[#E32B2B]/25 disabled:opacity-50"
          >
            {delBusy ? "Deleting…" : "Delete My Account"}
          </button>
        </div>
      </div>
    </CollapsibleSettingsSection>
  );
}
