import { LegalPageFooterNav } from "@/components/legal-page-footer-nav";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

/** Legal operator of Match Fit. */
const OPERATOR_LEGAL_NAME = "Northside Ventures LLC";

/** General and billing inquiries. */
const TERMS_CONTACT_EMAIL = "northside.ventures.llc@gmail.com";

const PHYSICAL_ADDRESS_LINE = "1954 Airport Rd STE 1277, Chamblee, GA 30341, United States";

const TERMS_EFFECTIVE_DATE = "April 29, 2026";

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

export default async function TermsPage() {
  const clientId = await getSessionClientId();
  const trainerId = await getSessionTrainerId();
  const role = clientId ? "client" : trainerId ? "trainer" : "guest";

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
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
          The Service is a technology platform that helps clients discover independent personal trainers (&quot;Trainers&quot;
          or &quot;Coaches&quot;) and purchase certain offerings (such as sessions, programs, subscriptions, and optional
          promotional products) facilitated through the Service. <Strong>Trainers are independent contractors, not employees
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
            <Strong>Trainer:</Strong> An independent professional who registers for a trainer account, completes onboarding
            requirements we specify, and may offer services through the Service.
          </Li>
          <Li>
            <Strong>Session:</Strong> A booked mobile (in-person at an agreed location) or virtual (online) personal training
            appointment between a Client and a Trainer, priced and confirmed through flows available in the Service as
            implemented from time to time.
          </Li>
          <Li>
            <Strong>DIY Plan:</Strong> Remote programming or related deliverables priced on a recurring or trial basis as
            offered by a Trainer through the Service.
          </Li>
          <Li>
            <Strong>Platform Subscription:</Strong> Recurring Client access to the nationwide trainer database and related
            client features, billed as described at checkout or in-product.
          </Li>
        </Ul>

        <H2 id="eligibility-accounts">2. Eligibility, Accounts, and Security</H2>
        <Ul>
          <Li>You must be legally able to enter a binding contract in your jurisdiction to use the Service.</Li>
          <Li>
            You are responsible for accurate profile and billing information. Clients are required to maintain a valid
            payment method on file for activation and continued use where the Service requires it.
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

        <H2 id="fees-and-payments">3. Fees, Administrative Charges, and Payment Processing</H2>
        <P>
          <Strong>Administrative Fee (Non-Subscription Purchases):</Strong> For Clients, purchases other than the recurring
          Platform subscription (for example, per-session bookings, DIY plans, trial weeks, tips where enabled, premium
          trainer content subscriptions offered in-product, trainer-side registration or premium fees, match-boost or token
          purchases, and similar one-time or non-platform-subscription charges) include a{" "}
          <Strong>twenty percent (20%) administrative fee</Strong> assessed on the applicable transaction. This fee supports
          platform operations, payments infrastructure, dispute tooling, and marketplace services. Unless a separate refund
          policy below states otherwise for a specific scenario, <Strong>any portion of the 20% administrative fee that has
          been collected is non-refundable</Strong> when a refund of the underlying trainer compensation or service price is
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
          <Strong>Trainer Premium Subscription:</Strong> Where we offer a Trainer premium plan at a stated monthly price
          (for example, twenty U.S. dollars ($20.00) per month), applicable payment processor costs may be included in that
          advertised price as described at checkout.
        </P>
        <P>
          <Strong>Subscriptions and Promotions:</Strong> Client Platform subscriptions may be offered at published rates
          (for example, five U.S. dollars ($5.00) per month) with promotional pricing (for example, two U.S. dollars ($2.00)
          per month for an introductory period) when we run such programs. Promotional details, renewal rates, and billing
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
          <Strong>Location and Tools:</Strong> For <Strong>mobile (in-person)</Strong> sessions, the Client and Trainer agree
          on place and time. Match Fit does not monitor or control where training occurs. For <Strong>virtual</Strong>{" "}
          sessions, Trainers may connect third-party meeting tools (such as Zoom, Google Meet, or Microsoft Teams) as offered
          in-product; those providers&apos; terms apply to the video session itself.
        </P>
        <P>
          <Strong>Compensation:</Strong> Sessions are generally compensated on a per-session basis at the Trainer&apos;s
          published rate plus the administrative fee and transaction fee described in Section 3. Optional tips, if offered,
          are separate line items subject to the same processing mechanics unless stated otherwise at checkout.
        </P>
        <P>
          <Strong>Completion Confirmation:</Strong> After the scheduled session date, the Client has a limited window
          (currently <Strong>twenty-four (24) hours</Strong> where implemented) to confirm whether the session was completed
          or to report an issue through the flows we provide (for example, marking outcomes such as completed,{" "}
          <Strong>No Show</Strong>, <Strong>Rescheduled</Strong> with an updated date reflected in the Service, or{" "}
          <Strong>Cancelled without make-up</Strong>). If the session did not occur and the Client does not report that within
          the stated window, automated refund paths may not be available; Clients should contact support promptly for
          exceptional cases.
        </P>
        <P>
          <Strong>No Show Refunds:</Strong> If the Client marks <Strong>No Show</Strong> for the Trainer in accordance with
          in-product rules, the Client may be eligible for a refund of the session price paid for the personal training
          portion, <Strong>excluding the non-refundable 20% administrative fee</Strong> and any non-refundable processing
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
          through Service tools or support. We may suspend a Trainer&apos;s account pending a good-faith investigation and
          restrict booking or platform use until the matter is resolved.
        </P>

        <H2 id="diy-policies">6. DIY Plans and Trial Weeks</H2>
        <P>
          DIY offerings are priced by the Trainer, typically on a monthly basis, with the <Strong>20% administrative fee
          applied to the monthly price</Strong> at checkout (plus transaction fees under Section 3). Trainers may offer a{" "}
          <Strong>trial week</Strong> priced at approximately one-quarter (¼) of the monthly plan price plus administrative
          and processing fees as shown at checkout.
        </P>
        <Ul>
          <Li>
            After the Trainer has the information we require, the Trainer is expected to deliver the first workout within{" "}
            <Strong>five (5) business days</Strong> unless Match Fit or support has approved a different timeline for a
            larger engagement.
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
            <Strong>excluding the non-refundable 20% administrative fee</Strong> as stated above.
          </Li>
          <Li>
            Dissatisfaction after delivery is handled similarly to sessions: support may offer account credit; refunds are
            limited to exceptional circumstances.
          </Li>
          <Li>
            Clients may commit to a full month, pay month-to-month, or use auto-pay where those options are presented.
          </Li>
        </Ul>

        <H2 id="subscriptions-billing">7. Client Platform Subscription, Pause, and Failed Payments</H2>
        <Ul>
          <Li>
            Platform subscriptions renew according to the plan you select until canceled in accordance with in-product
            controls and processor billing portals where linked.
          </Li>
          <Li>
            If you pause your subscription after a bill date as allowed in-product, you may lose access to the trainer
            database until you resume. Trainers you work with may receive notices consistent with product behavior when a
            subscription will not renew.
          </Li>
          <Li>
            If a renewal payment fails, you may have a grace period (currently up to <Strong>seven (7) days</Strong>) to
            update payment information before access is suspended, as implemented in billing flows and communications.
          </Li>
        </Ul>

        <H2 id="communications-discovery">8. Messaging, Discovery History, and In-App Communication</H2>
        <Ul>
          <Li>
            Clients may be limited to <Strong>two (2) initial outbound messages</Strong> to a Trainer until that Trainer
            responds, as implemented to reduce spam.
          </Li>
          <Li>
            You agree to use Service messaging for introductions and coordination where required by product rules. Automated
            tools may mask or remove phone numbers, email addresses, or similar contact data shared in chat. You acknowledge
            that off-platform sharing (for example, in person) is outside our control but may violate these Terms or
            Trainer obligations below.
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
          Premium Trainers may publish content (such as posts, photos, or videos) to Fit Hub or related surfaces. Clients may
          subscribe to premium trainer feeds where offered, filter feeds, and cancel those subscriptions at any time subject
          to billing cycles. Content may be moderated for appropriateness and safety.
        </P>

        <H2 id="learning-features">10. Matching, Goals, and Product Analytics</H2>
        <P>
          The Service may use questionnaires, match preferences, and usage signals to suggest Trainers and improve the
          product. Features may include goal-setting tools and behavioral or preference modeling to personalize experiences.
          Details about data practices appear in our Privacy Policy.
        </P>

        <H2 id="trainer-terms">11. Trainer Registration, Compliance, and Public Profile</H2>
        <Ul>
          <Li>
            Trainer registration may require a <Strong>one-time registration fee</Strong> (for example, one hundred U.S.
            dollars ($100.00)) plus applicable transaction fees, as shown at checkout.
          </Li>
          <Li>
            To appear publicly, Trainers may need to complete tax documentation (such as IRS Form W-9 or successor forms),
            accept Trainer-specific terms presented in onboarding, upload valid primary certification (for example, CPT) and
            optional additional credentials, complete a background check through a provider they select from options we make
            available, and satisfy other verification steps we add over time.
          </Li>
          <Li>
            Trainers must keep certifications current and renew background checks at intervals we specify (for example,{" "}
            <Strong>every twelve (12) months</Strong>). Accounts may be suspended until credentials are updated. If
            requirements are not satisfied within a notice period we communicate (for example, <Strong>sixty (60)
            days</Strong>), we may close the account and delete associated data in accordance with our retention policies and
            applicable law.
          </Li>
          <Li>
            Trainers may work at other facilities; Match Fit does not supervise in-person exchanges of contact information
            away from the Service.
          </Li>
        </Ul>

        <H2 id="trainer-conduct-payouts">12. Trainer Conduct, Communication Policy, Payouts, and Taxes</H2>
        <Ul>
          <Li>
            <Strong>Off-Platform Payments:</Strong> Any Trainer found soliciting or accepting payments off-platform for
            clients first discovered through Match Fit agrees to pay a <Strong>$1,000.00 Liquidated Damages Fee</Strong> per
            occurrence, in addition to other remedies available to Match Fit under these Terms or applicable law.
          </Li>
          <Li>
            <Strong>In-App Communication:</Strong> Attempting to circumvent in-app messaging to share phone numbers or
            emails may result in enforcement. For Trainers, a first substantiated offense may lead to a{" "}
            <Strong>ninety (90) day</Strong> deactivation, a second offense up to <Strong>three hundred sixty-five
            (365) days</Strong>, and a third offense <Strong>permanent</Strong> deactivation, tracked in line with account and
            tax-record associations as reasonably available.
          </Li>
          <Li>
            <Strong>DIY Timelines:</Strong> Trainers agree to meet DIY delivery timelines described in Section 6 or escalated
            timelines approved by Match Fit support. Failure may result in Clients receiving refunds of service amounts (with
            the administrative fee treated as non-refundable to Clients as stated) and loss of corresponding payout.
          </Li>
          <Li>
            <Strong>Independent Business:</Strong> Trainers set their own prices and service structures (per session for
            mobile/virtual where applicable; monthly or recurring models for DIY where applicable). Trainers receive the
            Trainer-set portion of eligible charges per payout rules we publish; Match Fit retains the administrative fee
            component and processor fees as priced at checkout.
          </Li>
          <Li>
            <Strong>Payouts:</Strong> Funds may be held until the Client confirms completion or a dispute window passes, as
            implemented in payout logic. Tips, where supported, are directed to Trainers according to in-product rules. You
            must complete payout elections correctly to receive funds.
          </Li>
          <Li>
            <Strong>Complaints and Investigations:</Strong> When a complaint is filed that warrants review, we may suspend a
            Trainer pending investigation. We aim to investigate fairly and resolve matters promptly, but timelines vary by
            complexity.
          </Li>
          <Li>
            <Strong>Taxes:</Strong> Trainers are independent contractors responsible for their own taxes. Match Fit may issue
            IRS Form 1099 (or successor forms) as required. Trainers must notify us of form errors with enough time before tax
            filing deadlines for us to attempt corrections. Match Fit is not liable for a Trainer&apos;s failure to file
            taxes.
          </Li>
          <Li>
            <Strong>Premium Billing:</Strong> If a Trainer selects a premium plan, they must keep the payment method current.
            If billing fails beyond a stated grace period (for example, <Strong>seventy-two (72) consecutive hours</Strong>),
            premium features may be demoted until payment succeeds.
          </Li>
        </Ul>

        <H2 id="trainer-matching-products">13. Trainer Discovery Limits and Optional Purchases</H2>
        <P>
          Trainers may receive periodic batches of client matches (for example, ten (10) matches every twelve (12) hours) as
          implemented. Trainers may purchase additional match visibility or related boosts where we offer them. Premium plans
          may include unlimited or expanded matching as described at signup.
        </P>

        <H2 id="featured-placement">14. Featured Home Placement and Sponsored Visibility</H2>
        <P>
          Premium Page coaches may participate in regional programs to appear in public featured-trainer modules. Components may
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
            <Strong>Off-Platform Fee Circumvention:</Strong> Trainers must not solicit or accept payment outside Match Fit
            for relationships that began through the Service. The <Strong>$1,000.00 Liquidated Damages Fee</Strong> described
            in Section 12 applies per substantiated occurrence.
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
          merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that trainers are
          licensed in every jurisdiction where a client may be located, that sessions will be error-free, or that outcomes
          will meet expectations.
        </P>
        <P>
          Fitness activities involve inherent risks. Clients should consult qualified health professionals before beginning
          programs. Trainers are responsible for professional scope of practice and for obtaining appropriate insurance for
          their businesses.
        </P>

        <H2 id="limitation-liability">18. Limitation of Liability</H2>
        <P>
          To the maximum extent permitted by law, Match Fit and its affiliates, officers, directors, employees, and agents
          will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of
          profits, data, or goodwill, arising from or related to these Terms or the Service, even if advised of the
          possibility. Our aggregate liability for claims arising out of or relating to the Service or these Terms is limited
          to the greater of (a) one hundred U.S. dollars ($100) or (b) the amounts you paid to Match Fit for platform fees
          (excluding amounts passed through to trainers or processors) in the three (3) months before the event giving rise
          to liability. Some jurisdictions do not allow certain limitations; in those cases, limits apply to the fullest extent
          allowed.
        </P>

        <H2 id="indemnity">19. Indemnity</H2>
        <P>
          You will defend, indemnify, and hold harmless Match Fit and its affiliates from claims, damages, losses, and expenses
          (including reasonable attorneys&apos; fees) arising from your content, your services as a Trainer, your use of
          trainer services as a Client, your violation of these Terms, or your violation of third-party rights.
        </P>

        <H2 id="termination">20. Suspension, Termination, and Reinstatement</H2>
        <P>
          We may suspend or terminate access for violations of these Terms, risk to users, fraud, or legal requirements.
          Serious violations, egregious conduct, or risk to Match Fit&apos;s brand or operations may result in termination and
          records retained internally for <Strong>five (5) years</Strong>. After that period, reapplication may be allowed
          with heightened monitoring; Match Fit may still permanently ban individuals when warranted.
        </P>
        <P>
          Trainers may close accounts as provided in-product. After deletion, we may offer a reactivation window (for example,{" "}
          <Strong>thirty (30) days</Strong>) before residual data is disposed of in accordance with policy and law.
        </P>

        <H2 id="changes">21. Changes to the Service and These Terms</H2>
        <P>
          We may modify the Service or these Terms. Material changes will be communicated by email to the address on file
          and/or through in-product notices, with an updated effective date on this page. Continued use after the effective
          date constitutes acceptance unless we state otherwise for specific changes that require fresh consent.
        </P>

        <H2 id="governing-law">22. Governing Law and Venue</H2>
        <P>
          These Terms are governed by the laws of the State of Georgia, excluding conflict-of-law rules. Subject to applicable
          law, exclusive jurisdiction and venue for disputes will be the state and federal courts located in Georgia; you
          consent to personal jurisdiction there.
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

        <section className="mt-12 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Legal Review</p>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Bump{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[0.65rem] text-white/70">TERMS_EFFECTIVE_DATE</code> when
            you ship material updates, and have qualified counsel review these Terms for your jurisdictions, payment flows,
            and promotional programs.
          </p>
        </section>

        <LegalPageFooterNav role={role} />
      </div>
    </main>
  );
}
