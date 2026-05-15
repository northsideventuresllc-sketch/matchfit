/**
 * Transactional email bodies. Use {@link wrapMatchFitTransactionalHtml}: orange
 * {@link matchFitEmailHeroKickerHtml}, white hero title always ALL CAPS via
 * {@link escapeHtmlEmailHeroTitle}. Subject lines are human-written;
 * {@link formatTransactionalEmailSubject} only trims and collapses whitespace.
 */
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { MF_EMAIL_SITE } from "@/lib/match-fit-email-brand";
import { escapeHtmlEmail, formatTransactionalEmailSubject, wrapMatchFitTransactionalHtml } from "@/lib/match-fit-email-shell";

function appBaseUrlForEmailSample(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return u || "https://match-fit.net";
}

function c(s: string | undefined, fallback: string): string {
  const t = s?.trim();
  return t && t.length > 0 ? t : fallback;
}

function bodyParagraphs(htmlLines: string[]): string {
  const s = MF_EMAIL_SITE;
  return htmlLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:480px;margin-left:auto;margin-right:auto;">${line}</p>`,
    )
    .join("");
}

function finalizeTransactional(subject: string, text: string, html: string): { subject: string; text: string; html: string } {
  return {
    subject: formatTransactionalEmailSubject(subject),
    text,
    html,
  };
}

export function buildTransactionalEmail(
  kind: TransactionalEmailKind,
  ctx: Record<string, string>,
): { subject: string; text: string; html: string } {
  const s = MF_EMAIL_SITE;
  const code = c(ctx.code, "123456");
  const resetUrl = c(ctx.resetUrl, "https://match-fit.net/client/reset-password?token=sample");
  const confirmUrl = c(ctx.confirmUrl, "https://match-fit.net/client/settings/confirm-email-change?token=sample");
  const newEmail = c(ctx.newEmail, "new.address@example.com");
  const dashboardUrl = c(ctx.dashboardUrl, "https://match-fit.net/client");
  const trainerDashboardUrl = c(ctx.trainerDashboardUrl, "https://match-fit.net/trainer/dashboard");
  const firstName = c(ctx.firstName, "Alex");
  const amount = c(ctx.amount, "$49.00");
  const itemLabel = c(ctx.itemLabel, "10-session coaching package");
  const trainerUsername = c(ctx.trainerUsername, "coachjordan");
  const clientUsername = c(ctx.clientUsername, "clientalex");
  const payoutAmount = c(ctx.payoutAmount, "$320.00");
  const periodLabel = c(ctx.periodLabel, "May 1–15, 2026");
  const statusLine = c(ctx.statusLine, "Your subscription is active.");
  const detailLine = c(ctx.detailLine, "Renewal date: June 1, 2026");
  const violationSummary = c(ctx.violationSummary, "Activity suggesting off-platform payment was detected.");
  const reportId = c(ctx.reportId, "BR-20481");
  const moderationSummary = c(ctx.moderationSummary, "A post on your account was flagged for review.");
  const inquiryNote = c(ctx.inquiryNote, "A client tapped “Interested” on your profile.");
  const adminName = c(ctx.adminName, "Jamie Rivera");
  const certName = c(ctx.certName, "NASM CPT");
  const expiryDate = c(ctx.expiryDate, "2026-08-01");
  const bgStatus = c(ctx.bgStatus, "CLEAR");
  const ipLine = c(ctx.ipLine, "Near Atlanta, GA (IP anonymized)");
  const deviceLine = c(ctx.deviceLine, "Chrome on Windows");
  const loginTime = c(ctx.loginTime, new Date().toISOString());
  const policyName = c(ctx.policyName, "Terms of Service");

  switch (kind) {
    case "CLIENT_WELCOME": {
      const subject = "Welcome to Match Fit";
      const text = `Hi ${firstName},\n\nThanks for joining Match Fit. Open your dashboard to find coaches and manage your training:\n${dashboardUrl}\n\n— Match Fit`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Your Match Fit account is ready.",
        title: "Welcome aboard",
        bodyHtml: bodyParagraphs([
          `Hi <strong style="color:${s.textPrimary};">${escapeHtmlEmail(firstName)}</strong> — thanks for joining Match Fit.`,
          "Discover coaches, book sessions, and keep everything in one place.",
        ]),
        ctaHref: dashboardUrl,
        ctaLabel: "Open dashboard",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "TRAINER_WELCOME": {
      const subject = "Welcome to Match Fit — coach account";
      const text = `Hi ${firstName},\n\nYour trainer account is live. Finish onboarding tasks in the dashboard, then start connecting with clients.\n${trainerDashboardUrl}\n\n— Match Fit`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Your coach workspace is ready.",
        title: "Welcome, coach",
        bodyHtml: bodyParagraphs([
          `Hi <strong style="color:${s.textPrimary};">${escapeHtmlEmail(firstName)}</strong> — your Match Fit trainer profile is set up.`,
          "Complete compliance steps in the dashboard when prompted, then turn on discovery so clients can find you.",
        ]),
        ctaHref: trainerDashboardUrl,
        ctaLabel: "Trainer dashboard",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "OTP_2FA": {
      const subject = "Your Match Fit verification code";
      const text = `Your verification code is: ${code}\n\nIt expires in 10 minutes. If you did not try to sign in, ignore this email.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: `Your code is ${code}.`,
        title: "Verification code",
        bodyHtml: `${bodyParagraphs([`Enter this code to continue signing in to Match Fit:`])}<p style="margin:8px 0 20px;font-family:ui-monospace,monospace;font-size:28px;font-weight:800;letter-spacing:0.25em;color:${s.gold};text-align:center;">${escapeHtmlEmail(code)}</p>${bodyParagraphs(["Expires in 10 minutes. If this was not you, secure your password in settings."])}`,
      });
      return finalizeTransactional(subject, text, html);
    }
    case "PASSWORD_RESET": {
      const subject = "Reset your Match Fit password";
      const text = `We received a request to reset the password for your Match Fit account.\n\nOpen this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Password reset requested.",
        title: "Reset your password",
        bodyHtml: bodyParagraphs([
          "We received a request to reset the password on your Match Fit account.",
          "The button below expires in about an hour. If you did not request this, you can ignore this message.",
        ]),
        ctaHref: resetUrl,
        ctaLabel: "Reset password",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "EMAIL_CHANGE_CONFIRM": {
      const subject = "Confirm your new Match Fit email";
      const text = `Confirm this email address for your Match Fit account:\n${confirmUrl}\n\nLink expires in 1 hour. If you did not request this, ignore this email.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Confirm your new email address.",
        title: "Confirm new email",
        bodyHtml: bodyParagraphs(["Tap the button to verify this inbox for your Match Fit account."]),
        ctaHref: confirmUrl,
        ctaLabel: "Confirm email",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "EMAIL_CHANGE_SECURITY": {
      const subject = "Match Fit email change started";
      const text = `Someone started changing the email on your Match Fit account to ${newEmail}.\n\nIf this was you, confirm the new inbox from the message sent there.\n\nIf not you, reset your password and contact support.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "An email change was requested on your account.",
        title: "Email change requested",
        bodyHtml: bodyParagraphs([
          `Someone started using <strong style="color:${s.textPrimary};">${escapeHtmlEmail(newEmail)}</strong> as the new email on your Match Fit account.`,
          "If this was you, confirm that inbox from the separate message we sent there. If not, change your password immediately.",
        ]),
      });
      return finalizeTransactional(subject, text, html);
    }
    case "LOGIN_SECURITY_ALERT": {
      const subject = "New sign-in to your Match Fit account";
      const text = `We noticed a new sign-in to Match Fit.\n\nWhen: ${loginTime}\n${deviceLine}\n${ipLine}\n\nIf this was you, you can ignore this message. If not, reset your password.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "New activity on your account.",
        title: "New sign-in",
        bodyHtml: bodyParagraphs([
          `Time: <strong style="color:${s.textPrimary};">${escapeHtmlEmail(loginTime)}</strong>`,
          `${escapeHtmlEmail(deviceLine)} · ${escapeHtmlEmail(ipLine)}`,
          "If this was not you, reset your password from Account settings.",
        ]),
      });
      return finalizeTransactional(subject, text, html);
    }
    case "W9_TAX_VERIFICATION": {
      const subject = "Your Match Fit W-9 on file";
      const text = `Your W-9 tax information was emailed as requested.\n\nIf you did not request this copy, change your password and contact support.\n\n${c(ctx.w9Summary, "Summary: see HTML version.")}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "W-9 copy from Match Fit.",
        title: "W-9 information",
        bodyHtml: bodyParagraphs([
          "Below is the tax information you asked us to send from your Match Fit coach account.",
          escapeHtmlEmail(c(ctx.w9Summary, "Legal name and TIN on file — see your dashboard for full details.")),
        ]),
      });
      return finalizeTransactional(subject, text, html);
    }
    case "CERTIFICATION_RENEWAL_REMINDER": {
      const subject = `Renew your ${certName} on Match Fit`;
      const text = `Your ${certName} credential on Match Fit should be renewed before ${expiryDate}.\n\nUpload an updated document from Trainer settings → Compliance.\n${trainerDashboardUrl}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Credential renewal reminder.",
        title: "Certification renewal",
        bodyHtml: bodyParagraphs([
          `Your <strong style="color:${s.textPrimary};">${escapeHtmlEmail(certName)}</strong> listing should be refreshed before <strong style="color:${s.textPrimary};">${escapeHtmlEmail(expiryDate)}</strong>.`,
          "Upload an updated certificate from your trainer dashboard so clients keep full confidence in your profile.",
        ]),
        ctaHref: trainerDashboardUrl,
        ctaLabel: "Open compliance",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "BACKGROUND_CHECK_UPDATE": {
      const subject = "Background check update — Match Fit";
      const text = `Your background check status on Match Fit is now: ${bgStatus}.\n\nOpen your dashboard for details.`;
      const dash = c(ctx.dashboardUrl, trainerDashboardUrl);
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Background check status changed.",
        title: "Background check",
        bodyHtml: bodyParagraphs([
          `Your screening status is now <strong style="color:${s.textPrimary};">${escapeHtmlEmail(bgStatus)}</strong>.`,
          "Open Match Fit for any required follow-up steps.",
        ]),
        ctaHref: dash,
        ctaLabel: "View dashboard",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "ADMIN_REGISTRATION_REQUEST": {
      const subject = `[Match Fit] Administrator approval — ${adminName}`;
      const approveUrl = c(ctx.approveUrl, "https://match-fit.net/api/admin/pending-decision?token=sample");
      const denyUrl = c(ctx.denyUrl, "https://match-fit.net/api/admin/pending-decision?token=sampledeny");
      const adminNotes = c(ctx.adminNotes, "");
      const text = [
        "A new Match Fit administrator request was submitted.",
        "",
        `Name: ${adminName}`,
        `Email: ${c(ctx.adminEmail, "admin@example.com")}`,
        adminNotes ? `Notes: ${adminNotes}` : null,
        "",
        `Approve: ${approveUrl}`,
        `Deny: ${denyUrl}`,
      ]
        .filter(Boolean)
        .join("\n");
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Administrator onboarding needs review.",
        title: "Admin registration",
        bodyHtml: `${bodyParagraphs([
          `Applicant: <strong style="color:${s.textPrimary};">${escapeHtmlEmail(adminName)}</strong> (${escapeHtmlEmail(c(ctx.adminEmail, "admin@example.com"))})`,
          ...(adminNotes ? [escapeHtmlEmail(adminNotes)] : []),
        ])}<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto 0;"><tr><td style="padding:0 8px;"><a href="${escapeHtmlEmail(approveUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.orange};color:${s.bg};font-weight:800;text-decoration:none;font-size:13px;">Approve</a></td><td style="padding:0 8px;"><a href="${escapeHtmlEmail(denyUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${s.red};color:#fff;font-weight:800;text-decoration:none;font-size:13px;">Deny</a></td></tr></table>`,
      });
      return finalizeTransactional(subject, text, html);
    }
    case "PURCHASE_CONFIRMATION": {
      const subject = "Purchase confirmation — Match Fit";
      const text = `Thanks for your purchase on Match Fit.\n\n${itemLabel}\nAmount: ${amount}\nCoach: @${trainerUsername}\n\nReference: ${c(ctx.referenceId, "tx_sample")}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Your payment went through.",
        title: "Purchase confirmed",
        bodyHtml: bodyParagraphs([
          `You bought <strong style="color:${s.textPrimary};">${escapeHtmlEmail(itemLabel)}</strong> with @${escapeHtmlEmail(trainerUsername)}.`,
          `Amount: <strong style="color:${s.textPrimary};">${escapeHtmlEmail(amount)}</strong>`,
        ]),
        ctaHref: dashboardUrl,
        ctaLabel: "View billing",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "COACH_PACKAGE_SALE": {
      const subject = "New package sale — Match Fit";
      const text = `A client purchased a package from you on Match Fit.\n\nClient: @${clientUsername}\n${itemLabel}\nCoach service amount (before processing fees): ${amount}\n`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "You have a new paid package.",
        title: "New client sale",
        bodyHtml: bodyParagraphs([
          `@${escapeHtmlEmail(clientUsername)} purchased <strong style="color:${s.textPrimary};">${escapeHtmlEmail(itemLabel)}</strong>.`,
          `Package amount (before card processing fees): <strong style="color:${s.textPrimary};">${escapeHtmlEmail(amount)}</strong>`,
        ]),
        ctaHref: trainerDashboardUrl,
        ctaLabel: "Open messages",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "TRAINER_PAYOUT": {
      const subject = "Payout processed — Match Fit";
      const text = `A payout of ${payoutAmount} was initiated for ${periodLabel}.\n\nFunds timing depends on your bank. See Earnings in the trainer dashboard.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Payout on the way.",
        title: "Payout sent",
        bodyHtml: bodyParagraphs([
          `We initiated <strong style="color:${s.textPrimary};">${escapeHtmlEmail(payoutAmount)}</strong> for <strong style="color:${s.textPrimary};">${escapeHtmlEmail(periodLabel)}</strong>.`,
          "Settlement timing depends on your bank and payout method.",
        ]),
        ctaHref: trainerDashboardUrl,
        ctaLabel: "View earnings",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "SUBSCRIPTION_MANAGEMENT_UPDATE": {
      const subject = "Subscription update — Match Fit";
      const text = `Your Match Fit membership changed.\n\n${statusLine}\n${detailLine}\n${dashboardUrl}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Your subscription changed.",
        title: "Subscription update",
        bodyHtml: bodyParagraphs([
          escapeHtmlEmail(statusLine),
          escapeHtmlEmail(detailLine),
        ]),
        ctaHref: dashboardUrl,
        ctaLabel: "Manage plan",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "OFF_PLATFORM_VIOLATION_NOTICE": {
      const subject = "Important notice — Match Fit policies";
      const text = `We need to share an update about your Match Fit account.\n\n${violationSummary}\n\nReply to this thread or open the app for next steps.`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Policy reminder from Match Fit.",
        title: "Policy notice",
        bodyHtml: bodyParagraphs([escapeHtmlEmail(violationSummary), "Off-platform payments violate Match Fit policies and can affect account standing."]),
      });
      return finalizeTransactional(subject, text, html);
    }
    case "BUG_REPORT_ACKNOWLEDGMENT": {
      const subject = "We received your bug report";
      const text = `Thanks for the report (ref ${reportId}). Our team will review it and follow up if we need more detail.\n\n— Match Fit Support`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Bug report logged.",
        title: "Thanks for the report",
        bodyHtml: bodyParagraphs([
          `Reference <strong style="color:${s.textPrimary};">${escapeHtmlEmail(reportId)}</strong> — we logged your feedback.`,
          "If we need more detail we will reply from this thread.",
        ]),
      });
      return finalizeTransactional(subject, text, html);
    }
    case "NEW_CLIENT_INQUIRY": {
      const interestsUrl = c(ctx.interestsUrl, `${trainerDashboardUrl.replace(/\/$/, "")}/interests`);
      const subject = "New client interest — Match Fit";
      const text = `${inquiryNote}\n\nClient: @${clientUsername}\nRespond from Profile interests in your trainer dashboard.\n${interestsUrl}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "A client is interested in training with you.",
        title: "New client inquiry",
        bodyHtml: bodyParagraphs([
          escapeHtmlEmail(inquiryNote),
          `Client: <strong style="color:${s.textPrimary};">@${escapeHtmlEmail(clientUsername)}</strong>`,
        ]),
        ctaHref: interestsUrl,
        ctaLabel: "Review inquiry",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "CONTENT_MODERATION_NOTICE": {
      const subject = "Content review — Match Fit";
      const text = `${moderationSummary}\n\nOpen Match Fit to review any required actions.\n${trainerDashboardUrl}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Your content needs attention.",
        title: "Moderation update",
        bodyHtml: bodyParagraphs([escapeHtmlEmail(moderationSummary)]),
        ctaHref: trainerDashboardUrl,
        ctaLabel: "Open dashboard",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "PAYMENT_FAILED": {
      const subject = "Payment issue — Match Fit";
      const text = `We could not process a recent Match Fit payment.\n\n${detailLine}\n\nUpdate your payment method in billing settings:\n${dashboardUrl}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Action needed on your account.",
        title: "Payment failed",
        bodyHtml: bodyParagraphs([
          escapeHtmlEmail(detailLine),
          "Update your card or billing details so your membership stays active.",
        ]),
        ctaHref: dashboardUrl,
        ctaLabel: "Update billing",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "BOOKING_SESSION_CONFIRMED": {
      const coachName = c(ctx.coachName, "Jordan Lee");
      const startLabel = c(ctx.startLabel, "Thu, May 15, 3:00 PM");
      const sessionDelivery = (c(ctx.sessionDelivery, "VIRTUAL").trim().toUpperCase() === "IN_PERSON" ? "IN_PERSON" : "VIRTUAL") as
        | "IN_PERSON"
        | "VIRTUAL";
      const videoPlatform = c(ctx.videoPlatform, "Google Meet").trim();
      const joinUrl = (typeof ctx.joinUrl === "string" ? ctx.joinUrl : "").trim();
      const messagesThreadUrl = c(
        ctx.messagesThreadUrl,
        `${appBaseUrlForEmailSample()}/client/dashboard/messages/coachjordan`,
      );

      const subject = "Your session is confirmed — Match Fit";
      const textLines = [
        `Hi ${firstName},`,
        "",
        `You confirmed a session with ${coachName} starting ${startLabel}.`,
        sessionDelivery === "VIRTUAL" ? "Session type: Virtual meeting." : "Session type: In person.",
      ];
      if (sessionDelivery === "VIRTUAL") {
        if (joinUrl) {
          textLines.push(videoPlatform ? `Video platform: ${videoPlatform}.` : "Video link:");
          textLines.push(`Join: ${joinUrl}`);
        } else {
          textLines.push(
            "A Google Meet, Zoom, or Microsoft Teams link may still be added in your Match Fit messages before the session.",
          );
        }
      } else {
        textLines.push("Coordinate location details with your coach in Match Fit messages if needed.");
      }
      textLines.push("", `Messages (this coach):`, messagesThreadUrl, "", "— Match Fit");
      const text = textLines.join("\n");

      const introParas = [
        `Hi <strong style="color:${s.textPrimary};">${escapeHtmlEmail(firstName)}</strong> — you confirmed a session with <strong style="color:${s.textPrimary};">${escapeHtmlEmail(
          coachName,
        )}</strong> starting <strong style="color:${s.textPrimary};">${escapeHtmlEmail(startLabel)}</strong>.`,
        sessionDelivery === "VIRTUAL"
          ? "Session type: <strong style=\"color:#7dd3fc;\">Virtual meeting</strong>."
          : "Session type: <strong style=\"color:#86efac;\">In person</strong>.",
      ];
      let extraHtml = "";
      if (sessionDelivery === "VIRTUAL") {
        if (joinUrl) {
          introParas.push(videoPlatform ? `Video platform: <strong style="color:${s.textPrimary};">${escapeHtmlEmail(videoPlatform)}</strong>.` : "");
          extraHtml = `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${s.textMuted};text-align:center;max-width:520px;margin-left:auto;margin-right:auto;">Join link:<br /><a href="${escapeHtmlEmail(joinUrl)}" style="color:${s.gold};word-break:break-all;font-weight:700;">${escapeHtmlEmail(joinUrl)}</a></p>`;
        } else {
          introParas.push(
            "If you do not see a link below yet, your coach can attach Google Meet, Zoom, or Microsoft Teams from your Match Fit messages before the session.",
          );
        }
      } else {
        introParas.push("Use Messages to coordinate the meeting location with your coach.");
      }
      const html = wrapMatchFitTransactionalHtml({
        preheader: `Confirmed with ${coachName}.`,
        title: "Session confirmed",
        bodyHtml: bodyParagraphs(introParas.filter(Boolean)) + extraHtml,
        ctaHref: messagesThreadUrl,
        ctaLabel: "Open Messages",
      });
      return finalizeTransactional(subject, text, html);
    }
    case "POLICY_UPDATE": {
      const subject = `Policy update: ${policyName}`;
      const text = `Match Fit posted an update to ${policyName}.\n\nReview it here: ${c(ctx.policyUrl, "https://match-fit.net/terms")}`;
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Please review the updated policy.",
        title: "Policy update",
        bodyHtml: bodyParagraphs([
          `We updated <strong style="color:${s.textPrimary};">${escapeHtmlEmail(policyName)}</strong>.`,
          "Continued use of Match Fit after the effective date means you accept the revised terms.",
        ]),
        ctaHref: c(ctx.policyUrl, "https://match-fit.net/terms"),
        ctaLabel: "Read policy",
      });
      return finalizeTransactional(subject, text, html);
    }
    default: {
      const subject = "Match Fit notification";
      const text = "You have a new notification from Match Fit.";
      const html = wrapMatchFitTransactionalHtml({
        preheader: "Match Fit",
        title: "Notification",
        bodyHtml: bodyParagraphs(["You have a new notification from Match Fit."]),
      });
      return finalizeTransactional(subject, text, html);
    }
  }
}

/** Sample context for internal preview sends (one per kind). */
export function sampleContextForTransactionalEmail(kind: TransactionalEmailKind): Record<string, string> {
  void kind;
  const base = {
    firstName: "Alex",
    code: "482913",
    resetUrl: `${appBaseUrlForEmailSample()}/client/reset-password?token=sample`,
    confirmUrl: `${appBaseUrlForEmailSample()}/client/settings/confirm-email-change?token=sample`,
    newEmail: "new.address@example.com",
    dashboardUrl: `${appBaseUrlForEmailSample()}/client`,
    trainerDashboardUrl: `${appBaseUrlForEmailSample()}/trainer/dashboard`,
    trainerUsername: "coachjordan",
    clientUsername: "clientalex",
    amount: "$120.00",
    itemLabel: "8-session strength package",
    payoutAmount: "$640.00",
    periodLabel: "May 1–15, 2026",
    statusLine: "Your Match Fit membership is active.",
    detailLine: "Next renewal: June 1, 2026",
    violationSummary:
      "We observed messaging that may reference taking payments outside Match Fit. Please keep purchases on-platform.",
    reportId: "BR-20481",
    moderationSummary: "A FitHub post was flagged. No action is required if the content follows community guidelines.",
    inquiryNote: "A client expressed interest in working with you from Find Coaches.",
    adminName: "Jamie Rivera",
    adminEmail: "jamie@example.com",
    adminNotes: "DOB 1990-01-01 · Proposed admin code: AB12CD34",
    approveUrl: `${appBaseUrlForEmailSample()}/api/admin/pending-decision?token=sample-approve`,
    denyUrl: `${appBaseUrlForEmailSample()}/api/admin/pending-decision?token=sample-deny`,
    certName: "NASM CPT",
    expiryDate: "2026-08-01",
    bgStatus: "CLEAR",
    ipLine: "Near Atlanta, GA",
    deviceLine: "Chrome on macOS",
    loginTime: new Date().toISOString(),
    policyName: "Terms of Service",
    policyUrl: `${appBaseUrlForEmailSample()}/terms`,
    referenceId: "svc_tx_sample",
    w9Summary: "Legal name: Alex Coach · TIN on file · Address on file (see dashboard for full W-9).",
    interestsUrl: `${appBaseUrlForEmailSample()}/trainer/dashboard/interests`,
    coachName: "Jordan Lee",
    startLabel: "Thu, May 15, 2026, 3:00 PM",
    sessionDelivery: "VIRTUAL",
    videoPlatform: "Google Meet",
    joinUrl: "https://meet.google.com/lookup/sample-link",
    messagesThreadUrl: `${appBaseUrlForEmailSample()}/client/dashboard/messages/coachjordan`,
  };
  return base;
}
