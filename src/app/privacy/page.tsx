import { LegalPageFooterNav } from "@/components/legal-page-footer-nav";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";

/** Replace before launch — must match your operating entity and DPO / privacy inbox. */
const EFFECTIVE_DATE = "April 29, 2026";
const OPERATOR_LEGAL_NAME = "[Insert your legal entity name]";
const PRIVACY_CONTACT_EMAIL = "[Insert privacy email address]";
const PHYSICAL_ADDRESS_LINE = "[Insert mailing address for privacy requests, if required in your jurisdictions]";

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
          Effective date: {EFFECTIVE_DATE}
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
          <h2 className="text-base font-black tracking-tight">Contact us</h2>
          <P>
            For privacy questions or requests: <Strong>{PRIVACY_CONTACT_EMAIL}</Strong>
            {PHYSICAL_ADDRESS_LINE.startsWith("[") ? null : (
              <>
                {" "}
                or write to us at <Strong>{PHYSICAL_ADDRESS_LINE}</Strong>.
              </>
            )}
          </P>
        </section>

        <H2 id="summary">1. Summary</H2>
        <P>
          We built Match Fit to connect clients with coaches and to give coaches tools for profiles, discovery, Fit Hub
          content, messaging, and optional premium features. We collect account and profile data needed to run the
          Service, process subscriptions and certain coach payments through Stripe, send security and transactional
          messages through email and SMS providers, and store your in-app activity (including chats and social posts) on
          our systems. We use reasonable technical and organizational measures to protect personal information. We do not
          sell your personal information as that term is commonly defined in U.S. state privacy laws.
        </P>

        <H2 id="collect">2. Information we collect</H2>
        <P>Depending on whether you are a client, a trainer (coach), or a visitor, we may collect:</P>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.1 Account and authentication</h3>
        <Ul>
          <Li>
            <Strong>Identifiers and contact data:</Strong> name, preferred name, username, email address, phone number,
            date of birth, and ZIP or postal code.
          </Li>
          <Li>
            <Strong>Credentials and security:</Strong> password (stored using one-way hashing—we do not store your
            plaintext password), two-factor authentication settings, verification codes (stored as hashes or transient
            values, not plaintext), session identifiers in HTTP-only cookies, and &quot;stay logged in&quot; preferences.
          </Li>
          <Li>
            <Strong>Terms and compliance timestamps:</Strong> records that you accepted applicable terms or completed
            certain compliance steps where the product requires it.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.2 Client-specific data</h3>
        <Ul>
          <Li>
            <Strong>Profile and preferences:</Strong> public-style bio, profile photo, match and discovery preferences
            (including goals, service types, interests, and related questionnaire answers), Fit Hub feed preferences, and
            notification preferences.
          </Li>
          <Li>
            <Strong>Wellness and matching inputs:</Strong> daily matching questionnaire content and answers, and derived
            algorithm context we compute to personalize prompts or matching. Treat this as sensitive wellness-related
            information you choose to share.
          </Li>
          <Li>
            <Strong>Mailing address (optional):</Strong> if you provide it for your own records; we design the product so
            trainers do not receive your full private address through routine trainer APIs.
          </Li>
          <Li>
            <Strong>Billing:</Strong> Stripe customer and subscription identifiers; payment details are collected by
            Stripe under its own terms and privacy policy—we do not store full payment card numbers on our servers.
          </Li>
          <Li>
            <Strong>Social and engagement on Fit Hub:</Strong> likes, comments, reposts, shares, and content reports you
            submit about trainer posts.
          </Li>
          <Li>
            <Strong>Trainer relationships:</Strong> saved trainers, conversation and message content, trainer
            &quot;nudges,&quot; relationship stage labels we display in the product, and optional token &quot;gifts&quot;
            you send to trainers subject to product rules.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.3 Trainer-specific data</h3>
        <Ul>
          <Li>
            <Strong>Professional profile:</Strong> bio, photo, pronouns, demographics you choose to disclose (for
            example ethnicity or gender identity), languages, coaching experience, niches, and links or handles for
            social profiles you add.
          </Li>
          <Li>
            <Strong>Compliance and verification:</Strong> certification and nutrition credential files you upload,
            onboarding track selections, background check pipeline status, W-9 or tax information you submit through our
            flows, and related review statuses.
          </Li>
          <Li>
            <Strong>Matching questionnaire:</Strong> structured answers, optional follow-up questionnaires, and plain
            text or derived &quot;AI match profile&quot; text generated from your responses to improve discovery and
            pairing.
          </Li>
          <Li>
            <Strong>Fit Hub and Premium tools:</Strong> posts (text, images, video, carousels), captions, hashtags,
            scheduling choices, visibility (public or private to you), promotions paid with in-platform tokens, and studio
            activity timestamps used for notifications.
          </Li>
          <Li>
            <Strong>Featured placement program:</Strong> regional pool identifiers derived from your published in-person
            service ZIP (for example the first three digits of a U.S. ZIP code), raffle entries, bid amounts and payment
            status, display-day keys, and outcomes needed to operate the program described in our Terms.
          </Li>
          <Li>
            <Strong>Tokens and rewards:</Strong> token balances, ledger entries, weekly grants, purchases through Stripe
            Checkout where enabled, and rewards tied to documented client service transactions.
          </Li>
          <Li>
            <Strong>Billing (where connected):</Strong> Stripe-related identifiers for coach billing, invoices, or
            purchases as implemented in the product.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.4 Trust, safety, and support</h3>
        <Ul>
          <Li>
            <Strong>Blocks and safety reports:</Strong> who blocked whom, optional reasons, and reports you file about
            another user.
          </Li>
          <Li>
            <Strong>Account enforcement records:</Strong> suspension reasons, timing, and retention windows needed for
            audit or legal compliance.
          </Li>
          <Li>
            <Strong>Bug and feedback reports:</Strong> category, description, optional name, email, and whether you chose
            to submit anonymously.
          </Li>
        </Ul>

        <h3 className="mt-6 text-sm font-bold text-white/90">2.5 Technical and usage data</h3>
        <Ul>
          <Li>
            <Strong>Device and log data:</Strong> IP address, browser type, app version where applicable, dates and
            times of requests, referring URLs, and diagnostic logs. We use this for security, fraud prevention, debugging,
            and service reliability.
          </Li>
          <Li>
            <Strong>Cookies and similar technologies:</Strong> cookies that maintain your session and security flows. We
            may use essential cookies even if optional marketing cookies are not present.
          </Li>
        </Ul>

        <H2 id="sources">3. How we collect information</H2>
        <Ul>
          <Li>
            <Strong>Directly from you</Strong> when you register, complete profiles or questionnaires, upload media,
            send messages, make purchases, or contact support.
          </Li>
          <Li>
            <Strong>Automatically</Strong> when you use the Service, including through cookies, server logs, and similar
            technologies.
          </Li>
          <Li>
            <Strong>From service providers</Strong> such as payment processors (for example confirmation of subscription
            status from Stripe).
          </Li>
        </Ul>

        <H2 id="use">4. How we use information</H2>
        <P>We use personal information to:</P>
        <Ul>
          <Li>Provide, operate, maintain, and improve Match Fit;</Li>
          <Li>Create and secure accounts, authenticate users, and send security notices (including OTP and password-reset flows);</Li>
          <Li>Process payments, subscriptions, token purchases, and advertising-style placements you initiate;</Li>
          <Li>Enable discovery, matching, Fit Hub, chat, notifications, and premium coach tools;</Li>
          <Li>Verify identity or eligibility where required for coach onboarding, compliance, or risk controls;</Li>
          <Li>Detect, investigate, and prevent fraud, abuse, and violations of our Terms or policies;</Li>
          <Li>Communicate service, billing, and policy updates;</Li>
          <Li>Comply with law, respond to lawful requests, and establish or defend legal claims;</Li>
          <Li>
            Analyze usage in aggregated or de-identified form where permitted, to understand product performance and plan
            improvements.
          </Li>
        </Ul>

        <H2 id="legal-bases">5. Legal bases (EEA, UK, and similar jurisdictions)</H2>
        <P>
          Where GDPR or similar laws apply, we rely on one or more of the following: <Strong>performance of a contract</Strong>{" "}
          (providing the Service you request); <Strong>legitimate interests</Strong> (security, product improvement, and
          fraud prevention, balanced against your rights); <Strong>legal obligation</Strong>; and, where required,{" "}
          <Strong>consent</Strong> (for example for certain marketing communications or non-essential cookies, if we offer
          them and you opt in). You may withdraw consent where processing is consent-based, without affecting the lawfulness
          of processing before withdrawal.
        </P>

        <H2 id="disclosure">6. How we share information</H2>
        <P>We may share personal information with:</P>
        <Ul>
          <Li>
            <Strong>Other users</Strong> as needed to operate features you use—for example, profile fields you make
            visible, Fit Hub posts you publish as public, chat messages within a conversation, or discovery preferences
            you enable for coaches to find you.
          </Li>
          <Li>
            <Strong>Service providers (processors)</Strong> who assist us under contract, including:
            <Ul>
              <Li>
                <Strong>Stripe, Inc.</Strong> and affiliates for payments, billing portals, and related fraud and compliance
                tooling;
              </Li>
              <Li>
                <Strong>Resend</Strong> (or comparable email infrastructure) for transactional and security email;
              </Li>
              <Li>
                <Strong>Twilio</Strong> (or comparable carriers) for SMS or voice one-time codes when you enable those
                channels;
              </Li>
              <Li>
                <Strong>Cloud hosting, database, and infrastructure</Strong> vendors that store or process data on our
                behalf.
              </Li>
            </Ul>
          </Li>
          <Li>
            <Strong>Professional advisers</Strong> such as lawyers or accountants under confidentiality obligations.
          </Li>
          <Li>
            <Strong>Authorities</Strong> when we believe disclosure is required by law, regulation, legal process, or
            governmental request, or to protect the rights, property, or safety of Match Fit, our users, or the public.
          </Li>
          <Li>
            <Strong>Business transfers:</Strong> in connection with a merger, acquisition, financing, or sale of assets,
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

        <H2 id="security">8. Security</H2>
        <P>
          We implement administrative, technical, and physical safeguards designed to protect personal information,
          including encryption in transit where appropriate for our stack, access controls, and secure handling of
          secrets. No method of transmission or storage is completely secure; we cannot guarantee absolute security. You
          are responsible for maintaining the confidentiality of your password and devices.
        </P>

        <H2 id="rights">9. Your choices and rights</H2>
        <P>Depending on your location, you may have the right to:</P>
        <Ul>
          <Li>Access, correct, or update certain profile information through in-product settings;</Li>
          <Li>Request deletion of your account, subject to legal exceptions;</Li>
          <Li>Object to or restrict certain processing, or request portability of data you provided, where applicable;</Li>
          <Li>Withdraw marketing consent where we rely on consent;</Li>
          <Li>Lodge a complaint with a supervisory authority in your country, where GDPR or similar law applies.</Li>
        </Ul>
        <P>
          California residents may have additional rights under the CCPA/CPRA, including rights to know categories of
          personal information collected, to request deletion or correction, and to opt out of &quot;sale&quot; or{" "}
          &quot;sharing&quot; for cross-context behavioral advertising. We do not sell personal information for monetary
          consideration. If we ever use personal information in ways that constitute &quot;sharing&quot; under California
          law, we will provide a compliant opt-out mechanism and update this policy.
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

        <H2 id="international">11. International users</H2>
        <P>
          If you access the Service from outside the United States, your information may be processed in the United States
          or other countries where we or our vendors operate. Those countries may have different data protection laws than
          your own. Where required, we use appropriate safeguards (such as standard contractual clauses) for cross-border
          transfers.
        </P>

        <H2 id="third-party">12. Third-party links and embedded services</H2>
        <P>
          Trainers may link to external social networks or websites. Payment flows may embed or redirect to Stripe. Those
          third parties have their own privacy policies. We are not responsible for their practices.
        </P>

        <H2 id="ai">13. Automated processing and matching</H2>
        <P>
          We may use algorithms and, where product features enable it, machine-assisted processing to rank or suggest
          coaches, personalize questionnaires, or generate trainer-facing match profile text from questionnaire answers.
          These processes use information you or trainers provide in the Service. They are not used for decisions that
          produce legal or similarly significant effects solely by automated means beyond what is inherent to operating a
          fitness marketplace, unless we disclose otherwise in-product and provide any rights required by law.
        </P>

        <H2 id="changes">14. Changes to this policy</H2>
        <P>
          We may update this Privacy Policy from time to time. We will post the revised version and update the effective
          date. If changes are material, we will provide additional notice as required by law (for example, by email or
          in-app message).
        </P>

        <H2 id="disclaimers">15. Limitations</H2>
        <P>
          To the fullest extent permitted by law, this Policy does not create rights enforceable by third parties. Nothing
          in this Policy limits any non-waivable rights you may have under applicable law.
        </P>

        <section className="mt-12 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Legal review</p>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Replace the bracketed operator name and contact fields at the top of this file, align subprocessors with your
            actual vendors and DPAs, and have qualified counsel review this policy for your jurisdictions, payment flows,
            and any advertising or analytics tools you add before relying on it at scale.
          </p>
        </section>

        <LegalPageFooterNav role={role} />
      </div>
    </main>
  );
}
