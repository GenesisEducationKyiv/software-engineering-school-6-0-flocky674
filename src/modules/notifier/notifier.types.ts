export interface ConfirmationPayload {
  email: string;
  repoFullName: string;
  confirmToken: string;
}

export interface NotificationPayload {
  email: string;
  repoFullName: string;
  tagName: string;
  releaseName: string;
  releaseUrl: string;
  unsubscribeToken: string;
}

export interface NotifierPort {
  sendConfirmationEmail(payload: ConfirmationPayload): Promise<void>;
  sendReleaseNotification(payload: NotificationPayload): Promise<void>;
}
