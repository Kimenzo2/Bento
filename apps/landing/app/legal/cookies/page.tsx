import type { Metadata } from 'next';
import LegalLayout, { P, Sub, DashList, B } from '../../../components/legal/LegalLayout';
import type { LegalSection } from '../../../components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Cookie Policy — Bento',
  description:
    'How Bento uses cookies, local storage, and similar technologies to operate and improve our calm desktop app website.',
};

const EFFECTIVE_DATE = 'March 12, 2026';

const sections: LegalSection[] = [
  {
    id: 'introduction',
    number: 1,
    title: 'Introduction',
    content: (
      <>
        <P>
          This Cookie Policy explains how <B>Bento</B> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;us&rdquo;) uses cookies, local storage, and similar technologies when you visit our
          website at{' '}
          <a href="https://iamazeyou.me" className="legal-link">
            iamazeyou.me
          </a>{' '}
          or use our desktop application.
        </P>
        <P>
          Bento is designed with privacy in mind. We use the absolute minimum of cookies and storage
          necessary to operate the service. We do not use advertising cookies, tracking pixels, or
          cross-site trackers.
        </P>
        <P>
          This policy is part of our{' '}
          <a href="/legal/privacy" className="legal-link">
            Privacy Policy
          </a>
          . By using our website or app, you consent to the use of cookies and storage as described
          here.
        </P>
      </>
    ),
  },
  {
    id: 'what-are-cookies',
    number: 2,
    title: 'What Are Cookies and Local Storage?',
    content: (
      <>
        <P>
          <B>Cookies</B> are small text files stored on your device by your web browser. They
          contain a unique identifier and site information that allows the website to remember your
          actions and preferences over time.
        </P>
        <P>
          <B>Local storage</B> is a browser-native storage mechanism similar to cookies but with
          larger capacity. It persists until cleared by the user and is not automatically sent to
          servers with every request.
        </P>
        <P>
          Bento uses both cookies and local storage, but we choose the simplest technology for each
          purpose and store the minimum data required.
        </P>
      </>
    ),
  },
  {
    id: 'how-we-use',
    number: 3,
    title: 'How Bento Uses Cookies and Storage',
    content: (
      <>
        <P>We use cookies and local storage exclusively for essential and functional purposes:</P>

        <Sub>Essential Cookies</Sub>
        <P>
          These are necessary for the website and app to function. They cannot be switched off in
          our systems. They are usually set only in response to actions you take, such as logging
          in, filling in forms, or setting preferences.
        </P>
        <DashList
          items={[
            <>
              <B>Session cookie</B>: maintains your logged-in state as you navigate the website.
              Expires when you close your browser
            </>,
            <>
              <B>Authentication token</B>: stored in local storage to keep you signed in between
              sessions. Removed when you log out
            </>,
            <>
              <B>CSRF token</B>: a security cookie that prevents cross-site request forgery attacks.
              Expires when you close your browser
            </>,
          ]}
        />

        <Sub>Preference Storage</Sub>
        <P>
          We use local storage to remember your interface preferences so we don&rsquo;t need to ask
          you every time.
        </P>
        <DashList
          items={[
            <>
              <B>Theme preference</B>: remembers whether you selected light or dark mode so the
              website loads in your preferred theme immediately
            </>,
            <>
              <B>Dismissed notices</B>: records which informational banners you have dismissed to
              avoid showing them again
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'cookies-we-dont-use',
    number: 4,
    title: 'Cookies and Technologies We Do Not Use',
    content: (
      <>
        <P>To be perfectly clear, Bento does not use any of the following:</P>
        <DashList
          items={[
            'Advertising cookies or ad tracking of any kind',
            'Third-party tracking pixels (e.g., Facebook Pixel, Google Analytics advertising features)',
            'Cross-site tracking or fingerprinting scripts',
            'Social media tracking buttons that set cookies before interaction',
            'Retargeting or remarketing cookies from any ad network',
            'Behavioural profiling or audience segmentation cookies',
          ]}
        />
        <P>
          We believe you should not be tracked across the web. Bento is designed to respect your
          privacy.
        </P>
      </>
    ),
  },
  {
    id: 'analytics',
    number: 5,
    title: 'Analytics',
    content: (
      <>
        <P>
          Our marketing website (iamazeyou.me) uses <B>Vercel Analytics</B>, a privacy-first
          analytics service that collects anonymised, aggregated page view data. Vercel Analytics
          does not use cookies and does not track individual users.
        </P>
        <P>
          We also use <B>Vercel Speed Insights</B> to measure website performance metrics (load
          times, Core Web Vitals). This data is anonymised and aggregated.
        </P>
        <P>
          The desktop app itself does not use any analytics. No usage data, telemetry, or
          performance metrics are collected from the installed application.
        </P>
      </>
    ),
  },
  {
    id: 'managing-cookies',
    number: 6,
    title: 'Managing Your Cookie and Storage Preferences',
    content: (
      <>
        <P>You have several options to control cookies and local storage:</P>

        <Sub>Browser Settings</Sub>
        <P>
          Most browsers allow you to view, block, or delete cookies and site data. Check your
          browser&rsquo;s settings menu for options such as &ldquo;Clear browsing data,&rdquo;
          &ldquo;Block third-party cookies,&rdquo; or &ldquo;Site settings.&rdquo;
        </P>
        <P>
          Keep in mind that blocking essential cookies will prevent Bento from working properly:
        </P>
        <DashList
          items={[
            'Blocking session cookies means you will not be able to log in',
            'Clearing local storage will log you out and reset your theme preference',
            'Without authentication storage, you will need to log in every time you visit',
          ]}
        />

        <Sub>Account Settings</Sub>
        <P>
          Within your Bento account settings, you can toggle analytics collection on or off at any
          time.
        </P>

        <Sub>Do Not Track</Sub>
        <P>
          Bento honours the Do Not Track (DNT) signal sent by your browser. When we detect a DNT
          signal, we disable non-essential analytics collection for your session.
        </P>
      </>
    ),
  },
  {
    id: 'updates',
    number: 7,
    title: 'Updates to This Policy',
    content: (
      <>
        <P>
          We may update this Cookie Policy from time to time to reflect changes in technology, legal
          requirements, or Bento&rsquo;s features. Material changes will be communicated through our
          website or via email.
        </P>
        <P>
          We encourage you to review this page periodically. Your continued use of Bento after
          changes take effect constitutes acceptance of the updated policy.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    number: 8,
    title: 'Contact',
    content: (
      <>
        <P>
          If you have questions about this Cookie Policy or how Bento uses data storage
          technologies, please reach out:
        </P>
        <DashList
          items={[
            <>
              <B>Cookie and privacy inquiries</B>:{' '}
              <a href="mailto:privacy@iamazeyou.me" className="legal-link">
                privacy@iamazeyou.me
              </a>
            </>,
            <>
              <B>General contact</B>:{' '}
              <a href="mailto:support@iamazeyou.me" className="legal-link">
                support@iamazeyou.me
              </a>
            </>,
          ]}
        />
        <P>
          We are committed to transparency about our data practices and will respond to questions
          promptly.
        </P>
      </>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      description="How Bento uses cookies, local storage, and similar technologies to operate and improve our calm desktop app website."
      effectiveDate={EFFECTIVE_DATE}
      sections={sections}
      currentPage="cookies"
    />
  );
}
