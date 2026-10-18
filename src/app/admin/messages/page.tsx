import type { Metadata } from "next";
import Link from "next/link";
import { ChatPanel } from "@/components/chat-panel";
import { EmptyState, formatDate, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { listConversationsForTeacher } from "@/services/chat";

export const metadata: Metadata = { title: "Messages" };

export default async function TeacherMessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await requireUser("/admin/messages", "teacher");
  const { c } = await searchParams;
  await connectDB();
  const conversations = await listConversationsForTeacher();
  const active = conversations.find((x) => x.id === c) ?? conversations[0];

  return (
    <>
      <PageHeader title="Messages" subtitle="Replies are sent as “Onkuron Teacher” from the shared account." />
      {conversations.length === 0 ? (
        <EmptyState title="No messages yet">When students message you, their conversations appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="card max-h-[70vh] divide-y divide-line overflow-y-auto">
            {conversations.map((x) => (
              <li key={x.id}>
                <Link href={`/admin/messages?c=${x.id}`} className={`block p-3 text-sm ${x.id === active?.id ? "bg-brand-50" : "hover:bg-canvas"}`}>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">{x.studentName}</span>
                    {x.unread > 0 && <span className="badge ml-auto bg-sun-500 text-white">{x.unread}</span>}
                  </div>
                  <p className="truncate text-xs text-muted">{x.preview}</p>
                  <p className="text-[10px] text-muted">{formatDate(x.lastMessageAt, true)}</p>
                </Link>
              </li>
            ))}
          </ul>
          {active && (
            <div>
              <p className="mb-2 text-sm text-muted">
                Chatting with <strong className="text-ink">{active.studentName}</strong> · {active.studentEmail}
              </p>
              <ChatPanel key={active.id} conversationId={active.id} otherLabel={active.studentName} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
