"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type TrainerMatchQuestionnaireDraft,
  validateTrainerMatchQuestionnaireStep,
} from "@/lib/trainer-match-questionnaire-draft";

function stableDraftString(d: TrainerMatchQuestionnaireDraft): string {
  return JSON.stringify(d);
}

export function useTrainerMatchQuestionnaireDraftState(initialDraft: TrainerMatchQuestionnaireDraft) {
  const d0 = initialDraft;
  const [offersVirtual, setOffersVirtual] = useState(d0.offersVirtual);
  const [offersInPerson, setOffersInPerson] = useState(d0.offersInPerson);
  const [inPersonZip, setInPersonZip] = useState(d0.inPersonZip ?? "");
  const [inPersonRadiusMiles, setInPersonRadiusMiles] = useState(
    d0.inPersonRadiusMiles != null ? String(d0.inPersonRadiusMiles) : "",
  );
  const [ageGroups, setAgeGroups] = useState(d0.ageGroups);
  const [clientLevels, setClientLevels] = useState(d0.clientLevels);
  const [clientGoals, setClientGoals] = useState(d0.clientGoals);
  const [yearsCoaching, setYearsCoaching] = useState(String(d0.yearsCoaching));
  const [languages, setLanguages] = useState(d0.languages);
  const [coachingPhilosophy, setCoachingPhilosophy] = useState(d0.coachingPhilosophy);
  const [certifyAccurate, setCertifyAccurate] = useState(Boolean(d0.certifyAccurate));
  const [baselineSerialized, setBaselineSerialized] = useState(() => stableDraftString(d0));

  const serializeDraft = useCallback((): TrainerMatchQuestionnaireDraft => {
    const radius = inPersonRadiusMiles.trim() === "" ? null : Number(inPersonRadiusMiles);
    const years = Number(yearsCoaching);
    return {
      schemaVersion: 1,
      offersVirtual,
      offersInPerson,
      inPersonZip: offersInPerson ? inPersonZip.trim() || null : null,
      inPersonRadiusMiles: offersInPerson && radius != null && Number.isFinite(radius) ? radius : null,
      ageGroups,
      clientLevels,
      clientGoals,
      yearsCoaching: Number.isFinite(years) ? years : 0,
      coachingPhilosophy,
      languages,
      certifyAccurate,
    };
  }, [
    ageGroups,
    certifyAccurate,
    clientGoals,
    clientLevels,
    coachingPhilosophy,
    inPersonRadiusMiles,
    inPersonZip,
    languages,
    offersInPerson,
    offersVirtual,
    yearsCoaching,
  ]);

  const isDirty = useMemo(() => {
    return stableDraftString(serializeDraft()) !== baselineSerialized;
  }, [serializeDraft, baselineSerialized]);

  function commitBaseline() {
    setBaselineSerialized(stableDraftString(serializeDraft()));
  }

  function validateStep(step: number): string | null {
    return validateTrainerMatchQuestionnaireStep(serializeDraft(), step);
  }

  return {
    offersVirtual,
    setOffersVirtual,
    offersInPerson,
    setOffersInPerson,
    inPersonZip,
    setInPersonZip,
    inPersonRadiusMiles,
    setInPersonRadiusMiles,
    ageGroups,
    setAgeGroups,
    clientLevels,
    setClientLevels,
    clientGoals,
    setClientGoals,
    yearsCoaching,
    setYearsCoaching,
    languages,
    setLanguages,
    coachingPhilosophy,
    setCoachingPhilosophy,
    certifyAccurate,
    setCertifyAccurate,
    serializeDraft,
    isDirty,
    commitBaseline,
    validateStep,
  };
}

export type TrainerMatchQuestionnaireDraftState = ReturnType<typeof useTrainerMatchQuestionnaireDraftState>;
