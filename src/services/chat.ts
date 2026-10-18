import "server-only";
import { Types } from "mongoose";
import { forbidden, notFound, tooManyRequests } from "@/lib/errors";
import { hit, RULES } from "@/lib/security/rate-limit";
import type { SessionUser } from "@/lib/auth/current";
import { Conversation, Message, type IMessage } from "@/models/Chat";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { User } from "@/models/User";
import { hasApprovedEnrollment } from "./enrollment";

/**
 * Student ↔ shared-teacher messaging. Every read and write re-checks
 * membership: a student may only touch their own conversation; the teacher
 * role may access any conversation. Message bodies are stored as plain text
 * and rendered by React (escaped) — HTML is never interpreted.
 */

export async function getOrCreateStudentConversation(student: SessionUser) {
  if (student.role !== "student") throw forbidden();
  const studentId = new Types.ObjectId(student.id);
  const conv = await Conversation.findOneAndUpdate(
    { studentId },
    { $setOnInsert: { studentId, unreadForTeacher: 0, unreadForStudent: 0 } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return conv!;
}

async function loadAuthorized(user: SessionUser, conversationId: string) {
  if (!Types.ObjectId.isValid(conversationId)) throw notFound("Conversation not found");
  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) throw notFound("Conversation not found");
  if (user.role === "student" && String(conv.studentId) !== user.id) throw notFound("Conversation not found");
  if (user.role !== "student" && user.role !== "teacher") throw forbidden();
  return conv;
}

export async function listMessages(user: SessionUser, conversationId: string, after?: string) {
  const conv = await loadAuthorized(user, conversationId);
  const filter: Record<string, unknown> = { conversationId: conv._id };
  if (after && !Number.isNaN(Date.parse(after))) filter.createdAt = { $gt: new Date(after) };
  const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(200).lean();
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: user.role === "teacher" ? { unreadForTeacher: 0 } : { unreadForStudent: 0 } },
  );
  const labels = await contextLabels(messages);
  return messages.map((m) => toMessageDTO(m, user, labels));
}

type Labels = Map<string, string>;

/** Resolves "Course · Lesson" labels for messages that carry a context. */
async function contextLabels(messages: Pick<IMessage, "context">[]): Promise<Labels> {
  const courseIds = [...new Set(messages.flatMap((m) => (m.context ? [String(m.context.courseId)] : [])))];
  const lessonIds = [...new Set(messages.flatMap((m) => (m.context?.lessonId ? [String(m.context.lessonId)] : [])))];
  if (!courseIds.length) return new Map();
  const [courses, lessons] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("title").lean(),
    lessonIds.length ? Lesson.find({ _id: { $in: lessonIds } }).select("title").lean() : [],
  ]);
  return new Map([...courses, ...lessons].map((d) => [String(d._id), d.title]));
}

function toMessageDTO(m: Pick<IMessage, "_id" | "body" | "senderRole" | "senderId" | "createdAt" | "context">, user: SessionUser, labels: Labels) {
  const course = m.context ? labels.get(String(m.context.courseId)) : undefined;
  const lesson = m.context?.lessonId ? labels.get(String(m.context.lessonId)) : undefined;
  return {
    id: String(m._id),
    body: m.body,
    senderRole: m.senderRole,
    mine: String(m.senderId) === user.id,
    createdAt: m.createdAt.toISOString(),
    context: course ? (lesson ? `${course} · ${lesson}` : course) : undefined,
  };
}

/** A student may only tag a message with a course they are approved for (and a lesson of that course). */
async function verifiedContext(user: SessionUser, context?: { courseId: string; lessonId?: string }) {
  if (!context || user.role !== "student") return undefined;
  if (!(await hasApprovedEnrollment(user.id, context.courseId))) throw forbidden("You can only ask about courses you are enrolled in.");
  if (context.lessonId && !(await Lesson.exists({ _id: context.lessonId, courseId: context.courseId }))) throw notFound("Lesson not found");
  return { courseId: new Types.ObjectId(context.courseId), ...(context.lessonId ? { lessonId: new Types.ObjectId(context.lessonId) } : {}) };
}

export async function sendMessage(user: SessionUser, conversationId: string, body: string, context?: { courseId: string; lessonId?: string }) {
  const rl = await hit(RULES.chatUser, user.id);
  if (!rl.allowed) throw tooManyRequests(rl.retryAfterSeconds);
  const conv = await loadAuthorized(user, conversationId);
  const ctx = await verifiedContext(user, context);
  const msg = await Message.create({ conversationId: conv._id, senderId: user.id, senderRole: user.role, body, ...(ctx ? { context: ctx } : {}) });
  await Conversation.updateOne(
    { _id: conv._id },
    {
      $set: { lastMessageAt: msg.createdAt, lastMessagePreview: body.slice(0, 120) },
      $inc: user.role === "teacher" ? { unreadForStudent: 1 } : { unreadForTeacher: 1 },
    },
  );
  return toMessageDTO(msg, user, await contextLabels([msg]));
}

export async function listConversationsForTeacher() {
  const convs = await Conversation.find({ lastMessageAt: { $exists: true } }).sort({ lastMessageAt: -1 }).limit(200).lean();
  const students = await User.find({ _id: { $in: convs.map((c) => c.studentId) } }).select("name email").lean();
  const byId = new Map(students.map((s) => [String(s._id), s]));
  return convs.map((c) => ({
    id: String(c._id),
    studentName: byId.get(String(c.studentId))?.name ?? "Deleted student",
    studentEmail: byId.get(String(c.studentId))?.email ?? "",
    lastMessageAt: c.lastMessageAt?.toISOString(),
    preview: c.lastMessagePreview ?? "",
    unread: c.unreadForTeacher,
  }));
}
