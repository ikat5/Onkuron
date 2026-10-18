import "server-only";

/**
 * Transactional email templates. Table-based layout with inline styles for
 * broad client support, max-width 600px and fluid on mobile. Brand colours
 * match the Onkuron logo (blue, green, orange). All interpolated values are
 * HTML-escaped. Templates never include passwords, session tokens or secrets.
 */

const BLUE = "#0b45a0";
const GREEN = "#3b8b2e";
const ORANGE = "#f08c4a";

export interface EmailContext {
  appUrl: string;
  supportEmail?: string;
  supportPhone?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string, color = BLUE) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${color}">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function badge(label: string, color: string) {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color};color:#fff;font-size:13px;font-weight:bold">${escapeHtml(label)}</span>`;
}

function layout(ctx: EmailContext, title: string, bodyHtml: string, preheader: string) {
  const support: string[] = [];
  if (ctx.supportEmail) support.push(`Email: <a href="mailto:${escapeHtml(ctx.supportEmail)}" style="color:${BLUE}">${escapeHtml(ctx.supportEmail)}</a>`);
  if (ctx.supportPhone) support.push(`Phone: ${escapeHtml(ctx.supportPhone)}`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e8f2">
<tr><td style="height:6px;background:${BLUE};font-size:0;line-height:0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="60%" style="height:6px;background:${BLUE}"></td><td width="25%" style="height:6px;background:${GREEN}"></td><td width="15%" style="height:6px;background:${ORANGE}"></td></tr></table>
</td></tr>
<tr><td align="center" style="padding:28px 24px 8px">
<a href="${escapeHtml(ctx.appUrl)}" style="text-decoration:none"><img src="${escapeHtml(ctx.appUrl)}/brand/onkuron-logo.jpg" width="160" alt="অঙ্কুরণ Onkuron" style="display:block;width:160px;max-width:60%;height:auto;border:0;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:${BLUE}"></a>
</td></tr>
<tr><td style="padding:8px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2a44">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BLUE}">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:20px 32px;background:#f7f9fc;border-top:1px solid #e3e8f2;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5b6680">
<strong style="color:${GREEN}">Onkuron</strong> — learning that grows with you.<br>
<a href="${escapeHtml(ctx.appUrl)}" style="color:${BLUE}">${escapeHtml(ctx.appUrl.replace(/^https?:\/\//, ""))}</a>
${support.length ? `<br>${support.join(" · ")}` : ""}
<br><span style="color:#8a93a8">This is an automated message about your Onkuron account.</span>
</td></tr>
</table></td></tr></table></body></html>`;
}

function text(lines: Array<string | false | undefined>, ctx: EmailContext) {
  const support = [ctx.supportEmail && `Email: ${ctx.supportEmail}`, ctx.supportPhone && `Phone: ${ctx.supportPhone}`]
    .filter(Boolean)
    .join(" | ");
  const body = lines.filter((l): l is string => typeof l === "string");
  return [...body, "", "— Onkuron", ctx.appUrl, support].join("\n").trim();
}

const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;

export type TemplateName =
  | "verify_email"
  | "email_verified"
  | "enrollment_submitted"
  | "enrollment_approved"
  | "enrollment_rejected"
  | "password_reset"
  | "password_changed"
  | "registration_attempt"
  | "contact_message";

export type TemplateData = {
  verify_email: { name: string; link: string; expiresInHours: number };
  email_verified: { name: string };
  enrollment_submitted: { name: string; courseTitle: string; amount: number; paymentMethod: string; transactionId: string };
  enrollment_approved: { name: string; courseTitle: string; courseSlug: string };
  enrollment_rejected: { name: string; courseTitle: string; courseSlug: string; reason?: string };
  password_reset: { name: string; link: string; expiresInMinutes: number };
  password_changed: { name: string; at: string };
  registration_attempt: { name: string };
  contact_message: { name: string; email: string; subject: string; message: string; receivedAt: string };
};

const METHOD_LABEL: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };

export function renderEmail<T extends TemplateName>(template: T, data: TemplateData[T], ctx: EmailContext): RenderedEmail {
  const d = data as unknown as Record<string, string>;
  const name = escapeHtml(d.name);
  switch (template) {
    case "verify_email": {
      const title = "Verify your email address";
      return {
        subject: "Verify your Onkuron account",
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p("Welcome to Onkuron! Please confirm that this is your email address to activate your student account.") +
            button(d.link, "Verify my email", GREEN) +
            p(`This link expires in ${escapeHtml(d.expiresInHours)} hours and can be used only once.`) +
            p(`<span style="font-size:13px;color:#5b6680">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(d.link)}" style="color:${BLUE};word-break:break-all">${escapeHtml(d.link)}</a></span>`) +
            p(`<span style="font-size:13px;color:#5b6680">If you didn't create an account, you can ignore this email.</span>`),
          "Confirm your email to activate your Onkuron account",
        ),
        text: text(
          [`Hi ${d.name},`, "", "Confirm your email to activate your Onkuron account:", d.link, "", `This link expires in ${d.expiresInHours} hours and can be used once.`, "If you didn't create an account, ignore this email."],
          ctx,
        ),
      };
    }
    case "email_verified": {
      const title = "Your email is verified";
      const login = `${ctx.appUrl}/login`;
      return {
        subject: "Your Onkuron account is ready",
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) + p(`${badge("Verified", GREEN)}`) + p("Your email address has been verified. You can now sign in, browse courses and request enrollment.") + button(login, "Sign in to Onkuron"),
          "Your email address has been verified",
        ),
        text: text([`Hi ${d.name},`, "", "Your email address has been verified. You can now sign in:", login], ctx),
      };
    }
    case "enrollment_submitted": {
      const title = "Enrollment request received";
      const dash = `${ctx.appUrl}/dashboard`;
      const method = METHOD_LABEL[d.paymentMethod] ?? d.paymentMethod;
      return {
        subject: `Enrollment request received — ${d.courseTitle}`,
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p(`We received your enrollment request for <strong>${escapeHtml(d.courseTitle)}</strong>.`) +
            p(`Status: ${badge("Pending verification", ORANGE)}`) +
            `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border:1px solid #e3e8f2;border-radius:8px;font-size:15px">
<tr><td style="padding:10px 14px;color:#5b6680">Amount</td><td style="padding:10px 14px;text-align:right"><strong>৳${escapeHtml(d.amount)}</strong></td></tr>
<tr><td style="padding:10px 14px;color:#5b6680;border-top:1px solid #e3e8f2">Payment method</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #e3e8f2">${escapeHtml(method)}</td></tr>
<tr><td style="padding:10px 14px;color:#5b6680;border-top:1px solid #e3e8f2">Transaction ID</td><td style="padding:10px 14px;text-align:right;border-top:1px solid #e3e8f2;font-family:monospace">${escapeHtml(d.transactionId)}</td></tr></table>` +
            p("Your payment has <strong>not yet been verified</strong>. A teacher will manually check this transaction and you will receive another email once your enrollment is approved or rejected.") +
            button(dash, "View my dashboard"),
          `Your enrollment request for ${d.courseTitle} is pending manual verification`,
        ),
        text: text(
          [`Hi ${d.name},`, "", `We received your enrollment request for "${d.courseTitle}".`, "Status: Pending verification", `Amount: BDT ${d.amount}`, `Payment method: ${method}`, `Transaction ID: ${d.transactionId}`, "", "Your payment has not yet been verified. A teacher will manually check this transaction and email you with the decision.", dash],
          ctx,
        ),
      };
    }
    case "enrollment_approved": {
      const title = "You're enrolled!";
      const course = `${ctx.appUrl}/learn/${encodeURIComponent(d.courseSlug)}`;
      return {
        subject: `Enrollment confirmed — ${d.courseTitle}`,
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p(`Great news! Your enrollment in <strong>${escapeHtml(d.courseTitle)}</strong> has been confirmed.`) +
            p(`Status: ${badge("Approved", GREEN)}`) +
            p("Your payment was verified by our teacher and you now have full access to the course lessons, videos and materials.") +
            button(course, "Start learning", GREEN) +
            p(`You can also find all your courses on your <a href="${escapeHtml(ctx.appUrl)}/dashboard" style="color:${BLUE}">dashboard</a>.`),
          `Course access granted for ${d.courseTitle}`,
        ),
        text: text(
          [`Hi ${d.name},`, "", `Your enrollment in "${d.courseTitle}" has been confirmed and course access has been granted.`, "Start learning:", course, "", `Dashboard: ${ctx.appUrl}/dashboard`],
          ctx,
        ),
      };
    }
    case "enrollment_rejected": {
      const title = "Enrollment update";
      const courseUrl = `${ctx.appUrl}/courses/${encodeURIComponent(d.courseSlug)}`;
      return {
        subject: `Enrollment not approved — ${d.courseTitle}`,
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p(`Your enrollment request for <strong>${escapeHtml(d.courseTitle)}</strong> could not be approved.`) +
            p(`Status: ${badge("Rejected", "#c2410c")}`) +
            (d.reason ? p(`<strong>Reason:</strong> ${escapeHtml(d.reason)}`) : "") +
            p("If you believe this is a mistake, please check your transaction details and submit a new request, or message the teacher from your dashboard.") +
            button(courseUrl, "View course"),
          `Update on your enrollment request for ${d.courseTitle}`,
        ),
        text: text(
          [`Hi ${d.name},`, "", `Your enrollment request for "${d.courseTitle}" could not be approved.`, d.reason ? `Reason: ${d.reason}` : undefined, "", "You can check your transaction details and submit a new request:", courseUrl],
          ctx,
        ),
      };
    }
    case "password_reset": {
      const title = "Reset your password";
      return {
        subject: "Reset your Onkuron password",
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p("We received a request to reset your password. Click the button below to choose a new one.") +
            button(d.link, "Reset password") +
            p(`This link expires in ${escapeHtml(d.expiresInMinutes)} minutes and can be used once.`) +
            p(`<span style="font-size:13px;color:#5b6680">If you didn't request this, you can safely ignore this email — your password will not change.</span>`),
          "Reset your Onkuron password",
        ),
        text: text([`Hi ${d.name},`, "", "Reset your password using this link:", d.link, "", `It expires in ${d.expiresInMinutes} minutes. If you didn't request this, ignore this email.`], ctx),
      };
    }
    case "password_changed": {
      const title = "Your password was changed";
      return {
        subject: "Security notice: your Onkuron password was changed",
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p(`The password for your Onkuron account was changed on ${escapeHtml(d.at)}. All other signed-in sessions have been signed out.`) +
            p("If you did not make this change, reset your password immediately.") +
            button(`${ctx.appUrl}/forgot-password`, "Reset password", ORANGE),
          "Your Onkuron password was changed",
        ),
        text: text([`Hi ${d.name},`, "", `Your Onkuron password was changed on ${d.at}.`, "If you did not do this, reset it now:", `${ctx.appUrl}/forgot-password`], ctx),
      };
    }
    case "registration_attempt": {
      const title = "Someone tried to register with your email";
      return {
        subject: "Security notice: registration attempt",
        html: layout(
          ctx,
          title,
          p(`Hi ${name},`) +
            p("Someone tried to create a new Onkuron account using this email address. Since you already have an account, no new account was created.") +
            p("If this was you, just sign in. If you forgot your password, you can reset it.") +
            button(`${ctx.appUrl}/login`, "Sign in"),
          "A registration attempt was made with your email",
        ),
        text: text([`Hi ${d.name},`, "", "Someone tried to register a new Onkuron account with this email. No new account was created.", `Sign in: ${ctx.appUrl}/login`, `Forgot password: ${ctx.appUrl}/forgot-password`], ctx),
      };
    }
    case "contact_message": {
      const title = "New message from the contact form";
      const message = escapeHtml(d.message).replace(/\n/g, "<br>");
      return {
        subject: `[Contact] ${d.subject}`.slice(0, 160),
        replyTo: d.email,
        html: layout(
          ctx,
          title,
          `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border:1px solid #e3e8f2;border-radius:8px;font-size:15px">
<tr><td style="padding:10px 14px;color:#5b6680">From</td><td style="padding:10px 14px">${name}</td></tr>
<tr><td style="padding:10px 14px;color:#5b6680;border-top:1px solid #e3e8f2">Email</td><td style="padding:10px 14px;border-top:1px solid #e3e8f2">${escapeHtml(d.email)}</td></tr>
<tr><td style="padding:10px 14px;color:#5b6680;border-top:1px solid #e3e8f2">Subject</td><td style="padding:10px 14px;border-top:1px solid #e3e8f2">${escapeHtml(d.subject)}</td></tr>
<tr><td style="padding:10px 14px;color:#5b6680;border-top:1px solid #e3e8f2">Received</td><td style="padding:10px 14px;border-top:1px solid #e3e8f2">${escapeHtml(d.receivedAt)}</td></tr></table>` +
            `<div style="padding:16px;border-radius:8px;background:#f7f9fc;border:1px solid #e3e8f2">${message}</div>` +
            p(`<span style="font-size:13px;color:#5b6680">Reply to this email to answer the sender. The address was typed by the visitor and has not been verified.</span>`),
          `Contact form: ${d.subject}`,
        ),
        text: text([title, "", `From: ${d.name} <${d.email}>`, `Subject: ${d.subject}`, `Received: ${d.receivedAt}`, "", d.message, "", "The sender's address is unverified."], ctx),
      };
    }
  }
  throw new Error(`Unknown email template: ${String(template)}`);
}
