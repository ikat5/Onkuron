"use client";

import { Container } from "@/components/ui";

// Generic message only: error details and stack traces are never shown to users.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-2xl font-bold text-brand-700">Something went wrong</h1>
      <p className="mt-2 text-muted">The service may be temporarily unavailable. Please try again.</p>
      <button type="button" className="btn-primary mt-6" onClick={reset}>
        Try again
      </button>
    </Container>
  );
}
