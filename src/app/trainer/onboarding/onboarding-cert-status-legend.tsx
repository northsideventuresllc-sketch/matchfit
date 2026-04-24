type OnboardingCertStatusLegendProps = {
  title: string;
};

export function OnboardingCertStatusLegend({ title }: OnboardingCertStatusLegendProps) {
  const rows: { status: string; description: string }[] = [
    {
      status: "NOT STARTED",
      description: "No certification file has been uploaded yet for this category.",
    },
    {
      status: "PENDING",
      description: "A file is on file and is awaiting Match Fit review or automated verification.",
    },
    {
      status: "APPROVED",
      description: "Your credential has been verified and meets Match Fit requirements for this path.",
    },
    {
      status: "DENIED",
      description: "Verification did not pass. You will receive email with next steps; you cannot continue until staff resolves the record.",
    },
  ];

  return (
    <section className="mt-8 border-t border-white/10 pt-6">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-white/50">
        Your current status is shown above. Below is what each value means.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <li
            key={row.status}
            className="rounded-2xl border border-white/[0.07] bg-[#0E1016]/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <p className="font-mono text-[11px] font-black tracking-[0.14em] text-[#FF7E00]">{row.status}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-white/65">{row.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
