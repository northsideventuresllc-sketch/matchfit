import Link from "next/link";

function row(label: string, value: string | null | undefined) {
  const v = value?.trim();
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[#0E1016]/50 px-4 py-3 sm:grid sm:grid-cols-[minmax(8rem,11rem)_1fr] sm:items-start sm:gap-4 sm:py-3.5">
      <div className="text-[11px] font-semibold text-white/40">{label}</div>
      <div className="mt-1 text-sm leading-relaxed text-white/85 sm:mt-0">{v ? <FieldValue text={v} /> : "—"}</div>
    </div>
  );
}

function FieldValue({ text }: { text: string }) {
  if (/^https?:\/\//i.test(text)) {
    return (
      <a href={text} target="_blank" rel="noopener noreferrer" className="text-[#FF7E00] underline-offset-2 hover:underline">
        {text}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap">{text}</span>;
}

export type TrainerBackgroundVisibilitySnapshot = {
  pronouns: string | null;
  ethnicity: string | null;
  languagesSpoken: string | null;
  fitnessNiches: string | null;
  yearsCoaching: string | null;
  genderIdentity: string | null;
  socialInstagram: string | null;
  socialTiktok: string | null;
  socialFacebook: string | null;
  socialLinkedin: string | null;
  socialOtherUrl: string | null;
};

export function TrainerDashboardBackgroundVisibility(props: {
  data: TrainerBackgroundVisibilitySnapshot;
  settingsHref: string;
}) {
  const { data } = props;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
      <h2 className="text-center text-xs font-bold uppercase tracking-[0.18em] text-white/40">Background &amp; visibility</h2>
      <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-relaxed text-white/50">
        Same fields as in{" "}
        <Link href={props.settingsHref} className="text-[#FF7E00] underline-offset-2 hover:underline">
          Account Settings
        </Link>
        . Updates here whenever you save your profile.
      </p>
      <div className="mt-5 space-y-2">
        {row("Pronouns", data.pronouns)}
        {row("Ethnicity", data.ethnicity)}
        {row("Languages spoken", data.languagesSpoken)}
        {row("Fitness niches", data.fitnessNiches)}
        {row("Years of coaching", data.yearsCoaching)}
        {row("Gender identity", data.genderIdentity)}
        {row("Instagram", data.socialInstagram)}
        {row("TikTok", data.socialTiktok)}
        {row("Facebook", data.socialFacebook)}
        {row("LinkedIn", data.socialLinkedin)}
        {row("Other link", data.socialOtherUrl)}
      </div>
    </section>
  );
}
