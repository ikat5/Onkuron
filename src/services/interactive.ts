import "server-only";
import { Types } from "mongoose";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/current";
import { connectDB } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { DEFAULT_TOPICS, type InteractiveModule } from "@/lib/interactive";
import type { TopicInput } from "@/lib/validation";
import { Course } from "@/models/Course";
import { InteractiveTopic, type IInteractiveTopic } from "@/models/InteractiveTopic";
import { slugify } from "./courses";
import { seedOnce } from "./settings";

export interface TopicDTO {
  id: string;
  slug: string;
  title: string;
  chapter: string;
  chapterBn: string;
  glyph: string;
  learn: string[];
  module?: InteractiveModule;
  courseId?: string;
  order: number;
  published: boolean;
}

export type PublicTopic = Omit<TopicDTO, "id" | "order" | "published" | "courseId"> & {
  /** Slug of the linked course, when it is published. */
  courseSlug?: string;
};

/** The five labs that shipped with the site, inserted once into an empty database. */
export function ensureDefaultTopics() {
  return seedOnce("topics", () =>
    InteractiveTopic.insertMany(
      DEFAULT_TOPICS.map((t, i) => ({ ...t, order: i, published: true })),
      { ordered: false },
    ).catch((err) => {
      if ((err as { code?: number }).code !== 11000) throw err;
    }),
  );
}

function toDTO(t: IInteractiveTopic): TopicDTO {
  return { id: String(t._id), slug: t.slug, title: t.title, chapter: t.chapter ?? "", chapterBn: t.chapterBn ?? "", glyph: t.glyph ?? "", learn: t.learn ?? [], module: t.module, courseId: t.courseId ? String(t.courseId) : undefined, order: t.order, published: t.published };
}

export async function listTopics(opts: { publishedOnly?: boolean } = {}): Promise<TopicDTO[]> {
  await ensureDefaultTopics();
  const rows = await InteractiveTopic.find(opts.publishedOnly ? { published: true } : {})
    .sort({ order: 1, createdAt: 1 })
    .lean();
  return rows.map(toDTO);
}

/** Published topics for the homepage lab. Never throws (public pages must render while the database is down). */
export async function listPublicTopics(): Promise<PublicTopic[]> {
  try {
    await connectDB();
    const topics = await listTopics({ publishedOnly: true });
    const courseIds = topics.flatMap((t) => (t.courseId ? [t.courseId] : []));
    const courses = courseIds.length
      ? await Course.find({ _id: { $in: courseIds }, published: true })
          .select("slug")
          .lean()
      : [];
    const slugs = new Map(courses.map((c) => [String(c._id), c.slug]));
    return topics.map((t) => ({ slug: t.slug, title: t.title, chapter: t.chapter, chapterBn: t.chapterBn, glyph: t.glyph, learn: t.learn, module: t.module, courseSlug: t.courseId ? slugs.get(t.courseId) : undefined }));
  } catch {
    return [];
  }
}

function assertId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound("Interactive lesson not found");
}

export async function getTopic(id: string) {
  assertId(id);
  const t = await InteractiveTopic.findById(id).lean();
  if (!t) throw notFound("Interactive lesson not found");
  return toDTO(t);
}

async function fields(input: TopicInput) {
  if (input.courseId && !(await Course.exists({ _id: input.courseId }))) {
    throw badRequest("Please check the highlighted fields", { fields: { courseId: ["That course no longer exists"] } });
  }
  const set = { title: input.title, chapter: input.chapter, chapterBn: input.chapterBn, glyph: input.glyph, learn: input.learn, published: input.published };
  const unset: Record<string, 1> = {};
  if (input.module) Object.assign(set, { module: input.module });
  else unset.module = 1;
  if (input.courseId) Object.assign(set, { courseId: input.courseId });
  else unset.courseId = 1;
  return { set, unset };
}

function duplicate(err: unknown) {
  if ((err as { code?: number }).code === 11000) return conflict("Another interactive lesson already has this title. Use a different title.");
  return err;
}

export async function createTopic(teacher: SessionUser, input: TopicInput, ip: string) {
  await ensureDefaultTopics();
  const { set } = await fields(input);
  const last = await InteractiveTopic.findOne().sort({ order: -1 }).select("order").lean();
  try {
    const created = await InteractiveTopic.create({ ...set, slug: slugify(input.title, "topic"), order: (last?.order ?? -1) + 1 });
    await audit({ action: "topic.created", actor: teacher, targetType: "topic", targetId: String(created._id), ip });
    return toDTO(created.toObject());
  } catch (err) {
    throw duplicate(err);
  }
}

export async function updateTopic(teacher: SessionUser, id: string, input: TopicInput, ip: string) {
  assertId(id);
  const { set, unset } = await fields(input);
  try {
    const t = await InteractiveTopic.findByIdAndUpdate(id, Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set }, { returnDocument: "after", runValidators: true }).lean();
    if (!t) throw notFound("Interactive lesson not found");
    await audit({ action: "topic.updated", actor: teacher, targetType: "topic", targetId: id, ip, metadata: { published: input.published } });
    return toDTO(t);
  } catch (err) {
    throw duplicate(err);
  }
}

export async function deleteTopic(teacher: SessionUser, id: string, ip: string) {
  assertId(id);
  const t = await InteractiveTopic.findByIdAndDelete(id).lean();
  if (!t) throw notFound("Interactive lesson not found");
  await audit({ action: "topic.deleted", actor: teacher, targetType: "topic", targetId: id, ip, metadata: { slug: t.slug } });
}

export async function reorderTopics(teacher: SessionUser, ids: string[], ip: string) {
  const all = await InteractiveTopic.find().select("_id").lean();
  if (all.length !== ids.length || new Set(ids).size !== ids.length || !all.every((t) => ids.includes(String(t._id)))) {
    throw badRequest("The list of interactive lessons changed. Reload the page and try again.");
  }
  await InteractiveTopic.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  await audit({ action: "topic.reordered", actor: teacher, ip });
  return listTopics();
}
