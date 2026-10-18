import { handler, json } from "@/lib/api";
import { signUploadSchema } from "@/lib/validation";
import { signUpload } from "@/services/uploads";

export const POST = handler({ auth: "teacher", body: signUploadSchema }, async ({ body, user }) => {
  return json(await signUpload(user!, body));
});
