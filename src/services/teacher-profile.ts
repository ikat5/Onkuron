import "server-only";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { audit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth/current";
import { teamFilter, type Team } from "@/lib/team";
import type { TeacherProfileInput } from "@/lib/validation";
import { Course } from "@/models/Course";
import { TeacherProfile, type ITeacherProfile } from "@/models/TeacherProfile";
import { queueAssetDeletion } from "./assets";
import { slugify } from "./courses";

/** Everything the admin can edit. */
export interface TeacherProfileDTO {
  id: string;
  team: Team;
  published: boolean;
  order: number;
  displayName: string;
  slug: string;
  headline: string;
  qualification: string;
  facebookUrl: string;
  youtubeChannelUrl: string;
  shortBio: string;
  bio: string;
  philosophy: string;
  subjects: string[];
  expertise: string[];
  achievements: Array<{ id: string; title: string; description: string; year?: number }>;
  courseIds: string[];
  photoUrl?: string;
  youtubeVideoId?: string;
  updatedAt?: string;
}

/** What visitors see. Built only from a published profile; contains no internal fields. */
export type PublicTeacherProfile = Omit<TeacherProfileDTO, "id" | "published" | "order" | "updatedAt" | "courseIds">;

type LeanProfile = Omit<ITeacherProfile, "achievements"> & { achievements: ITeacherProfile["achievements"][number][] };

function toDTO(p: LeanProfile): TeacherProfileDTO {
  return {
    id: String(p._id),
    team: p.team ?? "teacher",
    published: p.published,
    order: p.order ?? 0,
    displayName: p.displayName,
    slug: p.slug,
    headline: p.headline ?? "",
    qualification: p.qualification ?? "",
    facebookUrl: p.facebookUrl ?? "",
    youtubeChannelUrl: p.youtubeChannelUrl ?? "",
    shortBio: p.shortBio ?? "",
    bio: p.bio ?? "",
    philosophy: p.philosophy ?? "",
    subjects: p.subjects ?? [],
    expertise: p.expertise ?? [],
    achievements: [...(p.achievements ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((a) => ({ id: String(a._id), title: a.title, description: a.description ?? "", year: a.year ?? undefined })),
    courseIds: (p.courseIds ?? []).map(String),
    photoUrl: p.photo?.url,
    youtubeVideoId: p.youtubeVideoId,
    updatedAt: p.updatedAt?.toISOString(),
  };
}

export function toPublicProfile(p: TeacherProfileDTO): PublicTeacherProfile {
  const { id: _id, published: _p, order: _o, updatedAt: _u, courseIds: _c, ...rest } = p;
  void [_id, _p, _o, _u, _c];
  return rest;
}

/**
 * The first version stored a single profile with a unique `key` index, which
 * would reject a second profile. Dropped before each create (adding a teacher
 * is rare, and the check is a cheap index listing).
 */
async function dropLegacyIndex() {
  try {
    const indexes = await TeacherProfile.collection.indexes();
    if (indexes.some((i) => i.name === "key_1")) await TeacherProfile.collection.dropIndex("key_1");
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 26 && code !== 27) logger.warn("teacher_profile.legacy_index", { error: err }); // 26/27: no collection/index yet
  }
}

const sorted = { order: 1 as const, createdAt: 1 as const };

function assertId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound("Profile not found");
}

/* ---------- Admin ---------- */

export async function listTeacherProfiles(team: Team = "teacher"): Promise<TeacherProfileDTO[]> {
  const docs = await TeacherProfile.find(teamFilter(team)).sort(sorted).lean();
  return docs.map((d) => toDTO(d as LeanProfile));
}

/** With `team`, a profile of another team counts as not found (keeps admin URLs honest). */
export async function getTeacherProfile(id: string, team?: Team): Promise<TeacherProfileDTO> {
  assertId(id);
  const p = await TeacherProfile.findOne({ _id: id, ...(team ? teamFilter(team) : {}) }).lean();
  if (!p) throw notFound("Profile not found");
  return toDTO(p as LeanProfile);
}

/** Only existing course IDs are kept, so a profile can't point at made-up courses. */
async function existingCourseIds(ids: string[]) {
  if (!ids.length) return [];
  const found = await Course.find({ _id: { $in: ids } }).select("_id").lean();
  return found.map((c) => c._id);
}

function fieldsFrom(input: TeacherProfileInput) {
  return {
    published: input.published,
    displayName: input.displayName,
    headline: input.headline,
    qualification: input.qualification,
    facebookUrl: input.facebookUrl,
    youtubeChannelUrl: input.youtubeChannelUrl,
    shortBio: input.shortBio,
    bio: input.bio,
    philosophy: input.philosophy,
    subjects: input.subjects,
    expertise: input.expertise,
    // Order is the position in the submitted list.
    achievements: input.achievements.map((a, order) => ({ title: a.title, description: a.description, ...(a.year ? { year: a.year } : {}), order })),
  };
}

async function uniqueSlug(base: string, excludeId?: Types.ObjectId) {
  let slug = base || `teacher-${randomBytes(2).toString("hex")}`;
  for (let i = 0; i < 5 && (await TeacherProfile.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })); i++) {
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }
  return slug;
}

export async function createTeacherProfile(admin: SessionUser, input: TeacherProfileInput, ip: string) {
  await dropLegacyIndex();
  // An explicitly chosen URL must be free; a generated one is made unique.
  if (input.slug && (await TeacherProfile.exists({ slug: input.slug }))) throw conflict("That profile URL is already used by another profile");
  const slug = input.slug || (await uniqueSlug(slugify(input.displayName)));
  // Always append after the team's existing profiles (profiles from the single-profile version may lack `order`).
  const team = teamFilter(input.team);
  const [last, count] = await Promise.all([TeacherProfile.findOne({ ...team, order: { $exists: true } }).sort({ order: -1 }).select("order").lean(), TeacherProfile.countDocuments(team)]);
  try {
    const doc = await TeacherProfile.create({
      ...fieldsFrom(input),
      team: input.team,
      slug,
      order: Math.max((last?.order ?? -1) + 1, count),
      courseIds: await existingCourseIds(input.courseIds),
      ...(input.youtubeVideoId ? { youtubeVideoId: input.youtubeVideoId } : {}),
    });
    await audit({ action: "teacher_profile.created", actor: admin, targetType: "teacher_profile", targetId: String(doc._id), ip, metadata: { team: input.team } });
    return toDTO(doc.toObject() as LeanProfile);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict("That profile URL is already used by another profile");
    throw err;
  }
}

export async function updateTeacherProfile(admin: SessionUser, id: string, input: TeacherProfileInput, ip: string) {
  assertId(id);
  const _id = new Types.ObjectId(id);
  const slug = input.slug || (await uniqueSlug(slugify(input.displayName), _id));
  const update: Record<string, unknown> = { $set: { ...fieldsFrom(input), slug, courseIds: await existingCourseIds(input.courseIds) } };
  if (input.youtubeVideoId) (update.$set as Record<string, unknown>).youtubeVideoId = input.youtubeVideoId;
  else update.$unset = { youtubeVideoId: 1 };
  try {
    const p = await TeacherProfile.findByIdAndUpdate(_id, update, { returnDocument: "after", runValidators: true }).lean();
    if (!p) throw notFound("Profile not found");
    await audit({ action: "teacher_profile.updated", actor: admin, targetType: "teacher_profile", targetId: id, ip, metadata: { published: input.published } });
    return toDTO(p as LeanProfile);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict("That profile URL is already used by another profile");
    throw err;
  }
}

export async function deleteTeacherProfile(admin: SessionUser, id: string, ip: string) {
  assertId(id);
  const p = await TeacherProfile.findByIdAndDelete(id).lean();
  if (!p) throw notFound("Profile not found");
  if (p.photo) await queueAssetDeletion(p.photo, "teacher_profile_deleted");
  await audit({ action: "teacher_profile.deleted", actor: admin, targetType: "teacher_profile", targetId: id, ip, metadata: { displayName: p.displayName } });
}

/** Applies a full new order; the IDs must be exactly the team's existing profiles. */
export async function reorderTeacherProfiles(admin: SessionUser, ids: string[], team: Team, ip: string) {
  const current = await TeacherProfile.find(teamFilter(team)).select("_id").lean();
  const known = new Set(current.map((p) => String(p._id)));
  const unique = new Set(ids);
  if (unique.size !== ids.length || unique.size !== known.size || ids.some((id) => !known.has(id))) {
    throw badRequest("The teacher list has changed. Reload the page and try again.");
  }
  await TeacherProfile.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: { order } } } })));
  await audit({ action: "teacher_profile.reordered", actor: admin, ip, metadata: { team } });
  return listTeacherProfiles(team);
}

export async function removeTeacherPhoto(admin: SessionUser, id: string, ip: string) {
  assertId(id);
  const before = await TeacherProfile.findByIdAndUpdate(id, { $unset: { photo: 1 } }, { returnDocument: "before" }).lean();
  if (!before) throw notFound("Profile not found");
  if (before.photo) await queueAssetDeletion(before.photo, "teacher_photo_removed");
  await audit({ action: "teacher_profile.photo_removed", actor: admin, targetType: "teacher_profile", targetId: id, ip });
}

/* ---------- Public ---------- */

/** A team's published profiles in admin-defined order. Never throws (public pages must render). */
export async function listPublicTeacherProfiles(team: Team = "teacher"): Promise<PublicTeacherProfile[]> {
  try {
    const docs = await TeacherProfile.find({ ...teamFilter(team), published: true }).sort(sorted).lean();
    return docs.map((d) => toPublicProfile(toDTO(d as LeanProfile)));
  } catch {
    return [];
  }
}

/** A published profile plus the published courses it is linked to. */
export async function getPublicTeacherProfile(slug: string, team: Team = "teacher") {
  const p = await TeacherProfile.findOne({ ...teamFilter(team), slug: slug.toLowerCase(), published: true }).lean();
  if (!p) return null;
  const dto = toDTO(p as LeanProfile);
  return { profile: toPublicProfile(dto), courseIds: dto.courseIds };
}

/** Published teachers linked to a course (for the course page). */
export async function listTeachersForCourse(courseId: Types.ObjectId | string): Promise<PublicTeacherProfile[]> {
  try {
    const docs = await TeacherProfile.find({ ...teamFilter("teacher"), published: true, courseIds: courseId }).sort(sorted).lean();
    return docs.map((d) => toPublicProfile(toDTO(d as LeanProfile)));
  } catch {
    return [];
  }
}
