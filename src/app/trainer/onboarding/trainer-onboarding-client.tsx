"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TRAINER_ONBOARDING_AGREEMENT_BULLETS } from "@/app/trainer/onboarding/trainer-agreement-bullets";
import { CREDIBLE_CPT_ORGANIZATIONS } from "@/app/trainer/onboarding/credible-cpt-organizations";
import { CREDIBLE_NUTRITION_CREDENTIALS } from "@/app/trainer/onboarding/credible-nutrition-credentials";
import { OnboardingCertStatusLegend } from "@/app/trainer/onboarding/onboarding-cert-status-legend";
import { TrainerSocialUrlFields } from "@/components/trainer/trainer-social-url-fields";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { normalizeTrainerSocialFields } from "@/lib/trainer-social-urls";
import { postTrainerLogout } from "@/lib/trainer-logout";
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
    onboardingTrackCpt: boolean;
    onboardingTrackNutrition: boolean;
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

export default function TrainerOnboardingClient() {
  const router = useRouter();
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
  const [certBusy, setCertBusy] = useState(false);

  const [pathCpt, setPathCpt] = useState(false);
  const [pathNutrition, setPathNutrition] = useState(false);
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

  const loadMe = useCallback(async () => {
    setMeError(null);
    setLoadingMe(true);
    try {
      const res = await fetch("/api/trainer/me", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as { error?: string; trainer?: TrainerMe };
      if (!res.ok) {
        setMeError(data.error ?? "Could not load your account.");
        setTrainer(null);
        return;
      }
      if (data.trainer) {
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

        if (!didBootstrapFromServer.current) {
          didBootstrapFromServer.current = true;
          if (t.profile?.hasSignedTOS) {
            setAgreementChecks(Array(AGREEMENT_COUNT).fill(true));
          }
          const p = t.profile;
          if (p) {
            if (!p.hasSignedTOS) setStep(1);
            else if (p.backgroundCheckStatus !== "APPROVED") setStep(2);
            else if (!p.onboardingTrackCpt && !p.onboardingTrackNutrition) setStep(3);
            else if (!certificationsGatePassed(p)) setStep(4);
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
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMe();
    });
  }, [loadMe]);

  const profile = trainer?.profile;

  useEffect(() => {
    if (!profile) return;
    const cpt = profile.onboardingTrackCpt;
    const nut = profile.onboardingTrackNutrition;
    const id = window.setTimeout(() => {
      setPathCpt(cpt);
      setPathNutrition(nut);
    }, 0);
    return () => window.clearTimeout(id);
  }, [profile?.onboardingTrackCpt, profile?.onboardingTrackNutrition]);

  const bgVendor = useMemo(() => coerceTrainerBackgroundVendorStatus(profile?.backgroundCheckStatus), [profile?.backgroundCheckStatus]);
  const cptStatus = useMemo(() => coerceTrainerCptStatus(profile?.certificationReviewStatus), [profile?.certificationReviewStatus]);
  const nutritionStatus = useMemo(
    () => coerceTrainerCptStatus(profile?.nutritionistCertificationReviewStatus),
    [profile?.nutritionistCertificationReviewStatus],
  );
  const showCptPendingPill = cptStatus === "PENDING" && !!profile?.certificationUrl;
  const showNutritionPendingPill = nutritionStatus === "PENDING" && !!profile?.nutritionistCertificationUrl;
  const bgNeedsReview = bgVendor === "NEEDS_FURTHER_REVIEW";

  const certsComplete = useMemo(() => {
    if (!profile) return false;
    return certificationsGatePassed({
      onboardingTrackCpt: profile.onboardingTrackCpt,
      onboardingTrackNutrition: profile.onboardingTrackNutrition,
      certificationReviewStatus: profile.certificationReviewStatus,
      nutritionistCertificationReviewStatus: profile.nutritionistCertificationReviewStatus,
    });
  }, [profile]);

  const stepHeading = useMemo(() => {
    if (step === 1) return "Acknowledgements";
    if (step === 2) return "Background Screening";
    if (step === 3) return "Your professional path";
    if (step === 4) return "Certifications";
    if (step === 5) return "Tax information (Form W-9)";
    return "Profile Set Up";
  }, [step]);

  const stepSubline = useMemo(() => {
    if (step === 1) return "Fees, screening, and platform policies";
    return null;
  }, [step]);

  async function handleLogout() {
    await postTrainerLogout();
    router.push("/trainer/dashboard/login");
    router.refresh();
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
    if (!pathCpt && !pathNutrition) {
      setError("Select at least one professional path.");
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
      router.push("/trainer/dashboard");
      router.refresh();
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

  async function handleCertUpload(kind: "cpt" | "other" | "nutritionist") {
    setError(null);
    const file = kind === "cpt" ? certFile : kind === "nutritionist" ? nutrCertFile : otherCertFile;
    if (!file) {
      setError(
        kind === "cpt"
          ? "Choose a CPT certification file first."
          : kind === "nutritionist"
            ? "Choose a nutritionist certification file first."
            : "Choose an additional certification file first.",
      );
      return;
    }
    setCertBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("uploadType", kind === "other" ? "other" : kind === "nutritionist" ? "nutritionist" : "cpt");
      const res = await fetch("/api/trainer/onboarding/certification", { method: "POST", credentials: "include", body: fd });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      if (kind === "cpt") setCertFile(null);
      else if (kind === "nutritionist") setNutrCertFile(null);
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
      const scopes: ("cpt" | "nutritionist")[] = [];
      if (profile?.onboardingTrackCpt) scopes.push("cpt");
      if (profile?.onboardingTrackNutrition) scopes.push("nutritionist");
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
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/25 hover:text-white"
          >
            Log out
          </button>
        </header>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
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
                <Link
                  href="/trainer/dashboard"
                  className="flex min-h-[3rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold tracking-wide text-white transition hover:border-white/25"
                >
                  Back to Dashboard
                </Link>
                <button
                  type="button"
                  disabled
                  title="Trainer Terms of Service link will be added before launch."
                  className="flex min-h-[3rem] flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-4 text-sm font-semibold tracking-wide text-white/35"
                >
                  View Trainer Terms of Service
                </button>
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
                    onChange={(e) => setPathCpt(e.target.checked)}
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
                    <p className="text-sm font-bold text-white">Nutritionist</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                      You will provide nutrition coaching, meal guidance, or related education within your scope of
                      practice. You must upload a nutrition credential that Match Fit can verify (for example RDN/RD,
                      CNC, or another recognized nutrition certification — examples on the next screen).
                    </p>
                  </div>
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
                  Testing: bypass this step with the development password (case-sensitive). This will mark both paths
                  selected so all upload sections appear on the next screen.
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
                  disabled={busy || !pathConfirmAck || (!pathCpt && !pathNutrition)}
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
              {profile?.onboardingTrackCpt && !profile?.onboardingTrackNutrition ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                  Upload your CPT credential. You cannot continue until CPT verification is{" "}
                  <span className="font-black tracking-wide">APPROVED</span>.
                </p>
              ) : null}
              {profile?.onboardingTrackNutrition && !profile?.onboardingTrackCpt ? (
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
                    <p className="text-sm font-semibold text-white">Nutritionist certification</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      PDF or image, up to 5 MB. Upload a credential from a credible nutrition organization (see examples
                      below). Match Fit may request scope-of-practice details depending on your jurisdiction.
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
                        {certBusy ? "Uploading…" : "Upload nutritionist certification"}
                      </button>
                    </div>
                    {profile?.nutritionistCertificationUrl ? (
                      <p className="mt-2 font-mono text-[11px] text-white/50">{profile.nutritionistCertificationUrl}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {profile?.onboardingTrackCpt || profile?.onboardingTrackNutrition ? (
                <div>
                  <p className="text-sm font-semibold text-white">Other relevant certifications</p>
                  <p className="mt-1 text-xs text-white/50">Optional — PDF or image, up to 5 MB.</p>
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
                  <input
                    id="w9-state"
                    required
                    maxLength={2}
                    value={w9State}
                    onChange={(e) => setW9State(e.target.value)}
                    placeholder="CA"
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
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
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-pro">
                    Pronouns
                  </label>
                  <input
                    id="onb-pro"
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    placeholder="e.g., she/her, he/him, they/them"
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-eth">
                    Ethnicity (optional)
                  </label>
                  <input
                    id="onb-eth"
                    value={ethnicity}
                    onChange={(e) => setEthnicity(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-lang">
                    Languages spoken
                  </label>
                  <input
                    id="onb-lang"
                    value={languagesSpoken}
                    onChange={(e) => setLanguagesSpoken(e.target.value)}
                    placeholder="e.g., English, Spanish — comma separated"
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
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
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-yrs">
                    Years of coaching experience (optional)
                  </label>
                  <input
                    id="onb-yrs"
                    value={yearsCoaching}
                    onChange={(e) => setYearsCoaching(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-white/50" htmlFor="onb-gen">
                    Gender identity (optional)
                  </label>
                  <input
                    id="onb-gen"
                    value={genderIdentity}
                    onChange={(e) => setGenderIdentity(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 focus:border-[#FF7E00]/40 focus:ring-2"
                  />
                </div>
              </div>
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
    </main>
  );
}
