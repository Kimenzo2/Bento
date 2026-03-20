import type React from 'react';
import LegalLayout, { P, Sub, DashList, B } from '../../components/legal/LegalLayout';
import type { LegalSection } from '../../components/legal/LegalLayout';
import { usePageSEO } from '../../hooks/usePageSEO';

const EFFECTIVE_DATE = 'March 12, 2026';

const sections: LegalSection[] = [
  {
    id: 'introduction',
    number: 1,
    title: 'Introduction and Scope',
    content: (
      <>
        <P>
          This Privacy Policy explains how <B>Genesis</B> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) collects, uses, stores, and protects your information when you use our AI visual storytelling platform at <B>iamazeyou.me</B> and all associated services, applications, and tools.
        </P>
        <P>
          Genesis is an AI-powered platform that enables creators to build illustrated storybooks, design persistent characters, and publish visual narratives across three creative realms. This policy covers every interaction you have with the platform, whether you are browsing as a visitor, using a free Spark account, or subscribed to a paid plan.
        </P>
        <P>
          By accessing or using Genesis, you acknowledge that you have read and understood this Privacy Policy and agree to the collection and use of your information as described. If you do not agree, you should not use the platform.
        </P>
        <P>
          This policy is governed by the laws of the jurisdiction in which Genesis operates. We encourage you to read this document carefully and contact us at <a href="mailto:privacy@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>privacy@iamazeyou.me</a> if you have any questions.
        </P>
      </>
    ),
  },
  {
    id: 'information-we-collect',
    number: 2,
    title: 'Information We Collect',
    content: (
      <>
        <Sub>Information You Provide Directly</Sub>
        <P>
          When you create an account, interact with the platform, or contact us, you provide information directly. This includes:
        </P>
        <DashList items={[
          <><B>Account registration data</B>: your email address, chosen display name, and password (stored in hashed form only)</>,
          <><B>Content you create</B>: stories, characters, prompts, art style preferences, visual settings, and narrative text</>,
          <><B>Payment information</B>: billing details provided during subscription. Genesis does not store raw credit card numbers. Payment is processed securely by our payment provider, Dodo Payments, under their own terms</>,
          <><B>Profile information</B>: avatar, bio, and any optional details you add to your profile</>,
          <><B>Communications</B>: messages you send to our support team, feedback you submit, and any correspondence with us</>,
        ]} />

        <Sub>Information Collected Automatically</Sub>
        <P>
          When you use Genesis, certain information is collected automatically to operate and improve the service:
        </P>
        <DashList items={[
          <><B>Usage data</B>: which realms you access (The Cosmos, The Kingdom, The Cell), how often you create, session duration, features you use, and your interaction patterns with Gen</>,
          <><B>Technical data</B>: browser type and version, device type, operating system, IP address, referring URL, and screen resolution</>,
          <><B>Cookies and local storage</B>: session management tokens, authentication state, theme preferences, and realm selections stored in your browser</>,
          <><B>Performance data</B>: page load times, error logs, and rendering performance metrics used to maintain service quality</>,
        ]} />

        <Sub>Information From Third Parties</Sub>
        <DashList items={[
          <><B>Authentication providers</B>: if you sign in through a third-party provider, we receive your email address and basic profile information as permitted by that provider</>,
          <><B>Payment processor</B>: Dodo Payments provides us with transaction status, subscription state, and billing cycle information. We do not receive your full card details</>,
          <><B>AI model providers</B>: when you create content, prompts are processed by third-party AI providers. These providers may process data under their own privacy policies. We describe this further in Section 5</>,
        ]} />
      </>
    ),
  },
  {
    id: 'how-we-use',
    number: 3,
    title: 'How We Use Your Information',
    content: (
      <>
        <Sub>To Provide the Service</Sub>
        <P>
          We use your information to create and maintain your account, process your creations through AI models, deliver exported content such as PDFs and ebooks, and provide Gen&rsquo;s creative guidance across the platform&rsquo;s three realms.
        </P>

        <Sub>To Improve Genesis</Sub>
        <P>
          We analyse aggregated and anonymised usage patterns to understand how creators use the platform, identify technical issues before they affect you, improve AI guidance quality, and develop features that serve real creative needs.
        </P>

        <Sub>To Communicate With You</Sub>
        <P>
          We send transactional emails including account confirmation, creation-complete notifications, and billing receipts. If you opt in, we may send product updates and feature announcements. We respond to support requests you initiate.
        </P>

        <Sub>To Process Payments</Sub>
        <P>
          We use billing information to manage your subscription, process monthly or annual charges, handle upgrades and downgrades between tiers, and process refunds when applicable.
        </P>

        <Sub>To Ensure Safety</Sub>
        <P>
          We use information to detect and prevent abuse of the platform, enforce our content standards, protect the integrity of the service, and safeguard minors who use Genesis.
        </P>
      </>
    ),
  },
  {
    id: 'content-you-create',
    number: 4,
    title: 'Content You Create',
    content: (
      <>
        <P>
          <B>You own what you create.</B> Stories, characters, visual content, and narrative text you produce on Genesis belong to you. Genesis does not claim ownership of your user-generated content.
        </P>
        <P>
          To deliver the service, you grant Genesis a limited, non-exclusive, royalty-free licence to process, store, display, and transmit your content. This licence exists solely for the purpose of operating the platform and expires when you delete your content or close your account.
        </P>
        <P>
          <B>We do not use your created content to train AI models without your explicit consent.</B> Your stories and characters are yours. They are processed by AI providers to generate the outputs you request, but they are not fed back into training datasets.
        </P>
        <P>
          Content created on the Spark (free) tier is licensed for personal use only. The full commercial licence, which permits selling, publishing, and monetising your creations, applies to the Creator tier and above. Refer to our Terms of Use for full details on content licensing.
        </P>
      </>
    ),
  },
  {
    id: 'ai-processing',
    number: 5,
    title: 'AI and Third-Party Model Processing',
    content: (
      <>
        <P>
          Genesis uses third-party AI model providers to power its creative engine. When you create content, your prompts and relevant story context are sent to these providers to generate illustrations, refine narratives, and deliver Gen&rsquo;s guidance.
        </P>
        <P>
          Our current AI providers include <B>Google Gemini</B> for text generation and guidance, and image generation APIs for visual content. These providers process your prompts under their own privacy policies and data handling practices.
        </P>
        <P>
          We take steps to minimise the personal information included in AI requests. However, because you control what you write in your prompts and stories, we strongly recommend that you <B>do not include sensitive personal information</B> — such as real addresses, financial details, or medical information — in your creative prompts.
        </P>
        <P>
          We review our AI provider relationships regularly and will update this policy if we add or change providers in a way that materially affects how your data is processed.
        </P>
      </>
    ),
  },
  {
    id: 'data-sharing',
    number: 6,
    title: 'Data Sharing and Disclosure',
    content: (
      <>
        <P>
          <B>Genesis does not sell your personal data. Period.</B> We have never sold user data and have no plans or business model that involves selling it.
        </P>
        <P>
          We share data only in the following limited circumstances:
        </P>
        <DashList items={[
          <><B>Service providers</B>: we share data with providers that help us operate Genesis, including hosting infrastructure, payment processing (Dodo Payments), email delivery services, and AI model providers. These providers operate under data processing agreements that restrict how they may use your information</>,
          <><B>Legal requirements</B>: we may disclose information if required by law, court order, subpoena, or government request, or if we believe in good faith that disclosure is necessary to protect the rights, safety, or property of Genesis, our users, or the public</>,
          <><B>Business transfers</B>: in the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity. We will provide notice to affected users before any such transfer and give you the opportunity to delete your account beforehand</>,
        ]} />
      </>
    ),
  },
  {
    id: 'data-retention',
    number: 7,
    title: 'Data Retention',
    content: (
      <>
        <P>
          We retain your information for as long as necessary to provide the service, comply with legal obligations, and resolve disputes. Specific retention periods:
        </P>
        <DashList items={[
          <><B>Account data</B>: retained while your account is active, plus 90 days after deletion to allow for recovery if requested</>,
          <><B>Created content</B>: retained per your account status. When you delete content, it is removed from active systems within 30 days. Backup copies are purged within 90 days</>,
          <><B>Anonymised usage analytics</B>: retained for up to 24 months for product improvement purposes. This data cannot be linked back to individual users</>,
          <><B>Payment records</B>: retained as required by applicable financial regulations, typically 7 years</>,
        ]} />
        <P>
          To request deletion of your data, contact us at <a href="mailto:privacy@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>privacy@iamazeyou.me</a> or use the account deletion option in your settings.
        </P>
      </>
    ),
  },
  {
    id: 'childrens-privacy',
    number: 8,
    title: "Children's Privacy",
    content: (
      <>
        <P>
          Genesis is used by creators of all ages, including younger users who create illustrated stories for educational purposes. We take the privacy and safety of minors seriously.
        </P>
        <P>
          Genesis does not knowingly collect personal information from children under 13 without verifiable parental consent. If you are under 13, you may only use Genesis with the involvement and consent of a parent or legal guardian.
        </P>
        <P>
          <B>Gen</B>, our AI creative companion, is designed with child safety as a primary consideration. Gen operates under strict content guidelines that prevent the generation of age-inappropriate material, and its safety constitution is enforced at every interaction.
        </P>
        <P>
          If you are a parent or guardian and believe your child has provided personal information to Genesis without your consent, please contact us immediately at <a href="mailto:privacy@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>privacy@iamazeyou.me</a>. We will take prompt steps to delete such information. Parents and guardians may also request deletion of a minor&rsquo;s account and all associated data at any time.
        </P>
      </>
    ),
  },
  {
    id: 'your-rights',
    number: 9,
    title: 'Your Rights and Choices',
    content: (
      <>
        <P>
          Depending on your jurisdiction, you may have some or all of the following rights regarding your personal data:
        </P>
        <DashList items={[
          <><B>Access</B>: request a copy of the personal data we hold about you</>,
          <><B>Correction</B>: request that we correct inaccurate or incomplete data</>,
          <><B>Deletion</B>: request that we delete your account and associated personal data</>,
          <><B>Export</B>: export your created content in standard formats before closing your account</>,
          <><B>Opt out</B>: unsubscribe from non-essential communications at any time via email preferences or account settings</>,
          <><B>Object</B>: object to certain types of processing where we rely on legitimate interests as the legal basis</>,
        ]} />
        <P>
          To exercise any of these rights, use the relevant options in your account settings or contact us at <a href="mailto:privacy@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>privacy@iamazeyou.me</a>. We will respond to verified requests within 30 days.
        </P>
      </>
    ),
  },
  {
    id: 'cookies',
    number: 10,
    title: 'Cookies and Tracking',
    content: (
      <>
        <P>
          Genesis uses a limited set of cookies and browser storage to operate the platform. Here is what we use and why:
        </P>
        <DashList items={[
          <><B>Essential cookies</B>: session management and authentication tokens that keep you logged in. These cannot be disabled without breaking the service</>,
          <><B>Preference storage</B>: your selected theme, realm preference, and display settings stored in local storage. You can clear these through your browser settings</>,
          <><B>Analytics</B>: if used, we collect anonymised usage metrics to understand how the platform is used. You may opt out through your account settings</>,
        ]} />
        <P>
          Genesis does not use advertising cookies, third-party tracking pixels, or cross-site trackers. We do not participate in ad networks or sell data to advertisers.
        </P>
      </>
    ),
  },
  {
    id: 'security',
    number: 11,
    title: 'Security',
    content: (
      <>
        <P>
          We implement technical and organisational measures to protect your data:
        </P>
        <DashList items={[
          <><B>Encryption in transit</B>: all data transmitted between your browser and our servers is encrypted using TLS</>,
          <><B>Encryption at rest</B>: sensitive data is encrypted in our database infrastructure</>,
          <><B>Access controls</B>: role-based access restrictions, with staff access limited to what is necessary for their function</>,
          <><B>Infrastructure</B>: hosted on industry-standard cloud platforms with regular security assessments</>,
        ]} />
        <P>
          No system is perfectly secure. In the event of a data breach that affects your personal information, we will notify affected users and relevant authorities within the timeframes required by applicable law.
        </P>
      </>
    ),
  },
  {
    id: 'changes',
    number: 12,
    title: 'Changes to This Policy',
    content: (
      <>
        <P>
          We may update this Privacy Policy to reflect changes in our practices, legal requirements, or the platform itself. When we make material changes, we will notify you by email and via an in-app notice at least 14 days before the changes take effect.
        </P>
        <P>
          Continued use of Genesis after the effective date of a revised policy constitutes your acceptance of the changes. If you do not agree with the revised policy, you may close your account before the changes take effect.
        </P>
        <P>
          Previous versions of this policy are available upon request by emailing <a href="mailto:legal@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>legal@iamazeyou.me</a>.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    number: 13,
    title: 'Contact and Questions',
    content: (
      <>
        <P>
          If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, contact us:
        </P>
        <DashList items={[
          <><B>Privacy inquiries</B>: <a href="mailto:privacy@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>privacy@iamazeyou.me</a></>,
          <><B>General legal questions</B>: <a href="mailto:legal@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>legal@iamazeyou.me</a></>,
          <><B>Support</B>: <a href="mailto:support@iamazeyou.me" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }}>support@iamazeyou.me</a></>,
        ]} />
        <P>
          We are committed to resolving privacy concerns promptly and will respond to all verified requests within 30 days.
        </P>
      </>
    ),
  },
];

const PrivacyPage: React.FC = () => {
  usePageSEO({
    title: 'Privacy Policy — Genesis',
    description: 'How Genesis collects, uses, and protects your information when you use our AI visual storytelling platform.',
    canonical: '/legal/privacy',
  });

  return (
    <LegalLayout
      title="Privacy Policy"
      description="How Genesis collects, uses, and protects your information when you use our AI visual storytelling platform."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
};

export default PrivacyPage;
