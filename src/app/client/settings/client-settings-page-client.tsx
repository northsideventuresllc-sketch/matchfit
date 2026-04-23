"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClientPortalHeader } from "@/components/client/client-portal-header";
import { CollapsibleSettingsSection } from "@/components/client/collapsible-settings-section";
import { PasswordChangePanel } from "./password-change-panel";
import {
  ProfileSettingsPanel,
  type ClientSettingsProfile,
  type ProfileSettingsPanelRef,
} from "./profile-settings-panel";
import { StayLoggedInPanel } from "./stay-logged-in-panel";
import { TwoFactorPanel, type TwoFactorChannelDTO, type TwoFactorPanelRef } from "./two-factor-panel";

type Props = {
  initialProfile: ClientSettingsProfile;
  initialStayLoggedIn: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: string;
  twoFactorChannels: TwoFactorChannelDTO[];
  initialDefaultChannelId: string | null;
  headerPreferredName: string;
  headerProfileImageUrl: string | null;
};

export function ClientSettingsPageClient(props: Props) {
  const router = useRouter();
  const profileRef = useRef<ProfileSettingsPanelRef>(null);
  const twoFaRef = useRef<TwoFactorPanelRef>(null);
  const [stayLoggedIn, setStayLoggedIn] = useState(props.initialStayLoggedIn);
  const [baselineStay, setBaselineStay] = useState(props.initialStayLoggedIn);
  const [profileDirty, setProfileDirty] = useState(false);
  const [footerBusy, setFooterBusy] = useState(false);
  const [footerError, setFooterError] = useState<string | null>(null);
  const [footerOk, setFooterOk] = useState<string | null>(null);
  const [profileSaveBlocked, setProfileSaveBlocked] = useState(false);
  const [twoFaLeaveDirty, setTwoFaLeaveDirty] = useState(false);
  const [twoFaFooterBlocked, setTwoFaFooterBlocked] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const stayDirty = stayLoggedIn !== baselineStay;
  const dirty = profileDirty || stayDirty || twoFaLeaveDirty;

  const handleProfileDirty = useCallback((d: boolean) => {
    setProfileDirty(d);
    if (d) setFooterOk(null);
  }, []);

  const handleStayLoggedInChange = useCallback((v: boolean) => {
    setFooterOk(null);
    setStayLoggedIn(v);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const runSave = useCallback(async (): Promise<boolean> => {
    setFooterError(null);
    setFooterOk(null);
    setFooterBusy(true);
    try {
      if (profileDirty) {
        const r = await profileRef.current?.saveProfileFromFooter();
        if (!r) return false;
      }
      if (stayDirty) {
        const res = await fetch("/api/client/settings/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stayLoggedIn }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setFooterError(data.error ?? "Could not update your session preference.");
          return false;
        }
        setBaselineStay(stayLoggedIn);
      }
      let twoFaApplied = false;
      if (twoFaRef.current) {
        const r2 = await twoFaRef.current.saveFromFooter();
        if (!r2.ok) return false;
        twoFaApplied = r2.applied;
      }
      // Any successful save discards unverified 2FA channels (only verified destinations are kept).
      try {
        await fetch("/api/client/settings/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "abandon_unverified_channels" }),
        });
      } catch {
        /* non-fatal */
      }
      if (profileDirty || stayDirty || twoFaApplied) {
        setFooterOk("Changes saved.");
      }
      router.refresh();
      return true;
    } catch {
      setFooterError("Network error. Try again.");
      return false;
    } finally {
      setFooterBusy(false);
    }
  }, [profileDirty, router, stayDirty, stayLoggedIn]);

  const requestNavigate = useCallback(
    (href: string) => {
      if (!dirty) {
        router.push(href);
        return;
      }
      setPendingHref(href);
      setLeaveOpen(true);
    },
    [dirty, router],
  );

  async function leaveDialogSave() {
    setFooterError(null);
    const ok = await runSave();
    if (!ok || !pendingHref) return;
    if (twoFaRef.current?.hasBlockingAddFlow()) {
      setFooterError("Finish or cancel adding a sign-in method before leaving.");
      return;
    }
    setLeaveOpen(false);
    router.push(pendingHref);
    setPendingHref(null);
  }

  async function leaveDialogAbandon() {
    await twoFaRef.current?.abandonStaged();
    const href = pendingHref;
    setLeaveOpen(false);
    setPendingHref(null);
    if (href) {
      router.push(href);
    }
  }

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 pb-32 text-white sm:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <ClientPortalHeader
          preferredName={props.headerPreferredName}
          profileImageUrl={props.headerProfileImageUrl}
          backHref="/client/account"
          backLabel="← Dashboard"
        />

        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Account Settings</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Manage your Match Fit profile and security preferences. Expand a section to review or update it.
          </p>
        </div>

        {footerError ? (
          <p
            className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]"
            role="alert"
          >
            {footerError}
          </p>
        ) : null}
        {footerOk && !leaveOpen ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
            {footerOk}
          </p>
        ) : null}

        <ProfileSettingsPanel
          key={JSON.stringify(props.initialProfile)}
          ref={profileRef}
          initialProfile={props.initialProfile}
          onProfileDirtyChange={handleProfileDirty}
          onProfileFooterBlockedChange={setProfileSaveBlocked}
          footerSaveMode
        />

        <CollapsibleSettingsSection
          title="Stay Logged In"
          description="Choose whether this browser keeps you signed in longer between visits."
          defaultOpen={false}
        >
          <StayLoggedInPanel value={stayLoggedIn} onChange={handleStayLoggedInChange} disabled={footerBusy} />
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Password"
          description={
            props.twoFactorEnabled
              ? "Start a secure reset using a code from your two-factor method."
              : "Start a secure reset using a link sent to your email address."
          }
          defaultOpen={false}
        >
          <PasswordChangePanel twoFactorEnabled={props.twoFactorEnabled} unstyled />
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Two-Factor Authentication"
          description="Add a verification step when you sign in from a new device."
          defaultOpen={false}
        >
          <TwoFactorPanel
            ref={twoFaRef}
            twoFactorEnabled={props.twoFactorEnabled}
            initialChannels={props.twoFactorChannels}
            initialDefaultChannelId={props.initialDefaultChannelId}
            unstyled
            onDirtyChange={setTwoFaLeaveDirty}
            onFooterBlockedChange={setTwoFaFooterBlocked}
          />
        </CollapsibleSettingsSection>

        <p className="text-sm">
          <button
            type="button"
            onClick={() => requestNavigate("/client/account")}
            className="text-[#FF7E00] underline-offset-2 hover:underline"
          >
            Back to Dashboard
          </button>
        </p>
      </div>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0C0F]/95 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">You have unsaved changes.</p>
            <button
              type="button"
              disabled={footerBusy || (profileDirty && profileSaveBlocked) || twoFaFooterBlocked}
              onClick={() => void runSave()}
              className="group relative isolate flex min-h-[3rem] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50 sm:w-auto"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
              />
              <span className="relative">{footerBusy ? "Saving…" : "Save Changes"}</span>
            </button>
          </div>
        </div>
      ) : null}

      {leaveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12151C] p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white">Unsaved Changes</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              You have updates that are not saved yet. Do you want to save them before leaving this page?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                disabled={footerBusy || (profileDirty && profileSaveBlocked) || twoFaFooterBlocked}
                onClick={() => void leaveDialogSave()}
                className="group relative isolate flex min-h-[3rem] flex-1 items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                />
                <span className="relative">{footerBusy ? "Saving…" : "Save Changes"}</span>
              </button>
              <button
                type="button"
                disabled={footerBusy}
                onClick={() => void leaveDialogAbandon()}
                className="min-h-[3rem] flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
              >
                Leave Without Saving
              </button>
            </div>
            <button
              type="button"
              className="mt-4 w-full text-center text-xs font-semibold uppercase tracking-wide text-white/40 hover:text-white/65"
              onClick={() => {
                setLeaveOpen(false);
                setPendingHref(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <SettingsLeaveGuard onRequestNavigate={requestNavigate} isActive={dirty} />
    </main>
  );
}

/** Intercepts in-page anchor navigation when dirty (header uses Link). */
function SettingsLeaveGuard(props: { onRequestNavigate: (href: string) => void; isActive: boolean }) {
  const { onRequestNavigate, isActive } = props;
  useEffect(() => {
    if (!isActive) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (a.hasAttribute("data-skip-leave-guard")) return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      onRequestNavigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isActive, onRequestNavigate]);
  return null;
}
