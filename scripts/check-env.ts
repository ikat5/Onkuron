/**
 * Prints which integrations are configured and tests connectivity, without
 * printing any secret values.
 *
 *   npm run check:env                                   # configuration + MongoDB ping
 *   npm run check:env -- --smtp --cloudinary            # also verify SMTP login and Cloudinary API
 *   npm run check:env -- --send-test you@example.com    # send a real test email
 */
import { featureStatus } from "@/lib/env";
import { connectDB, disconnectDB } from "@/lib/db";

async function main() {
  const status = featureStatus();
  for (const [name, s] of Object.entries(status)) {
    console.log(`${s.ok ? "✔" : "✘"} ${name}${s.ok ? "" : ` — missing/invalid: ${s.missing.join(", ")}`}`);
  }
  if (status.database.ok) {
    try {
      const m = await connectDB();
      const ping = await m.connection.db!.admin().command({ ping: 1 });
      console.log(`✔ MongoDB reachable (db: ${m.connection.name}, ping: ${ping.ok})`);
    } catch (e) {
      console.log(`✘ MongoDB connection failed: ${(e as Error).message}`);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  }
  if (status.email.ok && process.argv.includes("--smtp")) {
    const nodemailer = (await import("nodemailer")).default;
    const { getEmailEnv } = await import("@/lib/env");
    const env = getEmailEnv();
    const t = nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, requireTLS: !env.SMTP_SECURE && env.SMTP_REQUIRE_TLS,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 10_000,
    });
    try {
      await t.verify();
      console.log("✔ SMTP server accepted the connection and credentials");
    } catch (e) {
      const err = e as { code?: string; responseCode?: number };
      console.log(`✘ SMTP verification failed (${err.code ?? "error"}${err.responseCode ? ` ${err.responseCode}` : ""})`);
      process.exitCode = 1;
    }
  }
  const testIdx = process.argv.indexOf("--send-test");
  if (status.email.ok && testIdx > -1) {
    const to = process.argv[testIdx + 1];
    const { setMailTransport, getMailTransport } = await import("@/lib/email/transport");
    setMailTransport(null);
    try {
      const { messageId } = await getMailTransport().send({
        to,
        subject: "Onkuron SMTP test",
        text: "This is a test message from `npm run check:env -- --send-test`. Email delivery is configured.",
        html: "<p>This is a test message from <code>npm run check:env -- --send-test</code>. Email delivery is configured.</p>",
      });
      console.log(`✔ SMTP accepted a test message (id ${messageId}). Check the inbox of ${to}.`);
    } catch (e) {
      const err = e as { code?: string; responseCode?: number };
      console.log(`✘ Sending the test message failed (${err.code ?? "error"}${err.responseCode ? ` ${err.responseCode}` : ""})`);
      process.exitCode = 1;
    }
    process.exit();
  }
  if (status.cloudinary.ok && process.argv.includes("--cloudinary")) {
    const { getCloudinary } = await import("@/lib/cloudinary");
    try {
      const res = await getCloudinary().api.ping();
      console.log(`✔ Cloudinary API reachable (${res.status})`);
    } catch (e) {
      const err = e as { error?: { http_code?: number; message?: string } };
      console.log(`✘ Cloudinary API failed (${err.error?.http_code ?? "error"}: ${err.error?.message ?? ""})`);
      process.exitCode = 1;
    }
  }
}

main();
