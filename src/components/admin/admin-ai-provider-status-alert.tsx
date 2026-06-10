"use client";

import { AdminPortalAlert } from "@/components/admin/admin-portal-ui";
import type { AdminAiProviderStatus } from "@/lib/admin-analytics-ai";
import {
  OUTREACH_HQ_ANTHROPIC_WEB_SEARCH,
  OUTREACH_HQ_OPENAI_FALLBACK,
  adminAiNotConfiguredMessage,
} from "@/lib/admin-ai-copy";

export type AdminAiStatusAlertContext = "outreach" | "assistant" | "content-calendar";

export function AdminAiProviderStatusAlert(props: {
  status: AdminAiProviderStatus;
  context: AdminAiStatusAlertContext;
}) {
  const { status, context } = props;

  if (!status.configured) {
    return (
      <AdminPortalAlert variant="info">
        {context === "outreach"
          ? `${status.message} ${adminAiNotConfiguredMessage()}`
          : status.message || adminAiNotConfiguredMessage()}
      </AdminPortalAlert>
    );
  }

  if (context === "outreach" && status.provider === "openai") {
    return <AdminPortalAlert variant="info">{OUTREACH_HQ_OPENAI_FALLBACK}</AdminPortalAlert>;
  }

  if (context === "outreach" && status.provider === "anthropic" && status.working) {
    return (
      <AdminPortalAlert variant="info">
        {status.message} {OUTREACH_HQ_ANTHROPIC_WEB_SEARCH}
      </AdminPortalAlert>
    );
  }

  if (context === "outreach" && status.provider === "anthropic") {
    return <AdminPortalAlert variant="info">{status.message}</AdminPortalAlert>;
  }

  if (context === "assistant" || context === "content-calendar") {
    if (status.working) {
      return (
        <AdminPortalAlert variant="info">
          {status.message}
          {context === "assistant" ? " Full AI chat is available." : " Text generation is available."}
        </AdminPortalAlert>
      );
    }
    return <AdminPortalAlert variant="info">{status.message}</AdminPortalAlert>;
  }

  return null;
}
