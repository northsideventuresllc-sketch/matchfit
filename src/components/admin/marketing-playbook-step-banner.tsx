import Link from "next/link";
import {
  MATCH_FIT_MARKETING_PLAYBOOK_STEPS,
  type MatchFitMarketingPlaybookStepId,
} from "@/lib/match-fit-marketing-playbook";
import { adminLinkClass, adminPanelClass, adminSectionTitleClass } from "@/components/admin/admin-portal-ui";

type Props = {
  /** Highlight this playbook step on the current admin page. */
  currentStepId: MatchFitMarketingPlaybookStepId;
  className?: string;
};

export function MarketingPlaybookStepBanner({ currentStepId, className = "" }: Props) {
  const current = MATCH_FIT_MARKETING_PLAYBOOK_STEPS.find((s) => s.id === currentStepId);
  if (!current) return null;

  return (
    <section className={`${adminPanelClass} border-[#FF7E00]/15 bg-[#FF7E00]/[0.04] p-4 ${className}`}>
      <p className={adminSectionTitleClass}>Marketing playbook</p>
      <p className="mt-2 text-sm font-semibold text-white/85">
        Step {current.step} of 8 — {current.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-white/55">{current.description}</p>
      <ol className="mt-4 flex flex-wrap gap-2">
        {MATCH_FIT_MARKETING_PLAYBOOK_STEPS.map((step) => {
          const active = step.id === currentStepId;
          const content = (
            <span
              className={
                active
                  ? "rounded-md border border-[#FF7E00]/40 bg-[#FF7E00]/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#FFD34E]"
                  : "rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/40"
              }
            >
              {step.step}
            </span>
          );
          if (step.adminPath && step.id !== currentStepId) {
            return (
              <Link key={step.id} href={step.adminPath} className={adminLinkClass} title={step.title}>
                {content}
              </Link>
            );
          }
          return (
            <span key={step.id} title={step.title}>
              {content}
            </span>
          );
        })}
      </ol>
    </section>
  );
}
