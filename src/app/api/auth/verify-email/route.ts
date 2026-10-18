import { handler, json } from "@/lib/api";
import { tokenSchema } from "@/lib/validation";
import { verifyEmail } from "@/services/auth";

// POST only: opening the emailed link (GET) never consumes the token, so
// link scanners and previews cannot burn it.
export const POST = handler({ auth: "none", body: tokenSchema }, async ({ body, ip }) => {
  await verifyEmail(body.token, ip);
  return json({ ok: true, message: "Your email has been verified. You can now sign in." });
});
