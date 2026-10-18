import "server-only";

/**
 * Minimal structured JSON logger. Values under sensitive keys are replaced and
 * credentials embedded in connection strings are masked, so callers can log
 * error objects without leaking secrets.
 */

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|signature|api_?key|jwt|hash|uri/i;

export function redactString(value: string): string {
  return value
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi, "$1***:***@")
    .replace(/([?&](?:token|signature|api_key|api_secret)=)[^&\s]+/gi, "$1***");
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), code: (value as { code?: unknown }).code };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error" && !process.env.LOG_IN_TESTS) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields ?? {}) as object) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => write("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
