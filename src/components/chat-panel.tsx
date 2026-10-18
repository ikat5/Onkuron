"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

interface ChatMessage {
  id: string;
  body: string;
  senderRole: "student" | "teacher";
  mine: boolean;
  createdAt: string;
  /** "Course · Lesson" the message is about, if any. */
  context?: string;
}

const POLL_MS = 5000;

/**
 * Polling chat (works on serverless hosts without websockets). Messages are
 * rendered as plain text — React escapes them, so HTML/JS is never executed.
 * Render with `key={conversationId}` so switching conversations resets state.
 */
export function ChatPanel({
  conversationId,
  otherLabel,
  context,
  heightClass = "h-[70vh] min-h-96",
}: {
  conversationId: string;
  otherLabel: string;
  /** Tags new messages with the course/lesson being studied (verified server-side). */
  context?: { courseId: string; lessonId?: string; label: string };
  heightClass?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const lastRef = useRef<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      lastRef.current = next.at(-1)?.createdAt;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const q = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
      const res = await api<{ messages: ChatMessage[] }>(`/api/chat/${conversationId}/messages${q}`);
      if (cancelled) return;
      if (res.ok) {
        merge(res.data.messages);
        setError(null);
      } else setError(res.error.message);
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [conversationId, merge]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await api<{ message: ChatMessage }>(`/api/chat/${conversationId}/messages`, {
      body: { body, ...(context ? { context: { courseId: context.courseId, lessonId: context.lessonId } } : {}) },
    });
    setSending(false);
    if (res.ok) {
      setDraft("");
      merge([res.data.message]);
      setError(null);
    } else setError(res.error.fields?.body?.[0] ?? res.error.message);
  }

  return (
    <div className={`card flex flex-col overflow-hidden ${heightClass}`}>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas/60 p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${m.mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm border border-line bg-white text-ink"}`}>
              {!m.mine && <p className="mb-0.5 text-xs font-semibold text-leaf-700">{otherLabel}</p>}
              {m.context && <p className={`mb-1 text-[11px] font-medium ${m.mine ? "text-brand-100" : "text-brand-600"}`}>Re: {m.context}</p>}
              <p className="break-words whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? "text-brand-100" : "text-muted"}`}>
                {new Date(m.createdAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      {context && <p className="truncate border-t border-line bg-brand-50 px-4 py-1.5 text-xs text-brand-700">Asking about: {context.label}</p>}
      <form
        className="flex gap-2 border-t border-line bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={1}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          className="input min-h-11 flex-1 resize-none"
        />
        <button type="submit" className="btn-primary" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
