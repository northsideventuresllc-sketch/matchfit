"use client";

import { useCallback, useState } from "react";
import { parseTrainerSocialUrl, type TrainerSocialPlatform } from "@/lib/trainer-social-urls";
import { TrainerSocialBrandIcon, TrainerSocialBrandStrip } from "@/components/trainer/trainer-social-brand-icons";

export type TrainerSocialUrlFieldIds = {
  instagram: string;
  tiktok: string;
  facebook: string;
  linkedin: string;
  other: string;
};

type Row = {
  platform: Exclude<TrainerSocialPlatform, "other">;
  label: string;
  placeholder: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
};

type Props = {
  socialInstagram: string;
  socialTiktok: string;
  socialFacebook: string;
  socialLinkedin: string;
  socialOtherUrl: string;
  onSocialInstagram: (v: string) => void;
  onSocialTiktok: (v: string) => void;
  onSocialFacebook: (v: string) => void;
  onSocialLinkedin: (v: string) => void;
  onSocialOtherUrl: (v: string) => void;
  ids: TrainerSocialUrlFieldIds;
  inputClassName: string;
  disabled?: boolean;
  /** Optional section title (e.g. “Social Links”) — omit if parent renders it. */
  showSectionTitle?: boolean;
};

function fieldKey(platform: TrainerSocialPlatform): keyof Pick<
  Props,
  | "socialInstagram"
  | "socialTiktok"
  | "socialFacebook"
  | "socialLinkedin"
  | "socialOtherUrl"
> {
  switch (platform) {
    case "instagram":
      return "socialInstagram";
    case "tiktok":
      return "socialTiktok";
    case "facebook":
      return "socialFacebook";
    case "linkedin":
      return "socialLinkedin";
    default:
      return "socialOtherUrl";
  }
}

export function TrainerSocialUrlFields(props: Props) {
  const [blurErrors, setBlurErrors] = useState<Partial<Record<string, string>>>({});

  const clearError = useCallback((key: string) => {
    setBlurErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const onBlurField = useCallback((platform: TrainerSocialPlatform, value: string) => {
    const key = platform === "other" ? "socialOtherUrl" : fieldKey(platform);
    const r = parseTrainerSocialUrl(platform, value);
    if (!r.ok) {
      setBlurErrors((prev) => ({ ...prev, [key]: r.error }));
      return;
    }
    setBlurErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const rows: Row[] = [
    {
      platform: "instagram",
      label: "Instagram",
      placeholder: "https://www.instagram.com/yourname or @yourname",
      id: props.ids.instagram,
      value: props.socialInstagram,
      onChange: props.onSocialInstagram,
    },
    {
      platform: "tiktok",
      label: "TikTok",
      placeholder: "https://www.tiktok.com/@yourname or @yourname",
      id: props.ids.tiktok,
      value: props.socialTiktok,
      onChange: props.onSocialTiktok,
    },
    {
      platform: "facebook",
      label: "Facebook",
      placeholder: "https://www.facebook.com/your.profile",
      id: props.ids.facebook,
      value: props.socialFacebook,
      onChange: props.onSocialFacebook,
    },
    {
      platform: "linkedin",
      label: "LinkedIn",
      placeholder: "https://www.linkedin.com/in/your-profile",
      id: props.ids.linkedin,
      value: props.socialLinkedin,
      onChange: props.onSocialLinkedin,
    },
  ];

  const iconWrap =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-[#0E1016]/90";

  return (
    <div className="space-y-4">
      {props.showSectionTitle ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Social Links</p>
      ) : null}
      <TrainerSocialBrandStrip />
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => {
          const errKey = fieldKey(row.platform);
          return (
            <div key={row.id} className="flex min-w-0 items-start gap-2 sm:gap-3">
              <span className={iconWrap} aria-hidden title={row.label}>
                <TrainerSocialBrandIcon platform={row.platform} className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor={row.id} className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  {row.label}
                </label>
                <input
                  id={row.id}
                  value={row.value}
                  disabled={props.disabled}
                  placeholder={row.placeholder}
                  onChange={(e) => {
                    clearError(errKey);
                    row.onChange(e.target.value);
                  }}
                  onBlur={() => onBlurField(row.platform, row.value)}
                  className={`mt-2 ${props.inputClassName}`}
                />
                {blurErrors[errKey] ? (
                  <p className="mt-1 text-xs text-[#FFB4B4]" role="alert">
                    {blurErrors[errKey]}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="flex min-w-0 items-start gap-2 sm:col-span-2 sm:gap-3">
          <span
            className={`${iconWrap} flex items-center justify-center text-[10px] font-black uppercase tracking-wide text-white/50`}
            aria-hidden
            title="Other link"
          >
            URL
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor={props.ids.other} className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Other Link
            </label>
            <input
              id={props.ids.other}
              value={props.socialOtherUrl}
              disabled={props.disabled}
              placeholder="https://your-site.com or Linktree"
              onChange={(e) => {
                clearError("socialOtherUrl");
                props.onSocialOtherUrl(e.target.value);
              }}
              onBlur={() => onBlurField("other", props.socialOtherUrl)}
              className={`mt-2 ${props.inputClassName}`}
            />
            {blurErrors.socialOtherUrl ? (
              <p className="mt-1 text-xs text-[#FFB4B4]" role="alert">
                {blurErrors.socialOtherUrl}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
