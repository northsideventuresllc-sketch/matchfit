import { LegalPageFooterNav } from "@/components/legal-page-footer-nav";
import {
  CLIENT_PAYMENT_GRACE_DAYS,
  CLIENT_PLATFORM_TRIAL_DAYS,
} from "@/lib/client-platform-trial-constants";
import { CLIENT_VIP_PRICE_USD } from "@/lib/client-plan-access";
import { LEGAL_EFFECTIVE_DATE_DISPLAY } from "@/lib/legal-effective-date";
import { INDEPENDENT_FP_DAILY_NUDGES } from "@/lib/fp-tier-chat-policy";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

/** Legal operator of Match Fit. */
const OPERATOR_LEGAL_NAME = "Northside Ventures LLC";

/** Privacy and data-rights requests. */
const PRIVACY_CONTACT_EMAIL = "support@match-fit.net";

/** Postal address for written privacy requests and official notices where applicable. */
const PHYSICAL_ADDRESS_LINE = "1954 Airport Rd STE 1277, Chamblee, GA 30341, United States";

/**
 * Version in force for this posted policy. Update this string to the publication date whenever
 * you deploy a materially revised Privacy Policy so users can see which version applies.
 */
const POLICY_EFFECTIVE_DATE = LEGAL_EFFECTIVE_DATE_DISPLAY;

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

export default async function PrivacyPage() {
  const clientId = await getSessionClientId();
  const trainerId = await getSessionTrainerId();
  const role = clientId ? "client" : trainerId ? "trainer" : "guest";

  return (
    <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Privacy Policy</h1>
        <p className="mt-4 text-xs uppercase tracking-wide text-white/45">
          Effective Date: {POLICY_EFFECTIVE_DATE}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          Whenever we publish an updated policy, we change this effective date to match the version you are reading.
        </p>
        <P>
          Match Fit (&quot;Match Fit,&quot; the &quot;Service&quot;) is operated by <Strong>{OPERATOR_LEGAL_NAME}</Strong>{" "}
          (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). This Privacy Policy describes how we collect, use,
          disclose, and safeguard information when you use our websites, applications, and related services that link to
          this policy.
        </P>
        <P>
          By creating an account, using the Service, or otherwise providing information to us, you agree to this Privacy
          Policy. If you do not agree, do not use the Service.
        </P>

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-base font-black tracking-tight">Contact Us</h2>
          <P>
            For privacy questions or requests: <Strong>{PRIVACY_CONTACT_EMAIL}</Strong>, or write to us at{" "}
            <Strong>{PHYSICAL_ADDRESS_LINE}</Strong>.
          </P>
        </section>

        <H2 id="summary">1. Summary</H2>
        <P>
          We built Match Fit to connect clients with coaches and to give coaches tools for profiles, discovery, Fit Hub
          content, messaging, and optional premium features. We collect account and profile data needed to run the
          Service, record when you accept this Privacy Policy alongside our Terms where the product requires it, process
          subscriptions and certain coach payments through Stripe, send security and transactional messages through email
          infrastructure, deliver optional browser Web Push alerts when you opt in, collect limited usage analytics on
          public marketing and product pages (such as page views and link clicks), and store your in-app activity
          (including chats and social posts) on our systems. Client sign-up includes a {CLIENT_PLATFORM_TRIAL_DAYS}-day
          complimentary VIP trial with no card required; after the trial, accounts move to the Free plan unless you
          subscribe to Client VIP (currently ${CLIENT_VIP_PRICE_USD.toFixed(2)} per month). Legacy accounts may still have a{" "}
          {CLIENT_PAYMENT_GRACE_DAYS}-day payment grace window before deactivation. Fitness Pros in the founding coach promo
          receive {TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Match Fit Premium Pro at sign-up, pay only their background check through our portal, must begin
          onboarding within 7 days of sign-up, and cannot sell services until all onboarding requirements are completed.
          Independent Fitness Pro and Elite Fitness Pro require paid monthly subscriptions as shown at signup. Standard-tier Fitness Pros may defer the platform onboarding fee and repay through payout withhold as described in
          our Terms. You may adjust optional visibility of some profile fields and request in-product account deletion,
          account deletion, which schedules removal after a grace period as described in Section 7, while preserving the
          minimum data we need for trust, safety, and legal compliance. We use reasonable technical and organizational
          measures to protect personal information. We do not sell your personal information as that term is commonly
          defined in U.S. state privacy laws.
        </P>

        <H2 id="collect">2. Information We Collect</H2>
        <P>Depending on whether you are a client, a fitness pro (coach), or a visitor, we may collect:</P>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.1 Account and Authentication</h3>
        <Ul>
          <Li>
            <Strong>Identifiers and Contact Data:</Strong> name, preferred name, username, email address, phone number,
            date of birth, and ZIP or postal code.
          </Li>
          <Li>
            <Strong>Credentials and Security:</Strong> password (stored using one-way hashing—we do not store your
            plaintext password), two-factor authentication settings, verification codes (stored as hashes or transient
            values, not plaintext in our database), session identifiers in HTTP-only cookies, and &quot;stay logged
            in&quot; preferences. We do not write plaintext one-time codes to routine application logs. Some Fitness Pro sign-up
            and email-verification flows may use <Strong>Supabase Auth</Strong> (hosted authentication) before your Match Fit
            account is created; Supabase processes credentials and confirmation links under its own policies when you use
            those flows.
          </Li>
          <Li>
            <Strong>Terms, Privacy, and Compliance Timestamps:</Strong> records of when you accepted applicable terms,
            when you accepted this Privacy Policy (including at client registration, pending registration, fitness pro
            sign-up, or when carried forward from a legacy pending registration completed through Stripe checkout), and
            when you complete certain compliance steps where the product requires them.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.2 Client-Specific Data</h3>
        <Ul>
          <Li>
            <Strong>Profile and Preferences:</Strong> public-style bio, profile photo, match and discovery preferences
            (including goals, service types, interests, and related questionnaire answers), Fit Hub feed preferences,
            notification preferences, and optional visibility choices that control what appears on your public client
            profile (for example whether your bio or match snapshot is shown to visitors).
          </Li>
          <Li>
            <Strong>Wellness and Matching Inputs:</Strong> daily matching questionnaire content and answers, and derived
            algorithm context we compute to personalize prompts or matching. Treat this as sensitive wellness-related
            information you choose to share. The Service is a fitness and coaching marketplace, does not collect or
            process protected health information (PHI) under HIPAA, and does not provide medical advice.
          </Li>
          <Li>
            <Strong>Mailing Address (Optional):</Strong> if you provide it for your own records. Fitness Pro-facing APIs and
            discovery surfaces are built so coaches do not receive your full street address; they may see general
            location information consistent with how you use discovery (for example ZIP or regional pool identifiers), not
            your complete mailing address.
          </Li>
          <Li>
            <Strong>Billing:</Strong> Stripe customer and subscription identifiers when you subscribe; payment details are
            collected by Stripe under its own terms and privacy policy—we do not store full payment card numbers on our
            servers. We record platform trial end dates, payment grace windows, and account deactivation timestamps to
            enforce the client sign-up billing lifecycle described in our Terms.
          </Li>
          <Li>
            <Strong>Social and Engagement on Fit Hub:</Strong> likes, comments, reposts, shares, and content reports you
            submit about coach posts.
          </Li>
          <Li>
            <Strong>Coach Relationships:</Strong> saved coaches, conversation and message content, coach
            &quot;nudges,&quot; relationship stage labels we display in the product, and optional token &quot;gifts&quot;
            you send to fitness pros subject to product rules.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.3 Fitness Pro-Specific Data</h3>
        <Ul>
          <Li>
            <Strong>Professional Profile:</Strong> bio, photo, pronouns, demographics you choose to disclose (for
            example ethnicity or gender identity), languages, coaching experience, niches, and links or handles for
            social profiles you add, along with optional visibility settings that control whether some of those optional
            fields appear on your public coach profile.
          </Li>
          <Li>
            <Strong>Compliance and Verification:</Strong> certification and nutrition credential files you upload,
            onboarding track selections, background check pipeline status (including invite request and sent
            timestamps when manual Checkr screening is active), signup fee hold status, W-9 or tax information you submit
            through our flows, and related review statuses.
          </Li>
          <Li>
            <Strong>Onboarding Questionnaire:</Strong> structured answers, optional Additional Questionnaires, and plain
            text or derived &quot;AI match profile&quot; text generated from your responses to improve discovery and
            pairing.
          </Li>
          <Li>
            <Strong>Account Type and Tier Billing:</Strong> Fitness Pro account tier selection (Match Fit Pro, Match Fit
            Premium Pro, Independent Fitness Pro, or Elite Fitness Pro), tier subscription status, discovery nudge usage
            counts, purchased nudge credit balances, promote-token ledgers, and document-review status for tier-specific
            onboarding.
          </Li>
          <Li>
            <Strong>Fit Hub and Premium Tools:</Strong> posts (text, images, video, carousels), captions, hashtags,
            scheduling choices, visibility (public or private to you), promotions paid with in-platform tokens, and studio
            activity timestamps used for notifications.
          </Li>
          <Li>
            <Strong>Featured Placement Program:</Strong> regional pool identifiers derived from your published in-person
            service ZIP (for example the first three digits of a U.S. ZIP code), raffle entries, bid amounts and payment
            status, display-day keys, and outcomes needed to operate the program described in our Terms.
          </Li>
          <Li>
            <Strong>Tokens and Rewards:</Strong> token balances, ledger entries, weekly grants, purchases through Stripe
            Checkout where enabled, and rewards tied to documented client service transactions.
          </Li>
          <Li>
            <Strong>Billing (Where Connected):</Strong> Stripe-related identifiers for coach billing, invoices, or
            purchases as implemented in the product.
          </Li>
          <Li>
            <Strong>Session Punch-In (Geolocation):</Strong> when you record a SESSION STARTED punch-in for a booked
            session, we store latitude, longitude, and timestamps tied to that booking for compliance, payout gates, and
            fraud prevention.
          </Li>
          <Li>
            <Strong>Video Meeting OAuth (Optional):</Strong> if you connect Zoom, Google Meet, or Microsoft Teams for
            virtual sessions, we store OAuth tokens needed to create or manage meetings. Refresh tokens may be encrypted at rest in production.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.4 Beta Waitlist and Launch Gates</h3>
        <Ul>
          <Li>
            <Strong>Waitlist:</Strong> email address, ZIP code, and status if you join a Fitness Pro or Client waitlist when beta
            capacity is full. Client waitlist sign-up is open to U.S. ZIP codes; fitness pro waitlist sign-up may require a
            service ZIP in our Atlanta metro in-person launch area.
          </Li>
          <Li>
            <Strong>Invite tokens:</Strong> time-limited signup links and slot reservation timestamps when we invite you from
            the waitlist.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.5 Trust, Safety, and Support</h3>
        <Ul>
          <Li>
            <Strong>Blocks and Safety Reports:</Strong> who blocked whom, optional reasons, and reports you file about
            another user.
          </Li>
          <Li>
            <Strong>Account Enforcement Records:</Strong> suspension reasons, timing, and retention windows needed for
            audit or legal compliance.
          </Li>
          <Li>
            <Strong>Bug and Feedback Reports:</Strong> category, description, optional name, email, and whether you chose
            to submit anonymously.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.6 Technical and Usage Data</h3>
        <Ul>
          <Li>
            <Strong>Device and Log Data:</Strong> IP address, browser type, app version where applicable, dates and
            times of requests, referring URLs, and diagnostic logs. We use this for security, fraud prevention, debugging,
            and service reliability.
          </Li>
          <Li>
            <Strong>Cookies and Similar Technologies:</Strong> cookies that maintain your session and security flows. We
            may use essential cookies even if optional marketing cookies are not present.
          </Li>
          <Li>
            <Strong>Bot Protection:</Strong> when enabled, <Strong>Cloudflare Turnstile</Strong> tokens on sign-up, sign-in,
            waitlist, and related forms to distinguish humans from automated abuse.
          </Li>
          <Li>
            <Strong>In-App Chat Monitoring:</Strong> message bodies may be scanned with automated heuristics (for example
            off-platform contact or payment patterns) and, when configured, optional machine-assisted classifiers to flag
            content for internal trust-and-safety review. Flagged or reviewed messages may be retained in admin tooling.
            Rules vary by Fitness Pro account type: <Strong>Match Fit Pro</Strong> and{" "}
            <Strong>Match Fit Premium Pro</Strong> chats are monitored for phone numbers, email addresses, external URLs,
            and off-platform payment language; <Strong>Elite Fitness Pro</Strong> may permit business email addresses and
            external listing links while phone numbers and payment circumvention remain flagged;{" "}
            <Strong>Independent Fitness Pro</Strong> accounts do not use in-app chat — outreach uses discovery nudges
            (currently up to <Strong>{INDEPENDENT_FP_DAILY_NUDGES} per day</Strong>, UTC) which are also subject to
            contact and payment pattern checks before delivery.
          </Li>
          <Li>
            <Strong>Usage Analytics:</Strong> on public and authenticated pages outside admin tooling, we may record page
            views, in-app link clicks (including destination paths or external URLs and optional link labels), and
            pseudonymous visitor and session identifiers stored in a browser cookie and session storage. When deployed on
            Vercel, we may also use <Strong>Vercel Web Analytics</Strong> to collect page views and web performance metrics.
            Admin routes and API endpoints are excluded from first-party page tracking as implemented.
          </Li>
        </Ul>

        <H2 id="sources">3. How We Collect Information</H2>
        <Ul>
          <Li>
            <Strong>Directly From You</Strong> when you register, complete profiles or questionnaires, upload media,
            send messages, make purchases, or contact support.
          </Li>
          <Li>
            <Strong>Automatically</Strong> when you use the Service, including through cookies, server logs, and similar
            technologies.
          </Li>
          <Li>
            <Strong>From Service Providers</Strong> such as payment processors (for example confirmation of subscription
            status from Stripe).
          </Li>
        </Ul>

        <H2 id="use">4. How We Use Information</H2>
        <P>We use personal information to:</P>
        <Ul>
          <Li>Provide, operate, maintain, and improve Match Fit;</Li>
          <Li>
            Create and secure accounts, authenticate users, record acceptance of our Terms and this Privacy Policy where the
            product captures it, and send security notices (including OTP and password-reset flows);
          </Li>
          <Li>Process payments, subscriptions, token purchases, and advertising-style placements you initiate;</Li>
          <Li>Enable discovery, matching, Fit Hub, chat, notifications, and premium coach tools;</Li>
          <Li>Honor optional profile visibility settings you choose in account settings;</Li>
          <Li>Verify identity or eligibility where required for coach onboarding, compliance, or risk controls;</Li>
          <Li>
            Operate beta capacity limits, waitlists, founding promotions, and geographic eligibility for in-person
            services and fitness pro onboarding during limited launches;
          </Li>
          <Li>Detect, investigate, and prevent fraud, abuse, and violations of our Terms or policies;</Li>
          <Li>Communicate service, billing, and policy updates;</Li>
          <Li>Comply with law, respond to lawful requests, and establish or defend legal claims;</Li>
          <Li>
            Process in-product requests to delete your account, which de-identifies personal data on the account record
            while preserving the minimum information required for safety, billing, or legal obligations as described in
            Section 7;
          </Li>
          <Li>
            Analyze usage in aggregated or de-identified form where permitted, to understand product performance, measure
            traffic, and plan improvements;
          </Li>
        </Ul>

        <H2 id="legal-bases">5. Legal Bases (EEA, UK, and Similar Jurisdictions)</H2>
        <P>
          Where GDPR or similar laws apply, we rely on one or more of the following: <Strong>Performance of a Contract</Strong>{" "}
          (providing the Service you request); <Strong>Legitimate Interests</Strong> (security, product improvement, and
          fraud prevention, balanced against your rights); <Strong>Legal Obligation</Strong>; and, where required,{" "}
          <Strong>Consent</Strong> (for example for certain marketing communications or non-essential cookies, if we offer
          them and you opt in). You may withdraw consent where processing is consent-based, without affecting the lawfulness
          of processing before withdrawal.
        </P>

        <H2 id="disclosure">6. How We Share Information</H2>
        <P>We may share personal information with:</P>
        <Ul>
          <Li>
            <Strong>Other Users</Strong> as needed to operate features you use—for example, profile fields you make
            visible (including visibility choices for optional public profile data), Fit Hub posts you publish as public,
            chat messages within a conversation, or discovery preferences you enable for coaches to find you.
          </Li>
          <Li>
            <Strong>Service Providers (Processors)</Strong> who assist us under contract, including:
            <Ul>
              <Li>
                <Strong>Stripe, Inc.</Strong> and affiliates for payments, billing portals, and related fraud and compliance
                tooling;
              </Li>
              <Li>
                <Strong>Supabase</Strong> for hosted authentication on certain Fitness Pro sign-up and OAuth callback flows when
                enabled;
              </Li>
              <Li>
                <Strong>Cloudflare Turnstile</Strong> for bot protection on authentication and waitlist forms when enabled;
              </Li>
              <Li>
                <Strong>OpenAI</Strong> (or comparable providers), when configured, for optional chat trust-and-safety
                classification and certain fitness pro dashboard pricing-assist features;
              </Li>
              <Li>
                <Strong>Resend</Strong> (or comparable email infrastructure) for transactional and security email;
              </Li>
              <Li>
                <Strong>Web Push</Strong> (through your browser and operating system) for optional lock-screen alerts when
                you enable them in settings—no per-message carrier charges; you can revoke permission in your browser at any
                time;
              </Li>
              <Li>
                <Strong>Vercel Web Analytics</Strong>, when deployed on Vercel, for page-view and web-vitals measurement on
                our sites;
              </Li>
              <Li>
                <Strong>Cloud Hosting, Database, and AI Infrastructure</Strong> vendors (such as Vercel and Supabase) that
                store or process data on our behalf to operate the Service.
              </Li>
            </Ul>
          </Li>
          <Li>
            <Strong>Professional Advisers</Strong> such as lawyers or accountants under confidentiality obligations.
          </Li>
          <Li>
            <Strong>Authorities</Strong> when we believe disclosure is required by law, regulation, legal process, or
            governmental request, or to protect the rights, property, or safety of Match Fit, our users, or the public.
          </Li>
          <Li>
            <Strong>Business Transfers:</Strong> in connection with a merger, acquisition, financing, or sale of assets,
            subject to appropriate confidentiality and continuity commitments.
          </Li>
        </Ul>
        <P>
          We require subprocessors to use personal information only for the purposes we specify and to implement appropriate
          security measures. Their own policies also apply where they interact directly with you (for example Stripe&apos;s
          checkout flows).
        </P>

        <H2 id="retention">7. Retention</H2>
        <P>
          We retain personal information for as long as your account is active, as needed to provide the Service, and as
          necessary to comply with legal obligations, resolve disputes, enforce our agreements, and defend claims. Some
          records (for example certain compliance, billing, or safety audit data) may be kept for longer periods where
          law or legitimate business needs require. When retention periods end, we delete or de-identify information where
          feasible.
        </P>
        <P>
          <Strong>Account deletion.</Strong> If you delete your account through in-product settings, we verify your
          password and schedule permanent removal for <Strong>thirty (30) days</Strong> later. During that grace period you
          may sign in and cancel the scheduled deletion to restore access. When the grace period ends (or if you do not
          cancel), we cancel active paid subscriptions through Stripe where your account has them and de-identify personal
          fields on your user record (for example name, contact information, and profile content stored on that record)
          so you can no longer sign in. We may replace chat message bodies you authored with a short placeholder, set
          fitness pro-authored Fit Hub content to private and strip associated media and captions from public view, and clear
          certain compliance payloads on coach profiles, while retaining the underlying row identifiers needed for
          foreign keys and minimum enforcement, trust, or billing audit trails. After finalization, deletion is intended to
          be irreversible.
        </P>

        <H2 id="security">8. Security</H2>
        <P>
          We implement administrative, technical, and physical safeguards designed to protect personal information,
          including encryption in transit where appropriate for our stack, access controls, and secure handling of
          secrets. We avoid writing plaintext one-time verification codes to routine application logs. No method of
          transmission or storage is completely secure; we cannot guarantee absolute security. You are responsible for
          maintaining the confidentiality of your password and devices.
        </P>

        <H2 id="rights">9. Your Choices and Rights</H2>
        <P>Depending on your location, you may have the right to:</P>
        <Ul>
          <Li>
            Access, correct, or update certain profile information through in-product settings, including optional
            visibility of selected public profile fields (for example bio or match snapshot visibility for clients, or
            pronouns, ethnicity, gender identity, and languages spoken for coaches);
          </Li>
          <Li>
            Request deletion of your account through the same settings flow (password required), subject to the
            retention and de-identification approach described in Section 7 and to legal exceptions;
          </Li>
          <Li>Object to or restrict certain processing, or request portability of data you provided, where applicable;</Li>
          <Li>Withdraw marketing consent where we rely on consent;</Li>
          <Li>Lodge a complaint with a supervisory authority in your country, where GDPR or similar law applies.</Li>
        </Ul>
        <P>
          California residents may have additional rights under the CCPA/CPRA, including rights to know categories of
          personal information collected, to request deletion or correction, and to opt out of &quot;sale&quot; or{" "}
          &quot;sharing&quot; for cross-context behavioral advertising. We do not sell personal information for monetary
          consideration. If we ever use personal information in ways that constitute &quot;sharing&quot; under California
          law, we will provide a compliant opt-out mechanism and update this policy. Our website responds to Global Privacy
          Control (GPC) signals to restrict tracking where technically supported by your browser, but we do not otherwise
          alter our data collection practices in response to generic &quot;Do Not Track&quot; browser headers.
        </P>
        <P>
          To exercise rights, email <Strong>{PRIVACY_CONTACT_EMAIL}</Strong>. We may need to verify your identity before
          responding. You may designate an authorized agent where permitted by law, with proof of authorization.
        </P>

        <H2 id="children">10. Children</H2>
        <P>
          Match Fit is not directed to children under 13 (or the higher age required in your jurisdiction for valid
          consent). We do not knowingly collect personal information from children. If you believe we have collected such
          information, contact us and we will take appropriate steps to delete it.
        </P>

        <H2 id="international">11. International Users</H2>
        <P>
          If you access the Service from outside the United States, your information may be processed in the United States
          or other countries where we or our vendors operate. Those countries may have different data protection laws than
          your own. Where required, we use appropriate safeguards (such as standard contractual clauses) for cross-border
          transfers.
        </P>

        <H2 id="third-party">12. Third-Party Links and Embedded Services</H2>
        <P>
          Fitness pros may link to external social networks or websites. Payment flows may embed or redirect to Stripe. Those
          third parties have their own privacy policies. We are not responsible for their practices.
        </P>

        <H2 id="ai">13. Automated Processing and Matching</H2>
        <P>
          We may use algorithms and, where product features enable it, machine-assisted processing to rank or suggest
          coaches, personalize questionnaires, generate fitness pro-facing match profile text from questionnaire answers, flag
          chat messages for trust-and-safety review, and assist fitness pros with optional pricing guidance in the dashboard.
          These processes use information you or fitness pros provide in the Service. They are not used for decisions that
          produce legal or similarly significant effects solely by automated means beyond what is inherent to operating a
          fitness marketplace, unless we disclose otherwise in-product and provide any rights required by law.
        </P>

        <H2 id="changes">14. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time. Each posted version shows its own effective date at the top
          of this page; we update that date when a new version goes live. If changes are material, we will provide
          additional notice as required by law (for example, by email or in-app message).
        </P>

        <H2 id="disclaimers">15. Limitations</H2>
        <P>
          To the fullest extent permitted by law, this Policy does not create rights enforceable by third parties. Nothing
          in this Policy limits any non-waivable rights you may have under applicable law.
        </P>

        <LegalPageFooterNav role={role} />
      </div>
    </main>
  );
}
