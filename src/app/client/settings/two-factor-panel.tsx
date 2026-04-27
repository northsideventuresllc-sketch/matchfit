"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

type Delivery = "EMAIL" | "SMS" | "VOICE";

export type TwoFactorChannelDTO = {
  id: string;
  delivery: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
  isDefaultLogin: boolean;
};

export type TwoFactorPanelRef = {
  saveFromFooter: () => Promise<{ ok: boolean; applied: boolean }>;
  abandonStaged: () => Promise<void>;
  /** True while the add-method form has input or a verify step is in progress (not persisted until verified). */
  hasBlockingAddFlow: () => boolean;
};

type PanelProps = {
  twoFactorEnabled: boolean;
  initialChannels: TwoFactorChannelDTO[];
  initialDefaultChannelId: string | null;
  unstyled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onFooterBlockedChange?: (blocked: boolean) => void;
  /** Base path without trailing slash; defaults to client settings API. */
  settingsApiBase?: string;
  /** "Back to dashboard" link when the panel is not embedded (`unstyled` false). */
  dashboardLinkHref?: string;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

function maskDestination(c: TwoFactorChannelDTO): string {
  if (c.delivery === "EMAIL" && c.email) {
    const [u, d] = c.email.split("@");
    if (!d) return c.email;
    return `${u.length <= 2 ? u : `${u.slice(0, 2)}…`}@${d}`;
  }
  if (c.phone) {
    const d = c.phone.replace(/\D/g, "");
    if (d.length <= 4) return c.phone;
    return `…${d.slice(-4)}`;
  }
  return "—";
}

function deliveryLabel(d: string): string {
  if (d === "EMAIL") return "Email";
  if (d === "SMS") return "Text message";
  if (d === "VOICE") return "Phone call";
  return d;
}

export const TwoFactorPanel = forwardRef<TwoFactorPanelRef, PanelProps>(function TwoFactorPanel(props, ref) {
  const settingsBase = props.settingsApiBase ?? "/api/client/settings";
  const dashboardHref = props.dashboardLinkHref ?? "/client/dashboard";
  const router = useRouter();
  const baseline = useRef({
    defaultId: props.initialDefaultChannelId,
    channelsJson: JSON.stringify(props.initialChannels),
  });

  const [channels, setChannels] = useState(props.initialChannels);
  const [draftDefaultId, setDraftDefaultId] = useState<string | null>(props.initialDefaultChannelId);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const [addDelivery, setAddDelivery] = useState<Delivery>("EMAIL");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const [footerPassword, setFooterPassword] = useState("");
  const [footerBusy, setFooterBusy] = useState(false);

  const [disablePassword, setDisablePassword] = useState("");
  const [showDisablePw, setShowDisablePw] = useState(false);
  const [disableBusy, setDisableBusy] = useState(false);
  const [showAddPw, setShowAddPw] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const footerStateRef = useRef({
    defaultChanged: false,
    deletesPending: false,
    draftDefaultId: null as string | null,
    pendingDeletes: new Set<string>(),
    footerPassword: "",
  });

  const addFlowRef = useRef({
    addEmail: "",
    addPhone: "",
    addPassword: "",
    pendingChannelId: null as string | null,
    verifyCode: "",
  });

  useEffect(() => {
    setChannels(props.initialChannels);
    setDraftDefaultId(props.initialDefaultChannelId);
    setPendingDeletes(new Set());
    setPendingChannelId(null);
    setVerifyCode("");
    setAddEmail("");
    setAddPhone("");
    setAddPassword("");
    setFooterPassword("");
    baseline.current = {
      defaultId: props.initialDefaultChannelId,
      channelsJson: JSON.stringify(props.initialChannels),
    };
  }, [props.initialChannels, props.initialDefaultChannelId]);

  const verifiedChannels = useMemo(() => channels.filter((c) => c.verified && !pendingDeletes.has(c.id)), [channels, pendingDeletes]);

  const defaultChanged =
    verifiedChannels.length > 0 && (draftDefaultId ?? null) !== (baseline.current.defaultId ?? null);

  const deletesPending = pendingDeletes.size > 0;

  const addFormDirty =
    addEmail.trim().length > 0 ||
    addPhone.trim().length > 0 ||
    addPassword.trim().length > 0 ||
    pendingChannelId !== null ||
    verifyCode.trim().length > 0;

  const dirty = defaultChanged || deletesPending || addFormDirty;

  const footerSectionDirty = defaultChanged || deletesPending;

  footerStateRef.current = {
    defaultChanged,
    deletesPending,
    draftDefaultId,
    pendingDeletes,
    footerPassword,
  };

  addFlowRef.current = {
    addEmail,
    addPhone,
    addPassword,
    pendingChannelId,
    verifyCode,
  };

  useEffect(() => {
    props.onDirtyChange?.(dirty);
  }, [dirty, props.onDirtyChange]);

  useEffect(() => {
    const blocked = footerSectionDirty && !footerPassword.trim();
    props.onFooterBlockedChange?.(blocked);
  }, [footerSectionDirty, footerPassword, props.onFooterBlockedChange]);

  const syncBaselineFromProps = useCallback(() => {
    baseline.current = {
      defaultId: props.initialDefaultChannelId,
      channelsJson: JSON.stringify(props.initialChannels),
    };
    setDraftDefaultId(props.initialDefaultChannelId);
    setPendingDeletes(new Set());
    setFooterPassword("");
  }, [props.initialChannels, props.initialDefaultChannelId]);

  useImperativeHandle(ref, () => ({
    saveFromFooter: async () => {
      const fs = footerStateRef.current;
      if (!fs.deletesPending && !fs.defaultChanged) {
        return { ok: true, applied: false };
      }
      if (!fs.footerPassword.trim()) {
        setError("Enter your account password to save sign-in method changes.");
        return { ok: false, applied: false };
      }
      setError(null);
      setOkMsg(null);
      setFooterBusy(true);
      try {
        for (const id of fs.pendingDeletes) {
          const res = await fetch(`${settingsBase}/2fa`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete_channel", password: fs.footerPassword, channelId: id }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            setError(data.error ?? "Could not remove a sign-in method.");
            return { ok: false, applied: false };
          }
        }
        if (fs.defaultChanged && fs.draftDefaultId) {
          const res = await fetch(`${settingsBase}/2fa`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "set_default_login_channel",
              password: fs.footerPassword,
              channelId: fs.draftDefaultId,
            }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            setError(data.error ?? "Could not update the default method.");
            return { ok: false, applied: false };
          }
        }
        setOkMsg("Sign-in methods updated.");
        syncBaselineFromProps();
        return { ok: true, applied: true };
      } catch {
        setError("Something went wrong. Try again.");
        return { ok: false, applied: false };
      } finally {
        setFooterBusy(false);
      }
    },
    abandonStaged: async () => {
      try {
        await fetch(`${settingsBase}/2fa`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "abandon_unverified_channels" }),
        });
      } catch {
        /* ignore */
      }
      setPendingChannelId(null);
      setVerifyCode("");
      setAddEmail("");
      setAddPhone("");
      setAddPassword("");
      setPendingDeletes(new Set());
      setDraftDefaultId(baseline.current.defaultId);
      setFooterPassword("");
      setError(null);
      setChannels(JSON.parse(baseline.current.channelsJson) as TwoFactorChannelDTO[]);
    },
    hasBlockingAddFlow: () => {
      const a = addFlowRef.current;
      return (
        a.addEmail.trim().length > 0 ||
        a.addPhone.trim().length > 0 ||
        a.addPassword.trim().length > 0 ||
        a.pendingChannelId !== null ||
        a.verifyCode.trim().length > 0
      );
    },
  }));

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setDisableBusy(true);
    try {
      const res = await fetch(`${settingsBase}/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", password: disablePassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not turn off 2FA.");
        return;
      }
      setDisablePassword("");
      setOkMsg("Two-factor authentication is off.");
      router.refresh();
    } finally {
      setDisableBusy(false);
    }
  }

  async function handleRequestAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (!addPassword.trim()) {
      setError("Enter your account password to send a verification code.");
      return;
    }
    setAddBusy(true);
    try {
      const body: Record<string, unknown> = {
        action: "request_add_channel",
        password: addPassword,
        delivery: addDelivery,
      };
      if (addDelivery === "EMAIL") body.email = addEmail.trim().toLowerCase();
      else body.phone = addPhone.trim();

      const res = await fetch(`${settingsBase}/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; channelId?: string; devPhoneMock?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not send a code.");
        return;
      }
      const newId = data.channelId ?? null;
      setPendingChannelId(newId);
      setVerifyCode("");
      if (newId) {
        setChannels((prev) => {
          if (prev.some((c) => c.id === newId)) return prev;
          return [
            ...prev,
            {
              id: newId,
              delivery: addDelivery,
              email: addDelivery === "EMAIL" ? addEmail.trim().toLowerCase() : null,
              phone: addDelivery === "EMAIL" ? null : addPhone.trim(),
              verified: false,
              isDefaultLogin: false,
            },
          ];
        });
      }
      setOkMsg(
        data.devPhoneMock
          ? "Development mode: SMS/voice was not sent. Your 6-digit code is in the terminal running the dev server—enter it below."
          : "Check your email or phone for a 6-digit code.",
      );
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleConfirmAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pendingChannelId || !/^\d{6}$/.test(verifyCode)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setAddBusy(true);
    try {
      const res = await fetch(`${settingsBase}/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_add_channel", channelId: pendingChannelId, code: verifyCode }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      setPendingChannelId(null);
      setVerifyCode("");
      setAddEmail("");
      setAddPhone("");
      setAddPassword("");
      setOkMsg("Sign-in method added.");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleCancelVerify() {
    setError(null);
    setOkMsg(null);
    setAddBusy(true);
    try {
      await fetch(`${settingsBase}/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abandon_unverified_channels" }),
      });
    } catch {
      /* still reset UI */
    }
    setPendingChannelId(null);
    setVerifyCode("");
    setAddBusy(false);
    router.refresh();
  }

  async function handleResendVerify() {
    if (!pendingChannelId || !addPassword.trim()) {
      setError("Enter your password, then resend the code.");
      return;
    }
    setAddBusy(true);
    setError(null);
    try {
      const res = await fetch(`${settingsBase}/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend_channel_verify",
          password: addPassword,
          channelId: pendingChannelId,
        }),
      });
      const data = (await res.json()) as { error?: string; devPhoneMock?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not resend.");
        return;
      }
      setOkMsg(
        data.devPhoneMock
          ? "Development mode: new code printed in the dev server terminal (SMS/voice not sent)."
          : "A new code has been sent.",
      );
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setAddBusy(false);
    }
  }

  function togglePendingDelete(id: string) {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const shell = props.unstyled
    ? "space-y-4"
    : "rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8";

  return (
    <div className={shell}>
      {props.unstyled ? null : (
        <>
          <h2 className="text-lg font-black tracking-tight text-white">Two-Factor Authentication</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Add email addresses or phone numbers and choose how each receives codes (email, text, or call). One verified
            method is your default for signing in. Codes use your configured delivery providers in production.
          </p>
        </>
      )}

      {error ? (
        <p className="mt-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {okMsg}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        <p className="text-sm text-white/60">
          Status:{" "}
          <span className="font-semibold text-white">{props.twoFactorEnabled ? "On" : "Off"}</span>
          {verifiedChannels.length ? (
            <span className="text-white/45"> · {verifiedChannels.length} verified method(s)</span>
          ) : null}
        </p>

        {channels.length > 0 ? (
          <ul className="space-y-2">
            {channels.map((c) => {
              const staged = pendingDeletes.has(c.id);
              const isDefault = c.isDefaultLogin && c.verified;
              return (
                <li
                  key={c.id}
                  className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    staged ? "border-amber-500/40 bg-amber-500/5 opacity-70" : "border-white/10 bg-[#0E1016]/80"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {deliveryLabel(c.delivery)} · {maskDestination(c)}
                    </p>
                    <p className="text-xs text-white/45">
                      {c.verified ? (isDefault ? "Default for sign-in" : "Verified") : "Awaiting verification"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {c.verified ? (
                      <>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
                          <input
                            type="radio"
                            name="def2fa"
                            checked={draftDefaultId === c.id}
                            disabled={staged || footerBusy}
                            onChange={() => setDraftDefaultId(c.id)}
                            className="accent-[#FF7E00]"
                          />
                          Default
                        </label>
                        <button
                          type="button"
                          disabled={footerBusy}
                          onClick={() => togglePendingDelete(c.id)}
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            staged ? "text-amber-200 hover:text-amber-100" : "text-white/45 hover:text-white/70"
                          }`}
                        >
                          {staged ? "Undo remove" : "Mark to remove"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/45">No sign-in methods yet. Add one below.</p>
        )}
      </div>

      {footerSectionDirty && !addFormDirty ? (
        <div className="mt-6 border-t border-white/10 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Account password</p>
          <input
            type="password"
            autoComplete="current-password"
            value={footerPassword}
            onChange={(e) => setFooterPassword(e.target.value)}
            disabled={footerBusy}
            placeholder="Required to save changes above"
            className={`${inputClass} mt-2`}
          />
        </div>
      ) : null}

      <div className="mt-8 border-t border-white/10 pt-8">
        <h3 className="text-sm font-black uppercase tracking-wide text-white/70">Add Sign-In Method</h3>
        <p className="mt-2 text-sm text-white/50">
          Choose how the code is delivered, enter the destination, then confirm with your account password.
        </p>

        {pendingChannelId ? (
          <form onSubmit={handleConfirmAdd} className="mt-4 space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="ch-verify" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                6-digit code
              </label>
              <input
                id="ch-verify"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={addBusy || verifyCode.length !== 6}
                className="group relative isolate flex min-h-[3rem] flex-1 items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                />
                <span className="relative">{addBusy ? "Verifying…" : "Verify & Add"}</span>
              </button>
              <button
                type="button"
                disabled={addBusy}
                onClick={() => void handleResendVerify()}
                className="min-h-[3rem] flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
            <button
              type="button"
              disabled={addBusy}
              onClick={() => void handleCancelVerify()}
              className="text-xs font-semibold uppercase tracking-wide text-white/40 hover:text-white/65"
            >
              Cancel
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestAdd} className="mt-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Delivery</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { id: "EMAIL" as const, label: "Email" },
                  { id: "SMS" as const, label: "Text message" },
                  { id: "VOICE" as const, label: "Phone call" },
                ] as const
              ).map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                    addDelivery === c.id ? "border-[#FF7E00]/60 bg-[#FF7E00]/10" : "border-white/10 bg-[#0E1016]"
                  }`}
                >
                  <input
                    type="radio"
                    name="addDel"
                    checked={addDelivery === c.id}
                    onChange={() => setAddDelivery(c.id)}
                    className="accent-[#FF7E00]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {addDelivery === "EMAIL" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="add-em" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Email address
                </label>
                <input
                  id="add-em"
                  type="email"
                  autoComplete="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="add-ph" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Phone number
                </label>
                <input
                  id="add-ph"
                  type="tel"
                  autoComplete="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className={inputClass}
                  placeholder="+1 mobile number"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="add-pw" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Account password
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
                  onClick={() => setShowAddPw((s) => !s)}
                >
                  {showAddPw ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="add-pw"
                type={showAddPw ? "text" : "password"}
                autoComplete="current-password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={addBusy}
              className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
              />
              <span className="relative">{addBusy ? "Sending…" : "Send Verification Code"}</span>
            </button>
          </form>
        )}
      </div>

      {props.twoFactorEnabled ? (
        <form onSubmit={handleDisable} className="mt-10 border-t border-white/10 pt-8">
          <h3 className="text-sm font-black uppercase tracking-wide text-white/70">Turn Off 2FA</h3>
          <p className="mt-2 text-xs text-white/45">Removes every sign-in method and turns off two-factor authentication.</p>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="disable-pw" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Password
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
                onClick={() => setShowDisablePw((s) => !s)}
              >
                {showDisablePw ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="disable-pw"
              type={showDisablePw ? "text" : "password"}
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={disableBusy}
            className="mt-4 min-h-[3rem] w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {disableBusy ? "Please wait…" : "Turn Off Two-Factor Authentication"}
          </button>
        </form>
      ) : null}

      {!props.unstyled ? (
        <p className="mt-8 text-sm">
          <Link href={dashboardHref} className="text-[#FF7E00] underline-offset-2 hover:underline">
            Back to Dashboard
          </Link>
        </p>
      ) : null}
    </div>
  );
});

TwoFactorPanel.displayName = "TwoFactorPanel";
