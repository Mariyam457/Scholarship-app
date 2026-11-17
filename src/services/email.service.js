import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    logger.info(`📧 SMTP transporter initialized for host: ${env.SMTP_HOST}`);
  }
  return transporter;
}

/**
 * Send Password Reset OTP Email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.otp - 6-digit OTP code
 * @param {string} [options.userName] - Recipient name
 */
export async function sendPasswordResetEmail({ to, otp, userName = 'Scholar' }) {
  const mailTransporter = getTransporter();

  // If SMTP is not yet configured, log OTP prominently for local dev testing
  if (!mailTransporter) {
    logger.warn('⚠️ SMTP credentials not configured in .env. Password Reset OTP logged below for testing:');
    logger.info(`====================================================`);
    logger.info(`🔑 PASSWORD RESET OTP for ${to}: [ ${otp} ] (Valid for 15 minutes)`);
    logger.info(`====================================================`);
    return {
      delivered: false,
      mode: 'DEV_CONSOLE_FALLBACK',
      message: 'SMTP credentials not configured yet. Code logged in backend terminal.',
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your ScholarBeacon Security Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 32px 16px; -webkit-font-smoothing: antialiased; }
        .wrapper { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 82, 234, 0.08); }
        .hero { background: linear-gradient(135deg, #0052EA 0%, #003db3 100%); padding: 36px 32px; text-align: center; }
        .hero-badge { display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
        .hero h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
        .hero h1 span { color: #93c5fd; }
        .content { padding: 36px 32px; }
        .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
        .text { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
        .otp-container { background: #f8fafc; border: 2px dashed #0052EA; border-radius: 18px; padding: 24px 16px; text-align: center; margin: 24px 0; }
        .otp-eyebrow { font-size: 11px; font-weight: 800; color: #0052EA; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
        .otp-number { font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #0052EA; font-family: 'Courier New', Courier, monospace; margin: 4px 0; }
        .otp-validity { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 6px; }
        .security-callout { background: #eff6ff; border-left: 4px solid #0052EA; border-radius: 8px; padding: 14px 16px; margin: 24px 0 16px 0; font-size: 13px; color: #1e3a8a; line-height: 1.5; }
        .footer { background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="hero">
          <div class="hero-badge">Official Security Verification</div>
          <h1>Scholar<span>Beacon</span></h1>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${userName}</div>
          <div class="text">
            We received an authentication request to reset the password for your ScholarBeacon account (<strong style="color: #0f172a;">${to}</strong>). Enter the 6-digit verification code below to verify your identity.
          </div>
          
          <div class="otp-container">
            <div class="otp-eyebrow">Your 6-Digit Verification Code</div>
            <div class="otp-number">${otp}</div>
            <div class="otp-validity">⏱ Valid for 15 minutes</div>
          </div>

          <div class="security-callout">
            <strong>Security Notice:</strong> If you did not make this request, someone may have mistyped their email. Your credentials remain completely secure and no changes have been made to your account.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ScholarBeacon &bull; Dedicated to international scholars worldwide.<br>
          This is an automated security dispatch. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mailTransporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `Your ScholarBeacon Password Reset Code: ${otp}`,
      text: `Hello ${userName},\n\nYour ScholarBeacon password reset code is: ${otp}\n\nThis code will expire in 15 minutes.\nIf you did not request this, please ignore this email.`,
      html: htmlContent,
    });

    logger.info(`📧 Password reset email sent to ${to}. MessageId: ${info.messageId}`);
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`❌ Failed to send SMTP password reset email to ${to}: ${error.message}`);
    throw error;
  }
}
