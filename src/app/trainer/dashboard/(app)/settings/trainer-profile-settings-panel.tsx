"use client";

import { FormEvent, forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleSettingsSection } from "@/components/client/collapsible-settings-section";
import { assertAvatarMime, AVATAR_MAX_BYTES } from "@/lib/validations/client-settings-profile";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

export type TrainerSettingsProfile = {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  email: string;
  phone: string;
  username: string;
  pronouns: string | null;
  ethnicity: string | null;
  languagesSpoken: string | null;
  fitnessNiches: string | null;
  yearsCoaching: string | null;
  genderIdentity: string | null;
  socialInstagram: string | null;
  socialTiktok: string | null;
  socialFacebook: string | null;
  socialLinkedin: string | null;
  socialOtherUrl: string | null;
};

export type TrainerProfileSettingsPanelRef = {
  saveProfileFromFooter: () => Promise<boolean>;
};

type PanelProps = {
  initialProfile: TrainerSettingsProfile;
  footerSaveMode?: boolean;
  onProfileDirtyChange?: (dirty: boolean) => void;
};

function serializeCoachDraft(p: {
  firstName: string;
  lastName: string;
  preferredName: string;
  bio: string;
  pronouns: string;
  ethnicity: string;
  languagesSpoken: string;
  fitnessNiches: string;
  yearsCoaching: string;
  genderIdentity: string;
  socialInstagram: string;
  socialTiktok: string;
  socialFacebook: string;
  socialLinkedin: string;
  socialOtherUrl: string;
}) {
  return JSON.stringify({
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    preferredName: p.preferredName.trim(),
    bio: p.bio.trim(),
    pronouns: p.pronouns.trim(),
    ethnicity: p.ethnicity.trim(),
    languagesSpoken: p.languagesSpoken.trim(),
    fitnessNiches: p.fitnessNiches.trim(),
    yearsCoaching: p.yearsCoaching.trim(),
    genderIdentity: p.genderIdentity.trim(),
    socialInstagram: p.socialInstagram.trim(),
    socialTiktok: p.socialTiktok.trim(),
    socialFacebook: p.socialFacebook.trim(),
    socialLinkedin: p.socialLinkedin.trim(),
    socialOtherUrl: p.socialOtherUrl.trim(),
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

export const TrainerProfileSettingsPanel = forwardRef<TrainerProfileSettingsPanelRef, PanelProps>(
  function TrainerProfileSettingsPanel(props, ref) {
    const { initialProfile, footerSaveMode, onProfileDirtyChange } = props;
    const router = useRouter();
    const [profile, setProfile] = useState(initialProfile);
    const [avatarNonce, setAvatarNonce] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [okMsg, setOkMsg] = useState<string | null>(null);

    const [firstName, setFirstName] = useState(profile.firstName);
    const [lastName, setLastName] = useState(profile.lastName);
    const [preferredName, setPreferredName] = useState(profile.preferredName ?? "");
    const [bio, setBio] = useState(profile.bio ?? "");
    const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
    const [ethnicity, setEthnicity] = useState(profile.ethnicity ?? "");
    const [languagesSpoken, setLanguagesSpoken] = useState(profile.languagesSpoken ?? "");
    const [fitnessNiches, setFitnessNiches] = useState(profile.fitnessNiches ?? "");
    const [yearsCoaching, setYearsCoaching] = useState(profile.yearsCoaching ?? "");
    const [genderIdentity, setGenderIdentity] = useState(profile.genderIdentity ?? "");
    const [socialInstagram, setSocialInstagram] = useState(profile.socialInstagram ?? "");
    const [socialTiktok, setSocialTiktok] = useState(profile.socialTiktok ?? "");
    const [socialFacebook, setSocialFacebook] = useState(profile.socialFacebook ?? "");
    const [socialLinkedin, setSocialLinkedin] = useState(profile.socialLinkedin ?? "");
    const [socialOtherUrl, setSocialOtherUrl] = useState(profile.socialOtherUrl ?? "");

    const [baselineStr, setBaselineStr] = useState(() =>
      serializeCoachDraft({
        firstName: profile.firstName,
        lastName: profile.lastName,
        preferredName: profile.preferredName ?? "",
        bio: profile.bio ?? "",
        pronouns: profile.pronouns ?? "",
        ethnicity: profile.ethnicity ?? "",
        languagesSpoken: profile.languagesSpoken ?? "",
        fitnessNiches: profile.fitnessNiches ?? "",
        yearsCoaching: profile.yearsCoaching ?? "",
        genderIdentity: profile.genderIdentity ?? "",
        socialInstagram: profile.socialInstagram ?? "",
        socialTiktok: profile.socialTiktok ?? "",
        socialFacebook: profile.socialFacebook ?? "",
        socialLinkedin: profile.socialLinkedin ?? "",
        socialOtherUrl: profile.socialOtherUrl ?? "",
      }),
    );

    const [username, setUsername] = useState(profile.username);
    const [usernamePassword, setUsernamePassword] = useState("");

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

    const draftSerialized = serializeCoachDraft({
      firstName,
      lastName,
      preferredName,
      bio,
      pronouns,
      ethnicity,
      languagesSpoken,
      fitnessNiches,
      yearsCoaching,
      genderIdentity,
      socialInstagram,
      socialTiktok,
      socialFacebook,
      socialLinkedin,
      socialOtherUrl,
    });

    const fieldsDirty = draftSerialized !== baselineStr;
    const sectionDirty = fieldsDirty || pendingAvatarFile !== null;

    useEffect(() => {
      onProfileDirtyChange?.(sectionDirty);
    }, [sectionDirty, onProfileDirtyChange]);

    async function persistProfileToApi(): Promise<boolean> {
      setError(null);
      setOkMsg(null);
      try {
        const res = await fetch("/api/trainer/settings/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            preferredName,
            bio,
            pronouns,
            ethnicity,
            languagesSpoken,
            fitnessNiches,
            yearsCoaching,
            genderIdentity,
            socialInstagram,
            socialTiktok,
            socialFacebook,
            socialLinkedin,
            socialOtherUrl,
          }),
        });
        const data = (await res.json()) as { error?: string; profile?: TrainerSettingsProfile };
        if (!res.ok) {
          setError(data.error ?? "Could not save profile.");
          return false;
        }
        if (data.profile) {
          setProfile(data.profile);
          setOkMsg("Profile saved.");
          setBaselineStr(
            serializeCoachDraft({
              firstName: data.profile.firstName,
              lastName: data.profile.lastName,
              preferredName: data.profile.preferredName ?? "",
              bio: data.profile.bio ?? "",
              pronouns: data.profile.pronouns ?? "",
              ethnicity: data.profile.ethnicity ?? "",
              languagesSpoken: data.profile.languagesSpoken ?? "",
              fitnessNiches: data.profile.fitnessNiches ?? "",
              yearsCoaching: data.profile.yearsCoaching ?? "",
              genderIdentity: data.profile.genderIdentity ?? "",
              socialInstagram: data.profile.socialInstagram ?? "",
              socialTiktok: data.profile.socialTiktok ?? "",
              socialFacebook: data.profile.socialFacebook ?? "",
              socialLinkedin: data.profile.socialLinkedin ?? "",
              socialOtherUrl: data.profile.socialOtherUrl ?? "",
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
          if (!fieldsDirty && !pendingAvatarFile) return true;
          setError(null);
          setOkMsg(null);
          setBusy(true);
          try {
            if (pendingAvatarFile) {
              const fd = new FormData();
              fd.set("file", pendingAvatarFile);
              const res = await fetch("/api/trainer/settings/avatar", { method: "POST", body: fd });
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
            if (fieldsDirty) {
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
      [draftSerialized, fieldsDirty, pendingAvatarFile],
    );

    async function handleProfileSave(e: FormEvent) {
      e.preventDefault();
      if (footerSaveMode) return;
      setBusy(true);
      try {
        if (pendingAvatarFile) {
          const fd = new FormData();
          fd.set("file", pendingAvatarFile);
          const res = await fetch("/api/trainer/settings/avatar", { method: "POST", body: fd });
          const data = (await res.json()) as { error?: string; profileImageUrl?: string };
          if (!res.ok) {
            setError(data.error ?? "Could not upload photo.");
            return;
          }
          if (data.profileImageUrl) {
            setProfile((p) => ({ ...p, profileImageUrl: data.profileImageUrl! }));
            setAvatarNonce((n) => n + 1);
          }
          setPendingAvatarFile(null);
        }
        if (fieldsDirty) {
          const ok = await persistProfileToApi();
          if (!ok) return;
        }
        router.refresh();
      } finally {
        setBusy(false);
      }
    }

    async function submitUsernameChange() {
      setError(null);
      setOkMsg(null);
      setBusy(true);
      try {
        const res = await fetch("/api/trainer/settings/username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, currentPassword: usernamePassword }),
        });
        const data = (await res.json()) as { error?: string; username?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not update username.");
          return;
        }
        setUsernamePassword("");
        setOkMsg("Username updated.");
        if (data.username) setUsername(data.username);
        setProfile((p) => ({ ...p, username: data.username ?? p.username }));
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setBusy(false);
      }
    }

    const displayImg = avatarPreviewUrl ?? profile.profileImageUrl;
    const imgSrc = displayImg
      ? avatarPreviewUrl
        ? displayImg
        : `${displayImg.split("?")[0]}?v=${avatarNonce}`
      : null;

    return (
      <div className="space-y-6">
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
          title="Coach Profile & Sign-Up Details"
          description="What you entered when joining Match Fit—names, photo, bio, and how clients find you."
          defaultOpen
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Profile Photo</p>
                <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-[#0E1016]">
                  {imgSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob preview or stored avatar URL
                    <img src={imgSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-white/35">
                      {(firstName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <label className="mt-3 inline-block cursor-pointer text-xs font-semibold uppercase tracking-wide text-[#FF7E00] hover:text-[#FF9E40]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      setError(null);
                      setOkMsg(null);
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > AVATAR_MAX_BYTES) {
                        setError(`Image must be ${Math.round(AVATAR_MAX_BYTES / (1024 * 1024))} MB or smaller.`);
                        return;
                      }
                      try {
                        assertAvatarMime(f.type);
                      } catch (ex) {
                        setError(ex instanceof Error ? ex.message : "Invalid image.");
                        return;
                      }
                      setPendingAvatarFile(f);
                    }}
                  />
                  Change Photo
                </label>
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="tr-fn" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      First Name
                    </label>
                    <input
                      id="tr-fn"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                      disabled={busy}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="tr-ln" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Last Name
                    </label>
                    <input
                      id="tr-ln"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                      disabled={busy}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="tr-pref" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Preferred Name <span className="text-white/35">(Optional)</span>
                  </label>
                  <input
                    id="tr-pref"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="tr-bio" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Bio
                  </label>
                  <textarea
                    id="tr-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className={`${inputClass} min-h-[6rem] resize-y`}
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/60 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Email</p>
                    <p className="mt-1 text-sm text-white/80">{profile.email}</p>
                    <p className="mt-1 text-xs text-white/40">Contact support to change your sign-in email.</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Phone</p>
                    <p className="mt-1 text-sm text-white/80">{profile.phone}</p>
                    <p className="mt-1 text-xs text-white/40">Contact support to change your phone on file.</p>
                  </div>
                </div>
              </div>
            </div>

            <form
              className="border-t border-white/[0.08] pt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void submitUsernameChange();
              }}
            >
              <h3 className="text-sm font-black uppercase tracking-wide text-white/70">Username</h3>
              <p className="mt-1 text-xs text-white/45">Changing your username takes effect immediately after you confirm.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="tr-user" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    Username
                  </label>
                  <input
                    id="tr-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                    autoComplete="username"
                  />
                </div>
                <PasswordField
                  id="tr-user-pw"
                  label="Current Password"
                  autoComplete="current-password"
                  value={usernamePassword}
                  onChange={setUsernamePassword}
                  disabled={busy}
                />
              </div>
              <button
                type="submit"
                disabled={busy || username === profile.username || !usernamePassword}
                className="mt-4 min-h-[2.75rem] rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:opacity-40"
              >
                Update Username
              </button>
            </form>

            {footerSaveMode ? null : (
              <button
                type="button"
                disabled={busy || (!fieldsDirty && !pendingAvatarFile)}
                onClick={() => void handleProfileSave({ preventDefault: () => {} } as FormEvent)}
                className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50 sm:w-auto"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                />
                <span className="relative">{busy ? "Saving…" : "Save Profile"}</span>
              </button>
            )}
          </div>
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Background & Visibility"
          description="Optional details for inclusion and matching. You can update these anytime."
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-pro" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Pronouns
                </label>
                <input
                  id="tr-pro"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  className={inputClass}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-eth" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Ethnicity
                </label>
                <input
                  id="tr-eth"
                  value={ethnicity}
                  onChange={(e) => setEthnicity(e.target.value)}
                  className={inputClass}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tr-lang" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Languages Spoken
              </label>
              <input
                id="tr-lang"
                value={languagesSpoken}
                onChange={(e) => setLanguagesSpoken(e.target.value)}
                className={inputClass}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tr-niche" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Fitness Niches
              </label>
              <textarea
                id="tr-niche"
                value={fitnessNiches}
                onChange={(e) => setFitnessNiches(e.target.value)}
                rows={3}
                className={`${inputClass} min-h-[5rem] resize-y`}
                disabled={busy}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-years" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Years of Coaching
                </label>
                <input
                  id="tr-years"
                  value={yearsCoaching}
                  onChange={(e) => setYearsCoaching(e.target.value)}
                  className={inputClass}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="tr-gen" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  Gender Identity
                </label>
                <input
                  id="tr-gen"
                  value={genderIdentity}
                  onChange={(e) => setGenderIdentity(e.target.value)}
                  className={inputClass}
                  disabled={busy}
                />
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Social Links</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["Instagram", socialInstagram, setSocialInstagram, "tr-ig"],
                  ["TikTok", socialTiktok, setSocialTiktok, "tr-tt"],
                  ["Facebook", socialFacebook, setSocialFacebook, "tr-fb"],
                  ["LinkedIn", socialLinkedin, setSocialLinkedin, "tr-li"],
                ] as const
              ).map(([label, val, setVal, id]) => (
                <div key={id} className="flex flex-col gap-2">
                  <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-white/50">
                    {label}
                  </label>
                  <input id={id} value={val} onChange={(e) => setVal(e.target.value)} className={inputClass} disabled={busy} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tr-other" className="text-xs font-semibold uppercase tracking-wide text-white/50">
                Other Link
              </label>
              <input
                id="tr-other"
                value={socialOtherUrl}
                onChange={(e) => setSocialOtherUrl(e.target.value)}
                className={inputClass}
                disabled={busy}
                placeholder="https://"
              />
            </div>
            {footerSaveMode ? null : (
              <button
                type="button"
                disabled={busy || !fieldsDirty}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const ok = await persistProfileToApi();
                    if (ok) router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="group relative isolate flex min-h-[3rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50 sm:w-auto"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]"
                />
                <span className="relative">{busy ? "Saving…" : "Save Details"}</span>
              </button>
            )}
          </div>
        </CollapsibleSettingsSection>
      </div>
    );
  },
);

TrainerProfileSettingsPanel.displayName = "TrainerProfileSettingsPanel";
