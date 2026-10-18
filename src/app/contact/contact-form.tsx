"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { api } from "@/lib/api-client";

type Fields = "name" | "email" | "subject" | "message";

export function ContactForm() {
  // Time-to-fill spam heuristic: measured from first render to submit.
  const startedAt = useRef<number | null>(null);
  const [values, setValues] = useState<Record<Fields, string>>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function validate() {
    const e: Partial<Record<Fields, string>> = {};
    if (values.name.trim().length < 2) e.name = "Enter your name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) e.email = "Enter a valid email address";
    if (values.subject.trim().length < 3) e.subject = "Enter a subject";
    if (values.message.trim().length < 10) e.message = "Write at least 10 characters";
    return e;
  }

  const field = (name: Fields, label: string, props: Record<string, unknown> = {}) => (
    <div>
      <label htmlFor={`c-${name}`} className="label">
        {label}
      </label>
      <input
        id={`c-${name}`}
        className="input"
        value={values[name]}
        onChange={(e) => {
          setValues((v) => ({ ...v, [name]: e.target.value }));
          if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }));
        }}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `c-${name}-err` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`c-${name}-err`} className="mt-1 text-xs text-red-700">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form
      noValidate
      className="mt-6 space-y-4"
      onFocus={() => {
        startedAt.current ??= Date.now();
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus(null);
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length) return;
        const website = String(new FormData(e.currentTarget).get("website") ?? "");
        setBusy(true);
        const res = await api("/api/contact", {
          body: { ...values, website, elapsedMs: startedAt.current ? Date.now() - startedAt.current : undefined },
        });
        setBusy(false);
        if (res.ok) {
          setStatus({ tone: "success", text: "Thank you — your message has been received and sent to our team. We'll reply to the email address you gave." });
          setValues({ name: "", email: "", subject: "", message: "" });
          startedAt.current = null;
        } else {
          if (res.error.fields) setErrors(Object.fromEntries(Object.entries(res.error.fields).map(([k, v]) => [k, v?.[0]])));
          const fallback = res.error.code === "not_configured" || res.error.code === "service_unavailable";
          setStatus({
            tone: "error",
            text: fallback
              ? "The contact form isn't available right now. Please email us directly at info.onkuron@gmail.com."
              : res.error.code === "rate_limited"
                ? "You've sent several messages recently. Please wait a while before sending another."
                : res.error.message,
          });
        }
      }}
    >
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Your name", { autoComplete: "name", maxLength: 100 })}
        {field("email", "Email address", { type: "email", autoComplete: "email", maxLength: 254 })}
      </div>
      {field("subject", "Subject", { maxLength: 150 })}
      <div>
        <label htmlFor="c-message" className="label">
          Message
        </label>
        <textarea
          id="c-message"
          rows={6}
          maxLength={4000}
          className="input leading-relaxed"
          value={values.message}
          onChange={(e) => {
            setValues((v) => ({ ...v, message: e.target.value }));
            if (errors.message) setErrors((x) => ({ ...x, message: undefined }));
          }}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "c-message-err" : undefined}
        />
        {errors.message && (
          <p id="c-message-err" className="mt-1 text-xs text-red-700">
            {errors.message}
          </p>
        )}
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn-primary w-full py-3 sm:w-auto sm:px-8" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
