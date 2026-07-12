import axios, { AxiosInstance } from 'axios';
import { config } from '../../config/env';
import { ConfirmationPayload, NotificationPayload, NotifierPort } from './notifier.types';

export class NotifierClient implements NotifierPort {
  private readonly http: AxiosInstance;

  constructor(baseURL = config.notifierService.url) {
    this.http = axios.create({
      baseURL,
      timeout: 5_000,
    });
  }

  async sendConfirmationEmail(payload: ConfirmationPayload): Promise<void> {
    await this.http.post('/api/emails/confirmation', {
      ...payload,
      appUrl: config.appUrl,
    });
  }

  async sendReleaseNotification(payload: NotificationPayload): Promise<void> {
    await this.http.post('/api/emails/release', {
      ...payload,
      appUrl: config.appUrl,
    });
  }
}

export const notifierClient = new NotifierClient();
