export type FpDebriefBlock = {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type FpDebriefSection = {
  id: string;
  eyebrow: string;
  title: string;
  blocks: readonly FpDebriefBlock[];
};

export const FP_MATCH_FIT_PRO_DEBRIEF: FpDebriefSection = {
  id: "match-fit-pro-debrief",
  eyebrow: "Match Fit path",
  title: "Match Fit Pro Debrief",
  blocks: [
    {
      title: "Fitness Pro Onboarding Fee",
      paragraphs: [
        "Match Fit Pros can pay the platform onboarding fee today or defer it and repay from future payouts within 60 days of completing onboarding.",
      ],
      bullets: [
        "Pay now: authorize the platform hold at sign-up; Match Fit captures only after certification and background screening are approved.",
        "Defer: pay $0 platform fee today, authorize only the background check hold, and repay through payout withhold (minimum 20%) within 60 days of completing onboarding.",
      ],
    },
    {
      title: "Publish Between Sessions",
      paragraphs: [
        "FitHub is your publishing lane inside Match Fit: share short-form content from your dashboard so clients (and future clients) see your voice, expertise, and personality between appointments.",
        "Posts can carry captions, write-ups, and media that reinforce your brand, spark conversation through comments and engagement, and keep you visible without living on another social network.",
      ],
    },
    {
      title: "Your Brand. Your Business.",
      paragraphs: [
        "Show how you coach, offer the modalities you believe in, and spend less energy on discovery logistics—so you can stay focused on the work that changes people.",
        "Match Fit Premium Pro adds premium discovery surfacing and optional Premium Page tools when you want the Premium Hub for featured placement and promotion tokens.",
      ],
    },
  ],
};

export const FP_INDEPENDENT_PRO_DEBRIEF: FpDebriefSection = {
  id: "independent-pro-debrief",
  eyebrow: "Independent path",
  title: "Independent Pro Debrief",
  blocks: [
    {
      title: "Subscription and Onboarding",
      paragraphs: [
        "Independent Fitness Pro is a paid monthly account type with streamlined document onboarding so you can list your brand on Match Fit quickly.",
      ],
      bullets: [
        "Monthly platform subscription as shown at signup.",
        "Upload required business documents for listing review.",
        "Choose pay-now or deferred onboarding fee options where offered for your signup path.",
      ],
    },
    {
      title: "Discovery Outreach",
      paragraphs: [
        "Reach clients who opted into discovery with daily nudges that put your profile in front of people already browsing coaches on Match Fit.",
      ],
      bullets: [
        "Daily discovery nudge allowance with optional paid nudge packs for extra outreach.",
        "Interest clients still surface when someone swipes right on your profile.",
        "External website and business-listed trust indicators on your public listing.",
      ],
    },
    {
      title: "Your Brand. Your Lane.",
      paragraphs: [
        "Keep your own site, voice, and coaching identity while Match Fit handles discovery placement and lightweight outreach signals.",
        "Use Fit Hub and featured listing tools to stay visible between the clients you connect with through nudges.",
      ],
    },
  ],
};

export const FP_ELITE_PRO_DEBRIEF: FpDebriefSection = {
  id: "elite-pro-debrief",
  eyebrow: "Elite path",
  title: "Elite Pro Debrief",
  blocks: [
    {
      title: "Subscription and Onboarding",
      paragraphs: [
        "Elite Fitness Pro combines a monthly platform subscription with full Match Fit verification — background screening, document review, and verified business listing.",
      ],
      bullets: [
        "Monthly platform subscription as shown at signup.",
        "Background screening and document verification before public listing.",
        "Choose pay-now or deferred onboarding fee options where offered for your signup path.",
      ],
    },
    {
      title: "Chat and Discovery Together",
      paragraphs: [
        "Use unlimited discovery nudges and full in-app chat in the same workflow — open conversations when chemistry is there, nudge when you want to get on a client's radar.",
      ],
      bullets: [
        "Unlimited discovery nudges plus in-app chat on one account.",
        "Share business email addresses and external listing links in chat when it helps clients book with your brand.",
        "Interest clients workflow when someone swipes right on your profile.",
      ],
    },
    {
      title: "Your Brand. Your Business.",
      paragraphs: [
        "Elite Fitness Pro is built for established coaches who want Match Fit discovery plus the flexibility to keep their business identity in the conversation.",
        "Full analytics, Fit Hub publishing, featured listing programs, and platform reviews help you grow without leaving the tools that already run your business.",
      ],
    },
  ],
};
