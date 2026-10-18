import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryEnv } from "@/lib/env";

/**
 * Cloudinary SDK singleton.
 *
 * The SDK holds configuration in module-level state, so it is configured once
 * per server runtime (and re-used across hot reloads) instead of in every
 * route handler. It holds no per-user state. Throws ConfigError if the
 * credentials are missing — callers surface that as "not configured".
 */
const globalForCloudinary = globalThis as typeof globalThis & { __onkuronCloudinaryConfigured?: boolean };

export function getCloudinary(): typeof cloudinary {
  if (!globalForCloudinary.__onkuronCloudinaryConfigured) {
    const env = getCloudinaryEnv();
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    globalForCloudinary.__onkuronCloudinaryConfigured = true;
  }
  return cloudinary;
}

export function resetCloudinaryForTests() {
  globalForCloudinary.__onkuronCloudinaryConfigured = false;
}
