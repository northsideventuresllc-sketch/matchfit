import Link from "next/link";
import {
  CLIENT_FREE_PLAN_FEATURES,
  CLIENT_FREE_PLAN_LABEL,
  CLIENT_VIP_PLAN_FEATURES,
  CLIENT_VIP_PLAN_LABEL,
  clientVipPriceLabel,
} from "@/lib/client-plan-copy";
import { CLIENT_SIGN_UP_PATH } from "@/lib/home-page-auth";
import { HomeCollapsibleSection } from "@/components/home-collapsible-section";

function PricingCard({
  title,
  price,
  eyebrow,
  features,
  highlighted,
}: {
  title: string;
  price: string;
  eyebrow: string;
  features: readonly string[];
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
    </article>
  );
}

export function HomeClientPricingSection({ loggedIn }: { loggedIn: boolean }) {
  const signUpHref = loggedIn ? "/client/dashboard/billing" : CLIENT_SIGN_UP_PATH;

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
        Choose the plan that fits how you want to discover coaches.{" "}
        <span className="font-semibold text-white/85">{CLIENT_FREE_PLAN_LABEL}</span> keeps core matching and chat
        available, while <span className="font-semibold text-[#FFD34E]">{CLIENT_VIP_PLAN_LABEL}</span> unlocks full
        discovery, booking, and daily questionnaires.
      </p>
      <div className="grid gap-5 pt-4 lg:grid-cols-2">
        <PricingCard
          eyebrow="Core access"
          title={`${CLIENT_FREE_PLAN_LABEL} plan`}
          price="$0 / month"
          features={CLIENT_FREE_PLAN_FEATURES}
        />
        <PricingCard
          eyebrow="Full platform access"
          title={`${CLIENT_VIP_PLAN_LABEL} plan`}
          price={`${clientVipPriceLabel()} / month`}
          features={CLIENT_VIP_PLAN_FEATURES}
          highlighted
        />
      </div>
      <div className="pt-5">
        <Link
          href={signUpHref}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-6 text-sm font-black uppercase tracking-[0.1em] text-[#0B0C0F] shadow-[0_20px_50px_-18px_rgba(227,43,43,0.45)] transition hover:brightness-105"
        >
          Sign Up Today
        </Link>
      </div>
      <p className="pt-2 text-xs leading-relaxed text-white/45">
        Session purchases with Fitness Pros are priced separately. Match Fit adds a 20% service charge plus transaction
        fees on coach bookings as described in our Terms.
      </p>
    </HomeCollapsibleSection>
  );
}
