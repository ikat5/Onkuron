import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEmailEnv, type EmailEnv } from "@/lib/env";

/**
 * Email transport singleton, created once per server runtime. Brevo or Resend
 * (HTTPS) is used when its API key is set, otherwise a pooled SMTP transporter
 * that keeps connections open between messages. Other providers can be plugged in
 * by implementing `MailTransport`.
 */

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Lets the recipient answer the original sender (contact form). */
  replyTo?: string;
}

export interface MailTransport {
  send(mail: OutgoingMail): Promise<{ messageId?: string }>;
}

/**
 * Provider failure. `transient` decides whether the outbox retries; `status`
 * is the HTTP status (Resend) or SMTP reply code.
 */
export class MailSendError extends Error {
  constructor(
    message: string,
    public readonly transient: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MailSendError";
  }
}

/** Splits `Name <addr@x>` into Brevo's { name, email } shape. */
function parseAddress(value: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  return m ? { ...(m[1] ? { name: m[1] } : {}), email: m[2].trim() } : { email: value.trim() };
}

/** Throws MailSendError for a failed provider response; 429 and 5xx are worth retrying. */
async function readJson(res: Response, fallbackName: string) {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const name = (body.name ?? body.code ?? fallbackName) as string;
    const transient = res.status === 429 || res.status >= 500;
    throw new MailSendError(`${name}: ${(body.message as string) ?? res.statusText}`, transient, res.status);
  }
  return body;
}

async function post(url: string, headers: Record<string, string>, payload: unknown) {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new MailSendError(`network: ${(err as Error).message}`, true);
  }
}

class BrevoTransport implements MailTransport {
  constructor(private env: Extract<EmailEnv, { provider: "brevo" }>) {}

  async send(mail: OutgoingMail) {
    const res = await post("https://api.brevo.com/v3/smtp/email", { "api-key": this.env.BREVO_API_KEY }, {
      sender: parseAddress(this.env.EMAIL_FROM),
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      ...(mail.replyTo ? { replyTo: { email: mail.replyTo } } : {}),
    });
    const body = await readJson(res, "brevo_error");
    return { messageId: body.messageId as string | undefined };
  }
}

class ResendTransport implements MailTransport {
  constructor(private env: Extract<EmailEnv, { provider: "resend" }>) {}

  async send(mail: OutgoingMail) {
    const res = await post("https://api.resend.com/emails", { Authorization: `Bearer ${this.env.RESEND_API_KEY}` }, {
      from: this.env.EMAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    });
    const body = await readJson(res, "resend_error");
    return { messageId: body.id as string | undefined };
  }
}

class SmtpTransport implements MailTransport {
  private transporter: Transporter;
  private from: string;

  constructor(env: Extract<EmailEnv, { provider: "smtp" }>) {
    this.from = env.EMAIL_FROM;
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: !env.SMTP_SECURE && env.SMTP_REQUIRE_TLS,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(mail: OutgoingMail) {
    const info = await this.transporter.sendMail({ from: this.from, ...mail });
    return { messageId: info.messageId };
  }
}

const globalForMail = globalThis as typeof globalThis & { __onkuronMailTransport?: MailTransport };

export function getMailTransport(): MailTransport {
  if (!globalForMail.__onkuronMailTransport) {
    const env = getEmailEnv();
    globalForMail.__onkuronMailTransport =
      env.provider === "brevo" ? new BrevoTransport(env) : env.provider === "resend" ? new ResendTransport(env) : new SmtpTransport(env);
  }
  return globalForMail.__onkuronMailTransport;
}

/** Test hook: inject a fake transport (or reset with null). */
export function setMailTransport(transport: MailTransport | null) {
  globalForMail.__onkuronMailTransport = transport ?? undefined;
}
