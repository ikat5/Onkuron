"use client";

import type { InputHTMLAttributes } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: { label: string; name: string; error?: string[]; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  const describedBy = error?.length ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} name={name} className="input" aria-invalid={error?.length ? true : undefined} aria-describedby={describedBy} {...props} />
      {error?.length ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-700">
          {error[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function formValues(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
}
