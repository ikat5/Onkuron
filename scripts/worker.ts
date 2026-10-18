/**
 * Background worker for the email outbox and Cloudinary asset cleanup.
 *
 *   npm run worker:email            # loop forever (every 15 s)
 *   npm run worker:email -- --once  # process due jobs once and exit (for cron)
 *
 * Safe to run several copies: jobs are claimed atomically in MongoDB. If no
 * worker runs, emails are still attempted right after each request, and
 * failures wait in the outbox until a worker, the /api/internal/jobs cron
 * endpoint, or the teacher's "Retry" button processes them.
 */
import { connectDB, disconnectDB } from "@/lib/db";
import { processDueOutbox } from "@/lib/email/outbox";
import { processAssetDeletions } from "@/services/assets";

let stopping = false;

async function tick() {
  const emails = await processDueOutbox(50);
  const assets = await processAssetDeletions(20).catch((e: Error) => ({ error: e.message }));
  if (emails.sent || emails.failed || emails.dead) console.log(new Date().toISOString(), "emails", emails, "assets", assets);
}

async function main() {
  await connectDB();
  if (process.argv.includes("--once")) {
    await tick();
    await disconnectDB();
    return;
  }
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  console.log("Worker started. Press Ctrl+C to stop.");
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error("tick failed:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  await disconnectDB();
}

main();
