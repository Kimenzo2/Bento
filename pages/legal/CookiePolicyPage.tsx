import type React from 'react';
import LegalLayout, { P, Sub, DashList, B } from '../../components/legal/LegalLayout';
import type { LegalSection } from '../../components/legal/LegalLayout';
import { usePageSEO } from '../../hooks/usePageSEO';

const EFFECTIVE_DATE = 'March 13, 2026';

const sections: LegalSection[] = [
  {
    id: 'section-1-what-are-cookies',
    number: 1,
    title: 'What Are Cookies',
    content: (
      <>
        <P>
          Cookies are small text files that a website places on your device when you visit. They are widely used to make websites work correctly, work more efficiently, and to provide information to the site owner.
        </P>
        <P>
          Cookies are not programmes and cannot carry viruses or malware. They cannot access other files on your device. They contain only the information placed in them &mdash; typically a small identifier or preference value.
        </P>
        <P>
          <B>Genesis</B> uses cookies and similar technologies &mdash; including browser local storage and session storage &mdash; to make the platform function, to remember your preferences, and to understand how creators interact with the product so we can improve it.
        </P>
      </>
    ),
  },
  {
    id: 'section-2-how-genesis-uses-cookies',
    number: 2,
    title: 'How Genesis Uses Cookies',
    content: (
      <>
        <P>
          Genesis uses cookies for three purposes.
        </P>

        <Sub>Keeping You Signed In</Sub>
        <P>
          When you sign into Genesis your authentication session is maintained through a secure cookie set by Supabase, our authentication infrastructure provider. Without this cookie you would be signed out every time you close your browser. This cookie does not contain your password or any sensitive personal information &mdash; it contains only a secure session token that allows Genesis to verify your identity on subsequent requests.
        </P>

        <Sub>Remembering Your Preferences</Sub>
        <P>
          Genesis stores your theme selection, language preference, and notification settings in browser local storage. These are not transmitted to external servers &mdash; they live only on your device and are read by the Genesis application when it loads so your experience is consistent each time you return.
        </P>

        <Sub>Understanding Product Usage</Sub>
        <P>
          Genesis uses anonymous usage data to understand which features creators use most, where they encounter difficulty, and how the platform can be improved. This data does not identify you personally. It is aggregated across all users and used only for product improvement decisions.
        </P>
      </>
    ),
  },
  {
    id: 'section-3-types-of-cookies',
    number: 3,
    title: 'Types of Cookies We Use',
    content: (
      <>
        <P>
          Genesis cookies fall into three categories.
        </P>

        <Sub>Essential Cookies</Sub>
        <P>
          These are necessary for the platform to function. They cannot be disabled without breaking the Genesis experience.
        </P>
        <DashList items={[
          <><B>Authentication session cookie</B> (set by Supabase) &mdash; maintains your signed-in state securely across browser sessions</>,
          <><B>CSRF protection token</B> &mdash; protects your account from cross-site request forgery attacks</>,
          <><B>Load balancing cookie</B> &mdash; ensures your requests are handled consistently during your session</>,
        ]} />

        <Sub>Preference Cookies</Sub>
        <P>
          These remember choices you have made so you do not have to set them again each visit.
        </P>
        <DashList items={[
          <><B>Theme preference</B> &mdash; remembers your selected colour theme</>,
          <><B>Realm preference</B> &mdash; remembers your most recently used creative realm</>,
          <><B>Editor view preference</B> &mdash; remembers whether you prefer Pages or Canvas view in the editor</>,
        ]} />
        <P>
          Preference cookies can be cleared by resetting your browser storage. Your preferences will return to their defaults and can be set again within the platform.
        </P>

        <Sub>Analytics Cookies</Sub>
        <P>
          Genesis uses anonymised analytics to understand product usage patterns. These do not track you personally and do not build a profile of your browsing behaviour outside Genesis.
        </P>
        <DashList items={[
          <><B>Session analytics</B> &mdash; records which features are used during a session without identifying the specific user</>,
          <><B>Performance monitoring</B> &mdash; records page load times and error rates to help identify and fix technical problems</>,
        ]} />
        <P>
          Genesis does not use advertising cookies, retargeting cookies, or any technology that tracks your behaviour across other websites.
        </P>
      </>
    ),
  },
  {
    id: 'section-4-third-party-cookies',
    number: 4,
    title: 'Third-Party Cookies',
    content: (
      <>
        <P>
          Some features of Genesis involve third-party services that may set their own cookies. Genesis has no control over these cookies and they are governed by the privacy policies of those third parties.
        </P>

        <Sub>Supabase</Sub>
        <P>
          Supabase provides Genesis&rsquo;s authentication and database infrastructure. Supabase may set cookies related to session management and security. These are essential for the platform to function. Supabase&rsquo;s privacy practices are described at <a href="https://supabase.com/privacy" className="text-coral-burst hover:underline" style={{ fontWeight: 500 }} target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>.
        </P>

        <Sub>Payment Processing</Sub>
        <P>
          When you visit the pricing page or complete a subscription transaction, <B>Dodo Payments</B> processes your payment. Payment pages may set cookies related to fraud prevention and transaction security. Genesis does not have access to your payment card information &mdash; all payment data is handled directly by Dodo Payments under their privacy policy.
        </P>

        <Sub>AI Model Providers</Sub>
        <P>
          Genesis uses third-party AI model providers to power story generation and image creation. These providers process the content of your creative prompts to deliver the service. They do not set cookies in your browser through the Genesis interface &mdash; their processing happens server-side. Their data practices are governed by their own privacy policies.
        </P>
        <P>
          Genesis does not embed social media buttons, advertising networks, or third-party tracking pixels anywhere on the platform.
        </P>
      </>
    ),
  },
  {
    id: 'section-5-cookie-duration',
    number: 5,
    title: 'Cookie Duration',
    content: (
      <>
        <Sub>Session Cookies</Sub>
        <P>
          Session cookies exist only for the duration of your browser session. They are deleted automatically when you close your browser. Genesis uses session cookies for temporary state management during active use of the platform.
        </P>

        <Sub>Persistent Cookies</Sub>
        <P>
          Persistent cookies remain on your device after your browser session ends, up to a defined expiry date. Genesis uses persistent cookies for authentication &mdash; so you remain signed in between visits &mdash; and for preference storage. Authentication cookies issued by Supabase expire after 30 days of inactivity. Preference values stored in local storage do not have a defined expiry &mdash; they persist until you clear your browser storage.
        </P>
      </>
    ),
  },
  {
    id: 'section-6-your-cookie-choices',
    number: 6,
    title: 'Your Cookie Choices',
    content: (
      <>
        <P>
          You have several options for controlling cookies. Be aware that disabling certain cookies will affect how Genesis functions.
        </P>

        <Sub>Browser Settings</Sub>
        <P>
          All modern browsers allow you to view, manage, and delete cookies through their settings. You can configure your browser to block all cookies, block third-party cookies only, or notify you before a cookie is set.
        </P>
        <P>
          Blocking essential cookies will prevent you from signing in to Genesis. Blocking preference cookies means your theme and realm preferences will not be saved between sessions.
        </P>

        <Sub>Clearing Local Storage</Sub>
        <P>
          Your theme and preference settings are stored in browser local storage. To clear these, open your browser&rsquo;s developer tools, navigate to Application and then Local Storage, and clear the entries for <B>iamazeyou.me</B>. Your preferences will reset to their defaults and can be set again within the platform.
        </P>

        <Sub>Account Deletion</Sub>
        <P>
          Deleting your Genesis account removes your personal data from our servers. It does not automatically clear cookies or local storage from your browser &mdash; you can clear these manually using the methods described above.
        </P>
        <P>
          Genesis does not currently display a cookie consent banner for users in all jurisdictions. If you are located in a region where cookie consent is required by law and you have concerns about our practices, please contact us using the details below.
        </P>
      </>
    ),
  },
  {
    id: 'section-7-do-not-track',
    number: 7,
    title: 'Do Not Track',
    content: (
      <>
        <P>
          Some browsers include a Do Not Track setting that sends a signal to websites requesting that your browsing not be tracked.
        </P>
        <P>
          Genesis does not use cross-site tracking technologies, so the Do Not Track signal does not change how the platform operates for you. Genesis does not share your data with advertising networks or data brokers regardless of your Do Not Track setting.
        </P>
      </>
    ),
  },
  {
    id: 'section-8-changes',
    number: 8,
    title: 'Changes to This Policy',
    content: (
      <>
        <P>
          Genesis may update this Cookie Policy from time to time as the platform evolves and as the technologies we use change. Material changes will be communicated via email and through an in-app notice before taking effect.
        </P>
        <P>
          The date at the top of this page indicates when this policy was last updated. Continued use of Genesis after a policy update constitutes acceptance of the revised terms. Previous versions are available on request.
        </P>
      </>
    ),
  },
  {
    id: 'section-9-contact',
    number: 9,
    title: 'Contact and Questions',
    content: (
      <P>
        If you have questions about how Genesis uses cookies, or if you wish to exercise any rights related to your data, please reach out using the contact details below.
      </P>
    ),
  },
];

const CookiePolicyPage: React.FC = () => {
  usePageSEO({
    title: 'Cookie Policy — Genesis',
    description: 'How Genesis uses cookies and similar technologies to keep you signed in, remember your preferences, and understand how creators use the platform.',
    canonical: '/legal/cookies',
  });

  return (
    <LegalLayout
      title="Cookie Policy"
      description="How Genesis uses cookies and similar technologies to make the platform work, remember your preferences, and understand how creators use the product."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
    />
  );
};

export default CookiePolicyPage;
