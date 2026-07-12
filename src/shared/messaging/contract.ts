export const NOTIFICATIONS_EXCHANGE = 'notifications';
export const NOTIFICATIONS_QUEUE = 'notifications.emails';

export const EMAIL_CONFIRMATION_ROUTING_KEY = 'email.confirmation';
export const EMAIL_RELEASE_ROUTING_KEY = 'email.release';

export type EmailMessageType =
  | typeof EMAIL_CONFIRMATION_ROUTING_KEY
  | typeof EMAIL_RELEASE_ROUTING_KEY;

export interface ConfirmationEmailData {
  email: string;
  repoFullName: string;
  confirmToken: string;
  appUrl: string;
}

export interface ReleaseEmailData {
  email: string;
  repoFullName: string;
  tagName: string;
  releaseName: string;
  releaseUrl: string;
  unsubscribeToken: string;
  appUrl: string;
}

export interface EmailMessage<TData = ConfirmationEmailData | ReleaseEmailData> {
  type: EmailMessageType;
  data: TData;
}
