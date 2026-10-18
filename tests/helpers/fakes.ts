import type { MailTransport, OutgoingMail } from "@/lib/email/transport";

/** In-memory mail transport: records messages and can simulate failures. */
class FakeMail implements MailTransport {
  sent: OutgoingMail[] = [];
  private failures: Array<Error & { responseCode?: number; code?: string }> = [];

  reset() {
    this.sent = [];
    this.failures = [];
  }

  /** The next `n` sends fail with a transient (4xx/network) or permanent (5xx) error. */
  failNext(n = 1, permanent = false) {
    for (let i = 0; i < n; i++) {
      const err = Object.assign(new Error(permanent ? "550 mailbox unavailable" : "connect ETIMEDOUT"), {
        code: permanent ? "EENVELOPE" : "ETIMEDOUT",
        responseCode: permanent ? 550 : undefined,
      });
      this.failures.push(err);
    }
  }

  async send(mail: OutgoingMail) {
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.sent.push(mail);
    return { messageId: `<fake-${this.sent.length}@test>` };
  }

  to(address: string) {
    return this.sent.filter((m) => m.to === address);
  }
}

export const fakeMail = new FakeMail();

export function extractLink(mail: OutgoingMail, path: string): string {
  const m = new RegExp(`http://localhost:3000${path}\\?token=([A-Za-z0-9_%-]+)`).exec(mail.text);
  if (!m) throw new Error(`No ${path} link in email`);
  return decodeURIComponent(m[1]);
}
