import {
  adminCardClass,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/admin-portal-ui";
import {
  b2cRunbook5bChecklist,
  b2cRunbook5bReady,
  MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B,
  type B2cRunbook5bReadinessInput,
  type MatchFitB2cRunbookPhaseId,
} from "@/lib/match-fit-b2c-runbook";

type Props = {
  phaseId: MatchFitB2cRunbookPhaseId;
  readiness5b?: B2cRunbook5bReadinessInput;
  className?: string;
};

export function B2cRunbookPhasePanel({ phaseId, readiness5b, className = "" }: Props) {
  const phase = MATCH_FIT_B2C_RUNBOOK_PHASES_5B_6B.find((p) => p.id === phaseId);
  if (!phase) return null;

  const checklist =
    phaseId === "5b_confirm_client_tags" && readiness5b
      ? b2cRunbook5bChecklist(readiness5b)
      : phase.checklist.map((label) => ({ label, ok: null as boolean | null }));

  const ready = phaseId === "5b_confirm_client_tags" && readiness5b ? b2cRunbook5bReady(readiness5b) : null;

  return (
    <section className={`${adminCardClass} border-[#FF7E00]/15 ${className}`}>
      <p className={adminSectionTitleClass}>RUNBOOK</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-[#FF7E00]/40 bg-[#FF7E00]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#FFD34E]">
          Phase {phase.phase}
        </span>
        <span className="text-sm font-semibold text-white/85">{phase.title}</span>
        <span className="text-[11px] text-white/40">· Playbook step {phase.playbookStep}</span>
        {ready === true ? (
          <span className="text-[11px] font-bold text-[#9BE7B0]">Ready for 6b</span>
        ) : ready === false ? (
          <span className="text-[11px] font-bold text-amber-200/90">Finish checklist before 6b</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{phase.description}</p>
      <ul className={`mt-4 space-y-2 ${adminPanelClass} p-4`}>
        {checklist.map((item) => (
          <li key={item.label} className="flex gap-2 text-sm text-white/60">
            <span className="shrink-0 tabular-nums">
              {item.ok === true ? "✓" : item.ok === false ? "○" : "·"}
            </span>
            <span className={item.ok === true ? "text-white/75" : item.ok === false ? "text-white/45" : ""}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
