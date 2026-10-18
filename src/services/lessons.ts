import "server-only";
import { Types } from "mongoose";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/current";
import type { LessonInput, LessonUpdateInput } from "@/lib/validation";
import { Course } from "@/models/Course";
import { Lesson, type ILesson, type IResource, type ResourceKind, type VideoProvider } from "@/models/Lesson";
import { LessonProgress } from "@/models/LessonProgress";
import { queueAssetDeletion } from "./assets";

/** Serializable lesson shape shared by the teacher builder and the learning page. */
export interface ResourceDTO {
  id: string;
  title: string;
  kind: ResourceKind;
  bytes?: number;
  format?: string;
  originalFilename?: string;
  /** External link target (kind "link" only). Files are served via /api/media after an enrollment check. */
  url?: string;
}

export interface LessonDTO {
  id: string;
  title: string;
  description: string;
  order: number;
  videoProvider?: VideoProvider;
  youtubeVideoId?: string;
  /** Identifies the playable video for progress tracking. */
  videoKey?: string;
  /** Legacy Cloudinary upload, still playable until replaced by a YouTube link. */
  legacyVideo?: { bytes: number; duration?: number; originalFilename?: string };
  resources: ResourceDTO[];
  updatedAt: string;
}

type LeanLesson = Pick<ILesson, "_id" | "title" | "description" | "order" | "videoProvider" | "youtubeVideoId" | "video" | "updatedAt"> & {
  resources: IResource[];
};

export function videoProviderOf(l: Pick<ILesson, "youtubeVideoId" | "video">): VideoProvider | undefined {
  return l.youtubeVideoId ? "youtube" : l.video ? "cloudinary" : undefined;
}

/** Key identifying the video a lesson currently plays; progress resets its playback numbers when it changes. */
export function videoKeyOf(l: Pick<ILesson, "youtubeVideoId" | "video">): string | undefined {
  return l.youtubeVideoId ? `yt:${l.youtubeVideoId}` : l.video ? `cld:${l.video.publicId}:${l.video.version}` : undefined;
}

export function toResourceDTO(r: IResource): ResourceDTO {
  return {
    id: String(r._id),
    title: r.title,
    kind: r.kind,
    bytes: r.asset?.bytes,
    format: r.asset?.format,
    originalFilename: r.asset?.originalFilename,
    url: r.kind === "link" ? r.url : undefined,
  };
}

export function toLessonDTO(l: LeanLesson): LessonDTO {
  return {
    id: String(l._id),
    title: l.title,
    description: l.description ?? "",
    order: l.order,
    videoProvider: videoProviderOf(l),
    youtubeVideoId: l.youtubeVideoId,
    videoKey: videoKeyOf(l),
    legacyVideo: l.video ? { bytes: l.video.bytes, duration: l.video.duration, originalFilename: l.video.originalFilename } : undefined,
    resources: l.resources.map(toResourceDTO),
    updatedAt: new Date(l.updatedAt).toISOString(),
  };
}

function assertId(id: string, what: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound(`${what} not found`);
}

async function assertCourse(courseId: string) {
  assertId(courseId, "Course");
  if (!(await Course.exists({ _id: courseId }))) throw notFound("Course not found");
}

async function loadLesson(courseId: string, lessonId: string) {
  assertId(courseId, "Course");
  assertId(lessonId, "Lesson");
  const lesson = await Lesson.findOne({ _id: lessonId, courseId }).lean();
  if (!lesson) throw notFound("Lesson not found");
  return lesson;
}

export async function listLessonsForTeacher(courseId: string) {
  await assertCourse(courseId);
  const lessons = await Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean();
  return lessons.map(toLessonDTO);
}

export async function getLessonForTeacher(courseId: string, lessonId: string) {
  return toLessonDTO(await loadLesson(courseId, lessonId));
}

export async function createLesson(teacher: SessionUser, courseId: string, input: LessonInput, ip: string) {
  await assertCourse(courseId);
  const last = await Lesson.findOne({ courseId }).sort({ order: -1 }).select("order").lean();
  const lesson = await Lesson.create({
    courseId,
    title: input.title,
    description: input.description,
    order: (last?.order ?? -1) + 1,
    ...(input.youtubeVideoId ? { youtubeVideoId: input.youtubeVideoId, videoProvider: "youtube" } : {}),
  });
  await audit({ action: "lesson.created", actor: teacher, targetType: "lesson", targetId: String(lesson._id), ip, metadata: { youtubeVideoId: input.youtubeVideoId } });
  return toLessonDTO(lesson.toObject());
}

/**
 * Updates title/description/video. Setting a YouTube link on a lesson that
 * still has a legacy Cloudinary upload removes that upload (freeing storage).
 * Student progress is keyed by lesson ID, so edits never touch it; a changed
 * video only restarts the playback position (completion is kept).
 */
export async function updateLesson(teacher: SessionUser, courseId: string, lessonId: string, input: LessonUpdateInput, ip: string) {
  const before = await loadLesson(courseId, lessonId);
  if (input.move) await moveLesson(courseId, lessonId, input.move);

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  if (input.title !== undefined) $set.title = input.title;
  if (input.description !== undefined) $set.description = input.description;
  let dropLegacy = false;
  if (input.youtubeVideoId) {
    $set.youtubeVideoId = input.youtubeVideoId;
    $set.videoProvider = "youtube";
    if (before.video) {
      $unset.video = 1;
      dropLegacy = true;
    }
  } else if (input.youtubeVideoId === null) {
    $unset.youtubeVideoId = 1;
    if (before.video) $set.videoProvider = "cloudinary";
    else $unset.videoProvider = 1;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  const lesson = await Lesson.findOneAndUpdate({ _id: lessonId, courseId }, update, { returnDocument: "after", runValidators: true }).lean();
  if (!lesson) throw notFound("Lesson not found");
  if (dropLegacy && before.video) await queueAssetDeletion(before.video, "video_moved_to_youtube");

  const videoChanged = before.youtubeVideoId !== lesson.youtubeVideoId;
  await audit({
    action: "lesson.updated",
    actor: teacher,
    targetType: "lesson",
    targetId: lessonId,
    ip,
    metadata: { fields: [...Object.keys($set), ...Object.keys($unset)], ...(videoChanged ? { youtubeVideoId: lesson.youtubeVideoId ?? null } : {}) },
  });
  return toLessonDTO(lesson);
}

/** Swaps a lesson with its neighbour, after normalising orders to 0..n-1. */
async function moveLesson(courseId: string, lessonId: string, direction: "up" | "down") {
  const lessons = await Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id").lean();
  const i = lessons.findIndex((l) => String(l._id) === lessonId);
  if (i === -1) throw notFound("Lesson not found");
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= lessons.length) return;
  [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
  await writeOrder(lessons.map((l) => l._id));
}

async function writeOrder(ids: Types.ObjectId[]) {
  if (!ids.length) return;
  await Lesson.bulkWrite(ids.map((_id, order) => ({ updateOne: { filter: { _id }, update: { $set: { order } } } })));
}

/** Applies a full new order. The IDs must be exactly the course's current lessons. */
export async function reorderLessons(teacher: SessionUser, courseId: string, lessonIds: string[], ip: string) {
  await assertCourse(courseId);
  const current = await Lesson.find({ courseId }).select("_id").lean();
  const known = new Set(current.map((l) => String(l._id)));
  const unique = new Set(lessonIds);
  if (unique.size !== lessonIds.length || unique.size !== known.size || lessonIds.some((id) => !known.has(id))) {
    throw badRequest("The lesson list has changed. Reload the page and try again.");
  }
  await writeOrder(lessonIds.map((id) => new Types.ObjectId(id)));
  await audit({ action: "lesson.reordered", actor: teacher, targetType: "course", targetId: courseId, ip });
  return listLessonsForTeacher(courseId);
}

/** Deletes a lesson, its files and its progress records, then closes the gap in the ordering. */
export async function deleteLesson(teacher: SessionUser, courseId: string, lessonId: string, ip: string) {
  assertId(courseId, "Course");
  assertId(lessonId, "Lesson");
  const lesson = await Lesson.findOneAndDelete({ _id: lessonId, courseId }).lean();
  if (!lesson) throw notFound("Lesson not found");
  await LessonProgress.deleteMany({ lessonId: lesson._id });
  const rest = await Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id").lean();
  await writeOrder(rest.map((l) => l._id));
  await Promise.all(
    [lesson.video, ...lesson.resources.map((r) => r.asset)].map((a) => (a ? queueAssetDeletion(a, "lesson_deleted") : null)),
  );
  await audit({ action: "lesson.deleted", actor: teacher, targetType: "lesson", targetId: lessonId, ip });
}

export async function addLinkResource(teacher: SessionUser, courseId: string, lessonId: string, input: { title: string; url: string }, ip: string) {
  await loadLesson(courseId, lessonId);
  const resourceId = new Types.ObjectId();
  const lesson = await Lesson.findOneAndUpdate(
    { _id: lessonId, courseId },
    { $push: { resources: { _id: resourceId, title: input.title, kind: "link", url: input.url } } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!lesson) throw notFound("Lesson not found");
  await audit({ action: "resource.link_added", actor: teacher, targetType: "lesson", targetId: lessonId, ip, metadata: { resourceId: String(resourceId) } });
  return toLessonDTO(lesson);
}

/** Renames a resource, or changes a link's target. Files are replaced through the signed upload flow. */
export async function updateResource(
  teacher: SessionUser,
  courseId: string,
  lessonId: string,
  resourceId: string,
  input: { title?: string; url?: string },
  ip: string,
) {
  assertId(resourceId, "Resource");
  const before = await loadLesson(courseId, lessonId);
  const resource = before.resources.find((r) => String(r._id) === resourceId);
  if (!resource) throw notFound("Resource not found");
  if (input.url !== undefined && resource.kind !== "link") throw badRequest("Only link resources have a URL. Upload a new file to replace this one.");

  const $set: Record<string, unknown> = { "resources.$.updatedAt": new Date() };
  if (input.title !== undefined) $set["resources.$.title"] = input.title;
  if (input.url !== undefined) $set["resources.$.url"] = input.url;
  const lesson = await Lesson.findOneAndUpdate({ _id: lessonId, courseId, "resources._id": resourceId }, { $set }, { returnDocument: "after", runValidators: true }).lean();
  if (!lesson) throw notFound("Resource not found");
  await audit({ action: "resource.updated", actor: teacher, targetType: "lesson", targetId: lessonId, ip, metadata: { resourceId } });
  return toLessonDTO(lesson);
}
