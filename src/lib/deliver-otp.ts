/**
 * Sends one-time codes for 2FA. Match Fit only uses external providers when you
 * configure the related environment variables; otherwise codes are logged server-side
 * in development so nothing is shared with third parties without your integration.
 */

export type OtpChannel = "EMAIL" | "SMS" | "VOICE";

export async function deliverSignupOtp(
  channel: OtpChannel,
  params: { email: string; phone: string; code: string },
): Promise<void> {
  const { email, phone, code } = params;

  if (channel === "EMAIL") {
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
          subject: "Your Match Fit verification code",
          text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Email delivery failed: ${t}`);
      }
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.info(`[Match Fit 2FA][EMAIL] to ${email}: ${code}`);
      return;
    }
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send email codes in production.");
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNum = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && fromNum) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      To: phone,
      From: fromNum,
      Body: channel === "SMS" ? `Match Fit code: ${code}` : `Your Match Fit code is ${code}.`,
    });
    const url =
      channel === "SMS"
        ? `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
        : `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        channel === "SMS"
          ? body
          : new URLSearchParams({
              To: phone,
              From: fromNum,
              Twiml: `<Response><Say>Your Match Fit code is ${code.split("").join(" ")}</Say></Response>`,
            }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Phone delivery failed: ${t}`);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.info(`[Match Fit 2FA][${channel}] to ${phone}: ${code}`);
    return;
  }

  throw new Error(
    "Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to send SMS or voice codes in production.",
  );
}
