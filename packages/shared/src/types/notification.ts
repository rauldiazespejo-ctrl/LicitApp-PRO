export enum NotificationType {
  NEW_TENDER = 'NEW_TENDER',
  TENDER_UPDATED = 'TENDER_UPDATED',
  TENDER_CLOSING_SOON = 'TENDER_CLOSING_SOON',
  TENDER_CLOSED = 'TENDER_CLOSED',
  SYNC_ERROR = 'SYNC_ERROR',
  ALERT_TRIGGERED = 'ALERT_TRIGGERED',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  WEBHOOK = 'WEBHOOK',
  IN_APP = 'IN_APP',
}

export interface Notification {
  id: string;
  userId: string;
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt?: Date;
  sentAt?: Date;
  createdAt: Date;
}
