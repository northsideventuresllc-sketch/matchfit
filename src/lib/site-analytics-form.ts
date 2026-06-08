"use client";

import type { FocusEventHandler } from "react";
import { sendEvent } from "@/components/site-analytics-tracker";
import type { SiteAnalyticsKind } from "@/lib/site-analytics-shared";

export type FormAnalyticsContext = {
  path: string;
  formId: string;
};

async function trackFormEvent(
  kind: SiteAnalyticsKind,
  ctx: FormAnalyticsContext,
  linkLabel?: string | null,
): Promise<void> {
  await sendEvent({
    kind,
    path: ctx.path,
    linkLabel: linkLabel ?? ctx.formId,
  });
}

export function trackFormFieldFocus(ctx: FormAnalyticsContext, fieldName: string): void {
  void trackFormEvent("FORM_FIELD_FOCUS", ctx, fieldName);
}

export function trackFormSubmitAttempt(ctx: FormAnalyticsContext): void {
  void trackFormEvent("FORM_SUBMIT_ATTEMPT", ctx);
}

export function trackFormSubmitError(ctx: FormAnalyticsContext, errorCode: string): void {
  void trackFormEvent("FORM_SUBMIT_ERROR", ctx, errorCode.slice(0, 200));
}

export function trackFormSubmitSuccess(ctx: FormAnalyticsContext): void {
  void trackFormEvent("FORM_SUBMIT_SUCCESS", ctx);
}

export function bindFormFieldFocus(
  ctx: FormAnalyticsContext,
  fieldName: string,
): FocusEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  return () => trackFormFieldFocus(ctx, fieldName);
}
