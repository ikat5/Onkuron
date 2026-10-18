import { NextRequest } from "next/server";
import { signSession } from "@/lib/auth/session";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/auth/password";

// `never` lets routes with any params shape be passed in; params are supplied per call.
type RouteFn = (req: NextRequest, ctx: { params: Promise<never> }) => Promise<Response>;

export async function call(
  route: RouteFn,
  opts: { method?: string; url?: string; body?: unknown; cookie?: string; headers?: Record<string, string>; params?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { origin: "http://localhost:3000", ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = `onkuron_session=${opts.cookie}`;
  const req = new NextRequest(opts.url ?? "http://localhost:3000/api/test", {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  const res = await route(req, { params: Promise.resolve(opts.params ?? {}) as Promise<never> });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely-typed JSON for assertions
  return { status: res.status, json: json as Record<string, any>, text, headers: res.headers };
}

let counter = 0;
export async function createUser(opts: { role?: "student" | "teacher"; verified?: boolean; email?: string; password?: string; name?: string } = {}) {
  counter++;
  const user = await User.create({
    name: opts.name ?? `Student ${counter}`,
    email: opts.email ?? `student${counter}@example.test`,
    phone: "01712345678",
    passwordHash: await hashPassword(opts.password ?? "Password123"),
    role: opts.role ?? "student",
    emailVerified: opts.verified ?? true,
  });
  const { token } = await signSession({ sub: String(user._id), role: user.role, sv: user.sessionVersion });
  return { user, cookie: token, session: { id: String(user._id), name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified } };
}
