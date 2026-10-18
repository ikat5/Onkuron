import { Schema, type Types } from "mongoose";
import { model } from "./util";

/** One conversation per student with the shared teacher account. */
export interface IConversation {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadForTeacher: number;
  unreadForStudent: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: Date,
    lastMessagePreview: { type: String, maxlength: 120 },
    unreadForTeacher: { type: Number, default: 0 },
    unreadForStudent: { type: Number, default: 0 },
  },
  { timestamps: true },
);
ConversationSchema.index({ studentId: 1 }, { unique: true });
ConversationSchema.index({ lastMessageAt: -1 });

export const Conversation = model<IConversation>("Conversation", ConversationSchema);

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: "student" | "teacher";
  body: string;
  /** Course/lesson a student's question is about (verified against their enrollment when sent). */
  context?: { courseId: Types.ObjectId; lessonId?: Types.ObjectId };
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["student", "teacher"], required: true },
    body: { type: String, required: true, maxlength: 2000 },
    context: {
      type: new Schema(
        {
          courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
          lessonId: { type: Schema.Types.ObjectId, ref: "Lesson" },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = model<IMessage>("Message", MessageSchema);
