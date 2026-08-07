import { LegalPageFooterNav } from "@/components/legal-page-footer-nav";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { betaInviteSlotDays, betaMaxClients, betaMaxTrainers } from "@/lib/beta-launch-config";
import { LEGAL_EFFECTIVE_DATE_DISPLAY } from "@/lib/legal-effective-date";
import {
  getTrainerFoundingBgPercentMax,
} from "@/lib/match-fit-launch-promotions";
import {
  TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE,
  TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS,
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
  trainerIndependentProSubscriptionLabel,
  trainerStandardOnboardingAfterCapLabel,
} from "@/lib/trainer-signup-promo-copy";
import {
  CLIENT_PAYMENT_GRACE_DAYS,
  CLIENT_PLATFORM_TRIAL_DAYS,
} from "@/lib/client-platform-trial-constants";
import {
  CLIENT_FREEMIUM_SWIPE_LIMIT,
  CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS,
  CLIENT_VIP_PRICE_USD,
} from "@/lib/client-plan-access";
import {
  FP_NUDGE_PACK_PRICE_USD,
  FP_NUDGE_PACK_SIZE,
  INDEPENDENT_FP_DAILY_NUDGES,
} from "@/lib/fp-tier-chat-policy";
import { FP_TIER_MONTHLY_FEES_USD } from "@/lib/fp-account-tier-types";
import { FP_PREMIUM_PAGE_MONTHLY_USD } from "@/lib/fp-tier-marketing-copy";
import {
  TRAINER_PAYMENT_GRACE_DAYS,
  TRAINER_PLATFORM_SUBSCRIPTION_USD,
  TRAINER_PLATFORM_TRIAL_DAYS,
} from "@/lib/trainer-platform-trial-constants";
import {
  CHECK_IN_LEAD_HOURS,
  GATE_A_POST_SESSION_SILENCE_HOURS,
  INITIAL_OUTBOUND_MESSAGE_CAP,
  MATCH_BATCH_WINDOW_HOURS,
  OFF_PLATFORM_TEMP_BAN_DAYS,
  PAYOUT_BUFFER_AFTER_BOTH_GATES_HOURS,
  PLATFORM_ADMIN_FEE_PERCENT,
  STANDARD_MATCH_BATCH_SIZE,
  TOS_CLIENT_PLATFORM_PROMO_USD,
  TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD,
  TOS_PAYOUT_DISPUTE_ROLLING_DAYS,
  TOS_PAYOUT_DISPUTE_SUSPEND_THRESHOLD,
  TOS_PUNCH_MISS_SUSPEND_STREAK,
} from "@/lib/tos-implementation-contract";

/** Legal operator of Match Fit. */
const OPERATOR_LEGAL_NAME = "Northside Ventures LLC";

/** General and billing inquiries. */
const TERMS_CONTACT_EMAIL = "legal@match-fit.net";

const PHYSICAL_ADDRESS_LINE = "1954 Airport Rd STE 1277, Chamblee, GA 30341, United States";

const TERMS_EFFECTIVE_DATE = LEGAL_EFFECTIVE_DATE_DISPLAY;
const BETA_MAX_TRAINERS = betaMaxTrainers();
const BETA_MAX_CLIENTS = betaMaxClients();
const BETA_INVITE_SLOT_DAYS = betaInviteSlotDays();
const FOUNDING_TRAINER_CAP = getTrainerFoundingBgPercentMax();

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-white/60">{children}</p>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-lg font-black tracking-tight text-white">
      {children}
    </h2>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/60">{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-white/85">{children}</strong>;
}

function usdCents(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function TermsPage() {
  const clientId = await getSessionClientId();
  const trainerId = await getSessionTrainerId();
  const role = clientId ? "client" : trainerId ? "trainer" : "guest";

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mf-prose-safe mx-auto max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Terms of Service</h1>
        <p className="mt-4 text-xs uppercase tracking-wide text-white/45">
          Effective Date: {TERMS_EFFECTIVE_DATE}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          Whenever we publish an updated version, we change this effective date to match the version you are reading.
        </p>
        <P>
          Match Fit (&quot;Match Fit,&quot; the &quot;Service&quot;) is operated by <Strong>{OPERATOR_LEGAL_NAME}</Strong>{" "}
          (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access
          to and use of our websites, applications, and related services that link to these Terms. By creating an account,
          checking boxes at sign-up or onboarding, paying through the Service, or otherwise using the Service, you agree to
          these Terms. If you do not agree, do not use the Service.
        </P>
        <P>
          The Service is a technology platform that helps clients discover independent fitness professionals (&quot;Fitness Pros&quot;
          or &quot;Coaches&quot;) and purchase certain offerings (such as sessions, programs, subscriptions, and optional
          promotional products) facilitated through the Service. <Strong>Fitness Pros are independent contractors, not employees
          or agents of Match Fit.</Strong> Match Fit does not provide personal training, medical advice, or nutrition therapy.
        </P>

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-base font-black tracking-tight">Contact Us</h2>
          <P>
            For questions about these Terms: <Strong>{TERMS_CONTACT_EMAIL}</Strong>, or write to us at{" "}
            <Strong>{PHYSICAL_ADDRESS_LINE}</Strong>.
          </P>
        </section>

        <H2 id="definitions">1. Definitions</H2>
        <Ul>
          <Li>
            <Strong>Client:</Strong> An end user who registers for a client account to access discovery, messaging,
            subscriptions, and related features.
          </Li>
          <Li>
            <Strong>Fitness Pro:</Strong> An independent professional who registers for a Fitness Pro account, completes onboarding
            requirements we specify, and may offer services through the Service.
          </Li>
          <Li>
            <Strong>Session:</Strong> A booked mobile (in-person at an agreed location) or virtual (online) personal training
            appointment between a Client and a Fitness Pro, priced and confirmed through flows available in the Service as
            implemented from time to time.
          </Li>
          <Li>
            <Strong>DIY Plan:</Strong> Remote programming or related deliverables priced on a recurring or trial basis as
            offered by a Fitness Pro through the Service.
          </Li>
          <Li>
            <Strong>Client VIP Subscription:</Strong> Optional recurring Client plan (currently{" "}
            {usdCents(CLIENT_VIP_PRICE_USD)} per month) that unlocks full discovery, booking, FitHub interactions,
            daily questionnaires, and match questionnaire updates after any complimentary beta VIP trial ends.
          </Li>
          <Li>
            <Strong>Client Free plan:</Strong> No monthly platform fee. After the beta VIP trial, Free-plan Clients may have
            limited discovery (for example, swipe-only browsing with a cap of {CLIENT_FREEMIUM_SWIPE_LIMIT} swipes per{" "}
            {CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS}-hour window), in-app chat with matched Fitness Pros, and one initial match
            questionnaire. Scroll browsing, booking, FitHub interactions, daily questionnaires, and match questionnaire
            updates require VIP.
          </Li>
          <Li>
            <Strong>Platform Subscription (legacy):</Strong> Some older accounts may still reference a legacy Platform
            Subscription billed separately from Client VIP. Where both exist, in-product billing controls govern which plan
            applies.
          </Li>
        </Ul>

        <H2 id="eligibility-accounts">2. Eligibility, Accounts, and Security</H2>
        <Ul>
          <Li>You must be legally able to enter a binding contract in your jurisdiction to use the Service.</Li>
          <Li>
            You are responsible for accurate profile and billing information. After your complimentary beta VIP trial ends,
            you may remain on the Free plan with the limits described in these Terms or subscribe to Client VIP for full
            access.
          </Li>
          <Li>
            You must complete any user agreement or acceptance flows presented in the app (including acknowledgments at
            sign-up or onboarding) that reference these Terms and related policies.
          </Li>
          <Li>
            You are responsible for safeguarding credentials and for activity under your account. Notify us promptly of
            unauthorized use.
          </Li>
        </Ul>

        <H2 id="beta-launch">2A. Beta Launch, Service Area, Waitlist, and Capacity</H2>
        <P>
          Match Fit may operate in a limited <Strong>beta</Strong> phase. During beta we may cap how many Fitness Pros and
          Clients can register (for example, up to <Strong>{BETA_MAX_TRAINERS} Fitness Pros</Strong> and{" "}
          <Strong>{BETA_MAX_CLIENTS} Clients</Strong> when those gates are enabled in production). When caps are full, you
          may join a <Strong>waitlist</Strong> with your email and ZIP code; we may email time-limited invites when capacity
          opens. Invited users typically have on the order of <Strong>{BETA_INVITE_SLOT_DAYS} days</Strong> to complete
          sign-up before the reserved slot may be released to the next waitlisted person.
        </P>
        <P>
          During the current beta, Fitness Pros and clients anywhere in the world may sign up. In-person sessions
          will be enabled by region as beta activity grows.
        </P>
        <P>
          <Strong>Client beta VIP trial:</Strong> After you complete client sign-up and agree to these Terms, your account
          receives <Strong>{CLIENT_PLATFORM_TRIAL_DAYS} days</Strong> of complimentary <Strong>VIP access</Strong> with{" "}
          <Strong>no card required at sign-up</Strong>. During that window you may use discovery, chat, booking, FitHub, and
          related client features as implemented for VIP accounts. When the trial ends, your account moves to the{" "}
          <Strong>Free plan</Strong> unless you subscribe to Client VIP at the rate shown in-product (currently{" "}
          {usdCents(CLIENT_VIP_PRICE_USD)} per month). Free-plan limits include swipe caps and restrictions on scroll
          browsing, booking, FitHub interactions, daily questionnaires, and match questionnaire updates as described
          in-product.
        </P>
        <P>
          <Strong>Legacy payment grace (older accounts only):</Strong> Accounts created under prior billing flows may still
          have a <Strong>{CLIENT_PAYMENT_GRACE_DAYS}-day</Strong> grace window after trial to connect a legacy Platform
          Subscription. If that grace expires without payment, those accounts may be deactivated until reactivation.
        </P>
        <P>
          <Strong>Founding Fitness Pro promotions (while caps last):</Strong> The first{" "}
          <Strong>{FOUNDING_TRAINER_CAP} Fitness Pros</Strong> who complete registration receive{" "}
          <Strong>{TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days</Strong> of complimentary Independent Pro platform access
          starting at sign-up. During this promo, Fitness Pros pay only the independent background-check fee through
          Match Fit&apos;s portal (plus transaction fees), or receive a fully covered background check when founding
          eligibility applies. Fitness Pros must{" "}
          <Strong>begin onboarding within {TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} calendar days</Strong> of account
          creation (including paying the background check through our portal and starting certification and screening
          steps). {TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}
        </P>
        <P>
          <Strong>Trainer sign-up trial (Independent Pro):</Strong> After you complete trainer registration, your account
          receives a <Strong>{TRAINER_PLATFORM_TRIAL_DAYS}-day</Strong> complimentary Independent Pro platform access
          period with <Strong>no subscription card required at sign-up</Strong>. When that trial ends, you have an
          additional <Strong>{TRAINER_PAYMENT_GRACE_DAYS} days</Strong> to connect a card and start the recurring
          Independent Pro subscription ({trainerIndependentProSubscriptionLabel()}). If payment is not completed before
          the grace period ends, your account is deactivated and dashboard access is blocked until you pay to
          reactivate. You will be prompted for payment information whenever you log in once the trial ends. A new free
          trial is not offered if you previously consumed the sign-up trial.
        </P>

        <H2 id="fees-and-payments">3. Fees, Administrative Charges, and Payment Processing</H2>
        <P>
          <Strong>Administrative Fee (Non-Subscription Purchases):</Strong> For Clients, purchases other than the recurring
          Platform subscription (for example, per-session bookings, DIY plans, trial weeks, tips where enabled, premium
          Fitness Pro content subscriptions offered in-product, Fitness Pro–side registration or premium fees, match-boost or token
          purchases, and similar one-time or non-platform-subscription charges) include a{" "}
          <Strong>
            {PLATFORM_ADMIN_FEE_PERCENT}% administrative fee
          </Strong>{" "}
          assessed on the applicable transaction. This fee supports
          platform operations, payments infrastructure, dispute tooling, and marketplace services. Unless a separate refund
          policy below states otherwise for a specific scenario, <Strong>
            any portion of the {PLATFORM_ADMIN_FEE_PERCENT}% administrative fee that has
          been collected is non-refundable</Strong> when a refund of the underlying Fitness Pro compensation or service price is
          approved (for example, approved no-show or service-not-delivered outcomes described below).
        </P>
        <P>
          <Strong>Transaction (Processing) Fee:</Strong>{" "}
          <Strong>All charges processed through our payment processor (currently Stripe, Inc. and its affiliates)</Strong> may
          include a separate <Strong>transaction or processing fee</Strong> calculated to cover payment network and
          processor costs (for example, card-brand interchange and Stripe&apos;s percentage and fixed per-transaction
          components). The processor&apos;s own terms and privacy policy apply when you pay through their flows. We display fee
          components at or before checkout where the Service implements itemized pricing; you agree not to misrepresent total
          pricing when arranging services off-platform.
        </P>
        <P>
          <Strong>Fitness Pro Premium Page Add-On:</Strong> Where we offer an optional Premium Page subscription at a stated
          monthly price (for example, twenty U.S. dollars ($20.00) per month), applicable payment processor costs may be
          included in that advertised price as described at checkout. The Premium Page is separate from Fitness Pro account
          types (Match Fit Pro, Match Fit Premium Pro, Independent Fitness Pro, and Elite Fitness Pro) described in Section
          11A.
        </P>
        <P>
          <Strong>Fitness Pro Independent Pro Subscription:</Strong> Where we offer Independent Pro platform access at a
          stated monthly price (for example, {usdCents(TRAINER_PLATFORM_SUBSCRIPTION_USD)} per month), applicable payment
          processor costs may be included in that advertised price as described at checkout. After the sign-up trial and
          payment grace window, this subscription is required to keep the account active.
        </P>
        <P>
          <Strong>Subscriptions and Promotions:</Strong> Client Platform subscriptions may be offered at published rates
          (for example, {usdCents(TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD)} per month) with promotional pricing (for example,{" "}
          {usdCents(TOS_CLIENT_PLATFORM_PROMO_USD)} per month for an introductory period) when we run such programs.
          Promotional details, renewal rates, and billing
          cycles are shown in-product and at checkout.
        </P>
        <P>
          Taxes, if any, may be collected as required by law and shown at checkout.
        </P>

        <H2 id="client-services">4. Client Services and Marketplace Rules</H2>
        <P>
          Subject to these Terms and feature availability in the Service, Clients may use discovery tools (including
          swipe-style and list-style browsing), match preferences, questionnaires, goal-setting features, messaging, session
          booking, DIY offerings, Fit Hub content feeds, ratings or testimonials where enabled, bug and feedback submissions,
          and account settings (including subscription pause where available).
        </P>

        <H2 id="session-policies">5. Mobile and Virtual Sessions</H2>
        <P>
          <Strong>Location and Tools:</Strong> For <Strong>mobile (in-person)</Strong> sessions, the Client and Fitness Pro agree
          on place and time. Match Fit does not monitor or control where training occurs. For <Strong>virtual</Strong>{" "}
          sessions, Fitness Pros may connect third-party meeting tools (such as Zoom, Google Meet, or Microsoft Teams) as offered
          in-product; those providers&apos; terms apply to the video session itself. Clients must use meeting links Fitness Pros
          share in Match Fit chat (Zoom, Microsoft Teams, or Google Meet as offered)—not personal FaceTime invites, private
          phone numbers, or off-platform email meeting links for virtual coaching arranged through the Service.
        </P>
        <P>
          <Strong>Compensation:</Strong> Sessions are generally compensated on a per-session basis at the Fitness Pro&apos;s
          published rate plus the administrative fee and transaction fee described in Section 3. Optional tips, if offered,
          are separate line items subject to the same processing mechanics unless stated otherwise at checkout.
        </P>
        <P>
          <Strong>Completion Confirmation (Gate A):</Strong> Clients may confirm sessions starting{" "}
          <Strong>{CHECK_IN_LEAD_HOURS} hours</Strong> before the scheduled start time. After the session, the Client has a limited window (currently{" "}
          <Strong>{GATE_A_POST_SESSION_SILENCE_HOURS} hours</Strong> after the booked end time where implemented) to confirm completion or open
          a dispute through the flows we provide. If the Client does not act within the post-session window, Gate A may close
          automatically as implemented.
        </P>
        <P>
          <Strong>No Show Refunds:</Strong> If the Client marks <Strong>No Show</Strong> for the Fitness Pro in accordance with
          in-product rules, the Client may be eligible for a refund of the session price paid for the personal training
          portion, <Strong>excluding the non-refundable {PLATFORM_ADMIN_FEE_PERCENT}% administrative fee</Strong> and any non-refundable processing
          costs we are not able to recover from the processor.
        </P>
        <P>
          <Strong>Dissatisfaction After a Completed Session:</Strong> If a session is marked completed but the Client is
          dissatisfied, the Client may contact Match Fit support. We may, at our discretion, offer <Strong>account
          credit</Strong> toward a future purchase. <Strong>Cash refunds are not guaranteed</Strong> except where we determine
          a serious or safety-related situation warrants a refund.
        </P>
        <P>
          <Strong>Safety and Conduct Reports:</Strong> If a Client feels unsafe or mistreated, the Client should report it
          through Service tools or support. We may suspend a Fitness Pro&apos;s account pending a good-faith investigation and
          restrict booking or platform use until the matter is resolved.
        </P>

        <H2 id="governed-marketplace">5A. Governed Marketplace: Ledger, Gates, Punch-In, Suspensions</H2>
        <P>
          <Strong>Fitness Pro payout math:</Strong> For each paid purchase, the Service records net ledger pools after the{" "}
          <Strong>administrative fee</Strong> and <Strong>estimated card processing</Strong> described in Section 3.{" "}
          <Strong>Coach services and optional add-ons are split into separate pools</Strong> so refunds and disputes can be
          applied per line item. Per completed unit (session, purchased hour credit, or add-on unit as priced), the
          Fitness Pro&apos;s accrual is the corresponding net pool divided by the purchased count of that line (with separate
          denominators for hourly add-on bundles when metadata is provided at checkout).
        </P>
        <P>
          <Strong>Two gates and payout buffer:</Strong> For booked sessions, payout release generally requires{" "}
          <Strong>both</Strong> (a) client-side completion confirmation or automatic silence after the post-session Gate A
          window and (b) the Fitness Pro marking the session complete (Gate B). After both are satisfied, a{" "}
          <Strong>{PAYOUT_BUFFER_AFTER_BOTH_GATES_HOURS} hours</Strong> dispute buffer runs; Clients may dispute during that window for human
          review. Fitness Pros must also record a <Strong>SESSION STARTED</Strong> geolocation punch-in at arrival before Gate B
          can close, as enforced in-product.
        </P>
        <P>
          <Strong>Punch-in compliance:</Strong> Fitness Pros should allow device location access. The Service may evaluate
          missed punch-ins after each session window; <Strong>{TOS_PUNCH_MISS_SUSPEND_STREAK} consecutive missed punch-ins</Strong> may trigger
          suspension pending review. Separately, <Strong>{TOS_PAYOUT_DISPUTE_SUSPEND_THRESHOLD} payout disputes</Strong> opened against a Fitness Pro in a
          rolling <Strong>{TOS_PAYOUT_DISPUTE_ROLLING_DAYS}-day</Strong> window, or a serious <Strong>Client safety report</Strong> that results in suspension, may
          suspend the Fitness Pro pending review.
        </P>
        <P>
          <Strong>Suspension marketplace effects:</Strong> When a Fitness Pro is suspended under these rules, the Service may
          cancel upcoming confirmed bookings, notify matched Clients, restrict contactability, and process refunds of net
          attributed amounts toward the card where Stripe allows (administrative and processing portions may be retained).
          When a suspension is lifted after review, matched Clients may be notified that the account was restored.
        </P>

        <H2 id="diy-policies">6. DIY Plans and Trial Weeks</H2>
        <P>
          DIY offerings are priced by the Fitness Pro, typically on a monthly basis, with the <Strong>{PLATFORM_ADMIN_FEE_PERCENT}% administrative fee
          applied to the monthly price</Strong> at checkout (plus transaction fees under Section 3). Fitness Pros may offer a{" "}
          <Strong>trial week</Strong> priced at approximately one-quarter (¼) of the monthly plan price plus administrative
          and processing fees as shown at checkout.
        </P>
        <Ul>
          <Li>
            After the Fitness Pro has the information we require, the Fitness Pro is expected to deliver the first workout within{" "}
            <Strong>five (5) business days</Strong> unless Match Fit or support has approved a different timeline for a
            larger engagement. Separately, a <Strong>fourteen (14) calendar day</Strong> wall-clock deadline may apply to the
            first DIY deliverable upload as implemented in Client Management.
          </Li>
          <Li>
            If the calendar deadline passes without an upload, the Client may be prompted on next login to attest whether
            the DIY was still received. If the Client reports non-delivery, the Fitness Pro may have <Strong>twenty-four
            (24) hours</Strong> to upload or request a time extension; extensions require Client approval within{" "}
            <Strong>forty-eight (48) hours</Strong> or they may auto-approve. If the Client declines an extension, the net DIY
            purchase amount (excluding non-refundable administrative and processing portions) may be refunded and the
            Fitness Pro forfeits that payout for the engagement.
          </Li>
          <Li>
            The Client has <Strong>forty-eight (48) hours</Strong> after that delivery window to confirm receipt in-product.
            If that window passes without confirmation, the Client may not be eligible for an automated refund.
          </Li>
          <Li>
            For trial flows where implemented, Clients may have up to <Strong>fourteen (14) days</Strong> from a defined
            milestone to confirm they received a trial workout; exact timers are shown in-product.
          </Li>
          <Li>
            If the workout was never sent within the five-business-day window (absent an approved extension), the Client may
            report it as not sent and may be eligible for a refund of amounts attributable to the undelivered service,{" "}
            <Strong>excluding the non-refundable {PLATFORM_ADMIN_FEE_PERCENT}% administrative fee</Strong> as stated above.
          </Li>
          <Li>
            Dissatisfaction after delivery is handled similarly to sessions: support may offer account credit; refunds are
            limited to exceptional circumstances.
          </Li>
          <Li>
            Clients may commit to a full month, pay month-to-month, or use auto-pay where those options are presented.
          </Li>
        </Ul>

        <H2 id="subscriptions-billing">7. Client Plans & Billing</H2>
        <Ul>
          <Li>
            New Clients receive <Strong>{CLIENT_PLATFORM_TRIAL_DAYS} days</Strong> of complimentary VIP access after
            completing sign-up and agreeing to these Terms. No card is required during that beta VIP trial.
          </Li>
          <Li>
            When the beta VIP trial ends, accounts move to the <Strong>Free plan</Strong> unless the Client subscribes to{" "}
            <Strong>Client VIP</Strong> at the rate shown in-product (currently {usdCents(CLIENT_VIP_PRICE_USD)} per month).
            Free-plan limits may include a cap of {CLIENT_FREEMIUM_SWIPE_LIMIT} coach swipes per{" "}
            {CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS}-hour window, swipe-only discovery (no scroll feed), anonymous coach
            nudges, and restrictions on booking, FitHub interactions, and daily questionnaires. In-app chat with matched
            Fitness Pros and the initial match questionnaire are included on Free.
          </Li>
          <Li>
            Client VIP subscriptions renew according to the plan you select until canceled in accordance with in-product
            controls and Stripe billing portals where linked.
          </Li>
          <Li>
            Legacy Platform Subscription accounts may still follow older grace and deactivation rules described in section 2A
            until migrated or closed.
          </Li>
          <Li>
            If a renewal payment fails after you have an active paid subscription, you may have a grace period (currently up
            to <Strong>seventy-two (72) hours</Strong>) to update payment information before access is restricted, as
            implemented in billing flows and communications.
          </Li>
        </Ul>

        <H2 id="communications-discovery">8. Messaging, Discovery History, and In-App Communication</H2>
        <Ul>
          <Li>
            Each party may send up to <Strong>{INITIAL_OUTBOUND_MESSAGE_CAP} initial outbound messages</Strong> in a thread
            until the other party sends at least one chat message, as implemented to reduce spam.
          </Li>
          <Li>
            <Strong>Fitness Pro account types:</Strong> Match Fit offers tiered Fitness Pro accounts with different
            messaging capabilities. <Strong>Match Fit Pro</Strong> and <Strong>Match Fit Premium Pro</Strong> use
            in-app chat under the communication rules in this section and Section 12.{" "}
            <Strong>Independent Fitness Pro</Strong> accounts do <Strong>not</Strong> include in-app chat; they may send
            discovery <Strong>nudges</Strong> only (currently up to <Strong>{INDEPENDENT_FP_DAILY_NUDGES} nudges per
            day</Strong>, UTC), with optional purchase of <Strong>{FP_NUDGE_PACK_SIZE} additional nudges</Strong> for{" "}
            <Strong>{usdCents(FP_NUDGE_PACK_PRICE_USD)}</Strong> when offered in-product.{" "}
            <Strong>Elite Fitness Pro</Strong> includes in-app chat and unlimited discovery nudges, with a relaxed rule
            for business email addresses as described below; phone numbers and off-platform payment details remain
            prohibited.
          </Li>
          <Li>
            You agree to use Service messaging for introductions and coordination where required by product rules. You may
            share links to external websites, social profiles, or other platforms in chat on every account type — the
            Service does not require Fitness Pros to use Match Fit exclusively. For <Strong>Match Fit Pro</Strong> and{" "}
            <Strong>Match Fit Premium Pro</Strong>, automated tools may mask or remove phone numbers, email addresses, or
            similar contact data shared in chat. For <Strong>Elite Fitness Pro</Strong>, business email addresses may be
            permitted in chat; phone numbers and off-platform payment instructions remain blocked for every account type.
            The Service may use automated signals (for example, patterns resembling off-platform payment requests, common
            peer-payment brand names, or phone-like digit sequences) to flag threads for internal review; flagged content
            may be withheld or delivered according to policy while staff review when queued.
          </Li>
          <Li>
            The Service may run automated trust-and-safety checks on chat (pattern detection for contact or payment
            leakage, policy heuristics, and optional machine-assisted review when configured). Flagged messages may be
            queued for staff review or handled according to policy while review is pending.
          </Li>
          <Li>
            You acknowledge that off-platform sharing (for example, in person) is outside our control but may violate these
            Terms or Fitness Pro obligations below.
          </Li>
          <Li>
            Discovery history features (for example, storing left swipes for a limited period and recording right swipes) run
            as implemented; retention periods may change with notice via the Service or email for material reductions in
            functionality.
          </Li>
        </Ul>

        <H2 id="ratings-content">9. Ratings, Testimonials, and Fit Hub Content</H2>
        <P>
          Where enabled, Clients may rate experiences or leave testimonials. You agree that feedback must be truthful and
          not abusive, defamatory, or discriminatory. We may remove content that violates policy or law.
        </P>
        <P>
          Premium Fitness Pros may publish content (such as posts, photos, or videos) to Fit Hub or related surfaces. Clients may
          subscribe to premium Fitness Pro feeds where offered, filter feeds, and cancel those subscriptions at any time subject
          to billing cycles. Content may be moderated for appropriateness and safety.
        </P>

        <H2 id="learning-features">10. Matching, Goals, and Product Analytics</H2>
        <P>
          The Service may use questionnaires, match preferences, and usage signals to suggest Fitness Pros and improve the
          product. Features may include goal-setting tools and behavioral or preference modeling to personalize experiences.
          Details about data practices appear in our Privacy Policy.
        </P>

        <H2 id="trainer-terms">11. Fitness Pro Registration, Compliance, and Public Profile</H2>
        <Ul>
          <Li>
            Fitness Pro registration may require payment of the independent background-check fee through Match Fit&apos;s
            portal plus applicable transaction fees, as shown at checkout.{" "}
            <Strong>Founding-coach promo (first {FOUNDING_TRAINER_CAP} Fitness Pros):</Strong> pay only the background-check
            fee through our portal (plus processing) and receive <Strong>{TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days</Strong>{" "}
            of complimentary Independent Pro platform access at sign-up. Fitness Pros must begin onboarding within{" "}
            <Strong>{TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} calendar days</Strong> of account creation and may not offer
            or sell services until all onboarding requirements are completed.{" "}
            <Strong>Standard pricing (after founding caps):</Strong> {trainerStandardOnboardingAfterCapLabel()}. Standard-tier
            Fitness Pros may <Strong>pay the platform onboarding fee at sign-up</Strong> or{" "}
            <Strong>defer it and repay from future payouts</Strong> (minimum 20% withhold) within 60 days of completing
            onboarding, as shown in-product. Match Fit generally collects onboarding amounts only after background screening
            clears and primary certification is approved, as implemented in onboarding. At signup, your card may be{" "}
            <Strong>authorized (held)</Strong> through our payment processor; Match Fit <Strong>captures</Strong> amounts
            only according to the pricing tier and approval rules in effect when you registered.
          </Li>
          <Li>
            <Strong>Background screening escrow:</Strong> A portion of your signup authorization is earmarked for the
            independent background-check provider (for example, Checkr). If you do not complete background screening after we
            send (or automate) your invitation, you do not receive credit for that background-check portion toward registration
            pricing, and we may capture only the platform and processing portions of your authorization as implemented in the
            product. Refunds of the background-check escrow slice are not guaranteed.
          </Li>
          <Li>
            <Strong>Backup screening process:</Strong> When our direct Checkr API integration is not yet active, Fitness Pros
            request an invitation through Match Fit; staff sends Checkr invitations manually. Automated webhooks or staff
            review may update your status when results are available.
          </Li>
          <Li>
            To appear publicly, Fitness Pros may need to complete tax documentation (such as IRS Form W-9 or successor forms),
            accept Fitness Pro-specific terms presented in onboarding, upload valid primary certification (for example, CPT) and
            optional additional credentials, complete a background check through a provider they select from options we make
            available, and satisfy other verification steps we add over time.
          </Li>
          <Li>
            Fitness Pros must keep certifications current and renew background checks at intervals we specify (for example,{" "}
            <Strong>every twelve (12) months</Strong>). Accounts may be suspended until credentials are updated. If
            requirements are not satisfied within a notice period we communicate (for example, <Strong>sixty (60)
            days</Strong>), we may close the account and delete associated data in accordance with our retention policies and
            applicable law.
          </Li>
          <Li>
            Fitness Pros may work at other facilities; Match Fit does not supervise in-person exchanges of contact information
            away from the Service.
          </Li>
        </Ul>

        <H2 id="fp-account-types">11A. Fitness Pro Account Types</H2>
        <P>
          During and after beta, Fitness Pros may select among account types offered in-product. Features, fees, and
          messaging rules vary by tier as implemented in the Service and summarized here:
        </P>
        <Ul>
          <Li>
            <Strong>Match Fit Pro:</Strong> No monthly platform fee for the tier itself. Includes in-app chat, Fit Hub,
            platform reviews, verified trust indicators, and interest-client workflows. Outreach runs through chat and
            client inquiries. Communication rules are described in Section 12.
          </Li>
          <Li>
            <Strong>Match Fit Premium Pro:</Strong> Includes everything in Match Fit Pro plus premium discovery surfacing,
            regional featured-placement program eligibility, and Verified Premium trust indicators. During beta, eligible
            users may receive a promotional complimentary period as displayed in-product. Coaches may optionally add the
            Premium Page subscription (currently <Strong>{usdCents(FP_PREMIUM_PAGE_MONTHLY_USD)}</Strong> per month when
            billed) for Premium Hub tools such as featured placement workflows, FitHub publishing studio controls, and
            promotion tokens, as implemented.
          </Li>
          <Li>
            <Strong>Independent Fitness Pro:</Strong> Monthly fee currently{" "}
            <Strong>{usdCents(FP_TIER_MONTHLY_FEES_USD.independent_fitness_pro ?? 15)}</Strong> when billed. Includes
            discovery nudges (currently <Strong>{INDEPENDENT_FP_DAILY_NUDGES} per day</Strong>, UTC), optional purchase of{" "}
            <Strong>{FP_NUDGE_PACK_SIZE} additional nudges</Strong> for{" "}
            <Strong>{usdCents(FP_NUDGE_PACK_PRICE_USD)}</Strong>, external website listing, business-listed trust
            indicators, Fit Hub access, and featured listing tools as implemented. Outreach runs through discovery nudges
            and interest-client signals.
          </Li>
          <Li>
            <Strong>Elite Fitness Pro:</Strong> Monthly fee currently{" "}
            <Strong>{usdCents(FP_TIER_MONTHLY_FEES_USD.elite_fitness_pro ?? 40)}</Strong> when billed. Includes in-app
            chat, unlimited discovery nudges, verified business trust indicators, full analytics, Fit Hub, featured listing
            programs, platform reviews, and permission to share business email addresses in chat. Phone numbers and
            off-platform payment details remain prohibited as described in Section 12. Background screening and document
            requirements apply as shown in onboarding.
          </Li>
          <Li>
            Tier switches, billing grace periods, and document review requirements are enforced in-product. Match Fit may
            update tier pricing, limits, and included features with notice through the Service or email for material
            changes.
          </Li>
        </Ul>

        <H2 id="trainer-conduct-payouts">12. Fitness Pro Conduct, Communication Policy, Payouts, and Taxes</H2>
        <Ul>
          <Li>
            <Strong>Off-Platform Payments:</Strong> Any Fitness Pro found soliciting or accepting payments off-platform for
            clients first discovered through Match Fit is subject to the two-tier suspension schedule below (a temporary
            suspension on the first substantiated occurrence, permanent on the second), in addition to other remedies
            available to Match Fit under these Terms or applicable law.
          </Li>
          <Li>
            <Strong>In-App Communication:</Strong> Sharing links to external websites, social profiles, or other platforms
            in chat is permitted on every Fitness Pro account type — Match Fit does not require exclusive use of the
            Service. For <Strong>Match Fit Pro</Strong> and <Strong>Match Fit Premium Pro</Strong>, attempting to
            circumvent in-app messaging to share phone numbers or emails may result in enforcement. For{" "}
            <Strong>Elite Fitness Pro</Strong>, business email addresses may be permitted; phone numbers and off-platform
            payment steering remain prohibited for every account type. For <Strong>Independent Fitness Pro</Strong>,
            in-app chat is not available — discovery nudges are subject to daily limits and optional paid packs as
            described in Section 8. For Fitness Pros on tiers where chat applies, a first substantiated offense (phone
            numbers, personal emails, or off-platform payment solicitation) results in a{" "}
            <Strong>{OFF_PLATFORM_TEMP_BAN_DAYS}-day</Strong> temporary suspension, and a second substantiated offense
            results in a <Strong>permanent</Strong> ban, tracked in line with account and tax-record associations as
            reasonably available. Temporary suspensions lift automatically once the {OFF_PLATFORM_TEMP_BAN_DAYS}-day
            period ends unless Match Fit staff extends review for a specific case.
          </Li>
          <Li>
            <Strong>DIY Timelines:</Strong> Fitness Pros agree to meet DIY delivery timelines described in Section 6 or escalated
            timelines approved by Match Fit support. Failure may result in Clients receiving refunds of service amounts (with
            the administrative fee treated as non-refundable to Clients as stated) and loss of corresponding payout.
          </Li>
          <Li>
            <Strong>Independent Business:</Strong> Fitness Pros set their own prices and service structures (per session for
            mobile/virtual where applicable; monthly or recurring models for DIY where applicable). Fitness Pros receive the
            Fitness Pro-set portion of eligible charges per payout rules we publish; Match Fit retains the administrative fee
            component and processor fees as priced at checkout.
          </Li>
          <Li>
            <Strong>Payouts:</Strong> Funds may be held until the Client confirms completion or a dispute window passes, as
            implemented in payout logic. Tips, where supported, are directed to Fitness Pros according to in-product rules. You
            must complete payout elections correctly to receive funds.
          </Li>
          <Li>
            <Strong>Complaints and Investigations:</Strong> When a complaint is filed that warrants review, we may suspend a
            Fitness Pro pending investigation. We aim to investigate fairly and resolve matters promptly, but timelines vary by
            complexity.
          </Li>
          <Li>
            <Strong>Taxes:</Strong> Fitness Pros are independent contractors responsible for their own taxes. Match Fit may issue
            IRS Form 1099 (or successor forms) as required. Fitness Pros must notify us of form errors with enough time before tax
            filing deadlines for us to attempt corrections. Match Fit is not liable for a Fitness Pro&apos;s failure to file
            taxes.
          </Li>
          <Li>
            <Strong>Premium Billing:</Strong> If a Fitness Pro selects a premium plan, they must keep the payment method current.
            If billing fails beyond a stated grace period (for example, <Strong>seventy-two (72) consecutive hours</Strong>),
            premium features may be demoted until payment succeeds.
          </Li>
        </Ul>

        <H2 id="trainer-matching-products">13. Fitness Pro Discovery Limits and Optional Purchases</H2>
        <P>
          Fitness Pros may receive periodic batches of client matches (for example,{" "}
          <Strong>{STANDARD_MATCH_BATCH_SIZE} matches every {MATCH_BATCH_WINDOW_HOURS} hours</Strong>) as
          implemented. Fitness Pros may purchase additional match visibility or related boosts where we offer them.
          Premium plans may include unlimited or expanded matching as described at signup.
        </P>
        <P>
          <Strong>Discovery nudges</Strong> let eligible Fitness Pros send a lightweight outreach signal to clients who
          opted into discovery. Limits depend on account type: Independent Fitness Pro accounts receive a daily allowance
          (currently <Strong>{INDEPENDENT_FP_DAILY_NUDGES}</Strong>) with optional{" "}
          <Strong>{FP_NUDGE_PACK_SIZE}-nudge packs</Strong> for <Strong>{usdCents(FP_NUDGE_PACK_PRICE_USD)}</Strong>;
          Elite Fitness Pro includes unlimited nudges; Match Fit Pro and Match Fit Premium Pro use chat instead of nudges.
          Nudges on Independent Fitness Pro do not open in-app chat threads.
        </P>

        <H2 id="featured-placement">14. Featured Home Placement and Sponsored Visibility</H2>
        <P>
          <Strong>Match Fit Premium Pro</Strong> coaches may participate in regional programs to appear in public featured–Fitness Pro modules. Components may
          include: (1) a <Strong>daily random allocation</Strong> among eligible entrants sharing the same three-digit U.S. ZIP
          code prefix derived from the coach&apos;s published in-person service ZIP, and (2) a limited number of{" "}
          <Strong>sponsored placements</Strong> per region per day awarded to qualifying bids. Cutoffs and display windows use
          the <Strong>America/New_York</Strong> calendar unless we post a different schedule.
        </P>
        <P>
          Sponsored amounts are <Strong>payments for advertising</Strong>, not wagers or games of chance. Committed amounts are{" "}
          <Strong>non-refundable</Strong> once the placement window locks, even if you are later outranked, your profile is
          removed for policy reasons, or traffic is lower than expected. Match Fit does not guarantee impressions, messages, or
          revenue.
        </P>
        <P>
          Where a random allocation is a no-additional-charge benefit for qualifying coaches, we provide any{" "}
          <Strong>free alternate method of entry</Strong> required by applicable promotion laws, as described in official rules
          we publish. The program is void where prohibited; coaches must comply with local promotions, sweepstakes, and
          advertising laws.
        </P>

        <H2 id="prohibited-use">15. Prohibited Use</H2>
        <Ul>
          <Li>
            <Strong>Off-Platform Fee Circumvention:</Strong> Fitness Pros must not solicit or accept payment outside Match Fit
            for relationships that began through the Service. The two-tier suspension schedule described in Section 12
            applies per substantiated occurrence.
          </Li>
          <Li>No unlawful, harassing, discriminatory, fraudulent, or dangerous conduct.</Li>
          <Li>No scraping, security probing, or interference with the Service except as law permits.</Li>
          <Li>No misrepresentation of credentials, availability, or pricing.</Li>
          <Li>No circumvention of fees by soliciting off-platform payments for services first marketed through Match Fit where
            such circumvention violates additional policies we post.</Li>
        </Ul>

        <H2 id="ip-and-content">16. Intellectual Property and License</H2>
        <P>
          Match Fit and its licensors own the Service, branding, and software. You retain rights in content you upload; you
          grant Match Fit a non-exclusive license to host, display, distribute, and adapt that content as needed to operate,
          promote, and improve the Service, including moderation and safety review.
        </P>

        <H2 id="disclaimers">17. Disclaimers</H2>
        <P>
          The Service is provided &quot;as is&quot; and &quot;as available.&quot; To the maximum extent permitted by law,
          Match Fit disclaims all warranties, whether express, implied, or statutory, including implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that Fitness Pros are
          licensed in every jurisdiction where a client may be located, that sessions will be error-free, or that outcomes
          will meet expectations.
        </P>
        <P>
          Fitness activities involve inherent risks. Clients should consult qualified health professionals before beginning
          programs. Fitness Pros are responsible for professional scope of practice and for obtaining appropriate insurance for
          their businesses.
        </P>

        <section className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-6">
          <h2 id="physical-waiver" className="scroll-mt-24 text-base font-black tracking-tight text-amber-100">
            17A. Physical Activity Waiver and Release of Liability
          </h2>
          <p className="mt-4 text-sm font-semibold uppercase leading-relaxed tracking-wide text-white/75">
            FITNESS TRAINING INVOLVES INHERENT RISKS OF INJURY, ILLNESS, OR DEATH. MATCH FIT FACILITATES MARKETPLACE
            CONNECTIONS AND IS NOT A TRAINER OR MEDICAL PROVIDER. TO THE MAXIMUM EXTENT PERMITTED BY LAW, CLIENTS
            VOLUNTARILY ASSUME ALL RISKS ASSOCIATED WITH BOTH MOBILE (IN-PERSON) AND VIRTUAL SESSIONS. YOU EXPLICITLY
            RELEASE, WAIVE, AND DISCHARGE NORTHSIDE VENTURES LLC, ITS AFFILIATES, AND ITS OFFICERS FROM ANY AND ALL CLAIMS
            FOR PERSONAL INJURY, PROPERTY DAMAGE, MEDICAL EMERGENCY, ACCIDENT, OR WRONGFUL DEATH ARISING FROM OR RELATED TO
            SERVICES FACILITATED THROUGH THE PLATFORM.
          </p>
        </section>

        <H2 id="limitation-liability">18. Limitation of Liability</H2>
        <P>
          To the maximum extent permitted by law, Match Fit and its affiliates, officers, directors, employees, and agents
          will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of
          profits, data, or goodwill, arising from or related to these Terms or the Service, even if advised of the
          possibility. Our aggregate liability for claims arising out of or relating to the Service or these Terms is limited
          to the greater of (a) one hundred U.S. dollars ($100) or (b) the amounts you paid to Match Fit for platform fees
          (excluding amounts passed through to Fitness Pros or processors) in the three (3) months before the event giving rise
          to liability. Some jurisdictions do not allow certain limitations; in those cases, limits apply to the fullest extent
          allowed.
        </P>

        <H2 id="indemnity">19. Indemnity</H2>
        <P>
          You will defend, indemnify, and hold harmless Match Fit and its affiliates from claims, damages, losses, and expenses
          (including reasonable attorneys&apos; fees) arising from your content, your services as a Fitness Pro, your use of
          Fitness Pro services as a Client, your violation of these Terms, or your violation of third-party rights.
        </P>

        <H2 id="termination">20. Suspension, Termination, and Reinstatement</H2>
        <P>
          We may suspend or terminate access for violations of these Terms, risk to users, fraud, or legal requirements.
          Serious violations, egregious conduct, or risk to Match Fit&apos;s brand or operations may result in termination and
          records retained internally for <Strong>five (5) years</Strong>. After that period, reapplication may be allowed
          with heightened monitoring; Match Fit may still permanently ban individuals when warranted.
        </P>
        <P>
          You may request account deletion through in-product privacy settings (password verification required). We schedule
          permanent removal for <Strong>thirty (30) days</Strong> after your request. During that window you may sign in and
          cancel the scheduled deletion to keep your account. If you do not cancel, we de-identify personal data on your
          account record, cancel active Client subscriptions through Stripe where applicable, and treat the removal as{" "}
          <Strong>irreversible</Strong>, as described in our Privacy Policy. We retain minimum records needed for trust,
          safety, billing audit, and legal compliance.
        </P>

        <H2 id="changes">21. Changes to the Service and These Terms</H2>
        <P>
          We may modify the Service or these Terms. Material changes will be communicated by email to the address on file
          and/or through in-product notices, with an updated effective date on this page. Continued use after the effective
          date constitutes acceptance unless we state otherwise for specific changes that require fresh consent.
        </P>
        <H2 id="governing-law">22. Governing Law, Mandatory Arbitration, and Class Action Waiver</H2>
        <P>
          These Terms are governed by the laws of the State of Georgia, without regard to conflict-of-law principles. ANY
          DISPUTE ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE WILL BE RESOLVED EXCLUSIVELY THROUGH BINDING,
          INDIVIDUAL ARBITRATION IN GEORGIA, RATHER THAN IN COURT. YOU AND MATCH FIT AGREE THAT EACH MAY BRING CLAIMS
          AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR
          REPRESENTATIVE PROCEEDING. If any part of this arbitration agreement is found unenforceable, the exclusive
          jurisdiction and venue for disputes will be the state and federal courts located in Georgia.
        </P>

        <H2 id="general">23. General</H2>
        <Ul>
          <Li>
            <Strong>Entire Agreement:</Strong> These Terms and policies linked from the Service (including the Privacy Policy)
            form the entire agreement regarding the subject matter and supersede prior oral or written understandings.
          </Li>
          <Li>
            <Strong>Severability:</Strong> If a provision is unenforceable, the remaining provisions remain in effect.
          </Li>
          <Li>
            <Strong>No Waiver:</Strong> Failure to enforce a provision is not a waiver.
          </Li>
          <Li>
            <Strong>Assignment:</Strong> You may not assign these Terms without our consent; we may assign them in connection
            with a merger, acquisition, or sale of assets.
          </Li>
          <Li>
            <Strong>Survival:</Strong> Sections that by nature should survive (fees owed, liability limits, indemnity,
            governing law) survive termination.
          </Li>
        </Ul>

        <LegalPageFooterNav role={role} />
      </div>
    </main>
  );
}
