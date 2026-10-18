import { handler, json } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { registerStudent } from "@/services/auth";

export const POST = handler({ auth: "none", body: registerSchema }, async ({ body, ip }) => {
  const result = await registerStudent(body, ip);
  return json(result, { status: 202 });
});
