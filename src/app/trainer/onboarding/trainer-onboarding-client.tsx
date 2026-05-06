"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TRAINER_ONBOARDING_AGREEMENT_BULLETS } from "@/app/trainer/onboarding/trainer-agreement-bullets";
import { CREDIBLE_CPT_ORGANIZATIONS } from "@/app/trainer/onboarding/credible-cpt-organizations";
import { CREDIBLE_NUTRITION_CREDENTIALS } from "@/app/trainer/onboarding/credible-nutrition-credentials";
import { OnboardingCertStatusLegend } from "@/app/trainer/onboarding/onboarding-cert-status-legend";
import { TrainerProfileDemographyFields } from "@/components/trainer/trainer-profile-demography-fields";
import {
  SPECIALIST_ROLE_OPTIONS,
  type SpecialistProfessionalRoleId,
} from "@/lib/trainer-specialist-roles";
import { TrainerSocialUrlFields } from "@/components/trainer/trainer-social-url-fields";
import { navigateWithFullLoad } from "@/lib/navigate-full-load";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { normalizeTrainerSocialFields } from "@/lib/trainer-social-urls";
import { postTrainerLogout } from "@/lib/trainer-logout";
import { US_STATE_POSTAL_OPTIONS } from "@/lib/trainer-profile-demography-options";
import { coerceTrainerBackgroundVendorStatus, coerceTrainerCptStatus } from "@/lib/trainer-onboarding-status";

type TrainerMe = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  email: string;
  bio: string | null;
  preferredName: string | null;
  pronouns: string | null;
  ethnicity: string | null;
  languagesSpoken: string | null;
  fitnessNiches: string | null;
  yearsCoaching: string | null;
  genderIdentity: string | null;
  profileImageUrl: string | null;
  socialInstagram: string | null;
  socialTiktok: string | null;
  socialFacebook: string | null;
  socialLinkedin: string | null;
  socialOtherUrl: string | null;
  profile: {
    hasSignedTOS: boolean;
    hasUploadedW9: boolean;
    hasPaidBackgroundFee: boolean;
    backgroundCheckStatus: string;
    certificationUrl: string | null;
    otherCertificationUrl: string | null;
    nutritionistCertificationUrl: string | null;
    certificationReviewStatus: string;
    nutritionistCertificationReviewStatus: string;
    specialistCertificationReviewStatus: string;
    onboardingTrackCpt: boolean;
    onboardingTrackNutrition: boolean;
    onboardingTrackSpecialist: boolean;
    specialistProfessionalRole: string | null;
    specialistCertificationUrl: string | null;
    otherCertificationReviewStatus: string;
    backgroundCheckReviewStatus: string;
    dashboardActivatedAt?: string | null;
    matchQuestionnaireStatus?: string;
  } | null;
};

function HumanReviewPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
      Pending human review
    </span>
  );
}

function randomDigits(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

/** Random placeholder W-9 fields for QA; legal name matches sign-up first and last name. */
function buildDevW9Autofill(trainer: TrainerMe) {
  const idx = Math.floor(Math.random() * 3);
  const streets = ["742 Evergreen Terrace", "188 Test Valley Rd", "9 Sample Workshop Blvd"] as const;
  const locales = [
    { city: "Austin", state: "TX", zip: "78701" },
    { city: "Portland", state: "OR", zip: "97205" },
    { city: "Denver", state: "CO", zip: "80202" },
  ] as const;
  const loc = locales[idx];
  return {
    legalName: `${trainer.firstName} ${trainer.lastName}`.trim(),
    businessName: "",
    federalTaxClassification: "individual",
    addressLine1: streets[idx],
    addressLine2: `Unit ${100 + Math.floor(Math.random() * 900)}`,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    tinType: "SSN" as const,
    tin: `${randomDigits(3)}-${randomDigits(2)}-${randomDigits(4)}`,
  };
}

const AGREEMENT_COUNT = TRAINER_ONBOARDING_AGREEMENT_BULLETS.length;

/** Title case — used for page titles and step-number tooltips. */
const ONBOARDING_STEP_DISPLAY_TITLES: Record<number, string> = {
  1: "Acknowledgements",
  2: "Background Screening",
  3: "Your Professional Path",
  4: "Certifications",
  5: "Tax Information (Form W-9)",
  6: "Profile Setup",
};

function fileSig(f: File | null): string | null {
  if (!f) return null;
  return `${f.name}|${f.size}|${f.lastModified}`;
}

export default function TrainerOnboardingClient() {
  const [step, setStep] = useState(1);
  const [loadingMe, setLoadingMe] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<TrainerMe | null>(null);
  const didBootstrapFromServer = useRef(false);

  const [agreementChecks, setAgreementChecks] = useState<boolean[]>(() => Array(AGREEMENT_COUNT).fill(false));

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState("");
  const [fitnessNiches, setFitnessNiches] = useState("");
  const [yearsCoaching, setYearsCoaching] = useState("");
  const [genderIdentity, setGenderIdentity] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialOtherUrl, setSocialOtherUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [certFile, setCertFile] = useState<File | null>(null);
  const [otherCertFile, setOtherCertFile] = useState<File | null>(null);
  const [nutrCertFile, setNutrCertFile] = useState<File | null>(null);
  const [specialistCertFile, setSpecialistCertFile] = useState<File | null>(null);
  const [certBusy, setCertBusy] = useState(false);

  const [pathCpt, setPathCpt] = useState(false);
  const [pathNutrition, setPathNutrition] = useState(false);
  const [pathSpecialist, setPathSpecialist] = useState(false);
  const [specialistRole, setSpecialistRole] = useState<SpecialistProfessionalRoleId>("cscs");
  const [pathConfirmAck, setPathConfirmAck] = useState(false);
  const [pathBypassPassword, setPathBypassPassword] = useState("");

  const [bgDevPassword, setBgDevPassword] = useState("");
  const [certBypassPassword, setCertBypassPassword] = useState("");

  const [w9LegalName, setW9LegalName] = useState("");
  const [w9BusinessName, setW9BusinessName] = useState("");
  const [w9Classification, setW9Classification] = useState("individual");
  const [w9Address1, setW9Address1] = useState("");
  const [w9Address2, setW9Address2] = useState("");
  const [w9City, setW9City] = useState("");
  const [w9State, setW9State] = useState("");
  const [w9Zip, setW9Zip] = useState("");
  const [w9TinType, setW9TinType] = useState<"SSN" | "EIN">("SSN");
  const [w9Tin, setW9Tin] = useState("");
  const [w9Certify, setW9Certify] = useState(false);
  const [w9AutofillPassword, setW9AutofillPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baselineEpoch, setBaselineEpoch] = useState(0);
  const [lastSyncedSnapshot, setLastSyncedSnapshot] = useState("");
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const loadMe = useCallback(async () => {
    setMeError(null);
    setLoadingMe(true);
    let loadedTrainer = false;
    try {
      const res = await fetch("/api/trainer/me", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as { error?: string; trainer?: TrainerMe };
      if (!res.ok) {
        setMeError(data.error ?? "Could not load your account.");
        setTrainer(null);
        return;
      }
      if (data.trainer) {
        loadedTrainer = true;
        const t = data.trainer;
        setTrainer(t);
        setFirstName(t.firstName);
        setLastName(t.lastName);
        setPreferredName(t.preferredName ?? "");
        setBio(t.bio ?? "");
        setPronouns(t.pronouns ?? "");
        setEthnicity(t.ethnicity ?? "");
        setLanguagesSpoken(t.languagesSpoken ?? "");
        setFitnessNiches(t.fitnessNiches ?? "");
        setYearsCoaching(t.yearsCoaching ?? "");
        setGenderIdentity(t.genderIdentity ?? "");
        setSocialInstagram(t.socialInstagram ?? "");
        setSocialTiktok(t.socialTiktok ?? "");
        setSocialFacebook(t.socialFacebook ?? "");
        setSocialLinkedin(t.socialLinkedin ?? "");
        setSocialOtherUrl(t.socialOtherUrl ?? "");

        const pSync = t.profile;
        if (pSync) {
          setPathCpt(pSync.onboardingTrackCpt);
          setPathNutrition(pSync.onboardingTrackNutrition);
          setPathSpecialist(pSync.onboardingTrackSpecialist);
          const r = pSync.specialistProfessionalRole;
          if (r === "cscs" || r === "corrective_exercise_specialist" || r === "group_fitness_instructor") {
            setSpecialistRole(r);
          }
        }

        if (!didBootstrapFromServer.current) {
          didBootstrapFromServer.current = true;
          if (t.profile?.hasSignedTOS) {
            setAgreementChecks(Array(AGREEMENT_COUNT).fill(true));
          }
          const p = t.profile;
          if (p) {
            if (!p.hasSignedTOS) setStep(1);
            else if (p.backgroundCheckStatus !== "APPROVED") setStep(2);
            else if (!p.onboardingTrackCpt && !p.onboardingTrackNutrition && !p.onboardingTrackSpecialist) setStep(3);
            else if (
              !certificationsGatePassed({
                onboardingTrackCpt: p.onboardingTrackCpt,
                onboardingTrackNutrition: p.onboardingTrackNutrition,
                onboardingTrackSpecialist: p.onboardingTrackSpecialist,
                certificationReviewStatus: p.certificationReviewStatus,
                nutritionistCertificationReviewStatus: p.nutritionistCertificationReviewStatus,
                specialistCertificationReviewStatus: p.specialistCertificationReviewStatus,
              })
            )
              setStep(4);
            else if (!p.hasUploadedW9) setStep(5);
            else setStep(6);
          }
        }
      }
    } catch {
      setMeError("Could not load your account.");
      setTrainer(null);
    } finally {
      setLoadingMe(false);
      if (loadedTrainer) {
        setBaselineEpoch((e) => e + 1);
      }
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMe();
    });
  }, [loadMe]);

  const profile = trainer?.profile;

  const onboardingSnapshotSerialized = useMemo(
    () =>
      JSON.stringify({
        agreementChecks,
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
        avatarSig: fileSig(avatarFile),
        certSig: fileSig(certFile),
        otherCertSig: fileSig(otherCertFile),
        nutrCertSig: fileSig(nutrCertFile),
        specialistCertSig: fileSig(specialistCertFile),
        pathCpt,
        pathNutrition,
        pathSpecialist,
        specialistRole,
        pathConfirmAck,
        w9LegalName,
        w9BusinessName,
        w9Classification,
        w9Address1,
        w9Address2,
        w9City,
        w9State,
        w9Zip,
        w9TinType,
        w9Tin,
        w9Certify,
      }),
    [
      agreementChecks,
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
      avatarFile,
      certFile,
      otherCertFile,
      nutrCertFile,
      specialistCertFile,
      pathCpt,
      pathNutrition,
      pathSpecialist,
      specialistRole,
      pathConfirmAck,
      w9LegalName,
      w9BusinessName,
      w9Classification,
      w9Address1,
      w9Address2,
      w9City,
      w9State,
      w9Zip,
      w9TinType,
      w9Tin,
      w9Certify,
    ],
  );

  const baselineCaptureRef = useRef("");

  useLayoutEffect(() => {
    baselineCaptureRef.current = onboardingSnapshotSerialized;
  }, [onboardingSnapshotSerialized]);

  useLayoutEffect(() => {
    if (!trainer || loadingMe || baselineEpoch === 0) return;
    setLastSyncedSnapshot(baselineCaptureRef.current);
  }, [baselineEpoch, trainer, loadingMe]);

  const isOnboardingDirty =
    lastSyncedSnapshot !== "" && onboardingSnapshotSerialized !== lastSyncedSnapshot;

  const canReturnToDashboard = profile?.matchQuestionnaireStatus === "completed";

  useEffect(() => {
    if (!isOnboardingDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isOnboardingDirty]);

  useEffect(() => {
    if (!isOnboardingDirty || !canReturnToDashboard) return;
    function onClickCapture(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/trainer/dashboard" && url.pathname !== "/trainer/dashboard/") return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveModalOpen(true);
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isOnboardingDirty, canReturnToDashboard]);

  const bgVendor = useMemo(() => coerceTrainerBackgroundVendorStatus(profile?.backgroundCheckStatus), [profile?.backgroundCheckStatus]);
  const cptStatus = useMemo(() => coerceTrainerCptStatus(profile?.certificationReviewStatus), [profile?.certificationReviewStatus]);
  const nutritionStatus = useMemo(
    () => coerceTrainerCptStatus(profile?.nutritionistCertificationReviewStatus),
    [profile?.nutritionistCertificationReviewStatus],
  );
  const specialistStatus = useMemo(
    () => coerceTrainerCptStatus(profile?.specialistCertificationReviewStatus),
    [profile?.specialistCertificationReviewStatus],
  );
  const showCptPendingPill = cptStatus === "PENDING" && !!profile?.certificationUrl;
  const showNutritionPendingPill = nutritionStatus === "PENDING" && !!profile?.nutritionistCertificationUrl;
  const showSpecialistPendingPill = specialistStatus === "PENDING" && !!profile?.specialistCertificationUrl;
  const specialistRoleLabel = useMemo(() => {
    const id = profile?.specialistProfessionalRole;
    return SPECIALIST_ROLE_OPTIONS.find((o) => o.id === id)?.label ?? "Certified specialist credential";
  }, [profile?.specialistProfessionalRole]);
  const bgNeedsReview = bgVendor === "NEEDS_FURTHER_REVIEW";

  const certsComplete = useMemo(() => {
    if (!profile) return false;
    return certificationsGatePassed({
      onboardingTrackCpt: profile.onboardingTrackCpt,
      onboardingTrackNutrition: profile.onboardingTrackNutrition,
      onboardingTrackSpecialist: profile.onboardingTrackSpecialist,
      certificationReviewStatus: profile.certificationReviewStatus,
      nutritionistCertificationReviewStatus: profile.nutritionistCertificationReviewStatus,
      specialistCertificationReviewStatus: profile.specialistCertificationReviewStatus,
    });
  }, [profile]);

  const stepHeading = ONBOARDING_STEP_DISPLAY_TITLES[step] ?? "Trainer Onboarding";
  const stepSubline = step === 1 ? "Fees, Screening, and Platform Policies" : null;

  function requestDashboardNavigation() {
    if (!canReturnToDashboard) return;
    if (isOnboardingDirty) {
      setLeaveModalOpen(true);
      return;
    }
    navigateWithFullLoad("/trainer/dashboard");
  }

  async function persistOnboardingForDashboardLeave(): Promise<boolean> {
    setError(null);
    if (step === 1) {
      if (!agreementChecks.every(Boolean)) {
        setError("Check every acknowledgement before saving.");
        return false;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/trainer/onboarding/agreements", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedTrainerAgreement: true }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not save acknowledgements.");
          return false;
        }
        await loadMe();
        return true;
      } catch {
        setError("Something went wrong.");
        return false;
      } finally {
        setBusy(false);
      }
    }
    if (step === 2) {
      return true;
    }
    if (step === 3) {
      if (!pathCpt && !pathNutrition && !pathSpecialist) {
        setError("Select at least one professional path.");
        return false;
      }
      if (pathCpt && pathSpecialist) {
        setError("Choose either CPT or another certified specialist path for training—not both.");
        return false;
      }
      if (pathSpecialist && !specialistRole) {
        setError("Select which certified specialist role applies to you.");
        return false;
      }
      if (!pathConfirmAck) {
        setError("Confirm that you understand the certification requirements for your selection.");
        return false;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/trainer/onboarding/professional-path", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackCpt: pathCpt,
            trackNutrition: pathNutrition,
            trackSpecialist: pathSpecialist,
            specialistRole: pathSpecialist ? specialistRole : null,
            confirmCredentialRequirements: true,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not save your selection.");
          return false;
        }
        await loadMe();
        return true;
      } catch {
        setError("Something went wrong.");
        return false;
      } finally {
        setBusy(false);
      }
    }
    if (step === 4) {
      if (certFile || otherCertFile || nutrCertFile || specialistCertFile) {
        setError("Upload or clear pending certification files before saving.");
        return false;
      }
      return true;
    }
    if (step === 5) {
      setBusy(true);
      try {
        const res = await fetch("/api/trainer/onboarding/w9", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalName: w9LegalName.trim(),
            businessName: w9BusinessName.trim(),
            federalTaxClassification: w9Classification,
            addressLine1: w9Address1.trim(),
            addressLine2: w9Address2.trim(),
            city: w9City.trim(),
            state: w9State.trim().toUpperCase(),
            zip: w9Zip.trim(),
            tinType: w9TinType,
            tin: w9Tin.trim(),
            certify: w9Certify,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not save W-9 information.");
          return false;
        }
        await loadMe();
        return true;
      } catch {
        setError("Something went wrong.");
        return false;
      } finally {
        setBusy(false);
      }
    }
    if (step === 6) {
      const socialNorm = normalizeTrainerSocialFields({
        socialInstagram,
        socialTiktok,
        socialFacebook,
        socialLinkedin,
        socialOtherUrl,
      });
      if (!socialNorm.ok) {
        setError(socialNorm.error);
        return false;
      }
      const s = socialNorm.value;
      setBusy(true);
      try {
        const res = await fetch("/api/trainer/onboarding/basic-profile", {
          method: "PATCH",
          credentials: "include",
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
            socialInstagram: s.socialInstagram ?? "",
            socialTiktok: s.socialTiktok ?? "",
            socialFacebook: s.socialFacebook ?? "",
            socialLinkedin: s.socialLinkedin ?? "",
            socialOtherUrl: s.socialOtherUrl ?? "",
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Could not save profile.");
          return false;
        }
        if (avatarFile) {
          setAvatarBusy(true);
          try {
            const fd = new FormData();
            fd.set("file", avatarFile);
            const ar = await fetch("/api/trainer/onboarding/profile-image", { method: "POST", credentials: "include", body: fd });
            const ad = (await ar.json()) as { error?: string };
            if (!ar.ok) {
              setError(ad.error ?? "Profile saved, but the photo upload failed.");
              await loadMe();
              return false;
            }
          } finally {
            setAvatarBusy(false);
            setAvatarFile(null);
          }
        }
        await loadMe();
        return true;
      } catch {
        setError("Something went wrong.");
        return false;
      } finally {
        setBusy(false);
      }
    }
    return true;
  }

  async function handleLeaveSaveAndGoToDashboard() {
    const ok = await persistOnboardingForDashboardLeave();
    if (!ok) return;
    setLeaveModalOpen(false);
    navigateWithFullLoad("/trainer/dashboard");
  }

  function handleLeaveDiscardAndGoToDashboard() {
    setLeaveModalOpen(false);
    navigateWithFullLoad("/trainer/dashboard");
  }

  async function handleLogout() {
    await postTrainerLogout();
    navigateWithFullLoad("/trainer/dashboard/login");
  }

  function toggleAgreement(i: number) {
    setAgreementChecks((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  async function handleAgreementsContinue() {
    setError(null);
    if (!agreementChecks.every(Boolean)) {
      setError("You cannot proceed until everything is checked to agree to.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/onboarding/agreements", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedTrainerAgreement: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save acknowledgements.");
        return;
      }
      await loadMe();
      setStep(2);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProfessionalPathContinue() {
    setError(null);
    if (!pathCpt && !pathNutrition && !pathSpecialist) {
      setError("Select at least one professional path.");
      return;
    }
    if (pathCpt && pathSpecialist) {
      setError("Choose either CPT or another certified specialist path for training—not both.");
      return;
    }
    if (pathSpecialist && !specialistRole) {
      setError("Select which certified specialist role applies to you.");
      return;
    }
    if (!pathConfirmAck) {
      setError("Confirm that you understand the certification requirements for your selection.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/onboarding/professional-path", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackCpt: pathCpt,
          trackNutrition: pathNutrition,
          trackSpecialist: pathSpecialist,
          specialistRole: pathSpecialist ? specialistRole : null,
          confirmCredentialRequirements: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your selection.");
        return;
      }
      await loadMe();
      setStep(4);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProfessionalPathBypass() {
    setError(null);
    if (!verifyTrainerOnboardingDevPassword(pathBypassPassword)) {
      setError("Incorrect password. It must match exactly and is case-sensitive.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/onboarding/professional-path/bypass", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devPassword: pathBypassPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Bypass failed.");
        return;
      }
      setPathBypassPassword("");
      setPathConfirmAck(true);
      await loadMe();
      setStep(4);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const socialNorm = normalizeTrainerSocialFields({
        socialInstagram,
        socialTiktok,
        socialFacebook,
        socialLinkedin,
        socialOtherUrl,
      });
      if (!socialNorm.ok) {
        setError(socialNorm.error);
        return;
      }
      const s = socialNorm.value;
      const res = await fetch("/api/trainer/onboarding/basic-profile", {
        method: "PATCH",
        credentials: "include",
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
          socialInstagram: s.socialInstagram ?? "",
          socialTiktok: s.socialTiktok ?? "",
          socialFacebook: s.socialFacebook ?? "",
          socialLinkedin: s.socialLinkedin ?? "",
          socialOtherUrl: s.socialOtherUrl ?? "",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save profile.");
        return;
      }
      if (avatarFile) {
        setAvatarBusy(true);
        try {
          const fd = new FormData();
          fd.set("file", avatarFile);
          const ar = await fetch("/api/trainer/onboarding/profile-image", { method: "POST", credentials: "include", body: fd });
          const ad = (await ar.json()) as { error?: string };
          if (!ar.ok) {
            setError(ad.error ?? "Profile saved, but the photo upload failed.");
            await loadMe();
            return;
          }
        } finally {
          setAvatarBusy(false);
          setAvatarFile(null);
        }
      }
      await loadMe();
      navigateWithFullLoad("/trainer/dashboard");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleW9Submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/onboarding/w9", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: w9LegalName.trim(),
          businessName: w9BusinessName.trim(),
          federalTaxClassification: w9Classification,
          addressLine1: w9Address1.trim(),
          addressLine2: w9Address2.trim(),
          city: w9City.trim(),
          state: w9State.trim().toUpperCase(),
          zip: w9Zip.trim(),
          tinType: w9TinType,
          tin: w9Tin.trim(),
          certify: w9Certify,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save W-9 information.");
        return;
      }
      await loadMe();
      setStep(6);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCertUpload(kind: "cpt" | "other" | "nutritionist" | "specialist") {
    setError(null);
    const file =
      kind === "cpt"
        ? certFile
        : kind === "nutritionist"
          ? nutrCertFile
          : kind === "specialist"
            ? specialistCertFile
            : otherCertFile;
    if (!file) {
      setError(
        kind === "cpt"
          ? "Choose a CPT certification file first."
          : kind === "nutritionist"
            ? "Choose a nutrition credential file first."
            : kind === "specialist"
              ? "Choose your specialist credential file first."
              : "Choose an additional certification file first.",
      );
      return;
    }
    setCertBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set(
        "uploadType",
        kind === "other" ? "other" : kind === "nutritionist" ? "nutritionist" : kind === "specialist" ? "specialist" : "cpt",
      );
      const res = await fetch("/api/trainer/onboarding/certification", { method: "POST", credentials: "include", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      if (kind === "cpt") setCertFile(null);
      else if (kind === "nutritionist") setNutrCertFile(null);
      else if (kind === "specialist") setSpecialistCertFile(null);
      else setOtherCertFile(null);
      await loadMe();
    } catch {
      setError("Something went wrong.");
    } finally {
      setCertBusy(false);
    }
  }

  function handleW9DevAutofill() {
    setError(null);
    if (!verifyTrainerOnboardingDevPassword(w9AutofillPassword)) {
      setError("Incorrect password. It must match exactly and is case-sensitive.");
      return;
    }
    if (!trainer) return;
    const d = buildDevW9Autofill(trainer);
    setW9LegalName(d.legalName);
    setW9BusinessName(d.businessName);
    setW9Classification(d.federalTaxClassification);
    setW9Address1(d.addressLine1);
    setW9Address2(d.addressLine2);
    setW9City(d.city);
    setW9State(d.state);
    setW9Zip(d.zip);
    setW9TinType(d.tinType);
    setW9Tin(d.tin);
    setW9Certify(true);
    setW9AutofillPassword("");
  }

  async function handleBackgroundTestingOverride() {
    setError(null);
    if (!bgDevPassword) {
      setError("Enter the development password to use the testing override.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/trainer/onboarding/background-check", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devPassword: bgDevPassword, mockBackgroundFeePaid: false }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not submit background check.");
        return;
      }
      await loadMe();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCertBypass() {
    setError(null);
    if (!verifyTrainerOnboardingDevPassword(certBypassPassword)) {
      setError("Incorrect password. It must match exactly and is case-sensitive.");
      return;
    }
    setBusy(true);
    try {
      const scopes: ("cpt" | "nutritionist" | "specialist")[] = [];
      if (profile?.onboardingTrackCpt) scopes.push("cpt");
      if (profile?.onboardingTrackNutrition) scopes.push("nutritionist");
      if (profile?.onboardingTrackSpecialist) scopes.push("specialist");
      const res = await fetch("/api/trainer/onboarding/certification/bypass", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devPassword: certBypassPassword,
          scopes: scopes.length ? scopes : ["cpt"],
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Bypass failed.");
        return;
      }
      setCertBypassPassword("");
      await loadMe();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingMe) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0B0C0F] px-5 text-sm text-white/55">
        Loading your trainer workspace…
      </main>
    );
  }

  if (meError || !trainer) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0B0C0F] px-5 text-center text-sm text-white/70">
        <p>{meError ?? "Session expired. Please sign in again."}</p>
        <Link href="/trainer/dashboard/login" className="text-[#FF7E00] underline-offset-4 hover:underline">
          Back to Trainer Sign-In
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,211,78,0.12),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,126,0,0.08),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(227,43,43,0.06),transparent_55%)]"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl sm:h-12 sm:w-12">
              <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="48px" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black tracking-tight">
                <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Trainer onboarding</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {canReturnToDashboard ? (
              <button
                type="button"
                onClick={requestDashboardNavigation}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/25 hover:text-white"
              >
                Return to Dashboard
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/25 hover:text-white"
            >
              Log out
            </button>
          </div>
        </header>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              title={ONBOARDING_STEP_DISPLAY_TITLES[n]}
              onClick={() => setStep(n)}
              className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border px-3 text-xs font-black ${
                step === n ? "border-[#FF7E00]/60 bg-[#FF7E00]/15 text-white" : "border-white/10 text-white/45"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{stepHeading}</h1>
        {stepSubline ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{stepSubline}</p>
        ) : null}
        <p className="mt-2 text-sm text-white/55 sm:text-base">Step {step} of 6</p>

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
          {error ? (
            <p className="mb-4 rounded-xl border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-4 py-3 text-sm text-[#FFB4B4]" role="alert">
              {error}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5 text-sm leading-relaxed text-white/70">
              <ul className="space-y-3">
                {TRAINER_ONBOARDING_AGREEMENT_BULLETS.map((text, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3">
                    <input
                      id={`agr-${i}`}
                      type="checkbox"
                      checked={agreementChecks[i] ?? false}
                      onChange={() => toggleAgreement(i)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00]"
                    />
                    <label htmlFor={`agr-${i}`} className="cursor-pointer text-[13px] leading-relaxed text-white/75">
                      {text}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {canReturnToDashboard ? (
                  <Link
                    href="/trainer/dashboard"
                    onClick={(e) => {
                      if (!isOnboardingDirty) return;
                      e.preventDefault();
                      setLeaveModalOpen(true);
                    }}
                    className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold tracking-wide text-white transition hover:border-white/25"
                  >
                    Back to Dashboard
                  </Link>
                ) : null}
                <Link
                  href="/terms#trainer-terms"
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold tracking-wide text-white transition hover:border-white/25"
                >
                  View Trainer Terms of Service
                </Link>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAgreementsContinue()}
                className="group relative isolate flex min-h-[3.25rem] w-full items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
              >
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
                <span className="relative">{busy ? "Saving…" : "I acknowledge and agree"}</span>
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5 text-sm leading-relaxed text-white/70">
              <div className="space-y-3 text-[13px] leading-relaxed text-white/65">
                <p>
                  After you acknowledge Match Fit&apos;s policies, you complete background screening through our future
                  third-party vendor. <span className="font-semibold text-white/90">NOT STARTED</span> means you have not
                  yet submitted screening with the vendor. <span className="font-semibold text-white/90">PENDING</span>{" "}
                  means the vendor has received your screening and a result is not final.{" "}
                  <span className="font-semibold text-white/90">APPROVED</span> means you cleared screening at the
                  vendor, or a flagged result was approved through documented human review.{" "}
                  <span className="font-semibold text-white/90">NEEDS FURTHER REVIEW</span> means the vendor flagged an
                  item and Match Fit has not yet finished review, or we have emailed you to schedule a discussion.{" "}
                  <span className="font-semibold text-white/90">DENIED</span> means human review did not clear a flag
                  and you may not continue; related records are retained so that a repeated application within five years
                  can be automatically denied, after which you may apply again and prior denial markers are removed.
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-4 text-xs text-white/55">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Current vendor status:</p>
                <p className="mt-2 text-sm font-black tracking-[0.12em] text-white">{bgVendor}</p>
                {bgNeedsReview ? (
                  <div className="mt-3">
                    <HumanReviewPill />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="bg-dev-pw">
                  Development password (required for testing override)
                </label>
                <input
                  id="bg-dev-pw"
                  type="password"
                  autoComplete="off"
                  value={bgDevPassword}
                  onChange={(e) => setBgDevPassword(e.target.value)}
                  placeholder="Enter password"
                  className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleBackgroundTestingOverride()}
                className="flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-400/55 disabled:opacity-50"
              >
                Override for testing
              </button>
              <button
                type="button"
                disabled={bgVendor !== "APPROVED"}
                onClick={() => setStep(3)}
                className="flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.1em] text-white transition enabled:hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continue onboarding
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
              >
                Back
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-6">
              <p className="text-sm leading-relaxed text-white/65">
                Choose how you will serve clients on Match Fit. You may select one or both paths. On the next step you
                will upload the credentials that match your selection.
              </p>
              <div className="space-y-4">
                <label
                  className={`flex cursor-pointer gap-4 rounded-2xl border p-4 transition ${
                    pathCpt ? "border-[#FF7E00]/45 bg-[#FF7E00]/08" : "border-white/[0.08] bg-[#0E1016]/80 hover:border-white/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={pathCpt}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setPathCpt(on);
                      if (on) setPathSpecialist(false);
                    }}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00]"
                  />
                  <div>
                    <p className="text-sm font-bold text-white">Certified Personal Trainer</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                      You will coach clients through exercise, programming, and session delivery. You must upload a
                      current CPT (Certified Personal Trainer) credential from a credible, nationally recognized
                      organization (see examples on the next screen).
                    </p>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer gap-4 rounded-2xl border p-4 transition ${
                    pathNutrition ? "border-[#FF7E00]/45 bg-[#FF7E00]/08" : "border-white/[0.08] bg-[#0E1016]/80 hover:border-white/15"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={pathNutrition}
                    onChange={(e) => setPathNutrition(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00]"
                  />
                  <div>
                    <p className="text-sm font-bold text-white">Registered Dietitian Nutritionist (RDN) &amp; credentialed nutrition coaching</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                      For clinical nutrition and MNT-aligned work, the gold-standard credential is the{" "}
                      <span className="font-semibold text-white/75">Registered Dietitian Nutritionist (RDN)</span>{" "}
                      issued by the Commission on Dietetic Registration. You may also upload other nationally recognized
                      nutrition certifications (see examples on the next screen).
                    </p>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition ${
                    pathSpecialist
                      ? "border-[#FF7E00]/45 bg-[#FF7E00]/08"
                      : "border-white/[0.08] bg-[#0E1016]/80 hover:border-white/15"
                  }`}
                >
                  <div className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={pathSpecialist}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setPathSpecialist(on);
                        if (on) setPathCpt(false);
                      }}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#FF7E00]"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Other certified fitness specialist (not CPT)</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                        Choose this if your <span className="font-semibold text-white/75">primary</span> training
                        credential is something like CSCS, corrective exercise, or an accredited group-fitness
                        certification instead of a CPT. This path cannot be combined with the CPT checkbox.
                      </p>
                    </div>
                  </div>
                  {pathSpecialist ? (
                    <div className="pl-8">
                      <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="specialist-role">
                        Your certified role
                      </label>
                      <select
                        id="specialist-role"
                        value={specialistRole}
                        onChange={(e) => setSpecialistRole(e.target.value as SpecialistProfessionalRoleId)}
                        className="mt-2 w-full max-w-md rounded-xl border border-white/10 bg-[#0B0C0F] px-4 py-3 text-sm text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                      >
                        {SPECIALIST_ROLE_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-[12px] text-white/45">
                        {SPECIALIST_ROLE_OPTIONS.find((o) => o.id === specialistRole)?.description}
                      </p>
                    </div>
                  ) : null}
                </label>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
                <input
                  type="checkbox"
                  checked={pathConfirmAck}
                  onChange={(e) => setPathConfirmAck(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#FF7E00]"
                />
                <span className="text-sm leading-relaxed text-white/70">
                  I confirm that I understand the certification requirements for the path(s) I selected and that I
                  will upload matching documentation on the next step.
                </span>
              </label>
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-4">
                <p className="text-xs text-amber-50/95">
                  Testing: bypass this step with the development password (case-sensitive). This will mark CPT and
                  nutrition paths (not the specialist path) so both upload sections appear on the next screen.
                </p>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="path-bypass-pw">
                  Development password
                </label>
                <input
                  id="path-bypass-pw"
                  type="password"
                  autoComplete="off"
                  value={pathBypassPassword}
                  onChange={(e) => setPathBypassPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0C0F] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleProfessionalPathBypass()}
                  className="mt-3 flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 text-xs font-black tracking-[0.08em] text-amber-100 transition hover:border-amber-400/55 disabled:opacity-50"
                >
                  BYPASS THIS STEP
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    !pathConfirmAck ||
                    (!pathCpt && !pathNutrition && !pathSpecialist) ||
                    (pathCpt && pathSpecialist)
                  }
                  onClick={() => void handleProfessionalPathContinue()}
                  className="group relative isolate flex min-h-[3rem] flex-1 items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-40"
                >
                  <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
                  <span className="relative">{busy ? "Saving…" : "Save and continue"}</span>
                </button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-6">
              {profile?.onboardingTrackCpt && profile?.onboardingTrackNutrition ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  Upload and verify each required credential. You cannot continue until every selected path shows{" "}
                  <span className="font-black tracking-wide">APPROVED</span> for CPT and for nutrition.
                </p>
              ) : null}
              {profile?.onboardingTrackSpecialist && profile?.onboardingTrackNutrition ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  Upload your specialist credential and your nutrition credential. Each selected path must show{" "}
                  <span className="font-black tracking-wide">APPROVED</span> before you continue.
                </p>
              ) : null}
              {profile?.onboardingTrackCpt && !profile?.onboardingTrackNutrition && !profile?.onboardingTrackSpecialist ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  Upload your CPT credential. You cannot continue until CPT verification is{" "}
                  <span className="font-black tracking-wide">APPROVED</span>.
                </p>
              ) : null}
              {profile?.onboardingTrackSpecialist && !profile?.onboardingTrackNutrition ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  Upload the credential that matches the specialist role you selected. Verification must be{" "}
                  <span className="font-black tracking-wide">APPROVED</span> before you continue.
                </p>
              ) : null}
              {profile?.onboardingTrackNutrition && !profile?.onboardingTrackCpt && !profile?.onboardingTrackSpecialist ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  Upload your nutrition credential. You cannot continue until nutrition verification is{" "}
                  <span className="font-black tracking-wide">APPROVED</span>.
                </p>
              ) : null}

              {profile?.onboardingTrackCpt ? (
                <>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-4 text-xs text-white/55">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">CPT verification status:</p>
                    <p className="mt-2 text-sm font-black tracking-[0.12em] text-white">{cptStatus}</p>
                    {cptStatus === "DENIED" ? (
                      <p className="mt-3 rounded-lg border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-3 py-2 text-[13px] text-[#FFB4B4]">
                        Your CPT credential was denied. You will receive an email with specific reasons. You cannot
                        continue until Match Fit staff updates your record or approves a resubmission.
                      </p>
                    ) : null}
                    {showCptPendingPill ? (
                      <div className="mt-3">
                        <HumanReviewPill />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">CPT (Certified Personal Trainer Certification)</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      PDF or image, up to 5 MB. Your CPT must be issued by a credible organization that commercial gyms
                      and professional training employers commonly accept (see list below).
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                        className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                      />
                      <button
                        type="button"
                        disabled={certBusy}
                        onClick={() => void handleCertUpload("cpt")}
                        className="flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-50"
                      >
                        {certBusy ? "Uploading…" : "Upload CPT file"}
                      </button>
                    </div>
                    {profile?.certificationUrl ? (
                      <p className="mt-2 font-mono text-[11px] text-white/50">{profile.certificationUrl}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {profile?.onboardingTrackSpecialist ? (
                <>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-4 text-xs text-white/55">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      Specialist credential status:
                    </p>
                    <p className="mt-2 text-sm font-black tracking-[0.12em] text-white">{specialistStatus}</p>
                    <p className="mt-2 text-[12px] text-white/50">Selected role: {specialistRoleLabel}</p>
                    {specialistStatus === "DENIED" ? (
                      <p className="mt-3 rounded-lg border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-3 py-2 text-[13px] text-[#FFB4B4]">
                        Your specialist credential was denied. You will receive an email with specific reasons. You
                        cannot continue until Match Fit staff updates your record or approves a resubmission.
                      </p>
                    ) : null}
                    {showSpecialistPendingPill ? (
                      <div className="mt-3">
                        <HumanReviewPill />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Specialist certification upload</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      PDF or image, up to 5 MB. File must match the role you selected ({specialistRoleLabel}).
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setSpecialistCertFile(e.target.files?.[0] ?? null)}
                        className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                      />
                      <button
                        type="button"
                        disabled={certBusy}
                        onClick={() => void handleCertUpload("specialist")}
                        className="flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-50"
                      >
                        {certBusy ? "Uploading…" : "Upload specialist credential"}
                      </button>
                    </div>
                    {profile?.specialistCertificationUrl ? (
                      <p className="mt-2 font-mono text-[11px] text-white/50">{profile.specialistCertificationUrl}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {profile?.onboardingTrackNutrition ? (
                <>
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0E1016]/80 px-4 py-4 text-xs text-white/55">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      Nutrition credential status:
                    </p>
                    <p className="mt-2 text-sm font-black tracking-[0.12em] text-white">{nutritionStatus}</p>
                    {nutritionStatus === "DENIED" ? (
                      <p className="mt-3 rounded-lg border border-[#E32B2B]/35 bg-[#E32B2B]/10 px-3 py-2 text-[13px] text-[#FFB4B4]">
                        Your nutrition credential was denied. You will receive an email with specific reasons. You cannot
                        continue until Match Fit staff updates your record or approves a resubmission.
                      </p>
                    ) : null}
                    {showNutritionPendingPill ? (
                      <div className="mt-3">
                        <HumanReviewPill />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Registered Dietitian Nutritionist (RDN) &amp; related nutrition credentials
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      PDF or image, up to 5 MB. RDN/RD, CNS, CNC, and other nationally recognized nutrition credentials
                      are accepted (see examples below). Match Fit may request scope-of-practice details depending on your
                      jurisdiction.
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setNutrCertFile(e.target.files?.[0] ?? null)}
                        className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                      />
                      <button
                        type="button"
                        disabled={certBusy}
                        onClick={() => void handleCertUpload("nutritionist")}
                        className="flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-50"
                      >
                        {certBusy ? "Uploading…" : "Upload nutrition credential"}
                      </button>
                    </div>
                    {profile?.nutritionistCertificationUrl ? (
                      <p className="mt-2 font-mono text-[11px] text-white/50">{profile.nutritionistCertificationUrl}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {profile?.onboardingTrackCpt || profile?.onboardingTrackNutrition || profile?.onboardingTrackSpecialist ? (
                <div>
                  <p className="text-sm font-semibold text-white">Other relevant certifications</p>
                  <p className="mt-1 text-xs text-white/50">
                    Optional — PDF or image, up to 5 MB. Shown on your compliance record with a verified badge after
                    review.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setOtherCertFile(e.target.files?.[0] ?? null)}
                      className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                    />
                    <button
                      type="button"
                      disabled={certBusy}
                      onClick={() => void handleCertUpload("other")}
                      className="flex min-h-[3rem] items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/25 disabled:opacity-50"
                    >
                      {certBusy ? "Uploading…" : "Upload other certification"}
                    </button>
                  </div>
                  {profile?.otherCertificationUrl ? (
                    <p className="mt-2 font-mono text-[11px] text-white/50">{profile.otherCertificationUrl}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="cert-bypass-pw">
                  Bypass certification verification (testing)
                </label>
                <input
                  id="cert-bypass-pw"
                  type="password"
                  autoComplete="off"
                  value={certBypassPassword}
                  onChange={(e) => setCertBypassPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0C0F] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCertBypass()}
                  className="mt-3 flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-400/55 disabled:opacity-50"
                >
                  Bypass certification verification
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!certsComplete}
                  onClick={() => setStep(5)}
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Continue to W-9
                </button>
              </div>

              <OnboardingCertStatusLegend title="Credential verification statuses" />
              {profile?.onboardingTrackCpt ? (
                <section className="mt-2 border-t border-white/10 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]/90">
                    Widely accepted CPT-issuing organizations
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/50">
                    Major health clubs and training studios commonly hire from NCCA-accredited CPT programs and other
                    established national providers. Examples include:
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {CREDIBLE_CPT_ORGANIZATIONS.map((org) => (
                      <li
                        key={org.issuer}
                        className="rounded-2xl border border-white/[0.07] bg-[#0E1016]/90 px-4 py-3 text-[12px] leading-snug text-white/70"
                      >
                        <p className="font-semibold text-white/90">{org.issuer}</p>
                        <p className="mt-1 text-white/60">{org.credential}</p>
                        {org.note ? <p className="mt-2 text-[11px] text-white/45">{org.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {profile?.onboardingTrackNutrition ? (
                <section className="mt-6 border-t border-white/10 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]/90">
                    Recognized nutrition credentials
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/50">
                    Examples of nutrition credentials often paired with coaching in professional settings:
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {CREDIBLE_NUTRITION_CREDENTIALS.map((c) => (
                      <li
                        key={c.issuer}
                        className="rounded-2xl border border-white/[0.07] bg-[#0E1016]/90 px-4 py-3 text-[12px] leading-snug text-white/70"
                      >
                        <p className="font-semibold text-white/90">{c.issuer}</p>
                        <p className="mt-1 text-white/60">{c.credential}</p>
                        {c.note ? <p className="mt-2 text-[11px] text-white/45">{c.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {profile?.onboardingTrackSpecialist ? (
                <section className="mt-6 border-t border-white/10 pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7E00]/90">
                    Specialist credential checklist
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/50">
                    Upload must clearly show your name, issuing organization, and active status for:{" "}
                    <span className="font-semibold text-white/75">{specialistRoleLabel}</span>.
                  </p>
                </section>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <form onSubmit={handleW9Submit} className="flex flex-col gap-5">
              <p className="text-sm text-white/60">
                Your personal information is protected in line with our security practices. After you finish, your W-9
                will be available from your dashboard under <span className="font-semibold text-white">Documents</span>{" "}
                (download or email to an address you configure there — coming soon).
              </p>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-4">
                <p className="text-xs leading-relaxed text-amber-50/95">
                  Testing only: enter the development password (case-sensitive), then autofill. Your legal name will
                  match the first and last name from trainer sign-up; all other fields are random placeholders so you
                  can complete this step quickly.
                </p>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-autofill-pw">
                  Development password
                </label>
                <input
                  id="w9-autofill-pw"
                  type="password"
                  autoComplete="off"
                  value={w9AutofillPassword}
                  onChange={(e) => setW9AutofillPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0C0F] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={handleW9DevAutofill}
                  className="mt-3 flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 text-xs font-black uppercase tracking-[0.1em] text-amber-100 transition hover:border-amber-400/55"
                >
                  Autofill W-9 for testing
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-legal">
                    Legal name (as shown on your income tax return)
                  </label>
                  <input
                    id="w9-legal"
                    required
                    value={w9LegalName}
                    onChange={(e) => setW9LegalName(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-bus">
                    Business name / disregarded entity name (if different)
                  </label>
                  <input
                    id="w9-bus"
                    value={w9BusinessName}
                    onChange={(e) => setW9BusinessName(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-class">
                    Federal tax classification
                  </label>
                  <select
                    id="w9-class"
                    value={w9Classification}
                    onChange={(e) => setW9Classification(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  >
                    <option value="individual">Individual / sole proprietor</option>
                    <option value="c_corporation">C corporation</option>
                    <option value="s_corporation">S corporation</option>
                    <option value="partnership">Partnership</option>
                    <option value="trust_estate">Trust / estate</option>
                    <option value="llc">LLC (tax classification as indicated in IRS instructions)</option>
                    <option value="other">Other (see IRS Form W-9)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-a1">
                    Street address
                  </label>
                  <input
                    id="w9-a1"
                    required
                    value={w9Address1}
                    onChange={(e) => setW9Address1(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-a2">
                    Apt., suite, unit (optional)
                  </label>
                  <input
                    id="w9-a2"
                    value={w9Address2}
                    onChange={(e) => setW9Address2(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-city">
                    City
                  </label>
                  <input
                    id="w9-city"
                    required
                    value={w9City}
                    onChange={(e) => setW9City(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-state">
                    State
                  </label>
                  <select
                    id="w9-state"
                    required
                    value={(() => {
                      const u = w9State.trim().toUpperCase();
                      return US_STATE_POSTAL_OPTIONS.some((o) => o.value === u) ? u : "";
                    })()}
                    onChange={(e) => setW9State(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  >
                    <option value="">Select state</option>
                    {US_STATE_POSTAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-zip">
                    ZIP or postal code
                  </label>
                  <input
                    id="w9-zip"
                    required
                    value={w9Zip}
                    onChange={(e) => setW9Zip(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50">TIN type</label>
                  <select
                    value={w9TinType}
                    onChange={(e) => setW9TinType(e.target.value as "SSN" | "EIN")}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  >
                    <option value="SSN">SSN</option>
                    <option value="EIN">EIN</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="w9-tin">
                    Taxpayer identification number
                  </label>
                  <input
                    id="w9-tin"
                    required
                    value={w9Tin}
                    onChange={(e) => setW9Tin(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={w9Certify}
                    onChange={(e) => setW9Certify(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#FF7E00]"
                  />
                  <span className="text-sm text-white/70">
                    Under penalties of perjury, I certify that the information provided is true, correct, and complete.
                  </span>
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="group relative isolate flex min-h-[3rem] flex-1 items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
                >
                  <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
                  <span className="relative">{busy ? "Saving…" : "Save and continue"}</span>
                </button>
              </div>
            </form>
          ) : null}

          {step === 6 ? (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              <p className="text-sm text-white/55">
                First and last name are taken from your trainer sign-up. You can adjust everything here later from your
                dashboard.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-first">
                    First name
                  </label>
                  <input
                    id="onb-first"
                    readOnly
                    value={firstName}
                    className="cursor-not-allowed rounded-xl border border-white/10 bg-[#0E1016]/60 px-4 py-3 text-[15px] text-white/60 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-last">
                    Last name
                  </label>
                  <input
                    id="onb-last"
                    readOnly
                    value={lastName}
                    className="cursor-not-allowed rounded-xl border border-white/10 bg-[#0E1016]/60 px-4 py-3 text-[15px] text-white/60 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-pref">
                    Preferred name
                  </label>
                  <input
                    id="onb-pref"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
              </div>
              <TrainerProfileDemographyFields
                idPrefix="onb"
                selectClassName="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                inputClassName="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                pronouns={pronouns}
                onPronounsChange={setPronouns}
                ethnicity={ethnicity}
                onEthnicityChange={setEthnicity}
                genderIdentity={genderIdentity}
                onGenderIdentityChange={setGenderIdentity}
                yearsCoaching={yearsCoaching}
                onYearsCoachingChange={setYearsCoaching}
                languagesSpoken={languagesSpoken}
                onLanguagesSpokenChange={setLanguagesSpoken}
                disabled={busy || avatarBusy}
                betweenLanguagesAndYears={
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-niche">
                      Coaching specialties & niches
                    </label>
                    <textarea
                      id="onb-niche"
                      rows={3}
                      value={fitnessNiches}
                      onChange={(e) => setFitnessNiches(e.target.value)}
                      placeholder="e.g., strength for beginners, pre/postnatal, sport-specific, seniors, body recomposition…"
                      className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                    />
                  </div>
                }
              />
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-bio">
                  Bio
                </label>
                <textarea
                  id="onb-bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell clients about your coaching style and experience."
                  className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Profile picture</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                    className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                  />
                  {trainer.profileImageUrl ? (
                    <span className="text-[11px] text-white/45">Current: {trainer.profileImageUrl}</span>
                  ) : null}
                </div>
                {avatarBusy ? <p className="mt-2 text-xs text-white/45">Uploading photo…</p> : null}
              </div>
              <TrainerSocialUrlFields
                socialInstagram={socialInstagram}
                socialTiktok={socialTiktok}
                socialFacebook={socialFacebook}
                socialLinkedin={socialLinkedin}
                socialOtherUrl={socialOtherUrl}
                onSocialInstagram={setSocialInstagram}
                onSocialTiktok={setSocialTiktok}
                onSocialFacebook={setSocialFacebook}
                onSocialLinkedin={setSocialLinkedin}
                onSocialOtherUrl={setSocialOtherUrl}
                ids={{
                  instagram: "soc-ig",
                  tiktok: "soc-tt",
                  facebook: "soc-fb",
                  linkedin: "soc-li",
                  other: "soc-ot",
                }}
                inputClassName="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                disabled={busy || avatarBusy}
                showSectionTitle
              />
              <p className="rounded-xl border border-white/[0.06] bg-[#0E1016]/80 px-4 py-3 text-xs text-white/55">
                You can change your profile, social links, and photo anytime from your trainer dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy || avatarBusy}
                  className="group relative isolate flex min-h-[3rem] flex-1 items-center justify-center overflow-hidden rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition disabled:opacity-50"
                >
                  <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)]" />
                  <span className="relative">{busy || avatarBusy ? "Saving…" : "Finish & go to dashboard"}</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      {leaveModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-onboarding-title"
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#12151C] p-6 shadow-2xl">
            <h2 id="leave-onboarding-title" className="text-lg font-black uppercase tracking-wide text-white">
              Unsaved changes
            </h2>
            <p className="mt-3 text-xs font-semibold uppercase leading-relaxed tracking-wide text-white/55 sm:text-sm">
              Save your progress before returning to the dashboard, or discard changes and continue. Cancel stays on
              this page.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy || avatarBusy}
                onClick={() => void handleLeaveSaveAndGoToDashboard()}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#FF7E00]/25 disabled:opacity-50 sm:text-sm"
              >
                Save &amp; Continue
              </button>
              <button
                type="button"
                disabled={busy || avatarBusy}
                onClick={handleLeaveDiscardAndGoToDashboard}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black uppercase tracking-wide text-white/90 transition hover:border-white/25 disabled:opacity-50 sm:text-sm"
              >
                Don&apos;t Save
              </button>
              <button
                type="button"
                disabled={busy || avatarBusy}
                onClick={() => setLeaveModalOpen(false)}
                className="min-h-[2.75rem] flex-1 rounded-xl border border-white/10 px-4 text-xs font-black uppercase tracking-wide text-white/55 transition hover:text-white/80 disabled:opacity-50 sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
