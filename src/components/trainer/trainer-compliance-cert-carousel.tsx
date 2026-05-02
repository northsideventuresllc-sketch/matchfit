import Link from "next/link";
import { SPECIALIST_ROLE_OPTIONS } from "@/lib/trainer-specialist-roles";
import { certificationReviewStatusLabel } from "@/lib/trainer-compliance-status-copy";

type CertSlide = {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  reviewStatus: string;
};

function VerifiedSticker({ ok }: { ok: boolean }) {
  if (!ok) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">
      ✓ Verified
    </span>
  );
}

function statusPillClass(status: string | null | undefined): string {
  const s = (status ?? "NOT_STARTED").trim().toUpperCase();
  if (s === "APPROVED") {
    return "border-emerald-300/35 bg-emerald-500/15 text-emerald-200";
  }
  if (s === "PENDING") {
    return "border-amber-300/35 bg-amber-500/15 text-amber-100";
  }
  if (s === "DENIED") {
    return "border-rose-300/35 bg-rose-500/15 text-rose-200";
  }
  return "border-white/15 bg-white/[0.07] text-white/80";
}

export function TrainerComplianceCertCarousel(props: {
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  onboardingTrackSpecialist: boolean;
  specialistProfessionalRole: string | null;
  certificationUrl: string | null;
  nutritionistCertificationUrl: string | null;
  specialistCertificationUrl: string | null;
  otherCertificationUrl: string | null;
  certificationReviewStatus: string | null;
  nutritionistCertificationReviewStatus: string | null;
  specialistCertificationReviewStatus: string | null;
  otherCertificationReviewStatus: string | null;
}) {
  const slides: CertSlide[] = [];

  if (props.onboardingTrackCpt || props.certificationUrl) {
    slides.push({
      key: "cpt",
      title: "Certified Personal Trainer (CPT)",
      subtitle: "Primary personal-training credential.",
      href: props.certificationUrl ?? "#",
      reviewStatus: props.certificationReviewStatus ?? "NOT_STARTED",
    });
  }

  if (props.onboardingTrackNutrition || props.nutritionistCertificationUrl) {
    slides.push({
      key: "rdn",
      title: "Registered Dietitian Nutritionist (RDN) & related nutrition credentials",
      subtitle: "RDN/RD, CNS, CNC, or equivalent on file.",
      href: props.nutritionistCertificationUrl ?? "#",
      reviewStatus: props.nutritionistCertificationReviewStatus ?? "NOT_STARTED",
    });
  }

  if (props.onboardingTrackSpecialist || props.specialistCertificationUrl) {
    const roleLabel =
      SPECIALIST_ROLE_OPTIONS.find((o) => o.id === props.specialistProfessionalRole)?.label ?? "Certified specialist";
    slides.push({
      key: "specialist",
      title: "Other certified fitness specialist",
      subtitle: roleLabel,
      href: props.specialistCertificationUrl ?? "#",
      reviewStatus: props.specialistCertificationReviewStatus ?? "NOT_STARTED",
    });
  }

  if (props.otherCertificationUrl) {
    slides.push({
      key: "other",
      title: "Additional certification",
      subtitle: "Optional supporting credential.",
      href: props.otherCertificationUrl,
      reviewStatus: props.otherCertificationReviewStatus ?? "NOT_STARTED",
    });
  }

  if (!slides.length) {
    return <p className="mt-3 text-sm text-white/45">No certification files on record.</p>;
  }

  return (
    <div className="mt-5">
      <p className="text-xs text-white/45">Swipe horizontally on small screens to review each upload.</p>
      <div className="mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {slides.map((s) => {
          const approved = s.reviewStatus.trim().toUpperCase() === "APPROVED";
          const missingFile = s.href === "#";
          return (
            <div
              key={s.key}
              className="w-[min(100%,22rem)] shrink-0 snap-start rounded-2xl border border-white/[0.08] bg-[#0E1016]/90 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-bold text-white">{s.title}</p>
                <VerifiedSticker ok={approved} />
              </div>
              {s.subtitle ? <p className="mt-2 text-xs leading-relaxed text-white/50">{s.subtitle}</p> : null}
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">Review status</p>
              <p className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black tracking-[0.08em] ${statusPillClass(
                    s.reviewStatus,
                  )}`}
                >
                  {certificationReviewStatusLabel(s.reviewStatus).toUpperCase()}
                </span>
              </p>
              <div className="mt-4">
                {missingFile ? (
                  <span className="text-xs text-white/40">No file uploaded.</span>
                ) : (
                  <Link
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#FF7E00] underline-offset-2 hover:underline"
                  >
                    Open uploaded file
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
