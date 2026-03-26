import type React from 'react';
import { useTranslation } from 'react-i18next';
import LegalLayout, { P, Sub, DashList, B } from '../../components/legal/LegalLayout';
import type { LegalSection } from '../../components/legal/LegalLayout';
import { usePageSEO } from '../../hooks/usePageSEO';

const EFFECTIVE_DATE = 'March 12, 2026';

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    number: 1,
    title: 'Acceptance of Terms',
    content: (
      <>
        <P>
          By accessing or using Genesis, you agree to be bound by these Terms of Use. These Terms constitute a legally binding agreement between you and <B>Genesis</B>. If you do not agree to these Terms, you may not access or use the platform.
        </P>
        <P>
          If you are using Genesis on behalf of an organisation, you represent and warrant that you have the authority to bind that organisation to these Terms.
        </P>
        <P>
          Users under the age of 18 must have the consent of a parent or legal guardian to use Genesis. Users under the age of 13 may only use Genesis with verifiable parental consent as described in our Privacy Policy.
        </P>
      </>
    ),
  },
  {
    id: 'service',
    number: 2,
    title: 'The Genesis Service',
    content: (
      <>
        <P>
          Genesis is an AI-powered visual storytelling platform. It provides creators with tools to build illustrated storybooks, design persistent characters, and publish visual narratives. The platform includes:
        </P>
        <DashList items={[
          <><B>Three creative realms</B>: The Cosmos (science fiction and space), The Kingdom (fantasy and adventure), and The Cell (biology and microscopic worlds)</>,
          <><B>Gen</B>: an AI creative companion that provides guidance, inspiration, and narrative support across all realms</>,
          <><B>Visual Studio</B>: tools for character design, scene composition, and illustration generation</>,
          <><B>Export and publishing</B>: PDF generation, ebook formatting, and sharing tools</>,
          <><B>Curriculum tools</B>: features for educators to create visual learning materials</>,
        ]} />
        <P>
          Genesis is provided on a subscription basis, with a free Spark tier and paid tiers as described on our pricing page. Genesis reserves the right to modify, suspend, or discontinue features with reasonable notice, except where changes are required by urgent security or legal reasons.
        </P>
      </>
    ),
  },
  {
    id: 'accounts',
    number: 3,
    title: 'Account Registration and Security',
    content: (
      <>
        <P>
          To use Genesis beyond browsing the public landing page, you must create an account. When registering, you agree to:
        </P>
        <DashList items={[
          'Provide accurate, current, and complete registration information',
          'Maintain and promptly update your registration information',
          'Maintain the security of your password and accept responsibility for all activity under your account',
          'Notify Genesis immediately of any unauthorised access to your account',
        ]} />
        <P>
          <B>One account per person.</B> Maintaining multiple free accounts to circumvent usage limits is not permitted. Sharing account credentials with other individuals is not permitted.
        </P>
        <P>
          Genesis is not liable for losses resulting from unauthorised account access where the account holder failed to maintain reasonable security practices, such as using a strong password and not sharing credentials.
        </P>
        <P>
          The minimum age to create a Genesis account is 13. Users between 13 and 18 must have parental or guardian consent where required by their jurisdiction.
        </P>
      </>
    ),
  },
  {
    id: 'billing',
    number: 4,
    title: 'Subscription Plans and Billing',
    content: (
      <>
        <P>
          Genesis offers four subscription tiers:
        </P>
        <DashList items={[
          <><B>Spark (Free)</B>: 3 ebooks per month, maximum 4 pages per book, 5 illustration styles, watermarked exports, personal use only</>,
          <><B>Creator ($19.99/month)</B>: 30 ebooks per month, up to 12 pages per book, 20+ illustration styles, no watermarks, commercial licence, priority rendering</>,
          <><B>Studio ($59.99/month)</B>: unlimited ebooks, up to 500 pages per book, all illustration styles, team collaboration features, API access, dedicated support</>,
          <><B>Empire ($199.99/month)</B>: unlimited everything, custom AI training, white-label options, API access, dedicated account manager</>,
        ]} />

        <Sub>Payment Terms</Sub>
        <P>
          Subscription fees are charged in advance on a monthly basis. Payment is processed securely through <B>Dodo Payments</B> under their terms of service. Genesis does not store your raw credit card information.
        </P>

        <Sub>Pricing Changes</Sub>
        <P>
          Pricing may change with at least 30 days written notice to active subscribers. Price increases will not apply to your current billing period.
        </P>

        <Sub>Cancellation</Sub>
        <P>
          You may cancel your subscription at any time. Upon cancellation, your access to paid features continues until the end of your current billing period. No prorated refunds are provided for partial months except where required by applicable law. A 7-day money-back guarantee is available for first-time subscribers.
        </P>

        <Sub>Failed Payments</Sub>
        <P>
          If a payment fails, Genesis will attempt to collect and notify you. Access may be suspended after reasonable notice of continued non-payment.
        </P>
      </>
    ),
  },
  {
    id: 'content-ownership',
    number: 5,
    title: 'Content You Create — Ownership and Licence',
    content: (
      <>
        <Sub>Your Ownership</Sub>
        <P>
          Content you create on Genesis — stories, characters, visual content, and narrative text — <B>belongs to you</B>. Genesis does not claim ownership of user-generated content.
        </P>

        <Sub>Your Commercial Rights</Sub>
        <P>
          <B>Creator tier and above</B>: you receive a full commercial licence. You may sell, publish, license, and monetise your creations without restriction or royalty payment to Genesis. This includes publication on Amazon KDP, Etsy, Gumroad, and use in client work.
        </P>
        <P>
          <B>Spark (free) tier</B>: content is for personal use only. Exports carry a watermark. Commercial use of content created on the Spark tier requires upgrading to a paid plan.
        </P>

        <Sub>Licence You Grant Genesis</Sub>
        <P>
          To deliver the service, you grant Genesis a limited, non-exclusive, royalty-free licence to process, store, display, and transmit your content. This licence is solely for the purpose of providing the Genesis platform and expires when you delete your content or close your account.
        </P>
        <P>
          <B>Genesis does not use your created content to train AI models without your explicit written consent.</B>
        </P>
      </>
    ),
  },
  {
    id: 'content-standards',
    number: 6,
    title: 'Content Standards and Prohibited Uses',
    content: (
      <>
        <P>
          You agree not to create, upload, or transmit content that:
        </P>
        <DashList items={[
          'Violates any applicable law or regulation',
          'Infringes the intellectual property rights of any third party',
          <><B>Contains sexual or explicit content involving minors</B> — this is an absolute prohibition enforced without exception</>,
          'Constitutes hate speech, harassment, or threats targeting any individual or group',
          'Contains graphic violence beyond what is appropriate for general audiences',
          'Includes real personal information of third parties without their consent',
          'Attempts to extract dangerous real-world information through fictional framing',
          'Impersonates living individuals in harmful or defamatory ways',
        ]} />
        <P>
          You also agree not to:
        </P>
        <DashList items={[
          'Reverse engineer, decompile, or disassemble any part of the Genesis platform',
          'Scrape, crawl, or use automated tools to access Genesis beyond the intended interface',
          'Circumvent usage limits, authentication mechanisms, or access controls',
          'Use Genesis to develop competing products or services',
          'Create multiple free accounts to circumvent tier limits',
        ]} />
        <P>
          Genesis reserves the right to remove content and suspend or terminate accounts that violate these standards, with or without prior notice depending on the severity of the violation.
        </P>
      </>
    ),
  },
  {
    id: 'gen',
    number: 7,
    title: 'Gen — The AI Companion',
    content: (
      <>
        <P>
          Gen is Genesis&rsquo;s AI creative companion, designed to guide storytelling across the platform&rsquo;s three realms. Gen provides narrative suggestions, creative inspiration, and character development guidance.
        </P>
        <P>
          <B>Gen is not a substitute for professional advice of any kind</B> — medical, legal, financial, educational, psychological, or otherwise. Gen is a creative tool, and its outputs should be treated as creative suggestions, not authoritative guidance.
        </P>
        <P>
          Gen&rsquo;s content guidelines are designed with child safety as a primary consideration. Gen operates under a strict safety constitution that prevents the generation of age-inappropriate material.
        </P>
        <P>
          Genesis does not guarantee that Gen&rsquo;s output will be error-free, factually accurate, or appropriate for every audience in every context. <B>You are responsible for reviewing all AI-generated content before publishing or sharing it.</B>
        </P>
      </>
    ),
  },
  {
    id: 'ip-rights',
    number: 8,
    title: "Intellectual Property — Genesis's Rights",
    content: (
      <>
        <P>
          The Genesis platform — including its design, source code, branding, the Genesis name and logo, Gen&rsquo;s character and likeness, the three realm concepts (The Cosmos, The Kingdom, The Cell), and all platform-originated content — is the intellectual property of Genesis.
        </P>
        <P>
          You may not reproduce, distribute, modify, or create derivative works from Genesis&rsquo;s intellectual property without written permission. This restriction does not limit your rights to your own created content — only to platform-level assets, branding, and technology.
        </P>
      </>
    ),
  },
  {
    id: 'third-party',
    number: 9,
    title: 'Third-Party Services and AI Models',
    content: (
      <>
        <P>
          Genesis integrates third-party services to deliver its functionality, including AI model providers (such as Google Gemini and image generation APIs), payment processors (Dodo Payments), cloud infrastructure providers, and email delivery services.
        </P>
        <P>
          These third-party providers operate under their own terms of service and privacy policies. Genesis is not responsible for the practices, content, availability, or data handling of third-party services. Links to third-party services or content within Genesis do not constitute endorsement.
        </P>
      </>
    ),
  },
  {
    id: 'availability',
    number: 10,
    title: 'Availability and Service Levels',
    content: (
      <>
        <P>
          Genesis is provided on an &ldquo;as available&rdquo; basis. While we strive for high uptime, Genesis does not guarantee uninterrupted, error-free access to the platform at all times.
        </P>
        <P>
          Scheduled maintenance will be communicated in advance where practicable. In the event of extended unplanned outages, Genesis will make reasonable efforts to communicate status and expected resolution through our status channels.
        </P>
        <P>
          Free tier (Spark) users do not receive service level guarantees. Paid tier users experiencing material service failures may contact support to discuss billing credits at Genesis&rsquo;s discretion.
        </P>
      </>
    ),
  },
  {
    id: 'liability',
    number: 11,
    title: 'Limitation of Liability',
    content: (
      <>
        <P>
          To the maximum extent permitted by applicable law:
        </P>
        <DashList items={[
          <><B>Total liability</B>: Genesis&rsquo;s total liability for any claim arising from your use of the platform shall not exceed the amount you paid to Genesis in the 12 months preceding the claim, or $100 USD, whichever is greater</>,
          <><B>Excluded damages</B>: Genesis is not liable for indirect, consequential, incidental, special, or punitive damages arising from your use of the platform, including but not limited to loss of profits, data, or business opportunities</>,
          <><B>AI-generated content</B>: Genesis is not liable for content generated by AI models or for decisions you make based on AI-generated content</>,
          <><B>Third-party services</B>: Genesis is not liable for the actions, omissions, or failures of third-party service providers integrated with the platform</>,
        ]} />
        <P>
          Some jurisdictions do not allow the exclusion or limitation of certain damages. In such jurisdictions, the limitations above apply to the maximum extent permitted by applicable law.
        </P>
      </>
    ),
  },
  {
    id: 'indemnification',
    number: 12,
    title: 'Indemnification',
    content: (
      <>
        <P>
          You agree to indemnify, defend, and hold harmless Genesis, its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and costs (including reasonable legal fees) arising from:
        </P>
        <DashList items={[
          'Your violation of these Terms of Use',
          'Your misuse of the Genesis platform',
          'Infringement of third-party intellectual property rights through content you create',
          'Your violation of any applicable law or regulation through your use of Genesis',
          'Any content you publish or distribute that was created using Genesis',
        ]} />
      </>
    ),
  },
  {
    id: 'disputes',
    number: 13,
    title: 'Dispute Resolution',
    content: (
      <>
        <Sub>Informal Resolution</Sub>
        <P>
          Before initiating any formal legal proceeding, you agree to contact Genesis at <a href="mailto:legal@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>legal@iamazeyou.me</a> and attempt to resolve the dispute in good faith. We will make reasonable efforts to address your concern within 30 days.
        </P>

        <Sub>Governing Law</Sub>
        <P>
          These Terms are governed by and construed in accordance with applicable law, without regard to conflict of law principles.
        </P>

        <Sub>Arbitration</Sub>
        <P>
          Disputes that cannot be resolved informally shall be submitted to binding arbitration, except for claims that qualify for small claims court. The arbitration will be conducted on an individual basis.
        </P>

        <Sub>Class Action Waiver</Sub>
        <P>
          To the extent permitted by applicable law, you waive the right to participate in class action lawsuits or class-wide arbitration against Genesis. You may only bring claims against Genesis in your individual capacity.
        </P>
      </>
    ),
  },
  {
    id: 'termination',
    number: 14,
    title: 'Termination',
    content: (
      <>
        <P>
          <B>By you</B>: you may terminate your account at any time through your account settings or by contacting support. Upon cancellation of a paid plan, your access to paid features continues until the end of your current billing period.
        </P>
        <P>
          <B>By Genesis</B>: we may terminate or suspend your account for violation of these Terms. Where practicable, we will provide notice before termination. However, severe violations — particularly those involving minors, illegal content, or platform integrity threats — may result in immediate termination without prior notice.
        </P>
        <P>
          Upon termination:
        </P>
        <DashList items={[
          'Access to paid features ceases at the end of your current billing period (paid plans) or immediately (free plan or Terms violation)',
          'You may export your created content before account closure',
          'After 90 days following account closure, your content is permanently deleted from our active systems and backups',
        ]} />
      </>
    ),
  },
  {
    id: 'changes',
    number: 15,
    title: 'Changes to These Terms',
    content: (
      <>
        <P>
          Genesis may update these Terms of Use to reflect changes in the service, legal requirements, or business practices. When we make material changes:
        </P>
        <DashList items={[
          'We will notify you by email and via an in-app notice at least 14 days before the changes take effect',
          'The updated effective date will be displayed at the top of this document',
          'Continued use of Genesis after the effective date constitutes acceptance of the revised Terms',
        ]} />
        <P>
          If you do not accept material changes to these Terms, you may terminate your account before the changes take effect. Previous versions of these Terms are available upon request.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    number: 16,
    title: 'Contact',
    content: (
      <>
        <P>
          For questions or concerns regarding these Terms of Use, contact us:
        </P>
        <DashList items={[
          <><B>Legal inquiries</B>: <a href="mailto:legal@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>legal@iamazeyou.me</a></>,
          <><B>Support</B>: <a href="mailto:support@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>support@iamazeyou.me</a></>,
        ]} />
        <P>
          We are committed to addressing your concerns and will respond to all inquiries within a reasonable timeframe.
        </P>
      </>
    ),
  },
];

const TermsPage: React.FC = () => {
  const { t } = useTranslation('legal');

  usePageSEO({
    title: t('terms.seoTitle', 'Terms of Use — Genesis'),
    description: t(
      'terms.seoDescription',
      'The rules and rights that govern your use of the Genesis platform and everything you create here.'
    ),
    canonical: '/legal/terms',
  });

  return (
    <LegalLayout
      title={t('terms.title', 'Terms of Use')}
      description={t(
        'terms.description',
        'The rules and rights that govern your use of the Genesis platform and everything you create here.'
      )}
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
};

export default TermsPage;
