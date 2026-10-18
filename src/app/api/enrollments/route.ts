import { handler, json } from "@/lib/api";
import { enrollmentSchema } from "@/lib/validation";
import { submitEnrollment } from "@/services/enrollment";

export const POST = handler({ auth: "student", body: enrollmentSchema }, async ({ body, user, ip }) => {
  return json(await submitEnrollment(user!, body, ip), { status: 201 });
});
