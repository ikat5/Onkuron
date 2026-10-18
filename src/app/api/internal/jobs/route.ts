import { timingSafeEqual } from "node:crypto";
import { handler, json } from "@/lib/api";
import { unauthorized } from "@/lib/errors";
import { processDueOutbox } from "@/lib/email/outbox";
import { processAssetDeletions } from "@/services/assets";

function validSecret(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cron entry point (e.g. Vercel Cron or any scheduler) for the email outbox and asset cleanup. */
async function run(req: Request) {
  if (!validSecret(req.headers.get("authorization"))) throw unauthorized("Invalid job secret");
  const [emails, assets] = await Promise.all([processDueOutbox(50), processAssetDeletions(20).catch(() => null)]);
  return json({ emails, assets });
}

export const GET = handler({ auth: "none" }, ({ req }) => run(req));
export const POST = handler({ auth: "none" }, ({ req }) => run(req));
