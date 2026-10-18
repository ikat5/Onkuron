import { Types } from "mongoose";
import { handler, json } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { retryOutboxItem } from "@/lib/email/outbox";

export const POST = handler<undefined, { id: string }>({ auth: "teacher" }, async ({ user, params, ip }) => {
  if (!Types.ObjectId.isValid(params.id)) throw notFound();
  const result = await retryOutboxItem(params.id);
  if (result === null) throw notFound("Message not found or not in a retryable state");
  await audit({ action: "email.retried", actor: user, targetType: "email", targetId: params.id, ip });
  return json({ result });
});
