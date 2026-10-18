import "server-only";
import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import { dispatchSoon, enqueueEmail } from "@/lib/email/outbox";
import { getEmailEnv } from "@/lib/env";
import { badRequest, tooManyRequests } from "@/lib/errors";
import { hitAll, RULES } from "@/lib/security/rate-limit";
import type { ContactInput } from "@/lib/validation";

export const CONTACT_EMAIL = "info.onkuron@gmail.com";
/** Humans need a few seconds to fill the form in. */
const MIN_FILL_MS = 3000;

export function contactRecipient() {
  return process.env.CONTACT_EMAIL?.trim() || CONTACT_EMAIL;
}

/**
 * Accepts a contact-form message and queues it in the email outbox (durable,
 * retried, visible in the teacher's email log) addressed to the official
 * inbox. It only reports success once the message is stored for delivery.
 */
export async function submitContactMessage(input: ContactInput, ip: string) {
  // Spam checks: honeypot field and an implausibly fast submission.
  if (input.website || (input.elapsedMs !== undefined && input.elapsedMs < MIN_FILL_MS)) {
    await audit({ action: "contact.rejected_spam", ip });
    throw badRequest("Your message couldn't be sent. Please wait a moment and try again.");
  }
  const rl = await hitAll([
    [RULES.contactIp, ip],
    [RULES.contactEmail, input.email],
  ]);
  if (!rl.allowed) throw tooManyRequests(rl.retryAfterSeconds);

  getEmailEnv(); // ConfigError (503) when email isn't set up — never claim success then.
  const { id } = await enqueueEmail({
    idempotencyKey: `contact:${randomUUID()}`,
    template: "contact_message",
    to: contactRecipient(),
    data: {
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      receivedAt: new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }),
    },
  });
  await audit({ action: "contact.submitted", ip, metadata: { outboxId: String(id) } });
  dispatchSoon([id]);
  return { queued: true };
}
