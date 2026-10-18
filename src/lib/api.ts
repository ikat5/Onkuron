import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AppError, badRequest, forbidden, serviceUnavailable, unauthorized } from "@/lib/errors";
import { ConfigError } from "@/lib/env";
import { connectDB, DatabaseConnectionError } from "@/lib/db";
import { logger } from "@/lib/logger";
import { clientIp, isTrustedOrigin } from "@/lib/security/request";
import { getSessionUserFromToken, type SessionUser } from "@/lib/auth/current";
import { SESSION_COOKIE } from "@/lib/auth/session";
import type { Role } from "@/models/User";

type AuthRequirement = "none" | "optional" | Role | "any";

interface HandlerOptions<S extends z.ZodTypeAny | undefined> {
  auth: AuthRequirement;
  /** Zod schema for the JSON body (mutations). Unknown keys are stripped — no mass assignment. */
  body?: S;
  /** Maximum JSON body size in bytes. */
  maxBodyBytes?: number;
  /** Require a verified email (default true for student routes). */
  requireVerified?: boolean;
}

interface HandlerContext<B, P> {
  req: NextRequest;
  user: SessionUser | null;
  body: B;
  params: P;
  ip: string;
}

type Ctx<P> = { params: Promise<P> };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function json<T>(data: T, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    if (err.status === 429 && err.details?.retryAfterSeconds) {
      headers["Retry-After"] = String(err.details.retryAfterSeconds);
    }
    return json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status, headers });
  }
  if (err instanceof ConfigError) {
    logger.error("config.missing", { feature: err.feature, missing: err.missing });
    return json(
      { error: { code: "not_configured", message: `${err.feature} is not configured on the server.` } },
      { status: 503 },
    );
  }
  if (err instanceof DatabaseConnectionError) {
    return json({ error: { code: "db_unavailable", message: "The service is temporarily unavailable." } }, { status: 503 });
  }
  logger.error("api.unhandled", { error: err });
  return json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/**
 * Route handler wrapper: deny-by-default authentication/role checks, CSRF
 * origin validation for mutations, JSON size limits, schema validation and
 * uniform error responses that never include stack traces.
 */
export function handler<S extends z.ZodTypeAny | undefined = undefined, P = Record<string, string>>(
  opts: HandlerOptions<S>,
  fn: (ctx: HandlerContext<S extends z.ZodTypeAny ? z.infer<S> : undefined, P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (MUTATING.has(req.method) && !isTrustedOrigin(req.headers)) {
        throw forbidden("Cross-origin request rejected");
      }

      await connectDB();

      let user: SessionUser | null = null;
      if (opts.auth !== "none") {
        user = await getSessionUserFromToken(req.cookies.get(SESSION_COOKIE)?.value);
        if (opts.auth !== "optional") {
          if (!user) throw unauthorized();
          if (opts.auth !== "any" && user.role !== opts.auth) throw forbidden();
          const needVerified = opts.requireVerified ?? true;
          if (needVerified && !user.emailVerified) throw forbidden("Please verify your email address first");
        }
      }

      let body: unknown = undefined;
      if (opts.body) {
        const type = req.headers.get("content-type") ?? "";
        if (!type.toLowerCase().startsWith("application/json")) throw badRequest("Expected a JSON request body");
        const raw = await req.text();
        if (raw.length > (opts.maxBodyBytes ?? 16 * 1024)) throw new AppError(413, "too_large", "Request body too large");
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw badRequest("Malformed JSON");
        }
        const result = opts.body.safeParse(parsed);
        if (!result.success) {
          throw badRequest("Please check the highlighted fields", { fields: z.flattenError(result.error).fieldErrors });
        }
        body = result.data;
      }

      const params = ctx?.params ? await ctx.params : ({} as P);
      return await fn({
        req,
        user,
        body: body as S extends z.ZodTypeAny ? z.infer<S> : undefined,
        params,
        ip: clientIp(req.headers),
      });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function requireConfigured(ok: boolean, message: string) {
  if (!ok) throw serviceUnavailable(message);
}
