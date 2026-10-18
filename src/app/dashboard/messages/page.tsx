import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat-panel";
import { Container, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getOrCreateStudentConversation } from "@/services/chat";

export const metadata: Metadata = { title: "Messages" };

export default async function StudentMessagesPage() {
  const user = await requireUser("/dashboard/messages", "student");
  await connectDB();
  const conv = await getOrCreateStudentConversation(user);
  return (
    <Container className="max-w-3xl py-10">
      <PageHeader title="Messages" subtitle="Ask our teachers about courses, payments or lessons." />
      <ChatPanel conversationId={String(conv._id)} otherLabel="Onkuron Teacher" />
    </Container>
  );
}
