export type SupportInboxProvider = "outlook" | "unconfigured";

export type SupportInboxAuthMode = "application" | "delegated";

export type SupportInboxConnectionStatus = {
  configured: boolean;
  mailbox: string;
  provider: SupportInboxProvider;
  mode: SupportInboxAuthMode | null;
};

export type SupportInboxMessageSummary = {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedAt: string;
  isRead: boolean;
  preview: string;
  hasAttachments: boolean;
};

export type SupportInboxMessageDetail = SupportInboxMessageSummary & {
  to: string[];
  cc: string[];
  bodyHtml: string | null;
  bodyText: string | null;
  conversationId: string | null;
};
