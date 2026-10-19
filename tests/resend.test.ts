import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailEnv } from "@/lib/env";
import { EmailDeliveryError, sendEmailNow } from "@/lib/email/service";
import { getMailTransport, setMailTransport } from "@/lib/email/transport";
import { applyTestEnv } from "./helpers/setup";

const KEY = "re_test1234_resend-key-should-never-leak";

function useResend(response: { status: number; body: unknown }) {
  applyTestEnv({ RESEND_API_KEY: KEY });
  setMailTransport(null);
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(response.body), { status: response.status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setMailTransport(null);
});

describe("Resend email provider", () => {
  it("is chosen over SMTP when RESEND_API_KEY is set", () => {
    applyTestEnv({ RESEND_API_KEY: KEY });
    expect(getEmailEnv().provider).toBe("resend");
    applyTestEnv();
    expect(getEmailEnv().provider).toBe("smtp");
  });

  it("sends through the HTTPS API with the configured sender", async () => {
    const fetchMock = useResend({ status: 200, body: { id: "msg_123" } });
    const result = await getMailTransport().send({ to: "a@example.test", subject: "Hi", html: "<p>Hi</p>", text: "Hi", replyTo: "b@example.test" });
    expect(result.messageId).toBe("msg_123");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "Onkuron <no-reply@example.test>", to: ["a@example.test"], reply_to: "b@example.test" });
  });

  it("treats rejected requests as permanent and rate limits as transient, without leaking the key", async () => {
    useResend({ status: 403, body: { name: "validation_error", message: `The domain is not verified (key ${KEY})` } });
    const permanent = await sendEmailNow("verify_email", "a@example.test", { name: "A", link: "http://localhost:3000/verify-email#t", expiresInHours: 24 }).catch((e) => e);
    expect(permanent).toBeInstanceOf(EmailDeliveryError);
    expect(permanent.transient).toBe(false);
    expect(permanent.message).not.toContain(KEY);

    useResend({ status: 429, body: { name: "rate_limit_exceeded", message: "Too many requests" } });
    const retry = await sendEmailNow("verify_email", "a@example.test", { name: "A", link: "http://localhost:3000/verify-email#t", expiresInHours: 24 }).catch((e) => e);
    expect(retry.transient).toBe(true);
  });
});
