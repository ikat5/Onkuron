import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEmailEnv } from "@/lib/env";

/**
 * Email transport singleton. A pooled SMTP transporter keeps connections open
 * between messages, so it is created once per server runtime. Other providers
 * can be plugged in by implementing `MailTransport`.
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

class SmtpTransport implements MailTransport {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const env = getEmailEnv();
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
  return (globalForMail.__onkuronMailTransport ??= new SmtpTransport());
}

/** Test hook: inject a fake transport (or reset with null). */
export function setMailTransport(transport: MailTransport | null) {
  globalForMail.__onkuronMailTransport = transport ?? undefined;
}
