import "server-only";
import { z } from "zod";

/**
 * Environment validation, grouped by feature so that a missing optional
 * integration (e.g. Cloudinary) does not prevent unrelated parts of the app
 * from working. Each getter validates lazily and caches its result.
 *
 * Error messages name the missing variables but never echo their values.
 */

export class ConfigError extends Error {
  constructor(
    public readonly feature: string,
    public readonly missing: string[],
  ) {
    super(`${feature} is not configured. Missing or invalid: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const str = () => z.preprocess(emptyToUndefined, z.string().trim().min(1));
const optStr = () => z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const bool = (def: boolean) =>
  z.preprocess((v) => {
    const s = emptyToUndefined(v);
    if (s === undefined) return def;
    return String(s).toLowerCase() === "true" || s === "1";
  }, z.boolean());

function parse<T extends z.ZodTypeAny>(feature: string, schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new ConfigError(feature, missing);
  }
  return result.data;
}

const resetters: Array<() => void> = [];

function cached<T>(fn: () => T): () => T {
  let value: T | undefined;
  resetters.push(() => (value = undefined));
  return () => (value ??= fn());
}

/** Clears cached configuration. Intended for tests that mutate process.env. */
export function resetEnvCache() {
  resetters.forEach((r) => r());
}

const dbSchema = z.object({
  MONGODB_URI: str().refine((v) => /^mongodb(\+srv)?:\/\//.test(v) && !v.includes("<DB_PASSWORD>"), {
    message: "MONGODB_URI must be a mongodb:// or mongodb+srv:// URI with a real password",
  }),
  MONGODB_DB_NAME: z.preprocess(emptyToUndefined, z.string().trim().min(1).default("onkurlms")),
});

const authSchema = z.object({
  JWT_SECRET: str().refine((v) => v.length >= 32, { message: "JWT_SECRET must be at least 32 characters" }),
  APP_URL: str().pipe(z.url()),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  VERIFICATION_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60 * 72).default(60 * 24),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  TRUST_PROXY: bool(false),
});

/**
 * Email provider, first match wins: Brevo (BREVO_API_KEY), Resend
 * (RESEND_API_KEY), then SMTP. The HTTPS APIs work on hosts such as Render
 * that block outbound SMTP.
 */
const brevoSchema = z.object({
  EMAIL_FROM: str(),
  BREVO_API_KEY: str().refine((v) => v.startsWith("xkeysib-"), { message: "BREVO_API_KEY must start with xkeysib-" }),
});

const resendSchema = z.object({
  EMAIL_FROM: str(),
  RESEND_API_KEY: str().refine((v) => v.startsWith("re_"), { message: "RESEND_API_KEY must start with re_" }),
});

const smtpSchema = z.object({
  EMAIL_FROM: str(),
  SMTP_HOST: str(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: bool(false),
  /** Require STARTTLS when SMTP_SECURE=false. Only disable for a local mail catcher. */
  SMTP_REQUIRE_TLS: bool(true),
  SMTP_USER: optStr(),
  SMTP_PASS: optStr(),
});

const cloudinarySchema = z.object({
  CLOUDINARY_CLOUD_NAME: str(),
  CLOUDINARY_API_KEY: str(),
  CLOUDINARY_API_SECRET: str(),
  MAX_VIDEO_MB: z.coerce.number().int().min(1).max(20000).default(500),
  MAX_DOCUMENT_MB: z.coerce.number().int().min(1).max(500).default(25),
  MAX_IMAGE_MB: z.coerce.number().int().min(1).max(50).default(5),
});

const teacherSchema = z.object({
  TEACHER_EMAIL: str().pipe(z.email()),
  TEACHER_PASSWORD: str(),
  SEED_INITIAL_TEACHER: bool(false),
});

export const getDbEnv = cached(() => parse("Database", dbSchema));
export const getAuthEnv = cached(() => parse("Authentication", authSchema));
export type EmailEnv =
  | ({ provider: "brevo" } & z.infer<typeof brevoSchema>)
  | ({ provider: "resend" } & z.infer<typeof resendSchema>)
  | ({ provider: "smtp" } & z.infer<typeof smtpSchema>);

export const getEmailEnv = cached((): EmailEnv => {
  if (emptyToUndefined(process.env.BREVO_API_KEY) !== undefined) {
    return { provider: "brevo", ...parse("Email (Brevo)", brevoSchema) };
  }
  if (emptyToUndefined(process.env.RESEND_API_KEY) !== undefined) {
    return { provider: "resend", ...parse("Email (Resend)", resendSchema) };
  }
  return { provider: "smtp", ...parse("Email (SMTP)", smtpSchema) };
});
export const getCloudinaryEnv = cached(() => parse("Cloudinary", cloudinarySchema));
export const getTeacherEnv = () => parse("Teacher seeding", teacherSchema);

export function getAppUrl(): string {
  return getAuthEnv().APP_URL.replace(/\/+$/, "");
}

export const isProduction = () => process.env.NODE_ENV === "production";

/** Feature availability without throwing — used by the UI and health checks. */
export function featureStatus() {
  const check = (fn: () => unknown) => {
    try {
      fn();
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, missing: e instanceof ConfigError ? e.missing : ["unknown"] };
    }
  };
  return {
    database: check(getDbEnv),
    auth: check(getAuthEnv),
    email: check(getEmailEnv),
    cloudinary: check(getCloudinaryEnv),
  };
}
