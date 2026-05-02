"use client";

import type { ReactNode } from "react";
import { LANGUAGE_LABELS } from "@/lib/trainer-match-questionnaire";
import {
  TRAINER_DEMOGRAPHY_CASE_NOTE,
  TRAINER_ETHNICITY_CHOICES,
  TRAINER_ETHNICITY_CUSTOM,
  TRAINER_ETHNICITY_PRESET_VALUES,
  trainerEthnicitySelectValue,
  TRAINER_GENDER_CHOICES,
  TRAINER_GENDER_CUSTOM,
  TRAINER_GENDER_PRESET_VALUES,
  trainerGenderSelectValue,
  TRAINER_PRONOUN_CHOICES,
  TRAINER_PRONOUN_CUSTOM,
  TRAINER_PRONOUN_PRESET_VALUES,
  trainerPronounsSelectValue,
  TRAINER_YEARS_COACHING_CHOICES,
  TRAINER_YEARS_COACHING_CUSTOM,
  TRAINER_YEARS_COACHING_PRESET_VALUES,
  trainerYearsCoachingSelectValue,
} from "@/lib/trainer-profile-demography-options";

const LANGUAGE_DATALIST_VALUES = Object.values(LANGUAGE_LABELS);

type Props = {
  idPrefix: string;
  selectClassName: string;
  inputClassName: string;
  pronouns: string;
  onPronounsChange: (v: string) => void;
  ethnicity: string;
  onEthnicityChange: (v: string) => void;
  genderIdentity: string;
  onGenderIdentityChange: (v: string) => void;
  yearsCoaching: string;
  onYearsCoachingChange: (v: string) => void;
  languagesSpoken: string;
  onLanguagesSpokenChange: (v: string) => void;
  /** Rendered full-width after languages (e.g. coaching niches on onboarding). */
  betweenLanguagesAndYears?: ReactNode;
  disabled?: boolean;
};

export function TrainerProfileDemographyFields(props: Props) {
  const {
    idPrefix,
    selectClassName,
    inputClassName,
    pronouns,
    onPronounsChange,
    ethnicity,
    onEthnicityChange,
    genderIdentity,
    onGenderIdentityChange,
    yearsCoaching,
    onYearsCoachingChange,
    languagesSpoken,
    onLanguagesSpokenChange,
    betweenLanguagesAndYears,
    disabled,
  } = props;

  const noteId = `${idPrefix}-demo-note`;
  const langsListId = `${idPrefix}-langs-dl`;

  const pronSel = trainerPronounsSelectValue(pronouns);
  const ethSel = trainerEthnicitySelectValue(ethnicity);
  const genSel = trainerGenderSelectValue(genderIdentity);
  const yrsSel = trainerYearsCoachingSelectValue(yearsCoaching);

  return (
    <>
      <p id={noteId} className="text-[11px] leading-relaxed text-white/45 sm:col-span-2">
        {TRAINER_DEMOGRAPHY_CASE_NOTE}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor={`${idPrefix}-pro`}>
            Pronouns
          </label>
          <select
            id={`${idPrefix}-pro`}
            value={pronSel}
            disabled={disabled}
            aria-describedby={noteId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === TRAINER_PRONOUN_CUSTOM) {
                onPronounsChange(pronouns.trim() && !TRAINER_PRONOUN_PRESET_VALUES.has(pronouns.trim()) ? pronouns : "");
              } else {
                onPronounsChange(v);
              }
            }}
            className={selectClassName}
          >
            {TRAINER_PRONOUN_CHOICES.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {pronSel === TRAINER_PRONOUN_CUSTOM ? (
            <input
              id={`${idPrefix}-pro-custom`}
              value={pronouns}
              disabled={disabled}
              onChange={(e) => onPronounsChange(e.target.value)}
              placeholder="Type your pronouns"
              className={inputClassName}
              aria-label="Custom pronouns"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor={`${idPrefix}-eth`}>
            Ethnicity (optional)
          </label>
          <select
            id={`${idPrefix}-eth`}
            value={ethSel}
            disabled={disabled}
            aria-describedby={noteId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === TRAINER_ETHNICITY_CUSTOM) {
                onEthnicityChange(
                  ethnicity.trim() && !TRAINER_ETHNICITY_PRESET_VALUES.has(ethnicity.trim()) ? ethnicity : "",
                );
              } else {
                onEthnicityChange(v);
              }
            }}
            className={selectClassName}
          >
            {TRAINER_ETHNICITY_CHOICES.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {ethSel === TRAINER_ETHNICITY_CUSTOM ? (
            <input
              id={`${idPrefix}-eth-custom`}
              value={ethnicity}
              disabled={disabled}
              onChange={(e) => onEthnicityChange(e.target.value)}
              placeholder="Describe how you identify"
              className={inputClassName}
              aria-label="Custom ethnicity"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor={`${idPrefix}-lang`}>
            Languages spoken
          </label>
          <input
            id={`${idPrefix}-lang`}
            list={langsListId}
            value={languagesSpoken}
            disabled={disabled}
            onChange={(e) => onLanguagesSpokenChange(e.target.value)}
            placeholder="e.g., English, Spanish — comma separated"
            className={inputClassName}
            aria-describedby={noteId}
          />
          <datalist id={langsListId}>
            {LANGUAGE_DATALIST_VALUES.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </div>
        {betweenLanguagesAndYears ? <div className="sm:col-span-2">{betweenLanguagesAndYears}</div> : null}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor={`${idPrefix}-yrs`}>
            Years of coaching experience (optional)
          </label>
          <select
            id={`${idPrefix}-yrs`}
            value={yrsSel}
            disabled={disabled}
            aria-describedby={noteId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === TRAINER_YEARS_COACHING_CUSTOM) {
                onYearsCoachingChange(
                  yearsCoaching.trim() && !TRAINER_YEARS_COACHING_PRESET_VALUES.has(yearsCoaching.trim())
                    ? yearsCoaching
                    : "",
                );
              } else {
                onYearsCoachingChange(v);
              }
            }}
            className={selectClassName}
          >
            {TRAINER_YEARS_COACHING_CHOICES.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {yrsSel === TRAINER_YEARS_COACHING_CUSTOM ? (
            <input
              id={`${idPrefix}-yrs-custom`}
              value={yearsCoaching}
              disabled={disabled}
              onChange={(e) => onYearsCoachingChange(e.target.value)}
              placeholder="e.g., 4.5 or 12+"
              className={inputClassName}
              aria-label="Custom years of coaching"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor={`${idPrefix}-gen`}>
            Gender identity (optional)
          </label>
          <select
            id={`${idPrefix}-gen`}
            value={genSel}
            disabled={disabled}
            aria-describedby={noteId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === TRAINER_GENDER_CUSTOM) {
                onGenderIdentityChange(
                  genderIdentity.trim() && !TRAINER_GENDER_PRESET_VALUES.has(genderIdentity.trim())
                    ? genderIdentity
                    : "",
                );
              } else {
                onGenderIdentityChange(v);
              }
            }}
            className={selectClassName}
          >
            {TRAINER_GENDER_CHOICES.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {genSel === TRAINER_GENDER_CUSTOM ? (
            <input
              id={`${idPrefix}-gen-custom`}
              value={genderIdentity}
              disabled={disabled}
              onChange={(e) => onGenderIdentityChange(e.target.value)}
              placeholder="Describe how you identify"
              className={inputClassName}
              aria-label="Custom gender identity"
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
