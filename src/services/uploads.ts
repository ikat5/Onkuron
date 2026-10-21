import "server-only";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { getCloudinary } from "@/lib/cloudinary";
import { getCloudinaryEnv } from "@/lib/env";
import { AppError, badRequest, forbidden, notFound, tooManyRequests } from "@/lib/errors";
import { hit, RULES } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth/current";
import { Category } from "@/models/Category";
import { Course, type IAsset } from "@/models/Course";
import { Lesson, type ResourceKind } from "@/models/Lesson";
import { Setting } from "@/models/Setting";
import { TeacherProfile } from "@/models/TeacherProfile";
import { UploadIntent, type UploadKind } from "@/models/UploadIntent";
import { hasApprovedEnrollment } from "./enrollment";
import { queueAssetDeletion } from "./assets";

interface KindRule {
  resourceType: IAsset["resourceType"];
  deliveryType: IAsset["deliveryType"];
  extensions: string[];
  mimeTypes: string[];
  maxBytes: () => number;
  needsLesson: boolean;
  /** false for uploads that aren't course material (teacher profile and group photos). */
  needsCourse: boolean;
}

const MB = 1024 * 1024;

/**
 * Upload rules per kind. Thumbnails are public marketing images. Videos and
 * documents use Cloudinary's "authenticated" delivery type, so they can only
 * be fetched through signed URLs that this server issues to enrolled students.
 */
export const KIND_RULES: Record<UploadKind, KindRule> = {
  thumbnail: {
    resourceType: "image",
    deliveryType: "upload",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: () => getCloudinaryEnv().MAX_IMAGE_MB * MB,
    needsLesson: false,
    needsCourse: true,
  },
  teacher_photo: {
    resourceType: "image",
    deliveryType: "upload",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: () => getCloudinaryEnv().MAX_IMAGE_MB * MB,
    needsLesson: false,
    needsCourse: false,
  },
  team_photo: {
    resourceType: "image",
    deliveryType: "upload",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: () => getCloudinaryEnv().MAX_IMAGE_MB * MB,
    needsLesson: false,
    needsCourse: false,
  },
  /** Poster image of the homepage promotional video. */
  promo_thumbnail: {
    resourceType: "image",
    deliveryType: "upload",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: () => getCloudinaryEnv().MAX_IMAGE_MB * MB,
    needsLesson: false,
    needsCourse: false,
  },
  /** Homepage promotional video file, delivered publicly (it's marketing, not course content). */
  promo_video: {
    resourceType: "video",
    deliveryType: "upload",
    extensions: ["mp4", "webm", "mov", "m4v"],
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
    maxBytes: () => getCloudinaryEnv().MAX_VIDEO_MB * MB,
    needsLesson: false,
    needsCourse: false,
  },
  /** Card artwork of a learning category. */
  category_image: {
    resourceType: "image",
    deliveryType: "upload",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: () => getCloudinaryEnv().MAX_IMAGE_MB * MB,
    needsLesson: false,
    needsCourse: false,
  },
  video: {
    resourceType: "video",
    deliveryType: "authenticated",
    extensions: ["mp4", "webm", "mov", "m4v"],
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
    maxBytes: () => getCloudinaryEnv().MAX_VIDEO_MB * MB,
    needsLesson: true,
    needsCourse: true,
  },
  pdf: {
    resourceType: "raw",
    deliveryType: "authenticated",
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
    maxBytes: () => getCloudinaryEnv().MAX_DOCUMENT_MB * MB,
    needsLesson: true,
    needsCourse: true,
  },
  slides: {
    resourceType: "raw",
    deliveryType: "authenticated",
    extensions: ["ppt", "pptx", "odp", "key"],
    mimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.presentation",
      "application/x-iwork-keynote-sffkey",
      "application/octet-stream",
    ],
    maxBytes: () => getCloudinaryEnv().MAX_DOCUMENT_MB * MB,
    needsLesson: true,
    needsCourse: true,
  },
  document: {
    resourceType: "raw",
    deliveryType: "authenticated",
    extensions: ["doc", "docx", "odt", "rtf", "txt", "xls", "xlsx", "csv"],
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.oasis.opendocument.text",
      "application/rtf",
      "text/rtf",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ],
    maxBytes: () => getCloudinaryEnv().MAX_DOCUMENT_MB * MB,
    needsLesson: true,
    needsCourse: true,
  },
};

/** Kinds attached to a category named by `targetId`. */
const TARGETED = new Set<UploadKind>(["category_image"]);

const INTENT_TTL_MS = 60 * 60_000; // Cloudinary rejects signatures older than one hour anyway.
export const CHUNK_SIZE = 20 * MB;

function extensionOf(fileName: string) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  return m ? m[1].toLowerCase() : "";
}

const HEAD_BYTES = 4096;

/** Reads the first bytes of a stored raw asset through a signed delivery URL. */
async function readHead(publicId: string, version: number): Promise<Uint8Array> {
  const url = getCloudinary().url(publicId, { resource_type: "raw", type: "authenticated", version, secure: true, sign_url: true });
  let res: Response;
  try {
    res = await fetch(url, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` }, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    logger.error("uploads.head_failed", { error: err });
    throw new AppError(502, "storage_unavailable", "Could not verify the upload with Cloudinary. Please try again.");
  }
  if (!res.ok || !res.body) {
    logger.error("uploads.head_failed", { status: res.status });
    throw new AppError(502, "storage_unavailable", "Could not verify the upload with Cloudinary. Please try again.");
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < HEAD_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const head = new Uint8Array(Math.min(total, HEAD_BYTES));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, head.length - offset);
    head.set(part, offset);
    offset += part.length;
    if (offset >= head.length) break;
  }
  return head;
}

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * File-signature ("magic number") check, so a renamed executable or HTML
 * page can't be stored as course material just because of its extension.
 */
export function contentMatchesExtension(ext: string, head: Uint8Array): boolean {
  if (head.length === 0) return false;
  const ascii = new TextDecoder("latin1").decode(head.subarray(0, 1024));
  switch (ext) {
    case "pdf":
      return ascii.includes("%PDF-");
    case "pptx":
    case "docx":
    case "xlsx":
    case "odp":
    case "odt":
    case "key":
      return startsWith(head, ZIP);
    case "ppt":
    case "doc":
    case "xls":
      return startsWith(head, OLE);
    case "rtf":
      return ascii.startsWith("{\\rtf");
    case "txt":
    case "csv": {
      if (head.includes(0)) return false;
      const lower = ascii.trimStart().toLowerCase();
      return !startsWith(head, ZIP) && !ascii.startsWith("MZ") && !ascii.startsWith("\x7fELF") && !/^<(!doctype|html|script|svg)/.test(lower);
    }
    default:
      return false;
  }
}

export interface SignUploadInput {
  kind: UploadKind;
  courseId?: string;
  profileId?: string;
  targetId?: string;
  lessonId?: string;
  resourceId?: string;
  title?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Teacher-only. Validates the declared file, records an UploadIntent and
 * returns a signature for a direct browser → Cloudinary upload. The public_id
 * is chosen by the server and included in the signature, so the browser
 * cannot upload to any other location with it. The API secret never leaves
 * the server.
 */
export async function signUpload(teacher: SessionUser, input: SignUploadInput) {
  if (teacher.role !== "teacher") throw forbidden();
  const rl = await hit(RULES.uploadSign, teacher.id);
  if (!rl.allowed) throw tooManyRequests(rl.retryAfterSeconds);

  if (input.kind === "video") {
    throw badRequest("Lesson videos are hosted on YouTube. Paste the video's YouTube link in the lesson editor instead.");
  }
  const rule = KIND_RULES[input.kind];
  const env = getCloudinaryEnv();
  const ext = extensionOf(input.fileName);
  if (!rule.extensions.includes(ext)) {
    throw badRequest(`Unsupported file type. Allowed: ${rule.extensions.join(", ")}`);
  }
  if (input.mimeType && !rule.mimeTypes.includes(input.mimeType.toLowerCase())) {
    throw badRequest("The file's content type does not match the selected upload type.");
  }
  if (input.fileSize > rule.maxBytes()) {
    throw new AppError(413, "too_large", `File is too large. Maximum size is ${Math.round(rule.maxBytes() / MB)} MB.`);
  }

  if (rule.needsCourse) {
    if (!input.courseId || !(await Course.exists({ _id: input.courseId }))) throw notFound("Course not found");
  } else if (input.kind === "teacher_photo") {
    if (!input.profileId) throw badRequest("Save the profile once before uploading a photo.");
    if (!(await TeacherProfile.exists({ _id: input.profileId }))) throw notFound("Profile not found");
  } else if (input.kind === "category_image") {
    if (!input.targetId) throw badRequest("Save the category once before uploading an image.");
    if (!(await Category.exists({ _id: input.targetId }))) throw notFound("The category was not found");
  }
  if (rule.needsLesson) {
    if (!input.lessonId) throw badRequest("A lesson is required for this upload");
    const lesson = await Lesson.findOne({ _id: input.lessonId, courseId: input.courseId }).select("resources._id resources.kind").lean();
    if (!lesson) throw notFound("Lesson not found");
    if (input.resourceId) {
      const existing = lesson.resources.find((r) => String(r._id) === input.resourceId);
      if (!existing) throw notFound("Resource not found");
      if (existing.kind === "link") throw badRequest("Links can't be replaced with a file. Add the file as a new resource.");
    }
    if (!input.resourceId && !input.title) throw badRequest("Give the resource a title");
  }

  const random = randomBytes(12).toString("hex");
  // Raw files keep their extension in the public_id (Cloudinary convention for raw assets).
  const folder = rule.needsCourse ? `onkuron/courses/${input.courseId}` : TARGETED.has(input.kind) || input.kind === "promo_thumbnail" || input.kind === "promo_video" ? "onkuron/site" : "onkuron/teacher";
  const publicId = `${folder}/${input.kind}/${random}${rule.resourceType === "raw" ? `.${ext}` : ""}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const params: Record<string, string | number | boolean> = { timestamp, public_id: publicId, overwrite: false };
  if (rule.deliveryType !== "upload") params.type = rule.deliveryType;
  if (rule.resourceType !== "raw") params.allowed_formats = rule.extensions.join(",");

  const signature = getCloudinary().utils.api_sign_request(params, env.CLOUDINARY_API_SECRET);

  const intent = await UploadIntent.create({
    kind: input.kind,
    publicId,
    resourceType: rule.resourceType,
    deliveryType: rule.deliveryType,
    courseId: rule.needsCourse ? input.courseId : undefined,
    profileId: input.kind === "teacher_photo" ? input.profileId : undefined,
    targetId: TARGETED.has(input.kind) ? input.targetId : undefined,
    lessonId: input.lessonId,
    resourceId: input.resourceId,
    title: input.title,
    originalFilename: input.fileName,
    declaredBytes: input.fileSize,
    createdBy: teacher.id,
    expiresAt: new Date(Date.now() + INTENT_TTL_MS),
  });

  return {
    intentId: String(intent._id),
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${rule.resourceType}/upload`,
    fields: { ...params, api_key: env.CLOUDINARY_API_KEY, signature },
    chunkSize: CHUNK_SIZE,
  };
}

type CloudinaryResource = {
  public_id: string;
  resource_type: string;
  type: string;
  format?: string;
  bytes: number;
  version: number;
  duration?: number;
  secure_url: string;
};

/**
 * Called after the browser finishes uploading. Never trusts metadata from the
 * browser: it re-reads the asset from the Cloudinary Admin API, checks type,
 * format and size, then atomically consumes the intent and attaches the asset.
 * The previous asset is deleted only after the database points at the new one.
 */
export async function completeUpload(teacher: SessionUser, intentId: string, ip: string) {
  if (teacher.role !== "teacher") throw forbidden();
  const intent = await UploadIntent.findOne({
    _id: intentId,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!intent) throw badRequest("This upload session is invalid or has expired. Please upload again.");

  const rule = KIND_RULES[intent.kind];
  let resource: CloudinaryResource;
  try {
    resource = (await getCloudinary().api.resource(intent.publicId, {
      resource_type: intent.resourceType,
      type: intent.deliveryType,
    })) as CloudinaryResource;
  } catch (err) {
    const status = (err as { error?: { http_code?: number } }).error?.http_code;
    if (status === 404) throw badRequest("The upload was not found on Cloudinary. Please try again.");
    logger.error("uploads.verify_failed", { error: err });
    throw new AppError(502, "storage_unavailable", "Could not verify the upload with Cloudinary. Please try again.");
  }

  const formatOk = rule.resourceType === "raw" || (resource.format && rule.extensions.includes(resource.format.toLowerCase()));
  if (resource.public_id !== intent.publicId || resource.resource_type !== intent.resourceType || resource.type !== intent.deliveryType || !formatOk || resource.bytes > rule.maxBytes()) {
    await queueAssetDeletion(intent, "rejected_upload");
    throw badRequest("The uploaded file did not pass validation and was discarded.");
  }

  if (rule.resourceType === "raw") {
    const head = await readHead(intent.publicId, resource.version);
    if (!contentMatchesExtension(extensionOf(intent.originalFilename), head)) {
      await queueAssetDeletion(intent, "rejected_upload_content");
      throw badRequest("The file's contents don't match its type. Export it again as a real PDF, Office or text file.");
    }
  }

  const consumed = await UploadIntent.findOneAndUpdate(
    { _id: intent._id, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } },
  );
  if (!consumed) throw badRequest("This upload was already completed.");

  const asset: IAsset = {
    publicId: intent.publicId,
    resourceType: intent.resourceType,
    deliveryType: intent.deliveryType,
    format: resource.format,
    bytes: resource.bytes,
    version: resource.version,
    originalFilename: intent.originalFilename,
    duration: resource.duration,
    url: intent.deliveryType === "upload" ? resource.secure_url : undefined,
    uploadedAt: new Date(),
  };

  let previous: IAsset | undefined;
  let attached = false;
  if (intent.kind === "teacher_photo") {
    const before = await TeacherProfile.findByIdAndUpdate(intent.profileId, { $set: { photo: asset } }, { returnDocument: "before" }).lean();
    attached = Boolean(before);
    previous = before?.photo;
  } else if (intent.kind === "team_photo") {
    const before = await Setting.findOneAndUpdate({ key: "platform" }, { $set: { teamPhoto: asset } }, { upsert: true, returnDocument: "before" }).lean();
    attached = true;
    previous = before?.teamPhoto;
  } else if (intent.kind === "promo_thumbnail") {
    const before = await Setting.findOneAndUpdate({ key: "platform" }, { $set: { "intro.thumbnail": asset } }, { upsert: true, returnDocument: "before" }).lean();
    attached = true;
    previous = before?.intro?.thumbnail;
  } else if (intent.kind === "promo_video") {
    // An uploaded file replaces the YouTube link.
    const before = await Setting.findOneAndUpdate({ key: "platform" }, { $set: { "intro.video": asset }, $unset: { "intro.youtubeVideoId": 1 } }, { upsert: true, returnDocument: "before" }).lean();
    attached = true;
    previous = before?.intro?.video;
  } else if (intent.kind === "category_image") {
    const before = await Category.findByIdAndUpdate(intent.targetId, { $set: { image: asset } }, { returnDocument: "before" }).lean();
    attached = Boolean(before);
    previous = before?.image;
  } else if (intent.kind === "thumbnail") {
    const before = await Course.findOneAndUpdate({ _id: intent.courseId }, { $set: { thumbnail: asset } }, { returnDocument: "before" }).lean();
    attached = Boolean(before);
    previous = before?.thumbnail;
  } else if (intent.kind === "video") {
    const before = await Lesson.findOneAndUpdate(
      { _id: intent.lessonId, courseId: intent.courseId },
      { $set: { video: asset } },
      { returnDocument: "before" },
    ).lean();
    attached = Boolean(before);
    previous = before?.video;
  } else if (intent.resourceId) {
    const before = await Lesson.findOneAndUpdate(
      { _id: intent.lessonId, courseId: intent.courseId, "resources._id": intent.resourceId },
      { $set: { "resources.$.asset": asset, "resources.$.kind": intent.kind as ResourceKind, "resources.$.updatedAt": new Date() } },
      { returnDocument: "before" },
    ).lean();
    attached = Boolean(before);
    previous = before?.resources.find((r) => String(r._id) === String(intent.resourceId))?.asset;
  } else {
    const res = await Lesson.updateOne(
      { _id: intent.lessonId, courseId: intent.courseId },
      { $push: { resources: { _id: new Types.ObjectId(), title: intent.title ?? intent.originalFilename, kind: intent.kind, asset } } },
    );
    attached = res.matchedCount === 1;
  }

  if (!attached) {
    // The course/lesson disappeared meanwhile: don't leave an orphaned file.
    await queueAssetDeletion(asset, "target_missing");
    const gone: Partial<Record<UploadKind, string>> = { teacher_photo: "The profile no longer exists.", category_image: "The category no longer exists." };
    throw notFound(gone[intent.kind] ?? "The course or lesson no longer exists.");
  }
  if (previous && previous.publicId !== asset.publicId) await queueAssetDeletion(previous, `replaced_${intent.kind}`);

  await audit({
    action: previous ? "asset.replaced" : "asset.uploaded",
    actor: teacher,
    targetType: intent.kind,
    targetId: String(intent.lessonId ?? intent.courseId ?? intent.profileId ?? intent.targetId ?? "platform"),
    ip,
    metadata: { publicId: asset.publicId, bytes: asset.bytes },
  });
  return asset;
}

export async function removeLessonVideo(teacher: SessionUser, courseId: string, lessonId: string, ip: string) {
  const before = await Lesson.findOneAndUpdate({ _id: lessonId, courseId }, { $unset: { video: 1 } }, { returnDocument: "before" }).lean();
  if (!before) throw notFound("Lesson not found");
  if (before.video) await queueAssetDeletion(before.video, "video_removed");
  await audit({ action: "asset.video_removed", actor: teacher, targetType: "lesson", targetId: lessonId, ip });
}

export async function removeLessonResource(teacher: SessionUser, courseId: string, lessonId: string, resourceId: string, ip: string) {
  const before = await Lesson.findOneAndUpdate(
    { _id: lessonId, courseId, "resources._id": resourceId },
    { $pull: { resources: { _id: resourceId } } },
    { returnDocument: "before" },
  ).lean();
  if (!before) throw notFound("Resource not found");
  const removed = before.resources.find((r) => String(r._id) === resourceId);
  if (removed?.asset) await queueAssetDeletion(removed.asset, "resource_removed");
  await audit({ action: "asset.resource_removed", actor: teacher, targetType: "lesson", targetId: lessonId, ip });
}

const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;
const VIDEO_TOKEN_TTL_SECONDS = 2 * 60 * 60;

/**
 * Issues a delivery URL for protected lesson media, only after confirming the
 * requester is the teacher or a student with an *approved* enrollment.
 *
 * - Documents/slides/PDFs: Cloudinary private download URL that expires after
 *   10 minutes (`expires_at` is part of the API signature).
 * - Videos: if CLOUDINARY_AUTH_TOKEN_KEY is set (Cloudinary token-based
 *   authentication), a token URL valid for 2 hours. Otherwise a signed
 *   delivery URL for the authenticated asset; such signatures do not expire,
 *   so they are only handed out per request behind this enrollment check and
 *   never stored client-side. See SECURITY.md for this limitation.
 */
export async function getProtectedMediaUrl(user: SessionUser, lessonId: string, resourceId?: string) {
  if (!Types.ObjectId.isValid(lessonId) || (resourceId && !Types.ObjectId.isValid(resourceId))) throw notFound();
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) throw notFound();
  if (user.role !== "teacher") {
    const course = await Course.findOne({ _id: lesson.courseId, published: true }).select("_id").lean();
    if (!course || !(await hasApprovedEnrollment(user.id, lesson.courseId))) {
      await audit({ action: "media.denied", actor: user, targetType: "lesson", targetId: lessonId });
      throw forbidden("You need an approved enrollment to access this content.");
    }
  }

  const resource = resourceId ? lesson.resources.find((r) => String(r._id) === resourceId) : undefined;
  if (resourceId && !resource) throw notFound();
  // External links are also handed out only after the enrollment check above.
  if (resource?.kind === "link") return resource.url!;
  const asset = resource ? resource.asset : lesson.video;
  if (!asset) throw notFound();

  const cloudinary = getCloudinary();
  if (asset.resourceType === "video") {
    const tokenKey = process.env.CLOUDINARY_AUTH_TOKEN_KEY;
    return cloudinary.url(asset.publicId, {
      resource_type: "video",
      type: asset.deliveryType,
      version: asset.version,
      secure: true,
      sign_url: true,
      ...(tokenKey ? { auth_token: { key: tokenKey, duration: VIDEO_TOKEN_TTL_SECONDS } } : {}),
    });
  }
  return cloudinary.utils.private_download_url(asset.publicId, "", {
    resource_type: asset.resourceType,
    type: asset.deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_SECONDS,
    attachment: false,
  });
}
