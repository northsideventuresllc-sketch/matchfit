import { TRAINER_CERTIFICATION_POSITIONS_REFERENCE } from "@/lib/trainer-certification-positions-reference";

export function TrainerComplianceCertReferenceDetails() {
  return (
    <details className="mt-6 rounded-2xl border border-white/[0.06] bg-[#0E1016]/40 px-4 py-3">
      <summary className="cursor-pointer list-none text-center text-xs font-semibold text-[#FF7E00] underline-offset-2 transition hover:text-[#FFD34E] [&::-webkit-details-marker]:hidden">
        <span className="underline">Credentials you can upload &amp; widely accepted accrediting organizations</span>
      </summary>
      <div className="mt-4 space-y-8 border-t border-white/[0.06] pt-5 text-left">
        {TRAINER_CERTIFICATION_POSITIONS_REFERENCE.map((pos) => (
          <section key={pos.id}>
            <h3 className="text-sm font-bold text-white">{pos.positionLabel}</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/50">{pos.summary}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">Example certification names</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/65">
              {pos.exampleCredentialNames.map((name, i) => (
                <li key={`${pos.id}-ex-${i}-${name}`}>{name}</li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              Accredited / widely accepted issuing organizations
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {pos.accreditingBodies.map((org) => (
                <li
                  key={`${pos.id}-${org.issuer}-${org.credential}`}
                  className="rounded-xl border border-white/[0.06] bg-[#12151C]/80 px-3 py-2 text-[11px] leading-snug text-white/65"
                >
                  <span className="font-semibold text-white/85">{org.issuer}</span>
                  <span className="mt-0.5 block text-white/60">{org.credential}</span>
                  {org.note ? <span className="mt-1 block text-[10px] text-white/45">{org.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
