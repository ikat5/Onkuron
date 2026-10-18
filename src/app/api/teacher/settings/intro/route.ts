import { handler, json } from "@/lib/api";
import { introSchema } from "@/lib/validation";
import { getIntro, updateIntro } from "@/services/settings";

export const GET = handler({ auth: "teacher" }, async () => json({ intro: await getIntro() }));

/** Platform introduction video + text, shown on the homepage. */
export const PUT = handler({ auth: "teacher", body: introSchema }, async ({ body, user, ip }) => {
  return json({ intro: await updateIntro(user!, body, ip) });
});
