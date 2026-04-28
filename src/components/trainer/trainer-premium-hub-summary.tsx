import Link from "next/link";

type Variant = "full" | "compact";

type Props = {
  variant?: Variant;
  className?: string;
  /** When true, copy references shortcut cards above this block (enrolled hub). */
  quickLinksAbove?: boolean;
};

/**
 * Shared copy for the Premium hub, signup prompt, and dashboard teaser.
 */
export function TrainerPremiumHubSummary(props: Props) {
  const variant = props.variant ?? "full";
  const wrap = props.className?.trim() ? props.className : "";
  const quickLinksAbove = props.quickLinksAbove ?? true;

  if (variant === "compact") {
    return (
      <div
        className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#FF7E00]/[0.08] via-[#12151C] to-[#0E1016] p-5 text-left shadow-[0_20px_60px_-30px_rgba(0,0,0,0.75)] ${wrap}`}
      >
        <p className="text-sm leading-relaxed text-white/75">
          <span className="font-semibold text-white/90">Premium trainers</span> unlock featured placement options, a Fit
          Hub studio for posts clients actually see, and promotion tokens for regional boosts—plus one hub to manage it
          all. Treating those surfaces as part of your business plan is one of the fastest ways to get in front of serious
          clients.
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-white/55">
          <li>
            <span className="font-semibold text-[#FF7E00]/95">Placement &amp; Auctions</span> — eligibility, daily entry,
            and bidding for discovery.
          </li>
          <li>
            <span className="font-semibold text-[#FF7E00]/95">Content Creation</span> — create and schedule media; edit
            visibility in My Content.
          </li>
          <li>
            <span className="font-semibold text-[#FF7E00]/95">Token Balance &amp; FitHub Boost</span> — balance, packs, and
            promoted video runs by region.
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0E1016]/80 p-6 shadow-[0_28px_80px_-36px_rgba(255,126,0,0.35)] sm:p-8 ${wrap}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#FF7E00]/15 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#E32B2B]/10 blur-3xl" />

      <div className="relative space-y-4 text-center">
        <p className="text-sm leading-relaxed text-white/70">
          Being a <span className="font-semibold text-white">premium trainer</span> means you get the full growth stack:
          tools to compete for featured placement, a professional pipeline to publish to Fit Hub, and token-based boosts so
          the right clients see your best work—not just a badge.
        </p>
        <p className="text-xs leading-relaxed text-white/45">
          {quickLinksAbove ? (
            <>
              The shortcuts above jump you into each workspace; this section spells out what you are opening and why it
              matters for discovery and trust.
            </>
          ) : (
            <>
              When you are ready, enroll using the card above. After you are on premium, the three shortcut cards on this
              page lead this overview—each one opens a focused workspace.
            </>
          )}
        </p>
      </div>

      <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 text-center">
          <p className="text-sm font-semibold text-white">Featured Trainer</p>
          <p className="mt-2 text-sm font-semibold text-[#FF7E00]">Placement &amp; Auctions</p>
          <p className="mx-auto mt-2 max-w-[14rem] text-xs leading-relaxed text-white/45">
            Manage eligibility, daily raffle entry, and auction bids so you can surface in client-facing featured
            experiences when windows open.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 text-center">
          <p className="text-sm font-semibold text-white">Fit Hub &amp; Content</p>
          <p className="mt-2 text-sm font-semibold text-[#FF7E00]">Content Creation</p>
          <p className="mx-auto mt-2 max-w-[14rem] text-xs leading-relaxed text-white/45">
            Upload photos, clips, check-ins, and carousels—then publish or schedule. My Content on the same page is where
            you review, share, privatize, or remove what is live.
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#12151C]/90 p-4 text-center">
          <p className="text-sm font-semibold text-white">Promotion Tokens</p>
          <p className="mt-2 text-sm font-semibold text-[#FF7E00]">Token Balance &amp; FitHub Boost</p>
          <p className="mx-auto mt-2 max-w-[14rem] text-xs leading-relaxed text-white/45">
            Track your balance, buy packs when you need more runway, and spend tokens to promote eligible public videos
            to clients in your configured service region.
          </p>
        </div>
      </div>
    </div>
  );
}

export function TrainerPremiumHubBackLink() {
  return (
    <p className="text-center text-sm">
      <Link
        href="/trainer/dashboard/premium"
        className="font-semibold text-[#FF7E00] underline-offset-2 transition hover:text-[#FF9A3D] hover:underline"
      >
        ← Premium hub
      </Link>
    </p>
  );
}
