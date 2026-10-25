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
      <title>Reset Your ScholarBeacon Password</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: #0052EA; padding: 28px 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
        .header h1 span { color: #93c5fd; }
        .body { padding: 32px 24px; }
        .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .text { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
        .otp-box { background: #eff6ff; border: 2px dashed #0052EA; border-radius: 12px; text-align: center; padding: 18px; margin: 24px 0; }
        .otp-label { font-size: 11px; font-weight: 700; color: #0052EA; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
        .otp-code { font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0052EA; font-family: monospace; }
        .expiry-note { font-size: 12px; color: #64748b; text-align: center; margin-top: 8px; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Scholar<span>Beacon</span></h1>
        </div>
        <div class="body">
          <div class="greeting">Hello, ${userName}</div>
          <div class="text">
            We received a request to reset the password for your ScholarBeacon account (${to}). Use the 6-digit verification code below to complete the reset.
          </div>
          <div class="otp-box">
            <div class="otp-label">Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="expiry-note">This code will expire in 15 minutes.</div>
          </div>
          <div class="text">
            If you did not request a password reset, you can safely ignore this email. Your account remains completely secure.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ScholarBeacon. Dedicated to global scholars worldwide.
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
