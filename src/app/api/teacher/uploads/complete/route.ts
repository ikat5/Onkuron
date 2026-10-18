import { handler, json } from "@/lib/api";
import { completeUploadSchema } from "@/lib/validation";
import { completeUpload } from "@/services/uploads";

export const POST = handler({ auth: "teacher", body: completeUploadSchema }, async ({ body, user, ip }) => {
  const asset = await completeUpload(user!, body.intentId, ip);
  return json({ ok: true, asset: { bytes: asset.bytes, format: asset.format, url: asset.url } });
});
