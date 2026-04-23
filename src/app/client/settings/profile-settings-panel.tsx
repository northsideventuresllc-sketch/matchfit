"use client";

import { FormEvent, forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleSettingsSection } from "@/components/client/collapsible-settings-section";
import { assertAvatarMime, AVATAR_MAX_BYTES } from "@/lib/validations/client-settings-profile";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export type ClientSettingsProfile = {
  firstName: string;
  lastName: string;
  preferredName: string;
  bio: string | null;
  profileImageUrl: string | null;
  email: string;
  phone: string;
  username: string;
  usernameChangedAt: string | null;
  pendingEmail: string | null;
  pendingPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostal: string | null;
  addressCountry: string | null;
  nextUsernameChangeAt: string | null;
};

export type ProfileSettingsPanelRef = {
  saveProfileFromFooter: () => Promise<boolean>;
};

type PanelProps = {
  initialProfile: ClientSettingsProfile;
  footerSaveMode?: boolean;
  onProfileDirtyChange?: (dirty: boolean) => void;
  onProfileFooterBlockedChange?: (blocked: boolean) => void;
};

function serializeProfileDraft(p: {
  firstName: string;
  lastName: string;
  preferredName: string;
  bio: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostal: string;
  addressCountry: string;
}) {
  return JSON.stringify({
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    preferredName: p.preferredName.trim(),
    bio: p.bio.trim(),
    addressLine1: p.addressLine1.trim(),
    addressLine2: p.addressLine2.trim(),
    addressCity: p.addressCity.trim(),
    addressState: p.addressState.trim(),
    addressPostal: p.addressPostal.trim(),
    addressCountry: p.addressCountry.trim(),
  });
}

function PasswordField(props: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={props.id} className="text-xs font-semibold uppercase tracking-wide text-white/50">
          {props.label}
        </label>
        <button
          type="button"
          className="text-xs font-semibold text-[#FF7E00]/90 hover:text-[#FF7E00]"
          onClick={() => setShow((s) => !s)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <input
        id={props.id}
        type={show ? "text" : "password"}
        autoComplete={props.autoComplete}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

export const ProfileSettingsPanel = forwardRef<ProfileSettingsPanelRef, PanelProps>(function ProfileSettingsPanel(
  props,
  ref,
) {
  const { initialProfile, footerSaveMode, onProfileDirtyChange, onProfileFooterBlockedChange } = props;
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [avatarNonce, setAvatarNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [preferredName, setPreferredName] = useState(profile.preferredName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [addressLine1, setAddressLine1] = useState(profile.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile.addressLine2 ?? "");
  const [addressCity, setAddressCity] = useState(profile.addressCity ?? "");
  const [addressState, setAddressState] = useState(profile.addressState ?? "");
  const [addressPostal, setAddressPostal] = useState(profile.addressPostal ?? "");
  const [addressCountry, setAddressCountry] = useState(profile.addressCountry ?? "");

  const [profileBaselineStr, setProfileBaselineStr] = useState(() =>
    serializeProfileDraft({
      firstName: profile.firstName,
      lastName: profile.lastName,
      preferredName: profile.preferredName,
      bio: profile.bio ?? "",
      addressLine1: profile.addressLine1 ?? "",
      addressLine2: profile.addressLine2 ?? "",
      addressCity: profile.addressCity ?? "",
      addressState: profile.addressState ?? "",
      addressPostal: profile.addressPostal ?? "",
      addressCountry: profile.addressCountry ?? "",
    }),
  );

  const [username, setUsername] = useState(profile.username);
  const [usernamePassword, setUsernamePassword] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [newPhone, setNewPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phonePhase, setPhonePhase] = useState<"idle" | "code">(initialProfile.pendingPhone ? "code" : "idle");
  const [phoneCode, setPhoneCode] = useState("");

  /** Staged until footer "Save Changes" uploads to `/api/client/settings/avatar`. */
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const avatarPreviewUrl = useMemo(
    () => (pendingAvatarFile ? URL.createObjectURL(pendingAvatarFile) : null),
    [pendingAvatarFile],
  );
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!profile.nextUsernameChangeAt) {
        setUsernameHint(null);
        return;
      }
      const next = new Date(profile.nextUsernameChangeAt);
      if (Number.isNaN(next.getTime())) {
        setUsernameHint(null);
        return;
      }
      const refresh = () => {
        if (next.getTime() <= Date.now()) setUsernameHint(null);
        else setUsernameHint(`You can change your username again after ${next.toLocaleString()}.`);
      };
      refresh();
      intervalId = window.setInterval(refresh, 60_000);
    });
    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [profile.nextUsernameChangeAt]);

  const draftSerialized = serializeProfileDraft({
    firstName,
    lastName,
    preferredName,
    bio,
    addressLine1,
    addressLine2,
    addressCity,
    addressState,
    addressPostal,
    addressCountry,
  });

  const profileFieldsDirty = draftSerialized !== profileBaselineStr;
  const profileSectionDirty = profileFieldsDirty || pendingAvatarFile !== null;

  useEffect(() => {
    onProfileDirtyChange?.(profileSectionDirty);
  }, [profileSectionDirty, onProfileDirtyChange]);

  useEffect(() => {
    onProfileFooterBlockedChange?.(false);
  }, [onProfileFooterBlockedChange]);

  async function refreshProfile() {
    const res = await fetch("/api/client/settings/profile");
    const data = (await res.json()) as { profile?: ClientSettingsProfile; error?: string };
    if (res.ok && data.profile) {
      setProfile(data.profile);
      setFirstName(data.profile.firstName);
      setLastName(data.profile.lastName);
      setPreferredName(data.profile.preferredName);
      setBio(data.profile.bio ?? "");
      setUsername(data.profile.username);
      setAddressLine1(data.profile.addressLine1 ?? "");
      setAddressLine2(data.profile.addressLine2 ?? "");
      setAddressCity(data.profile.addressCity ?? "");
      setAddressState(data.profile.addressState ?? "");
      setAddressPostal(data.profile.addressPostal ?? "");
      setAddressCountry(data.profile.addressCountry ?? "");
      setProfileBaselineStr(
        serializeProfileDraft({
          firstName: data.profile.firstName,
          lastName: data.profile.lastName,
          preferredName: data.profile.preferredName,
          bio: data.profile.bio ?? "",
          addressLine1: data.profile.addressLine1 ?? "",
          addressLine2: data.profile.addressLine2 ?? "",
          addressCity: data.profile.addressCity ?? "",
          addressState: data.profile.addressState ?? "",
          addressPostal: data.profile.addressPostal ?? "",
          addressCountry: data.profile.addressCountry ?? "",
        }),
      );
    }
  }

  async function persistProfileToApi(): Promise<boolean> {
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/client/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          preferredName,
          bio: bio.trim() === "" ? null : bio,
          addressLine1: addressLine1.trim() === "" ? null : addressLine1,
          addressLine2: addressLine2.trim() === "" ? null : addressLine2,
          addressCity: addressCity.trim() === "" ? null : addressCity,
          addressState: addressState.trim() === "" ? null : addressState,
          addressPostal: addressPostal.trim() === "" ? null : addressPostal,
          addressCountry: addressCountry.trim() === "" ? null : addressCountry,
        }),
      });
      const data = (await res.json()) as { error?: string; profile?: ClientSettingsProfile };
      if (!res.ok) {
        setError(data.error ?? "Could not save profile.");
        return false;
      }
      if (data.profile) {
        setProfile(data.profile);
        setOkMsg("Profile saved.");
        setProfileBaselineStr(
          serializeProfileDraft({
            firstName: data.profile.firstName,
            lastName: data.profile.lastName,
            preferredName: data.profile.preferredName,
            bio: data.profile.bio ?? "",
            addressLine1: data.profile.addressLine1 ?? "",
            addressLine2: data.profile.addressLine2 ?? "",
            addressCity: data.profile.addressCity ?? "",
            addressState: data.profile.addressState ?? "",
            addressPostal: data.profile.addressPostal ?? "",
            addressCountry: data.profile.addressCountry ?? "",
          }),
        );
      }
      return true;
    } catch {
      setError("Something went wrong. Try again.");
      return false;
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      saveProfileFromFooter: async () => {
        if (!profileFieldsDirty && !pendingAvatarFile) return true;
        setError(null);
        setOkMsg(null);
        setBusy(true);
        try {
          if (pendingAvatarFile) {
            const fd = new FormData();
            fd.set("file", pendingAvatarFile);
            const res = await fetch("/api/client/settings/avatar", { method: "POST", body: fd });
            const data = (await res.json()) as { error?: string; profileImageUrl?: string };
            if (!res.ok) {
              setError(data.error ?? "Could not upload photo.");
              return false;
            }
            if (data.profileImageUrl) {
              setProfile((p) => ({ ...p, profileImageUrl: data.profileImageUrl! }));
              setAvatarNonce((n) => n + 1);
            }
            setPendingAvatarFile(null);
          }
          if (profileFieldsDirty) {
            const ok = await persistProfileToApi();
            if (!ok) return false;
          }
          return true;
        } catch {
          setError("Something went wrong. Try again.");
          return false;
        } finally {
          setBusy(false);
        }
      },
    }),
    // persistProfileToApi / profileFieldsDirty are read from the latest closure when deps change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftSerialized, pendingAvatarFile],
  );

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (footerSaveMode) return;
    setBusy(true);
    try {
      const ok = await persistProfileToApi();
      if (ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUsername(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, currentPassword: usernamePassword }),
      });
      const data = (await res.json()) as { error?: string; nextUsernameChangeAt?: string; username?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update username.");
        return;
      }
      setUsernamePassword("");
      setOkMsg("Username updated.");
      await refreshProfile();
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailStart(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/email-change/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword: emailPassword }),
      });
      const data = (await res.json()) as { error?: string; pendingEmail?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not start email change.");
        return;
      }
      setEmailPassword("");
      setNewEmail("");
      setOkMsg(`Confirmation link sent to ${data.pendingEmail ?? "your new email"}.`);
      await refreshProfile();
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoneStart(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/phone-change/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPhone, currentPassword: phonePassword }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not start phone change.");
        return;
      }
      setPhonePassword("");
      setPhonePhase("code");
      setPhoneCode("");
      setOkMsg(data.message ?? "Check your phone or email for a code.");
      await refreshProfile();
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoneComplete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/client/settings/phone-change/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: phoneCode }),
      });
      const data = (await res.json()) as { error?: string; phone?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update phone.");
        return;
      }
      setPhonePhase("idle");
      setNewPhone("");
      setPhoneCode("");
      setOkMsg("Phone number updated.");
      await refreshProfile();
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarSelect(file: File | null) {
    if (!file) return;
    setError(null);
    setOkMsg(null);
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Image must be 2 MB or smaller.");
      return;
    }
    try {
      assertAvatarMime(file.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid image type.");
      return;
    }
    setPendingAvatarFile(file);
    setOkMsg("Photo selected — use Save Changes at the bottom of the page to upload it.");
  }

  const avatarSrc = profile.profileImageUrl
    ? `${profile.profileImageUrl.split("?")[0]}?v=${avatarNonce}`
    : "";

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {okMsg}
        </p>
      ) : null}

      <CollapsibleSettingsSection
        title="Profile Picture"
        description="Upload or replace the image shown on your dashboard and account menu. Use a clear, square-friendly photo when you can."
        defaultOpen={false}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0E1016]">
            {avatarPreviewUrl || avatarSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- preview blob or stored avatar URL */}
                <img
                  src={avatarPreviewUrl ?? avatarSrc}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/35">No photo</div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Image file</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className="mt-2 block w-full max-w-xs text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              onChange={(e) => handleAvatarSelect(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-white/40">
              JPEG, PNG, or WebP · up to 2 MB. Upload applies when you choose Save Changes at the bottom of this page.
            </p>
          </div>
        </div>
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Name, Bio & Private Address"
        description="Update how your name appears, add a short bio, and keep a private mailing address on file. Your address is never shown to trainers or other clients."
        defaultOpen={false}
      >
        <form
          onSubmit={handleProfileSave}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="fn" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Legal first name
              </label>
              <input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ln" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Legal last name
              </label>
              <input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pn" className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Preferred name
            </label>
            <input id="pn" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className={inputClass} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`${inputClass} resize-y`}
              placeholder="A few words about your goals or training style…"
            />
          </div>

          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-black uppercase tracking-wide text-white/70">Mailing Address (Private)</h3>
            <div className="mt-4 grid gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Line 1</label>
                <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Line 2</label>
                <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputClass} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50">City</label>
                  <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50">State / region</label>
                  <input value={addressState} onChange={(e) => setAddressState(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Postal code</label>
                  <input value={addressPostal} onChange={(e) => setAddressPostal(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50">Country</label>
                  <input
                    value={addressCountry}
                    onChange={(e) => setAddressCountry(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {footerSaveMode ? null : (
            <button
              type="submit"
              disabled={busy}
              className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
            >
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
              <span className="relative">{busy ? "Saving…" : "Save Profile"}</span>
            </button>
          )}
        </form>
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Username"
        description="This is the handle you can use to sign in. You may change it at most once every seven days."
        defaultOpen={false}
      >
        <form onSubmit={handleUsername} className="space-y-4">
          {usernameHint ? <p className="text-sm text-amber-200/90">{usernameHint}</p> : null}
          <div className="flex flex-col gap-2">
            <label htmlFor="un" className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Username
            </label>
            <input id="un" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
          </div>
          <PasswordField
            id="un-cp"
            label="Current password"
            autoComplete="current-password"
            value={usernamePassword}
            onChange={setUsernamePassword}
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !usernamePassword}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Update Username"}
          </button>
        </form>
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Email"
        description="Change the email address you use to sign in and receive account notifications."
        defaultOpen={false}
      >
        <p className="text-sm text-white/55">
          Current: <span className="text-white/80">{profile.email}</span>
        </p>
        {profile.pendingEmail ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Waiting for you to confirm <strong>{profile.pendingEmail}</strong> from that inbox (link expires in one hour).
          </p>
        ) : null}
        <form onSubmit={handleEmailStart} className="mt-6 space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="ne" className="text-xs font-semibold uppercase tracking-wide text-white/50">
              New email
            </label>
            <input
              id="ne"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <PasswordField
            id="em-cp"
            label="Current password"
            autoComplete="current-password"
            value={emailPassword}
            onChange={setEmailPassword}
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !newEmail || !emailPassword}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Send Confirmation to New Email"}
          </button>
        </form>
        <p className="mt-3 text-xs text-white/40">
          We email your current address a security notice whenever a change is requested.
        </p>
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Phone"
        description="Update the phone number tied to your account for sign-in and verification messages."
        defaultOpen={false}
      >
        <p className="text-sm text-white/55">
          Current: <span className="text-white/80">{profile.phone}</span>
        </p>
        {profile.pendingPhone ? (
          <p className="mt-3 text-sm text-white/50">
            Pending change to <span className="text-white/80">{profile.pendingPhone}</span> — enter the code below to finish.
          </p>
        ) : null}

        {phonePhase === "idle" ? (
          <form onSubmit={handlePhoneStart} className="mt-6 space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="np" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                New phone
              </label>
              <input id="np" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputClass} />
            </div>
            <PasswordField
              id="ph-cp"
              label="Current password"
              autoComplete="current-password"
              value={phonePassword}
              onChange={setPhonePassword}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !newPhone || !phonePassword}
              className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneComplete} className="mt-6 space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="pc" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                6-digit code
              </label>
              <input
                id="pc"
                inputMode="numeric"
                maxLength={6}
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={busy || phoneCode.length !== 6}
              className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
            >
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
              <span className="relative">{busy ? "Updating…" : "Confirm New Phone"}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPhonePhase("idle");
                setPhoneCode("");
                setError(null);
              }}
              className="text-xs font-semibold uppercase tracking-wide text-white/45 hover:text-white/70"
            >
              Cancel
            </button>
          </form>
        )}
        <p className="mt-3 text-xs text-white/40">
          With SMS configured, the code goes to your new number; otherwise it is emailed to your current address for the same
          level of confirmation.
        </p>
      </CollapsibleSettingsSection>
    </div>
  );
});

ProfileSettingsPanel.displayName = "ProfileSettingsPanel";
