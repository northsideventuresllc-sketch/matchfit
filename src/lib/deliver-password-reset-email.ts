/**
 * Sends a password reset link. Uses Resend when configured; otherwise logs in development.
 */
export async function deliverPasswordResetEmail(params: { email: string; resetUrl: string }): Promise<void> {
  const { email, resetUrl } = params;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Reset your Match Fit password",
        text: `We received a request to change the password for your Match Fit account.\n\nOpen this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Email delivery failed: ${t}`);
    }
    return;
  }
  if (process.env.NODE_ENV === "development") {
    console.info(`[Match Fit][password reset] to ${email}: ${resetUrl}`);
    return;
  }
  throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send password reset email in production.");
}
