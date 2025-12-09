import { Resend } from 'resend';

const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('⚠️ Resend API key not found. Email functionality will be disabled.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!resend) {
    console.error('❌ Resend is not configured. Cannot send email.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const emailData: any = {
      from: options.from || 'Genesis <onboarding@resend.dev>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
    };

    // Add html or text based on what's provided
    if (options.html) {
      emailData.html = options.html;
    }
    if (options.text) {
      emailData.text = options.text;
    }
    if (options.replyTo) {
      emailData.replyTo = options.replyTo;
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('❌ Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (error: any) {
    console.error('❌ Email sending error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Send a welcome email to new users
 */
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Welcome to Genesis!</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName}! 👋</h2>
            <p>We're thrilled to have you join the Genesis community! You're now part of an innovative platform that transforms storytelling through AI-powered visual content creation.</p>
            
            <h3>🎨 What You Can Do:</h3>
            <ul>
              <li><strong>Create Stunning Ebooks:</strong> Generate illustrated stories with AI</li>
              <li><strong>Visual Storytelling:</strong> Bring your ideas to life with beautiful imagery</li>
              <li><strong>Collaborate:</strong> Share and remix stories with the community</li>
              <li><strong>Learn & Grow:</strong> Access educational content and templates</li>
            </ul>

            <p style="text-align: center;">
              <a href="https://genesis.app" class="button">Start Creating Now</a>
            </p>

            <h3>🚀 Quick Start Tips:</h3>
            <ol>
              <li>Explore the Creation Canvas to start your first project</li>
              <li>Check out the Template Library for inspiration</li>
              <li>Join our community to share your creations</li>
            </ol>

            <p>If you have any questions, feel free to reach out to our support team. We're here to help!</p>
            
            <p>Happy creating! 🎉</p>
            <p><strong>The Genesis Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 Genesis. All rights reserved.</p>
            <p>You're receiving this email because you signed up for Genesis.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: '✨ Welcome to Genesis - Start Creating Amazing Stories!',
    html,
    text: `Hi ${userName}! Welcome to Genesis! We're excited to have you join our community of creators. Start exploring the platform and create your first AI-powered story today!`,
  });
}

/**
 * Send a book completion celebration email
 */
export async function sendBookCompletionEmail(userEmail: string, userName: string, bookTitle: string): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .celebration { font-size: 48px; text-align: center; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
          </div>
          <div class="content">
            <div class="celebration">🎊 📚 ✨</div>
            <h2>Amazing Work, ${userName}!</h2>
            <p>You've just completed your book: <strong>"${bookTitle}"</strong></p>
            
            <p>This is a huge accomplishment! Creating a complete illustrated book takes creativity, dedication, and vision. You should be proud of what you've achieved.</p>

            <h3>📥 What's Next?</h3>
            <ul>
              <li><strong>Download:</strong> Save your book as a PDF to share with friends and family</li>
              <li><strong>Publish:</strong> Export for Amazon KDP and reach a global audience</li>
              <li><strong>Share:</strong> Let the Genesis community see your amazing work</li>
              <li><strong>Create More:</strong> Start your next masterpiece!</li>
            </ul>

            <p style="text-align: center;">
              <a href="https://genesis.app" class="button">View Your Book</a>
            </p>

            <p>Keep creating and inspiring others with your stories!</p>
            
            <p><strong>The Genesis Team</strong> 🌟</p>
          </div>
          <div class="footer">
            <p>© 2025 Genesis. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `🎉 Congratulations! You completed "${bookTitle}"`,
    html,
    text: `Congratulations ${userName}! You've completed your book "${bookTitle}". This is an amazing achievement! Download, share, or publish your book now on Genesis.`,
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
  const featuresList = features.map(f => `<li>${f}</li>`).join('');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .badge { display: inline-block; background: #FFD54F; color: #333; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
          ul { padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Subscription Upgraded!</h1>
          </div>
          <div class="content">
            <h2>Welcome to ${planName}, ${userName}! 🎉</h2>
            <p>Your subscription has been successfully upgraded. You now have access to premium features that will supercharge your creativity!</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <span class="badge">${planName} Plan Active</span>
            </div>

            <h3>✨ Your New Features:</h3>
            <ul>
              ${featuresList}
            </ul>

            <p style="text-align: center;">
              <a href="https://genesis.app" class="button">Start Creating</a>
            </p>

            <p>Thank you for supporting Genesis! We can't wait to see what you create with your enhanced capabilities.</p>
            
            <p><strong>The Genesis Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 Genesis. All rights reserved.</p>
            <p>Manage your subscription anytime in Settings.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: `🚀 Welcome to ${planName} - Your Upgrade is Active!`,
    html,
    text: `Hi ${userName}! Your subscription to ${planName} is now active. Enjoy your new premium features: ${features.join(', ')}. Start creating at genesis.app`,
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  userEmail: string, 
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Reset Your Password</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your Genesis account password.</p>
            
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>

            <p>This link will expire in 1 hour for security reasons.</p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>

            <p>Need help? Contact our support team.</p>
            
            <p><strong>The Genesis Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 Genesis. All rights reserved.</p>
            <p>This is an automated security email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject: '🔐 Reset Your Genesis Password',
    html,
    text: `You requested a password reset for your Genesis account. Click this link to reset your password: ${resetLink}. This link expires in 1 hour. If you didn't request this, please ignore this email.`,
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
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #FF9B71 0%, #FFD54F 100%); color: white; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📚 A Story For You!</h1>
          </div>
          <div class="content">
            <h2>${senderName} shared a story with you! 🎁</h2>
            <p><strong>${senderName}</strong> thought you'd enjoy their creation: <em>"${bookTitle}"</em></p>
            
            <p>They created this story using Genesis, an AI-powered visual storytelling platform.</p>

            <p style="text-align: center;">
              <a href="${shareLink}" class="button">Read the Story</a>
            </p>

            <p>After reading, you can create your own stories too! Join Genesis and start your creative journey.</p>
            
            <p><strong>The Genesis Team</strong> 📖</p>
          </div>
          <div class="footer">
            <p>© 2025 Genesis. All rights reserved.</p>
            <p>You're receiving this because ${senderName} shared a story with you.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `📚 ${senderName} shared "${bookTitle}" with you!`,
    html,
    text: `${senderName} shared their story "${bookTitle}" with you! View it here: ${shareLink}. Created with Genesis - AI-powered visual storytelling.`,
  });
}
