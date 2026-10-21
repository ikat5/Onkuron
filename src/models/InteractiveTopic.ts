import { Schema, type Types } from "mongoose";
import { CATEGORY_SLUG_RE } from "@/lib/categories";
import { INTERACTIVE_MODULES, type InteractiveModule } from "@/lib/interactive";
import { model } from "./util";

/**
 * An interactive visual lesson: one tab of the homepage HSC ICT lab
 * ("Interactive Visual Learning"). The text is editable; the simulation
 * itself is one of the built-in modules.
 */
export interface IInteractiveTopic {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  chapter: string;
  chapterBn: string;
  /** Short symbol on the topic's tab (e.g. "A·B"). */
  glyph: string;
  learn: string[];
  module?: InteractiveModule;
  /** Course that teaches this topic in full (the lab's "Learn this" button opens it). */
  courseId?: Types.ObjectId;
  order: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InteractiveTopicSchema = new Schema<IInteractiveTopic>(
  {
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 80, match: CATEGORY_SLUG_RE },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    chapter: { type: String, default: "", maxlength: 40 },
    chapterBn: { type: String, default: "", maxlength: 80 },
    glyph: { type: String, default: "", maxlength: 6 },
    learn: { type: [{ type: String, maxlength: 120 }], default: [] },
    module: { type: String, enum: INTERACTIVE_MODULES },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);

InteractiveTopicSchema.index({ slug: 1 }, { unique: true });
InteractiveTopicSchema.index({ published: 1, order: 1 });

export const InteractiveTopic = model<IInteractiveTopic>("InteractiveTopic", InteractiveTopicSchema);
