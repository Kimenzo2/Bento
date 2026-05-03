import { render } from '@react-email/components';
import { createElement } from 'react';
import { authenticatedFetch } from './api/authenticatedFetch';

// React Email templates
import WelcomeEmail from '../emails/WelcomeEmail';
import BookCompletionEmail from '../emails/BookCompletionEmail';
import SubscriptionUpgradeEmail from '../emails/SubscriptionUpgradeEmail';
import PasswordResetEmail from '../emails/PasswordResetEmail';
import BookSharedEmail from '../emails/BookSharedEmail';
import PaymentSucceededEmail from '../emails/PaymentSucceededEmail';
import SubscriptionCancelledEmail from '../emails/SubscriptionCancelledEmail';
import SubscriptionRenewedEmail from '../emails/SubscriptionRenewedEmail';
import PaymentFailedEmail from '../emails/PaymentFailedEmail';
import CollaborationInviteEmail from '../emails/CollaborationInviteEmail';
import ExportReadyEmail from '../emails/ExportReadyEmail';
import WeeklyDigestEmail from '../emails/WeeklyDigestEmail';
import AchievementEmail from '../emails/AchievementEmail';

// SECURITY: Email sending is routed through /api/send-email server endpoint.
// The Resend API key must NEVER be in client-side code.
// This service renders React Email templates to HTML and sends them to our API.

const EMAIL_API_ENDPOINT = '/api/send-email';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await authenticatedFetch(EMAIL_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        from: options.from,
        replyTo: options.replyTo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to send email' };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    if (import.meta.env.DEV) console.error('Email sending error:', error);
    return { success: false, error: 'Network error sending email' };
  }
}

// ---------------------------------------------------------------------------
// Template senders — each renders a React Email component to HTML + plain text
// ---------------------------------------------------------------------------

/**
 * Send a welcome email to new users
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(WelcomeEmail, { userName });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Welcome to Genesis, ${userName}!`,
    html,
    text,
  });
}

/**
 * Send a book completion celebration email
 */
export async function sendBookCompletionEmail(
  userEmail: string,
  userName: string,
  bookTitle: string
): Promise<{ success: boolean; error?: string }> {
  const props = { userName, bookTitle, bookUrl: 'https://iamazeyou.me/library' };
  const element = createElement(BookCompletionEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Congratulations! You completed "${bookTitle}"`,
    html,
    text,
  });
}

/**
 * Send a subscription upgrade confirmation email
 */
export async function sendSubscriptionEmail(
  userEmail: string,
  userName: string,
  planName: string,
  features: string[]
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(SubscriptionUpgradeEmail, {
    userName,
    planName,
    price: '',
    features,
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Welcome to ${planName} — your upgrade is active`,
    html,
    text,
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(PasswordResetEmail, { resetLink });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: 'Reset your Genesis password',
    html,
    text,
  });
}

/**
 * Send a share notification email
 */
export async function sendBookShareEmail(
  recipientEmail: string,
  senderName: string,
  bookTitle: string,
  shareLink: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(BookSharedEmail, { senderName, bookTitle, shareLink });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: recipientEmail,
    subject: `${senderName} shared "${bookTitle}" with you`,
    html,
    text,
  });
}

/**
 * Send a payment confirmation email
 */
export async function sendPaymentSucceededEmail(
  userEmail: string,
  userName: string,
  planName: string,
  amount: string,
  currency: string,
  date: string,
  receiptUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(PaymentSucceededEmail, {
    userName,
    planName,
    amount,
    currency,
    date,
    receiptUrl,
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Payment confirmed — ${planName} plan`,
    html,
    text,
  });
}

/**
 * Send a subscription cancellation email
 */
export async function sendSubscriptionCancelledEmail(
  userEmail: string,
  userName: string,
  planName: string,
  endDate: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(SubscriptionCancelledEmail, { userName, planName, endDate });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Your ${planName} subscription has been cancelled`,
    html,
    text,
  });
}

/**
 * Send a subscription renewal email
 */
export async function sendSubscriptionRenewedEmail(
  userEmail: string,
  userName: string,
  planName: string,
  amount: string,
  nextRenewalDate: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(SubscriptionRenewedEmail, {
    userName,
    planName,
    amount,
    nextRenewalDate,
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Your ${planName} subscription has been renewed`,
    html,
    text,
  });
}

/**
 * Send a payment failed email
 */
export async function sendPaymentFailedEmail(
  userEmail: string,
  userName: string,
  planName: string,
  amount: string,
  retryDate: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(PaymentFailedEmail, {
    userName,
    planName,
    amount,
    retryDate,
    updatePaymentUrl: 'https://iamazeyou.me/settings',
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: 'Action required — your payment could not be processed',
    html,
    text,
  });
}

/**
 * Send a collaboration invite email
 */
export async function sendCollaborationInviteEmail(
  recipientEmail: string,
  inviterName: string,
  bookTitle: string,
  role: string,
  inviteUrl: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(CollaborationInviteEmail, {
    inviterName,
    bookTitle,
    role,
    inviteUrl,
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: recipientEmail,
    subject: `${inviterName} invited you to collaborate on "${bookTitle}"`,
    html,
    text,
  });
}

/**
 * Send an export ready email
 */
export async function sendExportReadyEmail(
  userEmail: string,
  userName: string,
  bookTitle: string,
  format: string,
  downloadUrl: string
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(ExportReadyEmail, { userName, bookTitle, format, downloadUrl });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Your ${format} export of "${bookTitle}" is ready`,
    html,
    text,
  });
}

/**
 * Send a weekly digest email
 */
export async function sendWeeklyDigestEmail(
  userEmail: string,
  userName: string,
  stats: {
    booksCreated: number;
    wordsWritten: number;
    streakDays: number;
    topBook?: string;
    weekStartDate: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(WeeklyDigestEmail, { userName, ...stats });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Your Genesis week — ${stats.booksCreated} books, ${stats.wordsWritten.toLocaleString()} words`,
    html,
    text,
  });
}

/**
 * Send an achievement unlocked email
 */
export async function sendAchievementEmail(
  userEmail: string,
  userName: string,
  achievementName: string,
  description: string,
  xpEarned?: number
): Promise<{ success: boolean; error?: string }> {
  const element = createElement(AchievementEmail, {
    userName,
    achievementName,
    description,
    xpEarned,
  });
  const html = await render(element);
  const text = await render(element, { plainText: true });

  return sendEmail({
    to: userEmail,
    subject: `Achievement unlocked: ${achievementName}`,
    html,
    text,
  });
}
