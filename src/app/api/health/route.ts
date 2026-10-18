import { json } from "@/lib/api";
import { featureStatus } from "@/lib/env";

/** Reports which integrations are configured (booleans only — never values). */
export async function GET() {
  const s = featureStatus();
  return json({
    status: "ok",
    database: s.database.ok,
    email: s.email.ok,
    cloudinary: s.cloudinary.ok,
  });
}
