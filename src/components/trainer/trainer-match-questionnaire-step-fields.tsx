"use client";

import type { TrainerMatchQuestionnaireDraftState } from "@/hooks/use-trainer-match-questionnaire-draft-state";
import {
  AGE_GROUP_IDS,
  AGE_GROUP_LABELS,
  CLIENT_GOAL_IDS,
  CLIENT_GOAL_LABELS,
  CLIENT_LEVEL_IDS,
  CLIENT_LEVEL_LABELS,
  LANGUAGE_IDS,
  LANGUAGE_LABELS,
} from "@/lib/trainer-match-questionnaire";
import { MATCH_QUESTIONNAIRE_YEARS_COACHING_MAX } from "@/lib/trainer-profile-demography-options";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2";

const labelClass = "text-xs font-semibold text-white/50";

function toggle<T extends string>(list: T[], value: T, setList: (v: T[]) => void) {
  if (list.includes(value)) {
    setList(list.filter((x) => x !== value));
  } else {
    setList([...list, value]);
  }
}

type Props = {
  step: 1 | 2 | 3 | 4;
  state: TrainerMatchQuestionnaireDraftState;
  sectionTitle?: string;
};

export function TrainerMatchQuestionnaireStepFields(props: Props) {
  const { step, state: s } = props;
  const sectionTitle = props.sectionTitle;

  if (step === 1) {
    return (
      <section className="space-y-4">
        {sectionTitle ? <h3 className="text-lg font-semibold text-white">{sectionTitle}</h3> : null}
        <p className="text-sm text-white/55">Toggle every format you are willing to offer.</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
          <input
            type="checkbox"
            checked={s.offersVirtual}
            onChange={(e) => s.setOffersVirtual(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#FF7E00]"
          />
          <span className="text-sm text-white/75">Virtual / remote sessions (video, app-based check-ins, etc.)</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
          <input
            type="checkbox"
            checked={s.offersInPerson}
            onChange={(e) => s.setOffersInPerson(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#FF7E00]"
          />
          <span className="text-sm text-white/75">In-person sessions at gyms, studios, parks, or client locations</span>
        </label>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section className="space-y-4">
        {sectionTitle ? <h3 className="text-lg font-semibold text-white">{sectionTitle}</h3> : null}
        {s.offersInPerson ? (
          <>
            <p className="text-sm text-white/55">
              Clients searching for in-person trainers need a center point and radius. Use the ZIP where you most often
              meet clients (you can refine exact locations later).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor="oq-zip">
                  ZIP code (center point)
                </label>
                <input
                  id="oq-zip"
                  value={s.inPersonZip}
                  onChange={(e) => s.setInPersonZip(e.target.value)}
                  placeholder="30301"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor="oq-radius">
                  Mile radius
                </label>
                <input
                  id="oq-radius"
                  type="number"
                  min={1}
                  max={150}
                  value={s.inPersonRadiusMiles}
                  onChange={(e) => s.setInPersonRadiusMiles(e.target.value)}
                  placeholder="e.g. 15"
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/55">You chose virtual-only sessions—no travel radius required.</p>
        )}
      </section>
    );
  }

  if (step === 3) {
    return (
      <section className="space-y-6">
        {sectionTitle ? <h3 className="text-lg font-semibold text-white">{sectionTitle}</h3> : null}
        <div>
          <p className={labelClass}>Age ranges (select all that apply)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {AGE_GROUP_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(s.ageGroups, id, s.setAgeGroups)}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                  s.ageGroups.includes(id)
                    ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                {AGE_GROUP_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={labelClass}>Experience levels you coach well</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CLIENT_LEVEL_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(s.clientLevels, id, s.setClientLevels)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  s.clientLevels.includes(id)
                    ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                {CLIENT_LEVEL_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={labelClass}>Primary Client Goals you support</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CLIENT_GOAL_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(s.clientGoals, id, s.setClientGoals)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  s.clientGoals.includes(id)
                    ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                {CLIENT_GOAL_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={labelClass}>Languages you can coach in</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LANGUAGE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(s.languages, id, s.setLanguages)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  s.languages.includes(id)
                    ? "border-[#FF7E00]/50 bg-[#FF7E00]/15 text-white"
                    : "border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                {LANGUAGE_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="oq-years">
            Years you have coached or trained people (0 if you are just starting professionally)
          </label>
          <select
            id="oq-years"
            value={s.yearsCoaching}
            onChange={(e) => s.setYearsCoaching(e.target.value)}
            className={inputClass}
          >
            {Array.from({ length: MATCH_QUESTIONNAIRE_YEARS_COACHING_MAX + 1 }, (_, i) => (
              <option key={i} value={String(i)}>
                {i === 0 ? "0 (just starting)" : i === 1 ? "1 year" : `${i} years`}
              </option>
            ))}
          </select>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {sectionTitle ? <h3 className="text-lg font-semibold text-white">Coaching Philosophy & Confirmation</h3> : null}
      <p className="text-sm text-white/55">
        At least a few sentences on how you coach, what clients can expect, and what makes your approach distinct (80+
        characters).
      </p>
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="oq-phil">
          Coaching philosophy (min 80 characters)
        </label>
        <textarea
          id="oq-phil"
          rows={8}
          value={s.coachingPhilosophy}
          onChange={(e) => s.setCoachingPhilosophy(e.target.value)}
          className={inputClass}
          placeholder="Describe your methods, values, communication style, and the outcomes you help clients achieve."
        />
        <p className="text-xs text-white/35">{s.coachingPhilosophy.trim().length} / 80+ characters</p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
        <input
          type="checkbox"
          checked={s.certifyAccurate}
          onChange={(e) => s.setCertifyAccurate(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[#FF7E00]"
        />
        <span className="text-sm text-white/75">
          I certify that my answers are accurate to the best of my knowledge and that I will keep my Match Fit profile
          updated if my match preferences or coaching details change.
        </span>
      </label>
    </section>
  );
}
