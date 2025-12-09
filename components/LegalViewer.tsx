import React, { useState } from 'react';
import { ArrowLeft, FileText, Shield, Cookie, AlertCircle } from 'lucide-react';
import { AppMode } from '../types';
import ReactMarkdown from 'react-markdown';

interface LegalViewerProps {
  onNavigate?: (mode: AppMode) => void;
  initialDoc?: 'privacy' | 'terms' | 'cookies' | 'acceptable-use';
}

const LegalViewer: React.FC<LegalViewerProps> = ({ onNavigate, initialDoc = 'privacy' }) => {
  const [activeDoc, setActiveDoc] = useState<'privacy' | 'terms' | 'cookies' | 'acceptable-use'>(initialDoc);
  const [isLoading, setIsLoading] = useState(false);

  const documents = {
    privacy: {
      title: 'Privacy Policy',
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      file: 'PRIVACY_POLICY.md'
    },
    terms: {
      title: 'Terms of Service',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      file: 'TERMS_OF_SERVICE.md'
    },
    cookies: {
      title: 'Cookie Policy',
      icon: Cookie,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      file: 'COOKIE_POLICY.md'
    },
    'acceptable-use': {
      title: 'Acceptable Use Policy',
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      file: 'ACCEPTABLE_USE_POLICY.md'
    }
  };

  const currentDoc = documents[activeDoc];
  const DocIcon = currentDoc.icon;

  // Get the markdown content
  const getMarkdownContent = () => {
    switch (activeDoc) {
      case 'privacy':
        return PRIVACY_POLICY_CONTENT;
      case 'terms':
        return TERMS_OF_SERVICE_CONTENT;
      case 'cookies':
        return COOKIE_POLICY_CONTENT;
      case 'acceptable-use':
        return ACCEPTABLE_USE_CONTENT;
      default:
        return '';
    }
  };

  return (
    <div className="w-full min-h-screen bg-cream-base pb-24 animate-fadeIn">
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-4 md:pt-8">
        
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
          {onNavigate && (
            <button
              onClick={() => onNavigate(AppMode.SETTINGS)}
              className="p-2 -ml-2 rounded-full hover:bg-cream-soft text-cocoa-light hover:text-coral-burst transition-colors touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${currentDoc.bgColor} flex items-center justify-center`}>
            <DocIcon className={`w-5 h-5 md:w-6 md:h-6 ${currentDoc.color}`} />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl md:text-4xl text-charcoal-soft">
              {currentDoc.title}
            </h1>
            <p className="text-cocoa-light text-sm md:text-base">Legal Information & Policies</p>
          </div>
        </div>

        {/* Document Selector */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          {Object.entries(documents).map(([key, doc]) => {
            const Icon = doc.icon;
            const isActive = activeDoc === key;
            return (
              <button
                key={key}
                onClick={() => setActiveDoc(key as typeof activeDoc)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading font-medium text-sm transition-all duration-200 touch-manipulation
                  ${isActive
                    ? `${doc.bgColor} ${doc.color} shadow-soft-sm border-2 border-current`
                    : 'bg-white text-cocoa-light hover:bg-cream-soft border-2 border-transparent'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="whitespace-nowrap">{doc.title}</span>
              </button>
            );
          })}
        </div>

        {/* Document Content */}
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-soft-lg border border-white/50 p-6 md:p-10">
          <article className="prose prose-sm md:prose-base max-w-none
            prose-headings:font-heading prose-headings:text-charcoal-soft
            prose-h1:text-2xl md:prose-h1:text-4xl prose-h1:mb-4 md:prose-h1:mb-6
            prose-h2:text-xl md:prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-coral-burst
            prose-h3:text-lg md:prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-charcoal-soft prose-p:leading-relaxed
            prose-a:text-coral-burst prose-a:no-underline hover:prose-a:underline
            prose-strong:text-charcoal-soft prose-strong:font-bold
            prose-ul:list-disc prose-ul:pl-6
            prose-ol:list-decimal prose-ol:pl-6
            prose-li:text-charcoal-soft prose-li:my-1
            prose-code:text-coral-burst prose-code:bg-cream-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-blockquote:border-l-4 prose-blockquote:border-coral-burst prose-blockquote:pl-4 prose-blockquote:italic
          ">
            <ReactMarkdown>{getMarkdownContent()}</ReactMarkdown>
          </article>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-cocoa-light/70">
          <p>Last Updated: December 9, 2025</p>
          <p className="mt-2">
            Questions? Contact us at{' '}
            <a href="mailto:legal@genesis.ai" className="text-coral-burst hover:underline">
              legal@genesis.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

// Markdown content embedded directly
const PRIVACY_POLICY_CONTENT = `# Privacy Policy for Genesis

**Effective Date:** December 9, 2025  
**Last Updated:** December 9, 2025

## Introduction

Welcome to Genesis ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience when using our visual learning platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.

## Information We Collect

### Personal Information
When you create an account or use Genesis, we may collect:
- **Account Information**: Email address, full name, password (encrypted)
- **Profile Data**: Avatar, display name, bio, preferences
- **Payment Information**: Processed securely through Paystack (we do not store credit card details)

### Automatically Collected Information
- **Usage Data**: Pages created, features used, interaction patterns
- **Device Information**: Browser type, IP address, device identifiers
- **Analytics**: Performance metrics, error logs, feature usage statistics

### User-Generated Content
- **Book Projects**: Stories, illustrations, text content you create
- **Gamification Data**: XP, levels, badges, streaks, achievements
- **Collaboration Data**: Shared projects, comments, feedback

## How We Use Your Information

We use the collected information to:
- **Provide Services**: Generate books, manage your account, process payments
- **Improve Experience**: Personalize content, optimize features, enhance AI models
- **Communication**: Send transactional emails, subscription updates, support responses
- **Security**: Detect fraud, prevent abuse, ensure platform integrity
- **Analytics**: Understand usage patterns, measure performance, develop new features

## Data Storage and Security

### Storage
Your data is stored securely using:
- **Supabase**: PostgreSQL database with end-to-end encryption
- **Cloud Infrastructure**: Industry-standard security protocols

### Security Measures
- **Encryption**: Data encrypted in transit (SSL/TLS) and at rest
- **Access Controls**: Role-based permissions, multi-factor authentication for staff
- **Regular Audits**: Security assessments, vulnerability scanning
- **Backup Systems**: Automated backups with disaster recovery

## Data Sharing and Disclosure

We **DO NOT** sell your personal information. We may share data with:

### Service Providers
- **Payment Processing**: Paystack for subscription management
- **AI Services**: Google Gemini for content generation (anonymized prompts)
- **Analytics**: Performance monitoring (anonymized data)
- **Email Services**: Transactional email delivery

### Legal Requirements
We may disclose information if required by law or to protect our rights.

## Your Rights and Choices

You have the right to:
- **Access**: Request a copy of your data
- **Rectification**: Correct inaccurate information
- **Deletion**: Request account and data deletion
- **Portability**: Export your data in standard formats
- **Opt-Out**: Unsubscribe from marketing communications

Contact us at: **privacy@genesis.ai**

## Cookies and Tracking

We use cookies for authentication, security, analytics, and preferences. You can control cookies through your browser settings.

## Children's Privacy

Genesis is not intended for children under 13. We do not knowingly collect information from children.

## Changes to This Policy

We may update this Privacy Policy periodically. We will notify you of material changes via email or platform notice.

## Contact Us

For privacy-related questions: **privacy@genesis.ai**

---

**Genesis** © 2025. Dream. Create. Inspire.`;

const TERMS_OF_SERVICE_CONTENT = `# Terms of Service for Genesis

**Effective Date:** December 9, 2025

## 1. Acceptance of Terms

By accessing or using Genesis, you agree to be bound by these Terms of Service. If you disagree with any part, you may not access the Service.

## 2. Description of Service

Genesis is a visual learning platform that uses AI technology to help users create interactive, illustrated books and educational content.

## 3. User Accounts

### 3.1 Registration
- You must provide accurate, current, and complete information
- You are responsible for maintaining account security
- You must be at least 13 years old
- One person may not maintain multiple free accounts

### 3.2 Account Security
- Keep your password confidential
- Notify us immediately of unauthorized access
- You are responsible for all activities under your account

## 4. Subscription Plans and Billing

### 4.1 Pricing Tiers
- **Spark (Free)**: 3 books/month, 4 pages/book, watermarked exports
- **Creator ($19.99/month)**: 30 books/month, 12 pages/book, commercial license
- **Studio ($59.99/month)**: Unlimited books, 500 pages/book, team features
- **Empire ($199.99/month)**: Unlimited everything, custom AI training, API access

### 4.2 Payment Terms
- Payments processed securely through Paystack
- Subscriptions renew automatically unless cancelled
- Annual plans billed upfront with ~17% discount

### 4.3 Refunds
- 7-day money-back guarantee for first-time subscribers
- No refunds for partial months or unused features

## 5. Acceptable Use Policy

You agree **NOT** to:
- Create illegal, harmful, threatening, or abusive content
- Violate intellectual property rights
- Impersonate any person or entity
- Transmit viruses or malicious code
- Use the Service for spam
- Reverse engineer our software

## 6. Intellectual Property Rights

### 6.1 Your Content
- You retain ownership of content you create
- **Commercial License**: Available with Creator tier and above
- **Free Tier**: Content is watermarked and not licensed for commercial use

### 6.2 AI-Generated Content
- AI-generated content becomes your property upon creation
- You are responsible for ensuring lawful use

## 7. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.

## 8. Limitation of Liability

Our total liability shall not exceed the amount you paid in the last 12 months.

## 9. Changes to Terms

We may update these Terms periodically with notice via email or platform announcement.

## 10. Contact Information

**Email**: legal@genesis.ai  
**Support**: support@genesis.ai

---

**Genesis** © 2025. Dream. Create. Inspire.`;

const COOKIE_POLICY_CONTENT = `# Cookie Policy

**Last Updated:** December 9, 2025

## What Are Cookies?

Cookies are small text files stored on your device when you visit Genesis. They help us provide a better experience by remembering your preferences.

## How We Use Cookies

### Essential Cookies (Required)
- **Authentication**: Keep you logged in securely
- **Security**: Prevent fraud and protect your account
- **Session Management**: Maintain your active session

### Analytics Cookies (Optional)
- **Usage Statistics**: Pages visited, features used
- **Performance Monitoring**: Load times, errors
- **A/B Testing**: Compare different versions

### Preference Cookies (Optional)
- **Theme Selection**: Light/dark mode preference
- **Language**: Your chosen language
- **Font Settings**: Typography preferences

## Managing Cookies

### Browser Controls
Most browsers allow you to:
- View and delete cookies
- Block third-party cookies
- Clear cookies on exit

### Your Choices
- **Accept All**: Full functionality
- **Essential Only**: Basic functionality
- **Opt-Out**: Disable analytics in Settings

## Cookie Lifespan

- **Session Cookies**: Deleted when browser closes
- **Persistent Cookies**: Stored for up to 1 year
- **Authentication Cookies**: 30 days

## Contact Us

Questions about cookies? **privacy@genesis.ai**

---

**Genesis** © 2025`;

const ACCEPTABLE_USE_CONTENT = `# Acceptable Use Policy

**Effective Date:** December 9, 2025

## Purpose

This Acceptable Use Policy governs your use of Genesis and protects our users, platform, and community.

## Prohibited Content

You may **NOT** create, upload, or distribute content that:

### Illegal Activities
- Violates any law
- Promotes illegal activities
- Infringes intellectual property rights

### Harmful Content
- Promotes violence or self-harm
- Contains hate speech or discrimination
- Harasses, threatens, or bullies individuals
- Exploits minors

### Inappropriate Content
- Contains pornography or sexually explicit material
- Depicts graphic violence
- Promotes substance abuse

## Prohibited Activities

You may **NOT**:

### System Abuse
- Gain unauthorized access to systems
- Upload viruses or malicious code
- Interfere with Service operation
- Reverse engineer software

### Account Abuse
- Create multiple free accounts
- Share accounts
- Sell or transfer accounts

## Commercial Use Restrictions

### Free Tier (Spark)
- Content is watermarked
- **NO** commercial use permitted
- Personal and educational use only

### Paid Tiers (Creator+)
- Commercial use permitted
- Must comply with all policies

## Reporting Violations

**Email**: abuse@genesis.ai  
**Response Time**: 48 hours

## Enforcement

1. **First Violation**: Warning and content removal
2. **Second Violation**: Temporary suspension (7-30 days)
3. **Third Violation**: Permanent termination

## Contact

**Email**: legal@genesis.ai

---

**Genesis** © 2025. Dream. Create. Inspire.`;

export default LegalViewer;
