import { describe, expect, it } from "vitest";
import * as lessons from "@/app/api/teacher/courses/[courseId]/lessons/route";
import * as lessonOne from "@/app/api/teacher/courses/[courseId]/lessons/[lessonId]/route";
import * as order from "@/app/api/teacher/courses/[courseId]/lessons/order/route";
import * as resources from "@/app/api/teacher/courses/[courseId]/lessons/[lessonId]/resources/route";
import * as resourceOne from "@/app/api/teacher/courses/[courseId]/lessons/[lessonId]/resources/[resourceId]/route";
import * as learnCourse from "@/app/api/learn/courses/[courseId]/route";
import * as learnLesson from "@/app/api/learn/lessons/[lessonId]/route";
import * as progressRoute from "@/app/api/learn/lessons/[lessonId]/progress/route";
import * as mediaResource from "@/app/api/media/[lessonId]/[resourceId]/route";
import * as conversation from "@/app/api/chat/conversation/route";
import * as messages from "@/app/api/chat/[conversationId]/messages/route";
import { parseYouTubeUrl } from "@/lib/youtube";
import { contentMatchesExtension } from "@/services/uploads";
import { AssetDeletion } from "@/models/AssetDeletion";
import type { Types } from "mongoose";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { Lesson } from "@/models/Lesson";
import { LessonProgress } from "@/models/LessonProgress";
import { call, createUser } from "./helpers/http";

const ID = "dQw4w9WgXcQ";
const ID2 = "M7lc1UVf-VE";

async function world(opts: { published?: boolean } = {}) {
  const course = await Course.create({ title: "Physics", slug: "physics", price: 1200, published: opts.published ?? true });
  const t = await createUser({ role: "teacher", email: "teacher@example.test" });
  const s = await createUser({ email: "s1@example.test" });
  const courseId = String(course._id);
  return { course, courseId, t, s };
}

async function enroll(studentId: Types.ObjectId, courseId: Types.ObjectId, status: "pending" | "approved" | "rejected", tx = "TX123456") {
  return Enrollment.create({ studentId, courseId, status, active: status !== "rejected", amount: 1200, paymentMethod: "bkash", transactionId: tx, senderNumber: "01712345678" });
}

async function addLesson(cookie: string, courseId: string, body: Record<string, unknown>) {
  return call(lessons.POST, { cookie, params: { courseId }, body: { description: "", ...body } });
}

describe("YouTube URL parsing", () => {
  it("accepts the standard YouTube URL formats and extracts only the video ID", () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abc123`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `youtu.be/${ID}`,
      `  https://www.youtube.com/watch?v=${ID}  `,
    ]) {
      expect(parseYouTubeUrl(url), url).toBe(ID);
    }
  });

  it("rejects malformed URLs and untrusted domains", () => {
    for (const url of [
      "",
      "not a url",
      `https://evil.example/watch?v=${ID}`,
      `https://youtube.com.evil.example/watch?v=${ID}`,
      `https://evilyoutube.com/watch?v=${ID}`,
      `https://user:pass@www.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com:8443/watch?v=${ID}`,
      `javascript:alert(1)//youtube.com/watch?v=${ID}`,
      `ftp://youtube.com/watch?v=${ID}`,
      "https://www.youtube.com/watch?v=short",
      `https://www.youtube.com/watch?v=${ID}x`,
      `https://www.youtube.com/watch?v=${ID.slice(0, 10)}<`,
      "https://www.youtube.com/playlist?list=PL123",
      `https://www.youtube.com/embed/${ID}/extra`,
      `https://youtu.be/watch?v=${ID}`,
      `https://www.youtube-nocookie.com/watch?v=${ID}`,
    ]) {
      expect(parseYouTubeUrl(url), url).toBeNull();
    }
  });
});

describe("file content checks", () => {
  const bytes = (s: string) => new TextEncoder().encode(s);
  it("matches real file signatures and rejects disguised files", () => {
    expect(contentMatchesExtension("pdf", bytes("%PDF-1.7 ..."))).toBe(true);
    expect(contentMatchesExtension("pdf", bytes("<html><script>"))).toBe(false);
    expect(contentMatchesExtension("pptx", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]))).toBe(true);
    expect(contentMatchesExtension("pptx", bytes("%PDF-1.7"))).toBe(false);
    expect(contentMatchesExtension("doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(true);
    expect(contentMatchesExtension("rtf", bytes("{\\rtf1\\ansi"))).toBe(true);
    expect(contentMatchesExtension("txt", bytes("অধ্যায় ১ — নোট\nplain text"))).toBe(true);
    expect(contentMatchesExtension("txt", new Uint8Array([0x4d, 0x5a, 0x90, 0]))).toBe(false);
    expect(contentMatchesExtension("csv", bytes("<!DOCTYPE html><html>"))).toBe(false);
    expect(contentMatchesExtension("pdf", new Uint8Array())).toBe(false);
  });
});

describe("teacher lesson management", () => {
  it("creates a lesson with a validated YouTube video and never trusts a client-supplied ID", async () => {
    const { courseId, t } = await world();
    const res = await addLesson(t.cookie, courseId, { title: "Vectors", description: "Intro", youtubeUrl: `https://youtu.be/${ID}`, youtubeVideoId: "AAAAAAAAAAA", order: 99 });
    expect(res.status).toBe(201);
    expect(res.json.lesson).toMatchObject({ title: "Vectors", youtubeVideoId: ID, videoProvider: "youtube", order: 0 });
    const saved = await Lesson.findById(res.json.id).lean();
    expect(saved).toMatchObject({ youtubeVideoId: ID, videoProvider: "youtube", order: 0 });

    // A lesson without a video yet is fine.
    const second = await addLesson(t.cookie, courseId, { title: "Motion" });
    expect(second.status).toBe(201);
    expect(second.json.lesson.youtubeVideoId).toBeUndefined();
    expect(second.json.lesson.order).toBe(1);

    const list = await call(lessons.GET, { cookie: t.cookie, params: { courseId } });
    expect(list.json.lessons.map((l: { title: string }) => l.title)).toEqual(["Vectors", "Motion"]);
  });

  it("rejects invalid or untrusted video URLs with a field error", async () => {
    const { courseId, t } = await world();
    for (const youtubeUrl of ["https://vimeo.com/123456", `https://evil.example/watch?v=${ID}`, "youtube", `https://youtube.com/watch?v=${ID}"><script>`]) {
      const res = await addLesson(t.cookie, courseId, { title: "Bad", youtubeUrl });
      expect(res.status, youtubeUrl).toBe(400);
      expect(res.json.error.details.fields.youtubeUrl[0]).toMatch(/YouTube/);
    }
    expect(await Lesson.countDocuments()).toBe(0);
  });

  it("edits, replaces and removes a lesson's video; a legacy upload is retired when a YouTube link is set", async () => {
    const { courseId, t } = await world();
    const created = await addLesson(t.cookie, courseId, { title: "Vectors", youtubeUrl: `https://www.youtube.com/watch?v=${ID}` });
    const params = { courseId, lessonId: created.json.id };

    const edited = await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params, body: { title: "Vectors 101", description: "Updated", youtubeUrl: `https://www.youtube.com/shorts/${ID2}` } });
    expect(edited.status).toBe(200);
    expect(edited.json.lesson).toMatchObject({ title: "Vectors 101", description: "Updated", youtubeVideoId: ID2 });

    const got = await call(lessonOne.GET, { cookie: t.cookie, params });
    expect(got.json.lesson.youtubeVideoId).toBe(ID2);

    const bad = await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params, body: { youtubeUrl: "https://example.com/video.mp4" } });
    expect(bad.status).toBe(400);
    expect((await Lesson.findById(created.json.id).lean())!.youtubeVideoId).toBe(ID2);

    const cleared = await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params, body: { youtubeUrl: "" } });
    expect(cleared.json.lesson.youtubeVideoId).toBeUndefined();
    expect(cleared.json.lesson.videoProvider).toBeUndefined();

    // Legacy Cloudinary video → replaced by YouTube; the old file is queued for deletion.
    const legacy = { publicId: "onkuron/courses/x/video/old", resourceType: "video", deliveryType: "authenticated", bytes: 10, version: 1, uploadedAt: new Date() };
    await Lesson.updateOne({ _id: created.json.id }, { $set: { video: legacy } });
    const before = await call(lessonOne.GET, { cookie: t.cookie, params });
    expect(before.json.lesson.videoProvider).toBe("cloudinary");
    const migrated = await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params, body: { youtubeUrl: `https://youtu.be/${ID}` } });
    expect(migrated.json.lesson).toMatchObject({ youtubeVideoId: ID, videoProvider: "youtube" });
    expect(migrated.json.lesson.legacyVideo).toBeUndefined();
    expect(await AssetDeletion.countDocuments({ publicId: legacy.publicId })).toBe(1);
  });

  it("requires the teacher role and an existing course/lesson", async () => {
    const { courseId, s, t } = await world();
    expect((await addLesson(s.cookie, courseId, { title: "Hack", youtubeUrl: `https://youtu.be/${ID}` })).status).toBe(403);
    expect((await call(lessons.GET, { cookie: s.cookie, params: { courseId } })).status).toBe(403);
    expect((await addLesson("", courseId, { title: "Hack" })).status).toBe(401);
    expect((await addLesson(t.cookie, "a".repeat(24), { title: "Orphan" })).status).toBe(404);
    expect((await addLesson(t.cookie, "not-an-id", { title: "Orphan" })).status).toBe(404);
    // A lesson can't be edited through another course's URL.
    const other = await Course.create({ title: "Other", slug: "other", price: 1 });
    const l = await addLesson(t.cookie, courseId, { title: "Mine" });
    const res = await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params: { courseId: String(other._id), lessonId: l.json.id }, body: { title: "Moved" } });
    expect(res.status).toBe(404);
  });

  it("reorders lessons only with an exact permutation of the course's lessons", async () => {
    const { courseId, t } = await world();
    const ids: string[] = [];
    for (const title of ["Ax", "Bx", "Cx"]) ids.push((await addLesson(t.cookie, courseId, { title })).json.id);
    const res = await call(order.PUT, { cookie: t.cookie, method: "PUT", params: { courseId }, body: { lessonIds: [ids[2], ids[0], ids[1]] } });
    expect(res.status).toBe(200);
    expect(res.json.lessons.map((l: { title: string; order: number }) => `${l.order}:${l.title}`)).toEqual(["0:Cx", "1:Ax", "2:Bx"]);

    const foreign = await Lesson.create({ courseId: (await Course.create({ title: "X", slug: "x", price: 1 }))._id, title: "Foreign", order: 0 });
    for (const lessonIds of [[ids[0], ids[1]], [ids[0], ids[0], ids[1]], [ids[0], ids[1], String(foreign._id)]]) {
      expect((await call(order.PUT, { cookie: t.cookie, method: "PUT", params: { courseId }, body: { lessonIds } })).status).toBe(400);
    }
    // Legacy up/down moves still work.
    await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params: { courseId, lessonId: ids[1] }, body: { move: "up" } });
    const list = await call(lessons.GET, { cookie: t.cookie, params: { courseId } });
    expect(list.json.lessons.map((l: { title: string }) => l.title)).toEqual(["Cx", "Bx", "Ax"]);
  });

  it("deletes a lesson, renumbers the rest and keeps other lessons' student progress", async () => {
    const { course, courseId, t, s } = await world();
    const ids: string[] = [];
    for (const title of ["Ax", "Bx", "Cx"]) ids.push((await addLesson(t.cookie, courseId, { title, youtubeUrl: `https://youtu.be/${ID}` })).json.id);
    await enroll(s.user._id, course._id, "approved");
    for (const lessonId of ids) {
      const r = await call(progressRoute.POST, { cookie: s.cookie, params: { lessonId }, body: { completed: true } });
      expect(r.status, JSON.stringify(r.json)).toBe(200);
    }
    expect(await LessonProgress.countDocuments({ completed: true })).toBe(3);

    expect((await call(lessonOne.DELETE, { cookie: t.cookie, method: "DELETE", params: { courseId, lessonId: ids[1] } })).status).toBe(200);
    const left = await Lesson.find({ courseId }).sort({ order: 1 }).lean();
    expect(left.map((l) => `${l.order}:${l.title}`)).toEqual(["0:Ax", "1:Cx"]);
    expect(await LessonProgress.countDocuments({ lessonId: ids[1] })).toBe(0);
    expect(await LessonProgress.countDocuments({ lessonId: { $in: [ids[0], ids[2]] }, completed: true })).toBe(2);

    const view = await call(learnCourse.GET, { cookie: s.cookie, params: { courseId } });
    expect(view.json.lessons).toHaveLength(2);
    expect(view.json.progress.filter((p: { completed: boolean }) => p.completed)).toHaveLength(2);
  });

  it("adds, edits and removes link resources with strict URL validation", async () => {
    const { courseId, t } = await world();
    const l = await addLesson(t.cookie, courseId, { title: "Reading" });
    const params = { courseId, lessonId: l.json.id };
    for (const url of ["javascript:alert(1)", "http://insecure.example/page", "https://user:pw@example.com/x", "notaurl"]) {
      expect((await call(resources.POST, { cookie: t.cookie, params, body: { title: "Bad", url } })).status, url).toBe(400);
    }
    const added = await call(resources.POST, { cookie: t.cookie, params, body: { title: "Textbook", url: "https://nctb.gov.bd/physics.pdf" } });
    expect(added.status).toBe(201);
    const r = added.json.lesson.resources[0];
    expect(r).toMatchObject({ title: "Textbook", kind: "link", url: "https://nctb.gov.bd/physics.pdf" });

    const edited = await call(resourceOne.PATCH, { cookie: t.cookie, method: "PATCH", params: { ...params, resourceId: r.id }, body: { title: "NCTB textbook", url: "https://example.org/read" } });
    expect(edited.status).toBe(200);
    expect(edited.json.lesson.resources[0]).toMatchObject({ title: "NCTB textbook", url: "https://example.org/read" });

    // Files can be renamed but don't have a URL to change.
    const doc = { publicId: "onkuron/courses/x/pdf/a.pdf", resourceType: "raw", deliveryType: "authenticated", bytes: 10, version: 1, uploadedAt: new Date() };
    await Lesson.updateOne({ _id: l.json.id }, { $push: { resources: { title: "Notes", kind: "pdf", asset: doc } } });
    const fileId = String((await Lesson.findById(l.json.id).lean())!.resources[1]._id);
    expect((await call(resourceOne.PATCH, { cookie: t.cookie, method: "PATCH", params: { ...params, resourceId: fileId }, body: { url: "https://example.org" } })).status).toBe(400);
    const renamed = await call(resourceOne.PATCH, { cookie: t.cookie, method: "PATCH", params: { ...params, resourceId: fileId }, body: { title: "Chapter notes" } });
    expect(renamed.json.lesson.resources[1]).toMatchObject({ title: "Chapter notes", kind: "pdf", bytes: 10 });

    expect((await call(resourceOne.DELETE, { cookie: t.cookie, method: "DELETE", params: { ...params, resourceId: r.id } })).status).toBe(200);
    expect((await call(resourceOne.DELETE, { cookie: t.cookie, method: "DELETE", params: { ...params, resourceId: fileId } })).status).toBe(200);
    expect((await Lesson.findById(l.json.id).lean())!.resources).toHaveLength(0);
    expect(await AssetDeletion.countDocuments({ publicId: doc.publicId })).toBe(1);
  });
});

describe("protected learning content", () => {
  async function withLesson() {
    const w = await world();
    const l = await addLesson(w.t.cookie, w.courseId, { title: "Vectors", description: "Paid notes", youtubeUrl: `https://youtu.be/${ID}` });
    const link = await call(resources.POST, { cookie: w.t.cookie, params: { courseId: w.courseId, lessonId: l.json.id }, body: { title: "Extra", url: "https://example.org/extra" } });
    return { ...w, lessonId: l.json.id as string, resourceId: link.json.lesson.resources[0].id as string };
  }

  it("denies anonymous, non-enrolled, pending and rejected students", async () => {
    const { course, courseId, lessonId, resourceId, s } = await withLesson();
    const check = async (cookie: string | undefined, expected: number) => {
      expect((await call(learnCourse.GET, { cookie, params: { courseId } })).status).toBe(expected);
      expect((await call(learnLesson.GET, { cookie, params: { lessonId } })).status).toBe(expected);
      expect((await call(progressRoute.POST, { cookie, params: { lessonId }, body: { completed: true } })).status).toBe(expected);
      expect((await call(mediaResource.GET, { cookie, params: { lessonId, resourceId } })).status).toBe(expected);
    };
    await check(undefined, 401);
    await check(s.cookie, 403);
    const pending = await enroll(s.user._id, course._id, "pending");
    await check(s.cookie, 403);
    await Enrollment.updateOne({ _id: pending._id }, { $set: { status: "rejected", active: false } });
    await check(s.cookie, 403);
    expect(await LessonProgress.countDocuments()).toBe(0);
  });

  it("serves lesson details, video ID and resources to approved students only while the course is published", async () => {
    const { course, courseId, lessonId, resourceId, s } = await withLesson();
    await enroll(s.user._id, course._id, "approved");
    const view = await call(learnCourse.GET, { cookie: s.cookie, params: { courseId } });
    expect(view.status).toBe(200);
    expect(view.json.lessons[0]).toMatchObject({ title: "Vectors", description: "Paid notes", youtubeVideoId: ID, videoKey: `yt:${ID}` });
    const one = await call(learnLesson.GET, { cookie: s.cookie, params: { lessonId } });
    expect(one.json.lesson.youtubeVideoId).toBe(ID);
    const link = await call(mediaResource.GET, { cookie: s.cookie, params: { lessonId, resourceId } });
    expect(link.status).toBe(302);
    expect(link.headers.get("location")).toBe("https://example.org/extra");

    await Course.updateOne({ _id: course._id }, { $set: { published: false } });
    expect((await call(learnCourse.GET, { cookie: s.cookie, params: { courseId } })).status).toBe(404);
    expect((await call(learnLesson.GET, { cookie: s.cookie, params: { lessonId } })).status).toBe(403);
  });
});

describe("video progress", () => {
  async function approved() {
    const w = await world();
    const l = await addLesson(w.t.cookie, w.courseId, { title: "Vectors", youtubeUrl: `https://youtu.be/${ID}` });
    await enroll(w.s.user._id, w.course._id, "approved");
    return { ...w, lessonId: l.json.id as string };
  }
  const beat = (cookie: string, lessonId: string, body: Record<string, unknown>) => call(progressRoute.POST, { cookie, params: { lessonId }, body: { videoKey: `yt:${ID}`, ...body } });
  const rewindLastReport = (lessonId: string, seconds: number) => LessonProgress.updateOne({ lessonId }, { $set: { lastReportAt: new Date(Date.now() - seconds * 1000) } });

  it("records position and real watch time, clamped to what playback could produce", async () => {
    const { s, lessonId } = await approved();
    const first = await beat(s.cookie, lessonId, { positionSeconds: 30, durationSeconds: 600, watchedDelta: 500 });
    expect(first.status).toBe(200);
    // First report: at most ~1 minute of watching is believable.
    expect(first.json.progress.watchedSeconds).toBeLessThanOrEqual(62);
    expect(first.json.progress).toMatchObject({ positionSeconds: 30, durationSeconds: 600, completed: false });

    // A burst of reports can't add more than 2× the elapsed wall-clock time.
    const burst = await beat(s.cookie, lessonId, { positionSeconds: 40, durationSeconds: 600, watchedDelta: 600 });
    expect(burst.json.progress.watchedSeconds - first.json.progress.watchedSeconds).toBeLessThanOrEqual(3);

    // Position is clamped to the duration; reports for another video don't count.
    const clamp = await beat(s.cookie, lessonId, { positionSeconds: 5000, durationSeconds: 600 });
    expect(clamp.json.progress.positionSeconds).toBe(600);
    const stale = await beat(s.cookie, lessonId, { videoKey: `yt:${ID2}`, positionSeconds: 5, watchedDelta: 50 });
    expect(stale.json.progress.positionSeconds).toBe(600);
  });

  it("completes automatically only after most of the video was actually watched, and supports manual completion", async () => {
    const { s, lessonId } = await approved();
    await beat(s.cookie, lessonId, { positionSeconds: 10, durationSeconds: 100, watchedDelta: 10 });
    // Seeking to the end without watching does not complete the lesson.
    const skipped = await beat(s.cookie, lessonId, { positionSeconds: 100, durationSeconds: 100 });
    expect(skipped.json.progress.completed).toBe(false);

    await rewindLastReport(lessonId, 60);
    const watched = await beat(s.cookie, lessonId, { positionSeconds: 95, durationSeconds: 100, watchedDelta: 85 });
    expect(watched.json.progress).toMatchObject({ completed: true, percent: 100, watchedSeconds: 95 });
    expect((await LessonProgress.findOne({ lessonId }).lean())!.completedBy).toBe("watched");

    const undo = await call(progressRoute.POST, { cookie: s.cookie, params: { lessonId }, body: { completed: false } });
    expect(undo.json.progress.completed).toBe(false);
    const manual = await call(progressRoute.POST, { cookie: s.cookie, params: { lessonId }, body: { completed: true } });
    expect(manual.json.progress.completed).toBe(true);
    expect((await LessonProgress.findOne({ lessonId }).lean())!.completedBy).toBe("manual");
  });

  it("restarts playback numbers when the teacher replaces the video but keeps completion", async () => {
    const { courseId, s, t, lessonId } = await approved();
    await beat(s.cookie, lessonId, { positionSeconds: 50, durationSeconds: 100, watchedDelta: 20 });
    await call(progressRoute.POST, { cookie: s.cookie, params: { lessonId }, body: { completed: true } });
    await call(lessonOne.PATCH, { cookie: t.cookie, method: "PATCH", params: { courseId, lessonId }, body: { youtubeUrl: `https://youtu.be/${ID2}` } });

    const view = await call(learnLesson.GET, { cookie: s.cookie, params: { lessonId } });
    expect(view.json.lesson.youtubeVideoId).toBe(ID2);
    const next = await call(progressRoute.POST, { cookie: s.cookie, params: { lessonId }, body: { videoKey: `yt:${ID2}`, positionSeconds: 3, durationSeconds: 300, watchedDelta: 3 } });
    expect(next.json.progress).toMatchObject({ positionSeconds: 3, durationSeconds: 300, watchedSeconds: 3, completed: true });
  });

  it("is only recorded for students", async () => {
    const { t, lessonId } = await approved();
    expect((await call(progressRoute.POST, { cookie: t.cookie, params: { lessonId }, body: { completed: true } })).status).toBe(403);
  });
});

describe("course-specific chat", () => {
  it("lets approved students tag questions with a course and lesson, and refuses other courses", async () => {
    const { course, courseId, t, s } = await world();
    const l = await addLesson(t.cookie, courseId, { title: "Vectors" });
    const conv = await call(conversation.POST, { cookie: s.cookie, body: {} });
    const params = { conversationId: conv.json.id };
    const body = { body: "I don't understand vectors", context: { courseId, lessonId: l.json.id } };

    expect((await call(messages.POST, { cookie: s.cookie, params, body })).status).toBe(403);
    await enroll(s.user._id, course._id, "approved");
    const sent = await call(messages.POST, { cookie: s.cookie, params, body });
    expect(sent.status).toBe(201);
    expect(sent.json.message.context).toBe("Physics · Vectors");

    const foreignLesson = await Lesson.create({ courseId: (await Course.create({ title: "X", slug: "x", price: 1 }))._id, title: "F", order: 0 });
    expect((await call(messages.POST, { cookie: s.cookie, params, body: { ...body, context: { courseId, lessonId: String(foreignLesson._id) } } })).status).toBe(404);

    const teacherView = await call(messages.GET, { cookie: t.cookie, params });
    expect(teacherView.json.messages[0]).toMatchObject({ body: "I don't understand vectors", context: "Physics · Vectors" });
  });
});
