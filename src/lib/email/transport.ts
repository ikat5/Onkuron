import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEmailEnv, type EmailEnv } from "@/lib/env";

/**
 * Email transport singleton, created once per server runtime. Resend (HTTPS)
 * is used when RESEND_API_KEY is set, otherwise a pooled SMTP transporter that
 * keeps connections open between messages. Other providers can be plugged in
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

class ResendTransport implements MailTransport {
  constructor(private env: Extract<EmailEnv, { provider: "resend" }>) {}

  async send(mail: OutgoingMail) {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.env.EMAIL_FROM,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new MailSendError(`network: ${(err as Error).message}`, true);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string; name?: string; message?: string };
    if (!res.ok) {
      // 429 and 5xx are worth retrying; other 4xx (bad key, unverified domain, invalid address) are not.
      const transient = res.status === 429 || res.status >= 500;
      throw new MailSendError(`${body.name ?? "resend_error"}: ${body.message ?? res.statusText}`, transient, res.status);
    }
    return { messageId: body.id };
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
    globalForMail.__onkuronMailTransport = env.provider === "resend" ? new ResendTransport(env) : new SmtpTransport(env);
  }
  return globalForMail.__onkuronMailTransport;
}

/** Test hook: inject a fake transport (or reset with null). */
export function setMailTransport(transport: MailTransport | null) {
  globalForMail.__onkuronMailTransport = transport ?? undefined;
}
