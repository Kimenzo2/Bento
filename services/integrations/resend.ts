/**
 * Resend Email Service Integration
 *
 * Professional email API for transactional and marketing emails.
 * Features: React Email templates, high deliverability, analytics.
 *
 * @see https://resend.com/docs
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactElement;
  attachments?: EmailAttachment[];
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
  scheduledAt?: string;
}

export interface EmailResult {
  id: string;
  from: string;
  to: string[];
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
}

export interface ResendConfig {
  apiKey: string;
  defaultFrom?: string;
  replyTo?: string;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export const EMAIL_TEMPLATES = {
  // Transactional
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  PURCHASE_CONFIRMATION: 'purchase_confirmation',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // Book-related
  BOOK_PUBLISHED: 'book_published',
  BOOK_SHARED: 'book_shared',
  COLLABORATION_INVITE: 'collaboration_invite',
  EXPORT_READY: 'export_ready',

  // Engagement
  WEEKLY_DIGEST: 'weekly_digest',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  INACTIVITY_REMINDER: 'inactivity_reminder',
  NEW_FEATURE: 'new_feature',

  // Marketing
  NEWSLETTER: 'newsletter',
  PROMO_OFFER: 'promo_offer',
  UPGRADE_PROMPT: 'upgrade_prompt',
} as const;

// ============================================================================
// RESEND SERVICE CLASS
// ============================================================================

class ResendService {
  private initialized = false;
  private config: ResendConfig | null = null;
  private baseUrl = 'https://api.resend.com';
  private defaultFrom = 'Genesis <noreply@genesis.app>';

  /**
   * Initialize Resend with API key
   */
  initialize(config?: Partial<ResendConfig>): boolean {
    // Server secret — never exposed to client bundle (no VITE_ prefix)
    const apiKey = config?.apiKey;

    if (!apiKey) {
      return false;
    }

    this.config = {
      apiKey,
      defaultFrom: config?.defaultFrom || this.defaultFrom,
      replyTo: config?.replyTo,
    };

    this.initialized = true;
    return true;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Make API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Resend not initialized');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Resend API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send a single email
   */
  async send(options: SendEmailOptions): Promise<EmailResult> {
    if (!this.isInitialized()) {
      throw new Error('Resend not initialized');
    }

    const payload = {
      from: options.from || this.config?.defaultFrom,
      to: Array.isArray(options.to) ? options.to : [options.to],
      cc: options.cc,
      bcc: options.bcc,
      reply_to: options.replyTo || this.config?.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      tags: options.tags,
      headers: options.headers,
      scheduled_at: options.scheduledAt,
    };

    return this.request<EmailResult>('/emails', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send batch emails (up to 100)
   */
  async sendBatch(emails: SendEmailOptions[]): Promise<{ data: EmailResult[] }> {
    if (!this.isInitialized()) {
      throw new Error('Resend not initialized');
    }

    if (emails.length > 100) {
      throw new Error('Batch limit is 100 emails');
    }

    const payload = emails.map((email) => ({
      from: email.from || this.config?.defaultFrom,
      to: Array.isArray(email.to) ? email.to : [email.to],
      cc: email.cc,
      bcc: email.bcc,
      reply_to: email.replyTo || this.config?.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: email.tags,
    }));

    return this.request('/emails/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get email by ID
   */
  async getEmail(emailId: string): Promise<EmailResult & { status: string }> {
    return this.request(`/emails/${emailId}`);
  }

  /**
   * Cancel scheduled email
   */
  async cancelEmail(emailId: string): Promise<{ id: string; canceled: boolean }> {
    return this.request(`/emails/${emailId}/cancel`, {
      method: 'POST',
    });
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR GENESIS
  // ============================================================================

  /**
   * Send welcome email to new user
   */
  async sendWelcome(to: string, userName: string): Promise<EmailResult> {
    return this.send({
      from: this.defaultFrom,
      to,
      subject: `Welcome to Genesis, ${userName}! 🎉`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">Welcome to Genesis!</h1>
          <p>Hi ${userName},</p>
          <p>We're thrilled to have you join our community of storytellers and creators.</p>
          <p>Here's what you can do next:</p>
          <ul>
            <li>📚 Create your first ebook with AI assistance</li>
            <li>🎨 Explore our visual studio for cover design</li>
            <li>🌍 Publish in 50+ languages</li>
          </ul>
          <a href="https://genesis.app/create" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
            Start Creating
          </a>
          <p style="color: #666; margin-top: 32px;">Happy writing!<br>The Genesis Team</p>
        </div>
      `,
      tags: [{ name: 'category', value: 'welcome' }],
    });
  }

  /**
   * Send book published notification
   */
  async sendBookPublished(to: string, bookTitle: string, shareUrl: string): Promise<EmailResult> {
    return this.send({
      from: this.defaultFrom,
      to,
      subject: `Your book "${bookTitle}" is now live! 📖`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">Congratulations! 🎉</h1>
          <p>Your book <strong>"${bookTitle}"</strong> has been successfully published!</p>
          <p>Share it with the world:</p>
          <a href="${shareUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
            View Your Book
          </a>
          <p style="color: #666; margin-top: 32px;">Keep creating!<br>The Genesis Team</p>
        </div>
      `,
      tags: [{ name: 'category', value: 'book_published' }],
    });
  }

  /**
   * Send collaboration invite
   */
  async sendCollaborationInvite(
    to: string,
    inviterName: string,
    bookTitle: string,
    inviteUrl: string
  ): Promise<EmailResult> {
    return this.send({
      from: this.defaultFrom,
      to,
      subject: `${inviterName} invited you to collaborate on "${bookTitle}"`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">You've Been Invited! ✨</h1>
          <p><strong>${inviterName}</strong> has invited you to collaborate on:</p>
          <h2 style="color: #1f2937;">"${bookTitle}"</h2>
          <a href="${inviteUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
            Accept Invitation
          </a>
          <p style="color: #666; margin-top: 32px;">The Genesis Team</p>
        </div>
      `,
      tags: [{ name: 'category', value: 'collaboration' }],
    });
  }

  /**
   * Send achievement notification
   */
  async sendAchievement(
    to: string,
    achievementName: string,
    description: string
  ): Promise<EmailResult> {
    return this.send({
      from: this.defaultFrom,
      to,
      subject: `🏆 Achievement Unlocked: ${achievementName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
          <h1 style="font-size: 64px; margin-bottom: 0;">🏆</h1>
          <h2 style="color: #6366f1;">Achievement Unlocked!</h2>
          <h3 style="color: #1f2937;">${achievementName}</h3>
          <p style="color: #666;">${description}</p>
          <a href="https://genesis.app/achievements" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
            View All Achievements
          </a>
        </div>
      `,
      tags: [{ name: 'category', value: 'gamification' }],
    });
  }

  /**
   * Send weekly digest
   */
  async sendWeeklyDigest(
    to: string,
    stats: {
      booksCreated: number;
      wordsWritten: number;
      streakDays: number;
    }
  ): Promise<EmailResult> {
    return this.send({
      from: this.defaultFrom,
      to,
      subject: '📊 Your Weekly Genesis Digest',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">Your Week in Review 📊</h1>
          <div style="background: #f3f4f6; padding: 24px; border-radius: 12px; margin: 24px 0;">
            <div style="display: flex; justify-content: space-around; text-align: center;">
              <div>
                <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${stats.booksCreated}</div>
                <div style="color: #666;">Books Created</div>
              </div>
              <div>
                <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${stats.wordsWritten.toLocaleString()}</div>
                <div style="color: #666;">Words Written</div>
              </div>
              <div>
                <div style="font-size: 32px; font-weight: bold; color: #6366f1;">${stats.streakDays}🔥</div>
                <div style="color: #666;">Day Streak</div>
              </div>
            </div>
          </div>
          <a href="https://genesis.app/dashboard" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Continue Your Journey
          </a>
        </div>
      `,
      tags: [{ name: 'category', value: 'digest' }],
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const resend = new ResendService();

export function initializeResend(config?: Partial<ResendConfig>): boolean {
  return resend.initialize(config);
}

export default resend;
