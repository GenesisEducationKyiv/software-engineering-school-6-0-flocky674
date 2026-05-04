import nodemailer from 'nodemailer';
import { config } from '../../config/env';
import logger from '../../shared/utils/logger';

export interface NotificationPayload {
  email: string;
  repoFullName: string;
  tagName: string;
  releaseName: string;
  releaseUrl: string;
  unsubscribeToken: string;
}

export interface ConfirmationPayload {
  email: string;
  repoFullName: string;
  confirmToken: string;
}

export class NotifierService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
      secure: config.smtp.port === 465,
    });
  }

  async sendConfirmationEmail(payload: ConfirmationPayload): Promise<void> {
    const { email, repoFullName, confirmToken } = payload;
    const confirmUrl = `${config.appUrl}/api/confirm/${confirmToken}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Confirm your subscription</h2>
        <p>You subscribed to release notifications for <strong>${repoFullName}</strong>.</p>
        <p>Click the button below to confirm:</p>
        <p>
          <a href="${confirmUrl}" style="background:#238636;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
            Confirm subscription
          </a>
        </p>
        <p style="font-size:12px;color:#666;">If you didn't request this, just ignore this email.</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: config.smtp.from,
      to: email,
      subject: `Confirm your subscription to ${repoFullName}`,
      html,
      text: `Confirm your subscription to ${repoFullName}: ${confirmUrl}`,
    });

    logger.info({ email, repoFullName }, 'confirmation email sent');
  }

  async sendReleaseNotification(payload: NotificationPayload): Promise<void> {
    const { email, repoFullName, tagName, releaseName, releaseUrl, unsubscribeToken } = payload;
    const unsubscribeUrl = `${config.appUrl}/api/unsubscribe/${unsubscribeToken}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New release: ${tagName}</h2>
        <p>New release in <strong><a href="https://github.com/${repoFullName}">${repoFullName}</a></strong></p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr><td style="padding:8px;font-weight:bold;">Repository</td><td style="padding:8px;">${repoFullName}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Release</td><td style="padding:8px;">${releaseName || tagName}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Tag</td><td style="padding:8px;">${tagName}</td></tr>
        </table>
        <p>
          <a href="${releaseUrl}" style="background:#24292e;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
            View on GitHub
          </a>
        </p>
        <hr style="margin-top:32px;"/>
        <p style="font-size:12px;color:#666;">
          You subscribed to release notifications for ${repoFullName}.<br/>
          <a href="${unsubscribeUrl}">Unsubscribe</a>
        </p>
      </div>
    `;

    await this.transporter.sendMail({
      from: config.smtp.from,
      to: email,
      subject: `New release in ${repoFullName}: ${tagName}`,
      html,
      text: `New release in ${repoFullName}: ${tagName}\n\n${releaseUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
    });

    logger.info({ email, repoFullName, tagName }, 'notification sent');
  }
}

export const notifierService = new NotifierService();
