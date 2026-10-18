"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui";
import { api } from "@/lib/api-client";

export function VerifyButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  // Remove the token from the address bar and browser history.
  useEffect(() => {
    window.history.replaceState(null, "", "/verify-email");
  }, []);

  if (state === "done") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Email verified">
          {message}
        </Alert>
        <Link href="/login?verified=1" className="btn-leaf w-full">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state === "error" && (
        <Alert tone="error">
          {message}{" "}
          <Link href="/resend-verification" className="font-semibold underline">
            Request a new link
          </Link>
        </Alert>
      )}
      <p className="text-sm text-muted">Press the button below to confirm that this email address belongs to you.</p>
      <button
        type="button"
        className="btn-leaf w-full"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await api<{ message: string }>("/api/auth/verify-email", { body: { token } });
          if (res.ok) {
            setMessage(res.data.message);
            setState("done");
          } else {
            setMessage(res.error.message);
            setState("error");
          }
        }}
      >
        {state === "busy" ? "Verifying…" : "Confirm my email"}
      </button>
    </div>
  );
}
