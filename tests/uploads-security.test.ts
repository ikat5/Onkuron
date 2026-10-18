import { afterEach, describe, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import * as sign from "@/app/api/teacher/uploads/sign/route";
import * as complete from "@/app/api/teacher/uploads/complete/route";
import * as media from "@/app/api/media/[lessonId]/route";
import * as mediaResource from "@/app/api/media/[lessonId]/[resourceId]/route";
import * as courses from "@/app/api/teacher/courses/route";
import * as settings from "@/app/api/teacher/settings/route";
import * as login from "@/app/api/auth/login/route";
import * as messages from "@/app/api/chat/[conversationId]/messages/route";
import * as conversation from "@/app/api/chat/conversation/route";
import * as health from "@/app/api/health/route";
import * as jobs from "@/app/api/internal/jobs/route";
import { resetCloudinaryForTests } from "@/lib/cloudinary";
import { safeRedirectPath } from "@/lib/security/request";
import { processAssetDeletions } from "@/services/assets";
import { AssetDeletion } from "@/models/AssetDeletion";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { Lesson } from "@/models/Lesson";
import { UploadIntent } from "@/models/UploadIntent";
import { call, createUser } from "./helpers/http";
import { applyTestEnv, TEST_ENV } from "./helpers/setup";

afterEach(() => {
  vi.restoreAllMocks();
  resetCloudinaryForTests();
});

async function world() {
  const course = await Course.create({ title: "Chemistry", slug: "chemistry", price: 900, published: true });
  const lesson = await Lesson.create({ courseId: course._id, title: "Atoms", order: 0 });
  const t = await createUser({ role: "teacher", email: "teacher@example.test" });
  const s = await createUser({ email: "s1@example.test" });
  return { course, lesson, t, s };
}

const pdfFile = { kind: "pdf", title: "Chapter 1 notes", fileName: "notes.pdf", fileSize: 2 * 1024 * 1024, mimeType: "application/pdf" };

function mockResource(over: Record<string, unknown> = {}) {
  return vi.spyOn(cloudinary.api, "resource").mockImplementation((async (publicId: string, opts: { resource_type: string; type: string }) => ({
    public_id: publicId,
    resource_type: opts.resource_type,
    type: opts.type,
    format: "pdf",
    bytes: 1234,
    version: 1700000000,
    secure_url: `https://res.cloudinary.com/demo-cloud/${opts.resource_type}/${opts.type}/v1/${publicId}`,
    ...over,
  })) as never);
}

/** The server reads the first bytes of the stored file to check its real type. */
function mockFileHead(content: string | number[] = "%PDF-1.7\n%âãÏÓ\n1 0 obj") {
  return vi.spyOn(globalThis, "fetch").mockImplementation((async () => new Response(new Uint8Array(typeof content === "string" ? new TextEncoder().encode(content) : content), { status: 206 })) as never);
}

describe("Cloudinary signed uploads", () => {
  it("signs uploads for the teacher with a server-chosen public_id and never returns the secret", async () => {
    const { course, lesson, t } = await world();
    const res = await call(sign.POST, { cookie: t.cookie, body: { ...pdfFile, courseId: String(course._id), lessonId: String(lesson._id) } });
    expect(res.status).toBe(200);
    const { fields, uploadUrl, intentId } = res.json;
    expect(uploadUrl).toBe("https://api.cloudinary.com/v1_1/demo-cloud/raw/upload");
    expect(fields.type).toBe("authenticated");
    expect(fields.public_id).toMatch(new RegExp(`^onkuron/courses/${course._id}/pdf/[a-f0-9]{24}\\.pdf$`));
    expect(res.text).not.toContain(TEST_ENV.CLOUDINARY_API_SECRET);

    // The signature is valid for exactly these parameters.
    const { signature, api_key, ...signed } = fields;
    expect(api_key).toBe(TEST_ENV.CLOUDINARY_API_KEY);
    expect(signature).toBe(cloudinary.utils.api_sign_request(signed, TEST_ENV.CLOUDINARY_API_SECRET));
    expect(await UploadIntent.countDocuments({ _id: intentId })).toBe(1);
  });

  it("denies students and anonymous users, validates file type and size, and refuses video uploads", async () => {
    const { course, lesson, s, t } = await world();
    const body = { ...pdfFile, courseId: String(course._id), lessonId: String(lesson._id) };
    expect((await call(sign.POST, { cookie: s.cookie, body })).status).toBe(403);
    expect((await call(sign.POST, { body })).status).toBe(401);
    expect((await call(sign.POST, { cookie: t.cookie, body: { ...body, fileName: "virus.exe" } })).status).toBe(400);
    expect((await call(sign.POST, { cookie: t.cookie, body: { ...body, mimeType: "text/html" } })).status).toBe(400);
    expect((await call(sign.POST, { cookie: t.cookie, body: { ...body, fileSize: 10 * 1024 * 1024 * 1024 } })).status).toBe(413);
    expect((await call(sign.POST, { cookie: t.cookie, body: { ...body, lessonId: undefined } })).status).toBe(400);
    // Videos are hosted on YouTube, never uploaded to Cloudinary.
    const video = await call(sign.POST, { cookie: t.cookie, body: { ...body, kind: "video", fileName: "lecture.mp4", mimeType: "video/mp4" } });
    expect(video.status).toBe(400);
    expect(video.json.error.message).toMatch(/YouTube/);
  });

  it("verifies the asset with Cloudinary before saving trusted metadata, then cleans up the replaced one", async () => {
    const { course, lesson, t } = await world();
    const spy = mockResource();
    mockFileHead();
    const destroy = vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" } as never);
    const body = { ...pdfFile, courseId: String(course._id), lessonId: String(lesson._id) };

    const first = await call(sign.POST, { cookie: t.cookie, body });
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: first.json.intentId } })).status).toBe(200);
    expect(spy).toHaveBeenCalledWith(first.json.fields.public_id, { resource_type: "raw", type: "authenticated" });
    let saved = await Lesson.findById(lesson._id).lean();
    expect(saved!.resources).toHaveLength(1);
    expect(saved!.resources[0].title).toBe("Chapter 1 notes");
    expect(saved!.resources[0].asset!.publicId).toBe(first.json.fields.public_id);
    expect(saved!.resources[0].asset!.bytes).toBe(1234);
    const resourceId = String(saved!.resources[0]._id);

    // Completing the same intent again is refused.
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: first.json.intentId } })).status).toBe(400);

    // Replacement: the old asset is queued for deletion only after the lesson points to the new one.
    const second = await call(sign.POST, { cookie: t.cookie, body: { ...body, title: undefined, resourceId } });
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: second.json.intentId } })).status).toBe(200);
    saved = await Lesson.findById(lesson._id).lean();
    expect(saved!.resources).toHaveLength(1);
    expect(saved!.resources[0].title).toBe("Chapter 1 notes");
    expect(saved!.resources[0].asset!.publicId).toBe(second.json.fields.public_id);
    expect(await AssetDeletion.countDocuments({ publicId: first.json.fields.public_id })).toBe(1);
    await processAssetDeletions();
    expect(destroy).toHaveBeenCalledWith(first.json.fields.public_id, expect.objectContaining({ resource_type: "raw", type: "authenticated" }));
    expect(destroy).not.toHaveBeenCalledWith(second.json.fields.public_id, expect.anything());
  });

  it("cannot register arbitrary or mismatched assets", async () => {
    const { course, lesson, t, s } = await world();
    mockResource();
    // A Windows executable renamed to .pdf: the extension and declared MIME type look fine, the content doesn't.
    mockFileHead([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    // Unknown intent id.
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: "a".repeat(24) } })).status).toBe(400);
    // Students can't complete uploads at all.
    expect((await call(complete.POST, { cookie: s.cookie, body: { intentId: "a".repeat(24) } })).status).toBe(403);
    const signed = await call(sign.POST, { cookie: t.cookie, body: { ...pdfFile, courseId: String(course._id), lessonId: String(lesson._id) } });
    const res = await call(complete.POST, { cookie: t.cookie, body: { intentId: signed.json.intentId } });
    expect(res.status).toBe(400);
    expect((await Lesson.findById(lesson._id).lean())!.resources).toHaveLength(0);
    expect(await AssetDeletion.countDocuments({ publicId: signed.json.fields.public_id })).toBe(1);
  });

  it("handles Cloudinary outages and missing configuration safely", async () => {
    const { course, lesson, t } = await world();
    vi.spyOn(cloudinary.api, "resource").mockRejectedValue({ error: { http_code: 500, message: "boom" } } as never);
    const signed = await call(sign.POST, { cookie: t.cookie, body: { ...pdfFile, courseId: String(course._id), lessonId: String(lesson._id) } });
    const res = await call(complete.POST, { cookie: t.cookie, body: { intentId: signed.json.intentId } });
    expect(res.status).toBe(502);
    expect(res.json.error.code).toBe("storage_unavailable");
    // The intent was not consumed, so the teacher can retry completion.
    expect((await UploadIntent.findById(signed.json.intentId).lean())!.consumedAt).toBeUndefined();

    applyTestEnv({ CLOUDINARY_API_SECRET: undefined });
    resetCloudinaryForTests();
    const nc = await call(sign.POST, { cookie: t.cookie, body: { ...pdfFile, courseId: String(course._id), lessonId: String(lesson._id) } });
    expect(nc.status).toBe(503);
    expect(nc.text).not.toContain(TEST_ENV.CLOUDINARY_API_KEY);
  });
});

describe("paid content protection", () => {
  async function withMedia() {
    const w = await world();
    const asset = { publicId: "onkuron/courses/x/video/abc", resourceType: "video", deliveryType: "authenticated", bytes: 10, version: 1, uploadedAt: new Date() };
    const doc = { publicId: "onkuron/courses/x/pdf/abc.pdf", resourceType: "raw", deliveryType: "authenticated", bytes: 10, version: 1, uploadedAt: new Date() };
    await Lesson.updateOne({ _id: w.lesson._id }, { $set: { video: asset }, $push: { resources: { title: "Notes", kind: "pdf", asset: doc } } });
    const lesson = await Lesson.findById(w.lesson._id).lean();
    return { ...w, resourceId: String(lesson!.resources[0]._id) };
  }

  it("refuses media to anonymous, non-enrolled and pending students", async () => {
    const { lesson, s, course, resourceId } = await withMedia();
    const params = { lessonId: String(lesson._id) };
    expect((await call(media.GET, { params })).status).toBe(401);
    expect((await call(media.GET, { cookie: s.cookie, params })).status).toBe(403);
    expect((await call(mediaResource.GET, { cookie: s.cookie, params: { ...params, resourceId } })).status).toBe(403);
    await Enrollment.create({ studentId: s.user._id, courseId: course._id, amount: 900, paymentMethod: "bkash", transactionId: "TX123456", senderNumber: "01712345678" });
    expect((await call(media.GET, { cookie: s.cookie, params })).status).toBe(403);
  });

  it("issues signed URLs only after approval (and short-lived download URLs for documents)", async () => {
    const { lesson, s, t, course, resourceId } = await withMedia();
    await Enrollment.create({ studentId: s.user._id, courseId: course._id, status: "approved", amount: 900, paymentMethod: "bkash", transactionId: "TX123456", senderNumber: "01712345678" });
    const v = await call(media.GET, { cookie: s.cookie, params: { lessonId: String(lesson._id) } });
    expect(v.status).toBe(302);
    const videoUrl = v.headers.get("location")!;
    expect(videoUrl).toMatch(/^https:\/\/res\.cloudinary\.com\/demo-cloud\/video\/authenticated\/s--[^/]+--\//);
    expect(v.headers.get("cache-control")).toMatch(/no-store/);

    const d = await call(mediaResource.GET, { cookie: s.cookie, params: { lessonId: String(lesson._id), resourceId } });
    const docUrl = new URL(d.headers.get("location")!);
    expect(docUrl.hostname).toBe("api.cloudinary.com");
    const expiresAt = Number(docUrl.searchParams.get("expires_at"));
    expect(expiresAt - Date.now() / 1000).toBeLessThanOrEqual(600);
    expect(docUrl.searchParams.get("signature")).toBeTruthy();
    expect(docUrl.toString()).not.toContain(TEST_ENV.CLOUDINARY_API_SECRET);

    expect((await call(media.GET, { cookie: t.cookie, params: { lessonId: String(lesson._id) } })).status).toBe(302);
  });
});

describe("authorization and web security", () => {
  it("prevents students from using teacher operations", async () => {
    const { s } = await world();
    expect((await call(courses.POST, { cookie: s.cookie, body: { title: "Hack", price: 1 } })).status).toBe(403);
    expect((await call(settings.PUT, { cookie: s.cookie, method: "PUT", body: { paymentNumbers: {} } })).status).toBe(403);
  });

  it("rejects forged or tampered sessions and revoked sessions", async () => {
    const { s, course } = await world();
    const [h, p] = s.cookie.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "teacher" })).toString("base64url");
    const forged = `${h}.${forgedPayload}.${s.cookie.split(".")[2]}`;
    expect((await call(courses.POST, { cookie: forged, body: { title: "Hack", price: 1 } })).status).toBe(401);

    const { User } = await import("@/models/User");
    await User.updateOne({ _id: s.user._id }, { $inc: { sessionVersion: 1 } });
    const res = await call(media.GET, { cookie: s.cookie, params: { lessonId: String(course._id) } });
    expect(res.status).toBe(401);
  });

  it("rejects cross-origin mutations (CSRF) and non-JSON bodies", async () => {
    const { t } = await world();
    const evil = await call(courses.POST, { cookie: t.cookie, body: { title: "X course", price: 5 }, headers: { origin: "https://evil.example" } });
    expect(evil.status).toBe(403);
    const form = await call(courses.POST, { cookie: t.cookie, body: "title=x", headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect(form.status).toBe(400);
  });

  it("blocks NoSQL operator injection in login", async () => {
    await createUser({ email: "victim@example.test" });
    const res = await call(login.POST, { body: { email: { $gt: "" }, password: { $ne: null } } });
    expect(res.status).toBe(400);
  });

  it("enforces conversation membership for every read and send", async () => {
    await world();
    const a = await createUser({ email: "a@example.test" });
    const b = await createUser({ email: "b@example.test" });
    const conv = await call(conversation.POST, { cookie: a.cookie, body: {} });
    const id = conv.json.id;
    expect((await call(messages.POST, { cookie: a.cookie, params: { conversationId: id }, body: { body: "<img src=x onerror=alert(1)>" } })).status).toBe(201);
    expect((await call(messages.GET, { cookie: b.cookie, params: { conversationId: id } })).status).toBe(404);
    expect((await call(messages.POST, { cookie: b.cookie, params: { conversationId: id }, body: { body: "intrusion" } })).status).toBe(404);
    const own = await call(messages.GET, { cookie: a.cookie, params: { conversationId: id } });
    // Stored verbatim as text; React escapes it on render.
    expect(own.json.messages[0].body).toBe("<img src=x onerror=alert(1)>");
  });

  it("never exposes secrets through API responses", async () => {
    const h = await health.GET();
    const text = await h.text();
    for (const secret of [TEST_ENV.MONGODB_URI, TEST_ENV.JWT_SECRET, TEST_ENV.SMTP_PASS, TEST_ENV.CLOUDINARY_API_SECRET]) {
      expect(text).not.toContain(secret);
    }
    expect(JSON.parse(text)).toEqual({ status: "ok", database: true, email: true, cloudinary: true });
    expect((await call(jobs.POST, { body: {} })).status).toBe(401);
    expect((await call(jobs.POST, { body: {}, headers: { authorization: `Bearer ${TEST_ENV.CRON_SECRET}` } })).status).toBe(200);
  });

  it("only allows safe same-site redirect targets", () => {
    expect(safeRedirectPath("/learn/x")).toBe("/learn/x");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
  });
});
