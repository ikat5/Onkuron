"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/**
 * Accessible modal built on the native <dialog> element: focus is moved into
 * it and trapped by the browser, Escape requests close, and the rest of the
 * page is inert while it is open. `variant="panel"` slides in from the right
 * on large screens and fills the screen on phones.
 */
export function Dialog({
  open,
  onRequestClose,
  title,
  description,
  children,
  footer,
  variant = "center",
  labelledBy = "dialog-title",
}: {
  open: boolean;
  onRequestClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "panel";
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onRequestClose);
  useEffect(() => {
    closeRef.current = onRequestClose;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && el.open) el.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const panel = variant === "panel";
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the content box).
        if (e.target === e.currentTarget) closeRef.current();
      }}
      className={
        panel
          ? "m-0 ml-auto h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-brand-900/40 sm:max-w-2xl"
          : "m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 backdrop:bg-brand-900/40"
      }
    >
      {open && (
        <div className={`flex flex-col bg-white text-ink shadow-xl ${panel ? "h-full" : "max-h-[85dvh] rounded-2xl"}`}>
          <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id={labelledBy} className="text-lg font-semibold text-brand-700">
                {title}
              </h2>
              {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
            </div>
            <button type="button" onClick={() => closeRef.current()} className="rounded-lg p-1.5 text-muted hover:bg-brand-50 hover:text-ink" aria-label="Close">
              <Icon name="x" className="size-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-3 sm:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onRequestClose={() => !busy && onCancel()}
      title={title}
      labelledBy="confirm-title"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn bg-red-600 text-white hover:bg-red-700" onClick={onConfirm} disabled={busy}>
            <Icon name="trash" />
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink">{children}</div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    </Dialog>
  );
}
