"use client";

import Image from "next/image";
import Link from "next/link";
import {
  TRAINER_SIGNUP_STEP_COUNT,
  TRAINER_SIGNUP_STEPS,
  type TrainerSignupStepId,
} from "@/lib/trainer-signup-steps";

type Props = {
  currentStep: TrainerSignupStepId;
  /** When true, show copy that progress is saved when leaving for home. */
  showSaveForLater?: boolean;
};

export function TrainerSignupStepNav({ currentStep, showSaveForLater = false }: Props) {
  const stepMeta = TRAINER_SIGNUP_STEPS.find((s) => s.id === currentStep);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 opacity-90 transition hover:opacity-100">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14">
            <Image src="/logo.png" alt="Match Fit" fill className="object-contain" sizes="56px" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-black tracking-tight sm:text-base">
              <span className="text-[#E8EAEF]">Match</span> <span className="text-[#E32B2B]">Fit</span>
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Trainer sign-up</p>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-wide text-white/50 transition hover:text-white/75"
        >
          Back to Home
        </Link>
      </header>

      <nav
        className="mt-10 flex flex-wrap items-center gap-2"
        aria-label="Trainer sign-up steps"
      >
        {TRAINER_SIGNUP_STEPS.map((step) => {
          const isCurrent = step.id === currentStep;
          return (
            <Link
              key={step.id}
              href={step.href}
              title={step.title}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border px-3 text-xs font-black transition ${
                isCurrent
                  ? "border-[#FF7E00]/60 bg-[#FF7E00]/15 text-white"
                  : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"
              }`}
            >
              {step.id}
            </Link>
          );
        })}
      </nav>

      <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{stepMeta?.title ?? "Trainer sign-up"}</h1>
      <p className="mt-2 text-sm text-white/55 sm:text-base">
        Step {currentStep} of {TRAINER_SIGNUP_STEP_COUNT}
      </p>

      {showSaveForLater ? (
        <p className="mt-3 text-xs leading-relaxed text-white/45">
          Your account progress is saved. You can{" "}
          <Link href="/" className="font-semibold text-[#FF7E00] underline-offset-2 hover:underline">
            return home
          </Link>{" "}
          and sign in later to pick up where you left off.
        </p>
      ) : null}
    </>
  );
}
