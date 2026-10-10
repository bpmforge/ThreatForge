import { escapeHtml } from "../../utils/html-escape.js";
/**
 * Email Templates
 *
 * HTML + plain-text generators for transactional emails.
 */

interface TemplateData {
  appName: string;
  appUrl: string;
  [key: string]: string;
}

export function generatePasswordResetEmail(
  userName: string,
  resetUrl: string,
  data: TemplateData,
): { subject: string; text: string; html: string } {
  const subject = `Reset your ${data.appName} password`;

  const text = `
Hello ${userName},

We received a request to reset your password for your ${data.appName} account.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Best regards,
The ${data.appName} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #1a1a1a; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 30px; }
    .button { display: inline-block; background: #2563eb; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; }
    .warning { color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${escapeHtml(data.appName)}</h1></div>
    <div class="content">
      <p>Hello ${escapeHtml(userName)},</p>
      <p>We received a request to reset your password for your ${data.appName} account.</p>
      <p style="text-align: center;"><a href="${resetUrl}" class="button">Reset Password</a></p>
      <p class="warning">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer"><p>Best regards,<br>The ${data.appName} Team</p></div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

export function generateVerificationEmail(
  userName: string,
  verifyUrl: string,
  data: TemplateData,
): { subject: string; text: string; html: string } {
  const subject = `Verify your ${data.appName} email`;

  const text = `
Hello ${userName},

Welcome to ${data.appName}! Please verify your email address to get started.

Click this link to verify your email:
${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

Best regards,
The ${data.appName} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #1a1a1a; margin: 0; font-size: 24px; }
    .content { background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 30px; }
    .button { display: inline-block; background: #059669; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; }
    .warning { color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${escapeHtml(data.appName)}</h1></div>
    <div class="content">
      <p>Hello ${escapeHtml(userName)},</p>
      <p>Welcome to ${data.appName}! Please verify your email address to get started.</p>
      <p style="text-align: center;"><a href="${verifyUrl}" class="button">Verify Email</a></p>
      <p class="warning">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer"><p>Best regards,<br>The ${data.appName} Team</p></div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}
