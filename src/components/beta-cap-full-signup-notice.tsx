import Link from "next/link";

type BetaCapFullSignupNoticeProps = {
  role: "client" | "trainer";
  waitlistHref: string;
  cap: number | null;
  count: number | null;
  slotsUsed?: number | null;
};

export function BetaCapFullSignupNotice({ role, waitlistHref, cap, count, slotsUsed }: BetaCapFullSignupNoticeProps) {
  const isClient = role === "client";
  const title = isClient ? "Memberships are full for this beta" : "Fitness Pro slots are full for this beta";
  const body = isClient
    ? "All founding client membership slots for this beta are taken. Anyone, anywhere can still join the waitlist — we will email you a secure invite when a slot opens, usually within 30 days to complete sign-up."
    : "All Fitness Pro slots for the Atlanta metro beta are taken. Join the waitlist and we will email you when a slot opens.";
  const cta = isClient ? "Join the client waitlist" : "Join the Fitness Pro waitlist";
  const capLine =
    cap != null && count != null ? (
      <p className="mt-3 text-xs text-white/45">
        {isClient ? "Clients" : "Fitness Pros"} signed up: {count} / {cap}
        {slotsUsed != null && slotsUsed !== count
          ? ` (${slotsUsed} slots reserved including pending invites)`
          : null}
      </p>
    ) : null;

  return (
    <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-5 py-5 sm:px-6" role="status">
      <p className="text-base font-black tracking-tight text-amber-50">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/90">{body}</p>
      {capLine}
      <Link
        href={waitlistHref}
        className="mt-5 flex min-h-[3.25rem] items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFD34E_0%,#FF7E00_45%,#E32B2B_100%)] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#0B0C0F] transition hover:opacity-95"
      >
        {cta}
      </Link>
      <p className="mt-4 text-xs leading-relaxed text-white/50">
        Already received a beta invite email? Open the link in that message to sign up — your reserved username and email
        will be prefilled.
      </p>
    </div>
  );
}
