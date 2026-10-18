"use client";

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string[] | undefined>;
  retryAfterSeconds?: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** JSON fetch for same-origin API routes (cookies are sent automatically). */
export async function api<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const e = payload?.error;
      return {
        ok: false,
        error: {
          code: e?.code ?? "http_error",
          message: e?.message ?? `Request failed (${res.status})`,
          fields: e?.details?.fields,
          retryAfterSeconds: e?.details?.retryAfterSeconds,
        },
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, error: { code: "network", message: "Network error — check your connection and try again." } };
  }
}
