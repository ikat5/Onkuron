import { handler, json } from "@/lib/api";
import { processDueOutbox } from "@/lib/email/outbox";

export const POST = handler({ auth: "teacher" }, async () => json(await processDueOutbox(25)));
