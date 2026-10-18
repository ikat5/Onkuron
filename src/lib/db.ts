import "server-only";
import mongoose from "mongoose";
import { getDbEnv } from "@/lib/env";
import { logger, redactString } from "@/lib/logger";

/**
 * MongoDB connection singleton.
 *
 * Why a singleton: Mongoose maintains a connection pool per connection. Opening
 * a new connection per request exhausts Atlas connection limits and adds
 * latency, so one connection is shared by every request in a server runtime.
 *
 * Lifecycle: the cache lives on `globalThis` so Next.js hot reloads in
 * development reuse it instead of leaking pools. Concurrent callers share the
 * same in-flight promise. A failed attempt clears the promise so the next call
 * can retry. This is per-process state only: each serverless instance or
 * horizontally-scaled replica has its own pool, and nothing here provides
 * cross-instance coordination — correctness relies on indexes and atomic
 * database operations instead.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & { __onkuronMongoose?: MongooseCache };
const cache: MongooseCache = (globalForMongoose.__onkuronMongoose ??= { conn: null, promise: null });

export class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    // Throws ConfigError (without values) before any network activity.
    const { MONGODB_URI, MONGODB_DB_NAME } = getDbEnv();
    mongoose.set("strictQuery", true);
    // Fail fast instead of buffering queries while disconnected.
    mongoose.set("bufferCommands", false);

    cache.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB_NAME,
        appName: "OnkurLMS",
        retryWrites: true,
        w: "majority",
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        autoIndex: true,
      })
      .then((m) => {
        logger.info("db.connected", { dbName: MONGODB_DB_NAME });
        return m;
      })
      .catch((err: unknown) => {
        cache.promise = null;
        const message = err instanceof Error ? redactString(err.message) : "unknown error";
        logger.error("db.connect_failed", { message });
        throw new DatabaseConnectionError(
          "Could not connect to MongoDB. Check MONGODB_URI, the Atlas network access list, and database user permissions.",
        );
      });
  }

  cache.conn = await cache.promise;
  maybeBootstrapTeacher();
  return cache.conn;
}

/**
 * Optional first-run bootstrap (SEED_INITIAL_TEACHER=true). Runs at most once
 * per process; the seed itself is idempotent and safe across instances.
 * Disable the flag again after the initial deployment.
 */
let bootstrapStarted = false;
function maybeBootstrapTeacher() {
  if (bootstrapStarted || process.env.SEED_INITIAL_TEACHER !== "true") return;
  bootstrapStarted = true;
  void import("@/services/teacher-seed")
    .then(({ ensureTeacher }) => ensureTeacher())
    .then((r) => logger.info("teacher.bootstrap", { status: r.status }))
    .catch((err) => logger.error("teacher.bootstrap_failed", { message: err instanceof Error ? err.message : "error" }));
}

/** Only for tests and one-off scripts; request handlers never disconnect. */
export async function disconnectDB(): Promise<void> {
  if (cache.promise || cache.conn) {
    await mongoose.disconnect();
  }
  cache.conn = null;
  cache.promise = null;
}
