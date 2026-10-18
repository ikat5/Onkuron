import { handler, json } from "@/lib/api";
import { settingsSchema } from "@/lib/validation";
import { updateSettings } from "@/services/settings";

export const PUT = handler({ auth: "teacher", body: settingsSchema }, async ({ body, user, ip }) => {
  return json(await updateSettings(user!, body, ip));
});
