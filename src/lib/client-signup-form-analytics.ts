export type ClientSignupFormFieldId =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "password"
  | "zipCode"
  | "dateOfBirth"
  | "agreedToTerms";

export type ClientSignupFormEvent =
  | "FORM_FIELD_FOCUS"
  | "FORM_SUBMIT_ATTEMPT"
  | "FORM_SUBMIT_ERROR"
  | "FORM_SUBMIT_SUCCESS";

export function trackClientSignupFormEvent(
  event: ClientSignupFormEvent,
  detail?: { field?: ClientSignupFormFieldId; error?: string },
): void {
  if (typeof window === "undefined") return;
  window.fbq?.("trackCustom", event, {
    form: "client_sign_up",
    ...(detail?.field ? { field: detail.field } : {}),
    ...(detail?.error ? { error: detail.error.slice(0, 120) } : {}),
  });
}
