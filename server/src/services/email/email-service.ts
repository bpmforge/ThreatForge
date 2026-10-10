/**
 * Email Service
 *
 * Provides email sending functionality with support for multiple providers:
 * - SMTP (nodemailer)
 * - SendGrid (API)
 * - Resend (API)
 * - AWS SES (API)
 *
 * Includes email templates for common flows like password reset and verification.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getPrisma } from "../../db.js";
import { decryptValue } from "../encryption/encryption-service.js";
import logger from "../../utils/logger.js";
import {
  generatePasswordResetEmail,
  generateVerificationEmail,
} from "./email-templates.js";

// =============================================================================
// Types
// =============================================================================

type EmailProvider = "none" | "smtp" | "sendgrid" | "resend" | "ses";

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
}

interface SendGridConfig {
  apiKey: string;
}

interface ResendConfig {
  apiKey: string;
}

interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

type EmailConfig = SMTPConfig | SendGridConfig | ResendConfig | SESConfig;

interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string; // Override default from address
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailSettings {
  provider: EmailProvider;
  from: string | null;
  config: EmailConfig | null;
}

// =============================================================================
// Email Service Class
// =============================================================================

class EmailService {
  private transporter: Transporter | null = null;
  private settings: EmailSettings | null = null;
  private lastSettingsCheck = 0;
  private readonly SETTINGS_CACHE_MS = 60000; // 1 minute cache

  /**
   * Get email settings from the database.
   */
  async getSettings(): Promise<EmailSettings> {
    const now = Date.now();

    // Use cached settings if still valid
    if (
      this.settings &&
      now - this.lastSettingsCheck < this.SETTINGS_CACHE_MS
    ) {
      return this.settings;
    }

    const prisma = await getPrisma();
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: {
        emailProvider: true,
        emailFrom: true,
        emailConfig: true,
      },
    });

    let config: EmailConfig | null = null;
    if (systemSettings?.emailConfig) {
      try {
        const decrypted = decryptValue(systemSettings.emailConfig);
        if (decrypted) {
          config = JSON.parse(decrypted);
        }
      } catch (error) {
        logger.error({ err: error }, "Failed to decrypt email config");
      }
    }

    this.settings = {
      provider: (systemSettings?.emailProvider || "none") as EmailProvider,
      from: systemSettings?.emailFrom || null,
      config,
    };
    this.lastSettingsCheck = now;

    return this.settings;
  }

  /**
   * Clear cached settings (call after config changes).
   */
  clearSettingsCache(): void {
    this.settings = null;
    this.lastSettingsCheck = 0;
    this.transporter = null;
  }

  /**
   * Get or create the nodemailer transporter.
   */
  private async getTransporter(): Promise<Transporter | null> {
    const settings = await this.getSettings();

    if (settings.provider === "none" || !settings.config) {
      return null;
    }

    // Re-use existing transporter if settings haven't changed
    if (this.transporter) {
      return this.transporter;
    }

    switch (settings.provider) {
      case "smtp": {
        const smtpConfig = settings.config as SMTPConfig;
        this.transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.auth.user,
            pass: smtpConfig.auth.pass,
          },
        });
        break;
      }

      case "sendgrid": {
        const sendgridConfig = settings.config as SendGridConfig;
        this.transporter = nodemailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          secure: false,
          auth: {
            user: "apikey",
            pass: sendgridConfig.apiKey,
          },
        });
        break;
      }

      case "resend": {
        const resendConfig = settings.config as ResendConfig;
        this.transporter = nodemailer.createTransport({
          host: "smtp.resend.com",
          port: 465,
          secure: true,
          auth: {
            user: "resend",
            pass: resendConfig.apiKey,
          },
        });
        break;
      }

      case "ses": {
        const sesConfig = settings.config as SESConfig;
        this.transporter = nodemailer.createTransport({
          host: `email-smtp.${sesConfig.region}.amazonaws.com`,
          port: 587,
          secure: false,
          auth: {
            user: sesConfig.accessKeyId,
            pass: sesConfig.secretAccessKey,
          },
        });
        break;
      }

      default:
        return null;
    }

    return this.transporter;
  }

  /**
   * Check if email service is configured and available.
   */
  async isConfigured(): Promise<boolean> {
    const settings = await this.getSettings();
    return (
      settings.provider !== "none" &&
      settings.config !== null &&
      settings.from !== null
    );
  }

  /**
   * Test the email configuration by sending a test email.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        return { success: false, error: "Email provider not configured" };
      }

      await transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }

  /**
   * Send an email.
   */
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const settings = await this.getSettings();

      if (settings.provider === "none") {
        // In development, log the email instead of failing
        if (process.env.NODE_ENV !== "production") {
          logger.info(
            {
              to: message.to,
              subject: message.subject,
              from: message.from || settings.from,
            },
            "[EMAIL DEV MODE] Would send email",
          );
          return { success: true, messageId: "dev-mode" };
        }
        return { success: false, error: "Email provider not configured" };
      }

      const transporter = await this.getTransporter();
      if (!transporter) {
        return { success: false, error: "Failed to create email transporter" };
      }

      const from = message.from || settings.from;
      if (!from) {
        return { success: false, error: "No from address configured" };
      }

      const result = await transporter.sendMail({
        from,
        to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error({ err: error }, "Failed to send email");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }

  /**
   * Send a password reset email.
   */
  async sendPasswordResetEmail(
    email: string,
    userName: string,
    resetToken: string,
  ): Promise<SendResult> {
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";
    const appName = process.env.APP_NAME || "ThreatForge";
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    const { subject, text, html } = generatePasswordResetEmail(
      userName,
      resetUrl,
      {
        appName,
        appUrl,
      },
    );

    return this.send({ to: email, subject, text, html });
  }

  /**
   * Send an email verification email.
   */
  async sendVerificationEmail(
    email: string,
    userName: string,
    verificationToken: string,
  ): Promise<SendResult> {
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";
    const appName = process.env.APP_NAME || "ThreatForge";
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    const { subject, text, html } = generateVerificationEmail(
      userName,
      verifyUrl,
      {
        appName,
        appUrl,
      },
    );

    return this.send({ to: email, subject, text, html });
  }
}

// Singleton instance
export const emailService = new EmailService();

// Re-export for convenience
