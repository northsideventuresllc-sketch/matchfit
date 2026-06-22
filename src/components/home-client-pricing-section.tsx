import Link from "next/link";
import {
  CLIENT_BETA_VIP_TRIAL_DAYS,
  CLIENT_FREE_PLAN_FEATURES,
  CLIENT_FREE_PLAN_LABEL,
  CLIENT_VIP_PLAN_FEATURES,
  CLIENT_VIP_PLAN_LABEL,
  clientBetaVipTrialSummary,
  clientVipPriceLabel,
} from "@/lib/client-plan-copy";
import { CLIENT_SIGN_UP_PATH } from "@/lib/home-page-auth";
import { HomeCollapsibleSection } from "@/components/home-collapsible-section";

function PricingCard({
  title,
  price,
  eyebrow,
  features,
  ctaHref,
  ctaLabel,
  highlighted,
}: {
  title: string;
  price: string;
  eyebrow: string;
  features: readonly string[];
  ctaHref: string;
  ctaLabel: string;
  highlighted?: boolean;
}) {
  return (
    <article
      className={
        highlighted
          ? "relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#FF7E00]/35 bg-[linear-gradient(160deg,rgba(255,211,78,0.12),rgba(255,126,0,0.08)_45%,rgba(18,21,28,0.95))] p-6 shadow-[0_24px_70px_-40px_rgba(255,126,0,0.55)] sm:p-7"
          : "flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#12151C]/80 p-6 sm:p-7"
      }
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7E00]">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-black uppercase tracking-wide text-white">{title}</h3>
      <p className="mt-2 text-2xl font-black text-[#FFD34E]">{price}</p>
      <ul className="mt-5 flex-1 space-y-3 text-sm leading-relaxed text-white/65">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7E00]" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={
          highlighted
            ? "mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-5 text-xs font-black uppercase tracking-[0.08em] text-[#0B0C0F]"
            : "mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-xs font-black uppercase tracking-[0.08em] text-white/85"
        }
      >
        {ctaLabel}
      </Link>
    </article>
  );
}

export function HomeClientPricingSection({ loggedIn }: { loggedIn: boolean }) {
  return (
    <HomeCollapsibleSection
      id="client-pricing"
      eyebrow="Client plans"
      eyebrowClass="text-[#FFD34E]"
      title="Free and VIP options for clients"
      accent="left"
      defaultOpen
    >
      <p>
        During beta, every new client starts with{" "}
        <span className="font-semibold text-white/85">{clientBetaVipTrialSummary()}</span>. When that window ends, your
        account moves to the <span className="font-semibold text-white/85">{CLIENT_FREE_PLAN_LABEL}</span> plan unless
        you subscribe to <span className="font-semibold text-[#FFD34E]">{CLIENT_VIP_PLAN_LABEL}</span>.
      </p>
      <div className="grid gap-5 pt-4 lg:grid-cols-2">
        <PricingCard
          eyebrow="After beta VIP trial"
          title={`${CLIENT_FREE_PLAN_LABEL} plan`}
          price="$0 / month"
          features={CLIENT_FREE_PLAN_FEATURES}
          ctaHref={loggedIn ? "/client/dashboard/billing" : CLIENT_SIGN_UP_PATH}
          ctaLabel={loggedIn ? "View billing" : "Sign up free"}
        />
        <PricingCard
          eyebrow="Full platform access"
          title={`${CLIENT_VIP_PLAN_LABEL} plan`}
          price={`${clientVipPriceLabel()} / month`}
          features={[
            `${CLIENT_BETA_VIP_TRIAL_DAYS}-day VIP trial included at sign-up (no card required)`,
            ...CLIENT_VIP_PLAN_FEATURES,
          ]}
          ctaHref={loggedIn ? "/client/dashboard/billing" : CLIENT_SIGN_UP_PATH}
          ctaLabel={loggedIn ? "Upgrade to VIP" : "Start VIP trial"}
          highlighted
        />
      </div>
      <p className="pt-2 text-xs leading-relaxed text-white/45">
        Session purchases with Fitness Pros are priced separately. Match Fit adds a 20% service charge plus transaction
        fees on coach bookings as described in our Terms.
      </p>
    </HomeCollapsibleSection>
  );
}
