"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AdminPortalBackdrop,
  adminAccentButtonClass,
  adminCardClass,
  adminInputClassSm,
  adminLabelClass,
  adminLinkClass,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-portal-ui";
import { OUTREACH_COWORK_DAILY_CAPS } from "@/lib/outreach-cowork";
import {
  MATCH_FIT_SIGNATURE_FROM_EMAIL,
  MATCH_FIT_SIGNATURE_LINES,
} from "@/lib/match-fit-signature";

type ApprovalState = "pending" | "approved" | "denied";

type DemoIgLead = {
  id: string;
  handle: string;
  profileUrl: string;
  niche: string;
  intent: string;
  likelihood: number;
  whyMatchFit: string;
  dmText: string;
  commentText: string;
  commentPostRef: string;
  postUrl: string;
};

type DemoEmailLead = {
  id: string;
  name: string;
  businessName: string;
  email: string;
  emailSourceUrl: string;
  intent: string;
  likelihood: number;
  whyMatchFit: string;
  subject: string;
  body: string;
};

const DEMO_IG_LEADS: DemoIgLead[] = [
  {
    id: "ig_1",
    handle: "@coach.mara.strong",
    profileUrl: "https://instagram.com/coach.mara.strong",
    niche: "Strength & conditioning",
    intent: "Join as Fitness Pro",
    likelihood: 82,
    whyMatchFit: "Independent S&C coach posting client wins — strong fit for founding Fitness Pro slots.",
    dmText:
      "Hey Mara — your S&C content is legit. I'm building Match Fit, a two-sided app that puts serious Fitness Pros in front of athletes ready to book. Founding pros get first-mover visibility + beta pricing. Want the 2-min rundown?",
    commentText: "This progression breakdown is clean 🔥 the cue on bracing is spot on.",
    commentPostRef: "Reel · Feb 12 · 'Bracing 101'",
    postUrl: "https://instagram.com/p/demo-mara-bracing",
  },
  {
    id: "ig_2",
    handle: "@liftwithdre",
    profileUrl: "https://instagram.com/liftwithdre",
    niche: "Hybrid / online coaching",
    intent: "Both",
    likelihood: 74,
    whyMatchFit: "Runs online + in-person hybrid — good for discovery matching across virtual clients.",
    dmText:
      "Dre — love the hybrid model you've built. Match Fit connects Fitness Pros like you with clients who are already searching. No cold outreach on your end. Can I send you the founding-pro details?",
    commentText: "The way you scale online programming without losing the personal touch is 👌",
    commentPostRef: "Carousel · Feb 10 · 'Online vs in-person'",
    postUrl: "https://instagram.com/p/demo-dre-hybrid",
  },
  {
    id: "ig_3",
    handle: "@fitbykayla",
    profileUrl: "https://instagram.com/fitbykayla",
    niche: "Women's strength",
    intent: "List With Us",
    likelihood: 69,
    whyMatchFit: "Established women's strength coach — ideal for List With Us discovery listing.",
    dmText:
      "Kayla — your women's strength community is exactly who Match Fit clients look for. Listing with us takes 5 minutes and clients come to you. Want me to send the link?",
    commentText: "Underrated tip on tempo work — saving this for my own sessions.",
    commentPostRef: "Reel · Feb 9 · 'Tempo tuts'",
    postUrl: "https://instagram.com/p/demo-kayla-tempo",
  },
  {
    id: "ig_4",
    handle: "@mobility.marcus",
    profileUrl: "https://instagram.com/mobility.marcus",
    niche: "Mobility & rehab",
    intent: "Join as Fitness Pro",
    likelihood: 71,
    whyMatchFit: "Mobility/rehab niche is under-served on the platform — high client demand.",
    dmText:
      "Marcus — mobility coaches are in high demand from Match Fit clients right now. Founding Fitness Pros lock in beta pricing + priority in the match algorithm. Want the quick overview?",
    commentText: "This hip CARs demo is the cleanest I've seen on here.",
    commentPostRef: "Reel · Feb 8 · 'Hip CARs'",
    postUrl: "https://instagram.com/p/demo-marcus-cars",
  },
  {
    id: "ig_5",
    handle: "@runcoach.tina",
    profileUrl: "https://instagram.com/runcoach.tina",
    niche: "Endurance / run coaching",
    intent: "Both",
    likelihood: 66,
    whyMatchFit: "Run coach with virtual-first delivery — great for virtual client matching.",
    dmText:
      "Tina — endurance coaching translates perfectly to Match Fit's virtual client base. We handle discovery so you focus on coaching. Can I share the founding-pro details?",
    commentText: "Smart take on deload weeks for marathon blocks 👏",
    commentPostRef: "Carousel · Feb 7 · 'Deload weeks'",
    postUrl: "https://instagram.com/p/demo-tina-deload",
  },
];

const DEMO_EMAIL_LEADS: DemoEmailLead[] = [
  {
    id: "em_1",
    name: "Jordan Ellis",
    businessName: "Ellis Performance",
    email: "jordan@ellisperformance.com",
    emailSourceUrl: "https://ellisperformance.com/about",
    intent: "Join as Fitness Pro",
    likelihood: 78,
    whyMatchFit: "Private performance studio owner — strong candidate for founding Fitness Pro.",
    subject: "Founding Fitness Pro spot for Ellis Performance",
    body: "Hi Jordan,\n\nI came across Ellis Performance and the work you're doing with your athletes stood out. I'm the founder of Match Fit — a two-sided app that connects Fitness Pros with clients actively looking to train.\n\nWe're onboarding a small group of founding Fitness Pros right now. Founding pros get first-mover visibility, beta pricing, and priority in our matching algorithm — clients come to you, no cold outreach required.\n\nWould you be open to a quick look? I can send a 2-minute overview or you can start at match-fit.net/trainer/signup.",
  },
  {
    id: "em_2",
    name: "Priya Nair",
    businessName: "Nair Strength Lab",
    email: "priya@nairstrength.com",
    emailSourceUrl: "https://nairstrength.com/contact",
    intent: "List With Us",
    likelihood: 72,
    whyMatchFit: "Studio with a strong local following — ideal List With Us discovery partner.",
    subject: "Get Nair Strength Lab in front of Match Fit clients",
    body: "Hi Priya,\n\nYour strength lab has a great reputation, and Match Fit clients in your area are searching for exactly what you offer.\n\nListing with us is free to start and takes about 5 minutes — clients discover you through the app and reach out directly. No commitment beyond the listing.\n\nIf you're open to it, you can list at match-fit.net or reply here and I'll walk you through it.",
  },
  {
    id: "em_3",
    name: "Devon Brooks",
    businessName: "Brooks Athletic Training",
    email: "devon@brooksatx.com",
    emailSourceUrl: "https://brooksatx.com",
    intent: "Both",
    likelihood: 70,
    whyMatchFit: "Hybrid trainer with virtual programs — fits both listing and founding-pro paths.",
    subject: "Match Fit — clients looking for a coach like you",
    body: "Hi Devon,\n\nI'm the founder of Match Fit. We connect Fitness Pros with clients who are already looking to book — both in-person and virtual.\n\nBased on your programs, you'd be a fit for either our founding Fitness Pro group or a discovery listing. Both put you in front of ready-to-book clients without cold outreach.\n\nHappy to send details — or you can start at match-fit.net/trainer/signup.",
  },
  {
    id: "em_4",
    name: "Sam Rivera",
    businessName: "Rivera Mobility",
    email: "sam@riveramobility.com",
    emailSourceUrl: "https://riveramobility.com/team",
    intent: "Join as Fitness Pro",
    likelihood: 68,
    whyMatchFit: "Mobility specialist — under-served niche with high client demand on the app.",
    subject: "Mobility coaches are in demand on Match Fit",
    body: "Hi Sam,\n\nMobility and movement coaches are one of the most-requested specialties from Match Fit clients right now, and we don't have enough of them yet.\n\nAs a founding Fitness Pro you'd lock in beta pricing and priority placement in our matching algorithm. Clients find you through the app and reach out directly.\n\nWant the quick overview? You can also start at match-fit.net/trainer/signup.",
  },
  {
    id: "em_5",
    name: "Alex Chen",
    businessName: "Chen Endurance",
    email: "alex@chenendurance.com",
    emailSourceUrl: "https://chenendurance.com/about",
    intent: "Both",
    likelihood: 64,
    whyMatchFit: "Virtual-first endurance coach — great fit for virtual client matching.",
    subject: "Virtual clients are searching for endurance coaches",
    body: "Hi Alex,\n\nYour virtual-first endurance coaching is a natural fit for Match Fit's client base. We handle discovery and matching so you can focus on the coaching.\n\nFounding Fitness Pros get first-mover visibility and beta pricing. Would you like the details, or want to start at match-fit.net/trainer/signup?",
  },
];

function HoldBanner() {
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-100">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
        Automations on HOLD
      </p>
      <p className="mt-1 text-amber-100/90">
        Approving a lead here only <strong>queues</strong> it. Nothing sends automatically — queues do
        <strong> not fire</strong> until JB explicitly says <strong>fire</strong>. JB is the only sender of live
        DMs and emails.
      </p>
    </div>
  );
}

function ApprovalControls(props: {
  state: ApprovalState;
  onApprove: () => void;
  onDeny: () => void;
  onAdjust: () => void;
  adjusting: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={
          props.state === "approved"
            ? "rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100"
            : "rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/20"
        }
        onClick={props.onApprove}
      >
        {props.state === "approved" ? "✓ Queued" : "Approve"}
      </button>
      <button
        type="button"
        className={
          props.state === "denied"
            ? "rounded-lg border border-[#E32B2B]/50 bg-[#E32B2B]/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4]"
            : "rounded-lg border border-[#E32B2B]/30 bg-[#E32B2B]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4] hover:bg-[#E32B2B]/20"
        }
        onClick={props.onDeny}
      >
        {props.state === "denied" ? "✕ Denied" : "Deny"}
      </button>
      <button
        type="button"
        className={props.adjusting ? adminAccentButtonClass : adminSecondaryButtonClass}
        onClick={props.onAdjust}
      >
        {props.adjusting ? "Close adjust" : "Adjust"}
      </button>
    </div>
  );
}

function StatusChip({ state }: { state: ApprovalState }) {
  if (state === "approved") {
    return (
      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
        Queued (hold)
      </span>
    );
  }
  if (state === "denied") {
    return (
      <span className="rounded-full border border-[#E32B2B]/40 bg-[#E32B2B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB4B4]">
        Denied
      </span>
    );
  }
  return (
    <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55">
      Pending review
    </span>
  );
}

/** Chat-bubble style adjust box that mirrors the live regenerate-with-feedback UX. */
function AdjustBubble(props: { onApply: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-[#FF7E00]/25 bg-[#FF7E00]/[0.05] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFD34E]">
        Adjust — tell the AI what to change
      </p>
      <textarea
        className={`${adminInputClassSm} mt-2`}
        rows={2}
        value={note}
        placeholder="e.g. Shorter opener, lead with the founding offer, less emoji…"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={adminAccentButtonClass}
          onClick={() => props.onApply(note.trim())}
        >
          Apply adjustment
        </button>
        <span className="self-center text-[10px] text-white/40">
          Preview: applies a note locally. Live panel calls regenerate-with-feedback.
        </span>
      </div>
    </div>
  );
}

function EmailClientPreview(props: { lead: DemoEmailLead }) {
  const { lead } = props;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.1] bg-white text-[#0B0C0F] shadow-lg">
      {/* Email client chrome */}
      <div className="flex items-center gap-2 border-b border-black/10 bg-[#F3F4F6] px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <span className="ml-2 text-xs font-semibold text-black/50">New Message — Match Fit</span>
      </div>
      <div className="space-y-1 border-b border-black/10 px-4 py-3 text-sm">
        <p>
          <span className="font-semibold text-black/50">From:</span> Match Fit &lt;{MATCH_FIT_SIGNATURE_FROM_EMAIL}&gt;
        </p>
        <p>
          <span className="font-semibold text-black/50">To:</span> {lead.name} &lt;{lead.email}&gt;
        </p>
        <p>
          <span className="font-semibold text-black/50">Subject:</span>{" "}
          <span className="font-semibold">{lead.subject}</span>
        </p>
      </div>
      <div className="px-4 py-4 text-sm leading-relaxed text-[#111]">
        <p className="whitespace-pre-wrap">{lead.body}</p>
        {/* Locked MF signature */}
        <div className="mt-5 border-t border-black/10 pt-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-[#FF7E00]/50 bg-[#FF7E00]/10 text-[9px] font-bold uppercase tracking-wide text-[#B45309]">
              Logo
            </div>
            <div className="text-[13px] leading-snug">
              {MATCH_FIT_SIGNATURE_LINES.map((line, i) => (
                <p key={line} className={i <= 1 ? "font-semibold" : "text-black/70"}>
                  {line}
                </p>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[10px] italic text-black/40">
            [Logo placeholder — production email embeds the Match Fit mark here.]
          </p>
        </div>
      </div>
    </div>
  );
}

export function OutreachPreviewClient() {
  const [igLeads, setIgLeads] = useState(DEMO_IG_LEADS);
  const [emailLeads, setEmailLeads] = useState(DEMO_EMAIL_LEADS);
  const [approvals, setApprovals] = useState<Record<string, ApprovalState>>({});
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [openEmailId, setOpenEmailId] = useState<string | null>(DEMO_EMAIL_LEADS[0]?.id ?? null);

  const setApproval = (id: string, state: ApprovalState) =>
    setApprovals((prev) => ({ ...prev, [id]: prev[id] === state ? "pending" : state }));

  const queuedCount = useMemo(
    () => Object.values(approvals).filter((s) => s === "approved").length,
    [approvals],
  );

  const applyIgAdjust = (id: string, note: string) => {
    if (note) {
      setIgLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, dmText: `${l.dmText}\n\n[Adjusted: ${note}]` } : l)),
      );
    }
    setAdjustingId(null);
  };

  const applyEmailAdjust = (id: string, note: string) => {
    if (note) {
      setEmailLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, body: `${l.body}\n\n[Adjusted: ${note}]` } : l)),
      );
    }
    setAdjustingId(null);
  };

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-10 text-white sm:px-8 sm:py-12">
      <AdminPortalBackdrop />
      <div className="relative mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FF7E00]">Interactive preview</p>
            <Link href="/admin/preview" className={adminSecondaryButtonClass}>
              All previews
            </Link>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Outreach HQ — morning pack</h1>
          <p className="max-w-2xl text-sm text-white/55">
            Demo mode with sample leads. Today&apos;s pack: {OUTREACH_COWORK_DAILY_CAPS.instagram} Instagram +{" "}
            {OUTREACH_COWORK_DAILY_CAPS.email} email. Review each lead, open the email as it will render in a client,
            then approve, deny, or adjust. All actions are local to this preview.
          </p>
        </header>

        <HoldBanner />

        <section className={`${adminCardClass} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className={adminLabelClass}>Queued for JB to fire</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#FFD34E]">{queuedCount}</p>
          </div>
          <p className="max-w-md text-xs text-white/45">
            Approvals collect here. In production these stay parked until JB triggers the send — automations remain on
            hold.
          </p>
        </section>

        {/* Instagram pack */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white/70">
              Instagram · {igLeads.length} leads
            </h2>
            <span className="text-[11px] text-white/40">DM → follow → like 4 → comment → status</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {igLeads.map((lead) => {
              const state = approvals[lead.id] ?? "pending";
              return (
                <article key={lead.id} className={`${adminPanelClass} p-4 sm:p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black tracking-tight text-white">{lead.handle}</h3>
                        <span className="rounded-full border border-[#FF7E00]/25 bg-[#FF7E00]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFD34E]">
                          {lead.intent}
                        </span>
                        <StatusChip state={state} />
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        {lead.niche} · Likelihood {lead.likelihood}%
                      </p>
                      <a href={lead.profileUrl} target="_blank" rel="noreferrer" className={`${adminLinkClass} text-sm`}>
                        Open Instagram profile
                      </a>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#FF7E00]/90">
                    <span className="font-semibold text-[#FF7E00]">Why Match Fit: </span>
                    {lead.whyMatchFit}
                  </p>

                  <div className="mt-3 space-y-3">
                    <div>
                      <p className={adminLabelClass}>First DM</p>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-[#0E1016]/70 p-3 text-sm text-white/80">
                        {lead.dmText}
                      </p>
                    </div>
                    <div>
                      <p className={adminLabelClass}>Comment</p>
                      <p className="mt-1 rounded-lg border border-white/[0.08] bg-[#0E1016]/70 p-3 text-sm text-white/80">
                        {lead.commentText}
                      </p>
                      <p className="mt-1 text-[11px] text-white/45">
                        Comment on: {lead.commentPostRef} ·{" "}
                        <a href={lead.postUrl} target="_blank" rel="noreferrer" className={adminLinkClass}>
                          post link
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <ApprovalControls
                      state={state}
                      adjusting={adjustingId === lead.id}
                      onApprove={() => setApproval(lead.id, "approved")}
                      onDeny={() => setApproval(lead.id, "denied")}
                      onAdjust={() => setAdjustingId((cur) => (cur === lead.id ? null : lead.id))}
                    />
                    {adjustingId === lead.id ? (
                      <AdjustBubble onApply={(note) => applyIgAdjust(lead.id, note)} />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Email pack */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white/70">
              Email · {emailLeads.length} leads
            </h2>
            <span className="text-[11px] text-white/40">From {MATCH_FIT_SIGNATURE_FROM_EMAIL}</span>
          </div>
          <div className="space-y-4">
            {emailLeads.map((lead) => {
              const state = approvals[lead.id] ?? "pending";
              const open = openEmailId === lead.id;
              return (
                <article key={lead.id} className={`${adminPanelClass} p-4 sm:p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black tracking-tight text-white">{lead.name}</h3>
                        <span className="rounded-full border border-[#FF7E00]/25 bg-[#FF7E00]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFD34E]">
                          {lead.intent}
                        </span>
                        <StatusChip state={state} />
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        {[lead.email, lead.businessName].filter(Boolean).join(" · ")} · Likelihood {lead.likelihood}%
                      </p>
                      <a href={lead.emailSourceUrl} target="_blank" rel="noreferrer" className={`${adminLinkClass} text-sm`}>
                        Where email was found
                      </a>
                    </div>
                    <button
                      type="button"
                      className={open ? adminAccentButtonClass : adminSecondaryButtonClass}
                      onClick={() => setOpenEmailId((cur) => (cur === lead.id ? null : lead.id))}
                    >
                      {open ? "Hide email preview" : "Open email preview"}
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#FF7E00]/90">
                    <span className="font-semibold text-[#FF7E00]">Why Match Fit: </span>
                    {lead.whyMatchFit}
                  </p>

                  {open ? <EmailClientPreview lead={lead} /> : null}

                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <ApprovalControls
                      state={state}
                      adjusting={adjustingId === lead.id}
                      onApprove={() => setApproval(lead.id, "approved")}
                      onDeny={() => setApproval(lead.id, "denied")}
                      onAdjust={() => setAdjustingId((cur) => (cur === lead.id ? null : lead.id))}
                    />
                    {adjustingId === lead.id ? (
                      <AdjustBubble onApply={(note) => applyEmailAdjust(lead.id, note)} />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <p className="rounded-xl border border-white/[0.06] bg-[#12151C]/75 px-4 py-3 text-center text-xs text-white/45">
          Preview only — no leads are contacted. Production Outreach HQ lives at{" "}
          <span className="font-semibold text-white/70">/admin/outreach</span> and requires admin login.
        </p>
      </div>
    </main>
  );
}
