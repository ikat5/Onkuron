import { handler, json } from "@/lib/api";
import { contactSchema } from "@/lib/validation";
import { submitContactMessage } from "@/services/contact";

/** Public contact form. Rate-limited, spam-checked, and queued to the official inbox. */
export const POST = handler({ auth: "none", body: contactSchema, maxBodyBytes: 12 * 1024 }, async ({ body, ip }) => {
  return json(await submitContactMessage(body, ip), { status: 202 });
});
