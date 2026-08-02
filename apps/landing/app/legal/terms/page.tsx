// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { Metadata } from 'next';
import LegalLayout, { P, Sub, DashList, B } from '../../../components/legal/LegalLayout';
import type { LegalSection } from '../../../components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service — Bento',
  description:
    'The terms and conditions that govern your use of Bento, our calm desktop productivity app with seventeen built-in mini-apps.',
};

const EFFECTIVE_DATE = 'March 12, 2026';

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    number: 1,
    title: 'Acceptance of Terms',
    content: (
      <>
        <P>
          By downloading, installing, or using <B>Bento</B> (the &ldquo;App&rdquo;), you agree to be
          bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms,
          do not install or use the App.
        </P>
        <P>
          Bento is operated by the team at{' '}
          <a href="https://iamazeyou.me" className="legal-link">
            iamazeyou.me
          </a>
          . Throughout these Terms, &ldquo;we,&rdquo; &ldquo;our,&rdquo; and &ldquo;us&rdquo; refer
          to the Bento team, and &ldquo;you&rdquo; refers to the individual or entity using the App.
        </P>
        <P>
          These Terms form a legally binding agreement between you and Bento. By using the App, you
          represent that you are at least the age of majority in your jurisdiction or have obtained
          parental or guardian consent to use the App.
        </P>
        <P>
          We reserve the right to update these Terms from time to time. Material changes will be
          communicated via email and in-app notice with at least 14 days&rsquo; notice. Your
          continued use of the App after the effective date of revised Terms constitutes acceptance.
        </P>
      </>
    ),
  },
  {
    id: 'description',
    number: 2,
    title: 'Description of Service',
    content: (
      <>
        <P>
          Bento is a desktop application designed to help you organise your life across seventeen
          built-in mini-apps: dashboard, notes, journal, tasks, voice memos, focus timer, habits,
          mood tracker, goals, clipboard, sleep tracker, health tracker, nutrition log, budget
          planner, password vault, countdown timer, and settings. The App is available for Windows,
          macOS, and Linux.
        </P>
        <P>
          Bento operates on a local-first architecture. Your data resides on your computer by
          default. Cloud sync (coming soon) will be an optional feature that, when enabled, backs up
          your data to our secure servers so it can be restored or accessed across devices.
        </P>
        <P>
          The App is offered in a free plan and three paid subscription tiers (Core, Pro, and Power)
          with additional capabilities, extended limits, and priority support. All features are
          subject to these Terms.
        </P>
      </>
    ),
  },
  {
    id: 'eligibility',
    number: 3,
    title: 'Eligibility and Registration',
    content: (
      <>
        <P>
          You must be at least 13 years of age to use Bento. If you are under 18, you must have a
          parent or legal guardian review and accept these Terms on your behalf.
        </P>
        <P>
          When you create an account, you agree to provide accurate, complete, and current
          information. You are solely responsible for maintaining the confidentiality of your
          password and for all activities that occur under your account.
        </P>
        <P>
          You must notify us immediately at{' '}
          <a href="mailto:support@iamazeyou.me" className="legal-link">
            support@iamazeyou.me
          </a>{' '}
          if you suspect any unauthorised use of your account or any breach of security. We are not
          liable for any loss or damage arising from your failure to protect your login credentials.
        </P>
      </>
    ),
  },
  {
    id: 'plans-and-payments',
    number: 4,
    title: 'Plans, Billing, and Payments',
    content: (
      <>
        <Sub>Free vs. Paid Plans</Sub>
        <P>
          Bento offers a free plan with core functionality and paid plans (Core, Pro, and Power)
          with expanded features. The specific features of each plan are described on our pricing
          page at{' '}
          <a href="https://iamazeyou.me/pricing" className="legal-link">
            iamazeyou.me/pricing
          </a>
          .
        </P>

        <Sub>Subscription Billing</Sub>
        <P>
          Paid subscriptions are billed monthly or annually, as selected during checkout. Payments
          are processed securely by Paystack. Your subscription will auto-renew at the end of each
          billing cycle unless cancelled before the renewal date.
        </P>

        <Sub>Cancellation and Refunds</Sub>
        <P>
          You may cancel your paid subscription at any time from your account settings. Upon
          cancellation, your paid plan access will continue until the end of the current billing
          period. No prorated refunds are provided for partial billing periods unless required by
          applicable consumer law.
        </P>
        <P>
          If you experience a technical issue that prevents you from using the App as described, we
          will work with you to resolve it. If we cannot resolve it within a reasonable timeframe, a
          refund for the current billing period may be issued at our discretion.
        </P>

        <Sub>Price Changes</Sub>
        <P>
          We reserve the right to adjust pricing for paid plans with 30 days&rsquo; notice via
          email. Price changes will not affect your current billing period and will apply from the
          next renewal date onward.
        </P>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    number: 5,
    title: 'Acceptable Use',
    content: (
      <>
        <P>You agree to use Bento only for lawful purposes and in accordance with these Terms.</P>
        <P>Specifically, you agree not to:</P>
        <DashList
          items={[
            'Use the App for any illegal purpose or in violation of any applicable local, national, or international law',
            'Attempt to reverse-engineer, decompile, disassemble, or derive the source code of the App',
            'Circumvent or bypass any security features, authentication measures, or payment mechanisms',
            'Upload or transmit viruses, malware, or any malicious code through the App',
            'Use the App to store or share content that is abusive, harassing, defamatory, or infringes on the rights of others',
            'Interfere with the operation of the App or our infrastructure, including through denial-of-service attacks or excessive automated requests',
            'Use the AI chat feature to generate harmful, abusive, or misleading content, or to impersonate individuals or organisations',
            'Create multiple accounts for the purpose of circumventing trial limits or subscription requirements',
            <>
              Attempt to access another user&rsquo;s account or data without their explicit
              permission
            </>,
          ]}
        />
        <P>
          Violation of these rules may result in immediate suspension or termination of your access
          to Bento without notice. We reserve the right to remove any content that violates these
          Terms.
        </P>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    number: 6,
    title: 'Intellectual Property Rights',
    content: (
      <>
        <Sub>Our IP</Sub>
        <P>
          The Bento name, logo, visual identity, source code, design, and all related intellectual
          property are owned by Bento and its licensors. These are protected by copyright,
          trademark, and other intellectual property laws. You may not copy, modify, distribute,
          sell, or lease any part of the App without our prior written consent.
        </P>

        <Sub>Your IP</Sub>
        <P>
          You retain full ownership of the data, content, and information you create and store in
          Bento. We claim no ownership over your personal content. By using the App, you grant us a
          limited licence to process, store, and transmit your content solely to provide the service
          to you.
        </P>
        <P>
          If you provide feedback or suggestions for improving Bento, we may use that feedback
          without obligation or compensation to you.
        </P>
      </>
    ),
  },
  {
    id: 'data-and-privacy',
    number: 7,
    title: 'Data, Privacy, and Security',
    content: (
      <>
        <P>
          Your privacy matters to us. Our{' '}
          <a href="/legal/privacy" className="legal-link">
            Privacy Policy
          </a>{' '}
          explains how we collect, use, and safeguard your personal information. By using Bento, you
          consent to the practices described in the Privacy Policy.
        </P>
        <P>
          Bento is designed with a local-first architecture. Your data resides on your computer by
          default. Cloud sync is optional and encrypted. We implement reasonable technical measures
          to protect your data, but no system is guaranteed impenetrable.
        </P>
        <P>
          You are responsible for maintaining backups of your important data. While we provide cloud
          sync as a convenience, it should not be your sole backup strategy.
        </P>
      </>
    ),
  },
  {
    id: 'third-party',
    number: 8,
    title: 'Third-Party Services',
    content: (
      <>
        <P>Bento integrates with certain third-party services to deliver its features:</P>
        <DashList
          items={[
            <>
              <B>Paystack</B>: payment processing for Pro subscriptions. Your payment details are
              handled by Paystack under their own terms and privacy policy
            </>,
            <>
              <B>AI model providers</B>: the AI chat feature routes prompts through third-party AI
              providers. These providers process data under their own policies. We recommend you do
              not share sensitive personal information in AI chat
            </>,
            <>
              <B>Email delivery</B>: transactional emails are sent through third-party email
              services that comply with applicable data protection laws
            </>,
          ]}
        />
        <P>
          We are not responsible for the practices of third-party services. Your interactions with
          these services are governed by their respective terms.
        </P>
      </>
    ),
  },
  {
    id: 'termination',
    number: 9,
    title: 'Termination',
    content: (
      <>
        <P>
          You may terminate your account at any time from your account settings. Upon termination,
          your access to the App will be revoked, and your data will be scheduled for deletion per
          our Privacy Policy.
        </P>
        <P>
          We may suspend or terminate your access to Bento at our discretion, without prior notice,
          if you violate these Terms or if your use of the App poses a risk to our infrastructure or
          other users.
        </P>
        <P>
          Upon termination by either party, Sections 6 (Intellectual Property), 7 (Data and
          Privacy), 10 (Disclaimers), 11 (Limitation of Liability), and 12 (Governing Law) shall
          survive.
        </P>
      </>
    ),
  },
  {
    id: 'disclaimers',
    number: 10,
    title: 'Disclaimers',
    content: (
      <>
        <P>
          Bento is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of
          any kind, express or implied. To the fullest extent permitted by law, we disclaim all
          warranties, including but not limited to merchantability, fitness for a particular
          purpose, non-infringement, and uninterrupted or error-free operation.
        </P>
        <P>
          Bento is a productivity tool and should not be relied upon as a medical, financial, or
          legal advisory tool. The mood tracker, sleep tracker, nutrition log, and budget features
          are for personal reference only and do not constitute professional advice.
        </P>
        <P>
          We do not guarantee that the App will be available at all times or that it will be free
          from bugs, errors, or security vulnerabilities. We may perform maintenance, updates, or
          modifications that temporarily affect availability.
        </P>
      </>
    ),
  },
  {
    id: 'limitation-liability',
    number: 11,
    title: 'Limitation of Liability',
    content: (
      <>
        <P>
          To the maximum extent permitted by applicable law, Bento and its team shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages, including lost
          profits, lost data, or business interruption, arising from your use of or inability to use
          the App.
        </P>
        <P>
          Our total liability to you for any claim arising from these Terms or your use of the App
          shall not exceed the amount you have paid to us for the Pro subscription in the 12 months
          preceding the claim, or if you are a free user, one hundred dollars ($100).
        </P>
        <P>
          Some jurisdictions do not allow limitations of liability for certain types of damages, so
          some of the above limitations may not apply to you.
        </P>
      </>
    ),
  },
  {
    id: 'governing-law',
    number: 12,
    title: 'Governing Law and Dispute Resolution',
    content: (
      <>
        <P>
          These Terms shall be governed by and construed in accordance with the laws of Nigeria,
          without regard to its conflict of law provisions.
        </P>
        <P>
          We encourage you to contact us directly at{' '}
          <a href="mailto:legal@iamazeyou.me" className="legal-link">
            legal@iamazeyou.me
          </a>{' '}
          to resolve any dispute before initiating formal proceedings. Most disputes can be resolved
          informally this way.
        </P>
        <P>
          If informal resolution is not possible, any dispute arising from these Terms shall be
          resolved exclusively in the courts of Nigeria. You consent to the personal jurisdiction of
          those courts.
        </P>
        <P>
          Any legal action arising from these Terms must be commenced within one year after the
          claim arises, or such claim is permanently barred.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    number: 13,
    title: 'Contact Information',
    content: (
      <>
        <P>
          For questions about these Terms, to report a violation, or to communicate with us about
          your account, reach out through any of the following channels:
        </P>
        <DashList
          items={[
            <>
              <B>Support</B>:{' '}
              <a href="mailto:support@iamazeyou.me" className="legal-link">
                support@iamazeyou.me
              </a>
            </>,
            <>
              <B>Legal inquiries</B>:{' '}
              <a href="mailto:legal@iamazeyou.me" className="legal-link">
                legal@iamazeyou.me
              </a>
            </>,
            <>
              <B>Privacy concerns</B>:{' '}
              <a href="mailto:privacy@iamazeyou.me" className="legal-link">
                privacy@iamazeyou.me
              </a>
            </>,
          ]}
        />
        <P>
          We aim to respond to all inquiries within 48 hours during business days. For urgent
          matters regarding account security or data breaches, please mark your message as urgent
          and we will prioritise it.
        </P>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="The terms and conditions that govern your use of Bento, our calm desktop productivity app with seventeen built-in mini-apps."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
      currentPage="terms"
    />
  );
}
