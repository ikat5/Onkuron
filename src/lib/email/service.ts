import "server-only";
import { getAppUrl, getEmailEnv, ConfigError } from "@/lib/env";
import { logger, redactString } from "@/lib/logger";
import { Setting } from "@/models/Setting";
import { getMailTransport, MailSendError } from "./transport";
import { renderEmail, type EmailContext, type TemplateData, type TemplateName } from "./templates";

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly transient: boolean,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export async function emailContext(): Promise<EmailContext> {
  const settings = await Setting.findOne({ key: "platform" }).select("supportEmail supportPhone").lean();
  return {
    appUrl: getAppUrl(),
    supportEmail: settings?.supportEmail || undefined,
    supportPhone: settings?.supportPhone || undefined,
  };
}

/** True when Resend or SMTP settings are present. Does not prove the provider accepts them. */
export function isEmailConfigured(): boolean {
  try {
    getEmailEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders and hands a message to the provider (Resend or SMTP). "Accepted by
 * the provider" is the strongest guarantee available here — it does not prove
 * inbox delivery. Throws ConfigError when email is not configured and
 * EmailDeliveryError with a redacted message for provider failures.
 */
export async function sendEmailNow<T extends TemplateName>(template: T, to: string, data: TemplateData[T]) {
  getEmailEnv(); // throws ConfigError when email is not configured
  const rendered = renderEmail(template, data, await emailContext());
  try {
    const result = await getMailTransport().send({ to, ...rendered });
    logger.info("email.accepted", { template, messageId: result.messageId });
    return result;
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    if (err instanceof MailSendError) {
      const summary = redactString(`${err.status ?? "ERROR"}: ${err.message}`).slice(0, 300);
      logger.warn("email.send_failed", { template, summary, transient: err.transient });
      throw new EmailDeliveryError(summary, err.transient);
    }
    const e = err as { code?: string; responseCode?: number; message?: string };
    // 5xx SMTP replies are permanent (bad recipient, auth rejected); everything else is retried.
    const transient = !(typeof e.responseCode === "number" && e.responseCode >= 500 && e.responseCode < 600);
    const summary = redactString(`${e.code ?? "ERROR"}${e.responseCode ? ` ${e.responseCode}` : ""}: ${e.message ?? "send failed"}`).slice(0, 300);
    logger.warn("email.send_failed", { template, summary, transient });
    throw new EmailDeliveryError(summary, transient);
  }
}
