import { afterEach, describe, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import * as intro from "@/app/api/teacher/settings/intro/route";
import * as teachers from "@/app/api/teacher/teachers/route";
import * as teacherOne from "@/app/api/teacher/teachers/[profileId]/route";
import * as photo from "@/app/api/teacher/teachers/[profileId]/photo/route";
import * as teacherOrder from "@/app/api/teacher/teachers/order/route";
import * as contact from "@/app/api/contact/route";
import * as courses from "@/app/api/teacher/courses/route";
import * as courseOne from "@/app/api/teacher/courses/[courseId]/route";
import * as sign from "@/app/api/teacher/uploads/sign/route";
import * as complete from "@/app/api/teacher/uploads/complete/route";
import { resetCloudinaryForTests } from "@/lib/cloudinary";
import { renderEmail } from "@/lib/email/templates";
import { AssetDeletion } from "@/models/AssetDeletion";
import { Category } from "@/models/Category";
import { Course } from "@/models/Course";
import { EmailOutbox } from "@/models/EmailOutbox";
import { TeacherProfile } from "@/models/TeacherProfile";
import { listPublishedCourses } from "@/services/courses";
import { getIntro } from "@/services/settings";
import { getPublicTeacherProfile, listPublicTeacherProfiles, listTeachersForCourse } from "@/services/teacher-profile";
import { call, createUser } from "./helpers/http";
import { applyTestEnv } from "./helpers/setup";

const ID = "dQw4w9WgXcQ";

afterEach(() => {
  vi.restoreAllMocks();
  resetCloudinaryForTests();
});

const people = async () => ({ t: await createUser({ role: "teacher", email: "teacher@example.test" }), s: await createUser({ email: "s1@example.test" }) });

describe("platform introduction video", () => {
  it("is configured by the teacher only, validated on the server, and read from one place", async () => {
    const { t, s } = await people();
    expect((await getIntro()).youtubeVideoId).toBeUndefined();
    expect((await getIntro()).title).toBeTruthy();

    const body = { youtubeUrl: `https://youtu.be/${ID}`, title: "How Onkur works", text: "Intro text" };
    expect((await call(intro.PUT, { method: "PUT", cookie: s.cookie, body })).status).toBe(403);
    expect((await call(intro.PUT, { method: "PUT", body })).status).toBe(401);

    const ok = await call(intro.PUT, { method: "PUT", cookie: t.cookie, body });
    expect(ok.status).toBe(200);
    expect(ok.json.intro).toMatchObject({ youtubeVideoId: ID, title: "How Onkur works", text: "Intro text" });
    expect(await getIntro()).toMatchObject({ youtubeVideoId: ID });

    for (const youtubeUrl of ["https://evil.example/watch?v=" + ID, "https://vimeo.com/1", "nope"]) {
      const bad = await call(intro.PUT, { method: "PUT", cookie: t.cookie, body: { ...body, youtubeUrl } });
      expect(bad.status, youtubeUrl).toBe(400);
    }
    expect((await getIntro()).youtubeVideoId).toBe(ID);

    const cleared = await call(intro.PUT, { method: "PUT", cookie: t.cookie, body: { ...body, youtubeUrl: "" } });
    expect(cleared.json.intro.youtubeVideoId).toBeUndefined();
  });
});

describe("teacher profiles (many, managed from the admin panel)", () => {
  const base = {
    published: false,
    displayName: "Tanvir Ahmed",
    headline: "ICT teacher",
    shortBio: "Teaches HSC ICT.",
    bio: "Full bio",
    philosophy: "Understand first.",
    subjects: ["HSC ICT", "HSC ICT", "Web development"],
    expertise: ["React"],
    achievements: [
      { title: "Second", description: "", year: 2024 },
      { title: "First", description: "Desc", year: null },
    ],
    youtubeUrl: `https://www.youtube.com/watch?v=${ID}`,
  };
  const add = (cookie: string, body: Record<string, unknown>) => call(teachers.POST, { cookie, body });

  it("stores qualification and host-checked social links, and clears them", async () => {
    const { t } = await people();
    const social = { qualification: "B.Sc. in CSE, University of Dhaka", facebookUrl: "https://www.facebook.com/tanvir", youtubeChannelUrl: "https://youtube.com/@tanvir" };
    const a = await add(t.cookie, { ...base, ...social, published: true });
    expect(a.status).toBe(201);
    expect(a.json.teacher).toMatchObject(social);
    expect((await getPublicTeacherProfile("tanvir-ahmed"))!.profile).toMatchObject(social);

    // Wrong host, plain http or a javascript: URL are refused.
    for (const bad of [{ facebookUrl: "https://evil.example/facebook.com" }, { facebookUrl: "http://facebook.com/x" }, { youtubeChannelUrl: "javascript:alert(1)" }, { youtubeChannelUrl: "https://notyoutube.com/x" }]) {
      expect((await add(t.cookie, { ...base, ...bad })).status).toBe(400);
    }

    const cleared = await call(teacherOne.PUT, { method: "PUT", cookie: t.cookie, params: { profileId: a.json.teacher.id }, body: { ...base, published: true, slug: "tanvir-ahmed" } });
    expect(cleared.json.teacher).toMatchObject({ qualification: "", facebookUrl: "", youtubeChannelUrl: "" });
  });

  it("adds, lists, edits and deletes several teachers; only published ones are public", async () => {
    const { t, s } = await people();
    expect((await add(s.cookie, base)).status).toBe(403);

    const a = await add(t.cookie, base);
    expect(a.status).toBe(201);
    expect(a.json.teacher).toMatchObject({ slug: "tanvir-ahmed", youtubeVideoId: ID, subjects: ["HSC ICT", "Web development"], order: 0 });
    expect(a.json.teacher.achievements.map((x: { title: string }) => x.title)).toEqual(["Second", "First"]);
    const b = await add(t.cookie, { ...base, displayName: "Nusrat Jahan", published: true });
    // Same name twice gets a unique generated URL; an explicitly taken URL is refused.
    const c = await add(t.cookie, { ...base, published: true });
    expect(c.json.teacher.slug).toMatch(/^tanvir-ahmed-[a-f0-9]{4}$/);
    const bangla = await add(t.cookie, { ...base, displayName: "নুসরাত", slug: "nusrat-jahan" });
    expect(bangla.json.teacher.slug).toMatch(/^profile-[a-f0-9]{6}$/); // a sent slug is ignored; non-Latin names still get a URL
    await call(teacherOne.DELETE, { method: "DELETE", cookie: t.cookie, params: { profileId: bangla.json.teacher.id } });

    const list = await call(teachers.GET, { cookie: t.cookie });
    expect(list.json.teachers.map((x: { displayName: string; order: number }) => `${x.order}:${x.displayName}`)).toEqual(["0:Tanvir Ahmed", "1:Nusrat Jahan", "2:Tanvir Ahmed"]);

    const pub = await listPublicTeacherProfiles();
    expect(pub.map((p) => p.displayName)).toEqual(["Nusrat Jahan", "Tanvir Ahmed"]);
    expect(pub[0]).not.toHaveProperty("published");
    expect(pub[0]).not.toHaveProperty("id");
    expect(await getPublicTeacherProfile("tanvir-ahmed")).toBeNull(); // the unpublished one

    // Renaming keeps the profile URL, so links already shared keep working; a sent slug is ignored.
    const edited = await call(teacherOne.PUT, { method: "PUT", cookie: t.cookie, params: { profileId: a.json.teacher.id }, body: { ...base, displayName: "Tanvir Ahmed Khan", published: true, headline: "Senior ICT teacher", slug: "tanvir" } });
    expect(edited.json.teacher).toMatchObject({ displayName: "Tanvir Ahmed Khan", headline: "Senior ICT teacher", slug: "tanvir-ahmed", published: true });
    expect((await getPublicTeacherProfile("tanvir-ahmed"))!.profile.headline).toBe("Senior ICT teacher");

    const reordered = await call(teacherOrder.PUT, { method: "PUT", cookie: t.cookie, body: { profileIds: [c.json.teacher.id, a.json.teacher.id, b.json.teacher.id] } });
    expect(reordered.json.teachers.map((x: { id: string }) => x.id)).toEqual([c.json.teacher.id, a.json.teacher.id, b.json.teacher.id]);
    expect((await call(teacherOrder.PUT, { method: "PUT", cookie: t.cookie, body: { profileIds: [a.json.teacher.id] } })).status).toBe(400);

    expect((await call(teacherOne.DELETE, { method: "DELETE", cookie: s.cookie, params: { profileId: b.json.teacher.id } })).status).toBe(403);
    expect((await call(teacherOne.DELETE, { method: "DELETE", cookie: t.cookie, params: { profileId: b.json.teacher.id } })).status).toBe(200);
    expect(await TeacherProfile.countDocuments()).toBe(2);
    expect((await call(teacherOne.GET, { cookie: t.cookie, params: { profileId: b.json.teacher.id } })).status).toBe(404);
  });

  it("links teachers to existing courses and shows them on those courses only", async () => {
    const { t } = await people();
    const course = await Course.create({ title: "Physics", slug: "physics", price: 100, published: true });
    const other = await Course.create({ title: "Chem", slug: "chem", price: 100, published: true });
    const res = await add(t.cookie, { ...base, published: true, courseIds: [String(course._id), "a".repeat(24)] });
    expect(res.json.teacher.courseIds).toEqual([String(course._id)]); // unknown IDs dropped
    expect((await listTeachersForCourse(course._id)).map((p) => p.displayName)).toEqual(["Tanvir Ahmed"]);
    expect(await listTeachersForCourse(other._id)).toEqual([]);
    expect((await getPublicTeacherProfile("tanvir-ahmed"))!.courseIds).toEqual([String(course._id)]);
  });

  it("drops the old single-profile unique index so more teachers can be added", async () => {
    const { t } = await people();
    await TeacherProfile.createCollection();
    await TeacherProfile.collection.createIndex({ key: 1 }, { unique: true, name: "key_1" });
    expect((await add(t.cookie, base)).status).toBe(201);
    expect((await add(t.cookie, { ...base, displayName: "Second Teacher" })).status).toBe(201);
    expect((await TeacherProfile.collection.indexes()).map((i) => i.name)).not.toContain("key_1");
  });

  it("validates input on the server", async () => {
    const { t } = await people();
    for (const body of [
      { ...base, displayName: "x" },
      { ...base, youtubeUrl: "https://evil.example/watch?v=" + ID },
      { ...base, achievements: [{ title: "" }] },
      { ...base, subjects: Array.from({ length: 21 }, (_, i) => `s${i}`) },
      { ...base, courseIds: ["not-an-id"] },
    ]) {
      expect((await add(t.cookie, body)).status).toBe(400);
    }
  });

  it("uploads a teacher's photo through the signed Cloudinary flow and removes it safely", async () => {
    const { t, s } = await people();
    const created = await add(t.cookie, base);
    const profileId = created.json.teacher.id;
    const file = { kind: "teacher_photo", fileName: "me.jpg", fileSize: 200_000, mimeType: "image/jpeg" };
    expect((await call(sign.POST, { cookie: t.cookie, body: file })).status).toBe(400); // which teacher?
    expect((await call(sign.POST, { cookie: t.cookie, body: { ...file, profileId: "a".repeat(24) } })).status).toBe(404);
    expect((await call(sign.POST, { cookie: s.cookie, body: { ...file, profileId } })).status).toBe(403);
    expect((await call(sign.POST, { cookie: t.cookie, body: { ...file, profileId, fileName: "me.svg", mimeType: "image/svg+xml" } })).status).toBe(400);

    const signed = await call(sign.POST, { cookie: t.cookie, body: { ...file, profileId } });
    expect(signed.status).toBe(200);
    expect(signed.json.fields.public_id).toMatch(/^onkuron\/teacher\/teacher_photo\/[a-f0-9]{24}$/);
    expect(signed.json.fields.type).toBeUndefined(); // public delivery, like thumbnails

    vi.spyOn(cloudinary.api, "resource").mockImplementation((async (publicId: string, opts: { resource_type: string; type: string }) => ({
      public_id: publicId,
      resource_type: opts.resource_type,
      type: opts.type,
      format: "jpg",
      bytes: 1000,
      version: 1,
      secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${publicId}.jpg`,
    })) as never);
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: signed.json.intentId } })).status).toBe(200);
    const withPhoto = await call(teacherOne.GET, { cookie: t.cookie, params: { profileId } });
    expect(withPhoto.json.teacher.photoUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    expect((await call(photo.DELETE, { method: "DELETE", cookie: t.cookie, params: { profileId } })).status).toBe(200);
    expect((await TeacherProfile.findById(profileId).lean())!.photo).toBeUndefined();
    expect(await AssetDeletion.countDocuments({ publicId: signed.json.fields.public_id })).toBe(1);
  });
});

describe("contact form", () => {
  const msg = { name: "Rahim", email: "rahim@example.test", subject: "Question about HSC ICT", message: "When does the next batch start?", website: "", elapsedMs: 8000 };

  it("queues the message to the official inbox with the sender as reply-to", async () => {
    const res = await call(contact.POST, { body: msg });
    expect(res.status).toBe(202);
    const out = await EmailOutbox.findOne({ template: "contact_message" }).lean();
    expect(out!.to).toBe("info.onkuron@gmail.com");
    const rendered = renderEmail("contact_message", { ...msg, receivedAt: "now" }, { appUrl: "http://localhost:3000" });
    expect(rendered.replyTo).toBe("rahim@example.test");
    const xss = renderEmail("contact_message", { ...msg, message: "<script>alert(1)</script>", receivedAt: "now" }, { appUrl: "http://localhost:3000" });
    expect(xss.html).not.toContain("<script>");
  });

  it("rejects spam, invalid input and floods, and never claims success without email", async () => {
    expect((await call(contact.POST, { body: { ...msg, website: "http://spam.example" } })).status).toBe(400);
    expect((await call(contact.POST, { body: { ...msg, elapsedMs: 300 } })).status).toBe(400);
    expect((await call(contact.POST, { body: { ...msg, email: "not-an-email" } })).status).toBe(400);
    expect((await call(contact.POST, { body: { ...msg, message: "short" } })).status).toBe(400);
    expect(await EmailOutbox.countDocuments()).toBe(0);

    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await call(contact.POST, { body: msg })).status);
    expect(statuses).toEqual([202, 202, 202, 429]); // 3 per sender email per hour

    applyTestEnv({ SMTP_HOST: undefined });
    const down = await call(contact.POST, { body: { ...msg, email: "other@example.test" } });
    expect(down.status).toBe(503);
    expect(await EmailOutbox.countDocuments()).toBe(3);
  });
});

describe("course categories", () => {
  it("stores an existing category and filters the public catalogue by it", async () => {
    const { t } = await people();
    await Category.create({ slug: "programming", name: "Programming Fundamentals", published: true }); // added by the admin (only HSC ICT is seeded)
    const a = await call(courses.POST, { cookie: t.cookie, body: { title: "HSC ICT Complete", price: 1000, category: "hsc-ict", published: true } });
    expect(a.status).toBe(201);
    expect((await call(courses.POST, { cookie: t.cookie, body: { title: "C Basics", price: 1500, category: "programming", published: true } })).status).toBe(201);
    await call(courses.POST, { cookie: t.cookie, body: { title: "Hidden draft", price: 900, category: "hsc-ict", published: false } });
    expect((await call(courses.POST, { cookie: t.cookie, body: { title: "Bad", price: 1, category: "astrology" } })).status).toBe(400);

    expect((await listPublishedCourses({ category: "hsc-ict" })).map((c) => c.title)).toEqual(["HSC ICT Complete"]);
    expect(await listPublishedCourses({ category: "made-up" })).toHaveLength(0); // the catalogue page ignores unknown categories instead
    expect((await listPublishedCourses()).map((c) => c.categoryName).sort()).toEqual(["HSC ICT", "Programming Fundamentals"]);
    // Public listing never includes the full description.
    expect((await listPublishedCourses())[0]).not.toHaveProperty("description");

    const cleared = await call(courseOne.PATCH, { method: "PATCH", cookie: t.cookie, params: { courseId: a.json.id }, body: { category: "" } });
    expect(cleared.status).toBe(200);
    const after = (await Course.findById(a.json.id).lean())!;
    expect(after.category).toBeUndefined();
    // A partial update leaves every other field untouched.
    expect(after).toMatchObject({ published: true, title: "HSC ICT Complete", price: 1000 });
    await call(courseOne.PATCH, { method: "PATCH", cookie: t.cookie, params: { courseId: a.json.id }, body: { summary: "Kept", description: "Kept too" } });
    await call(courseOne.PATCH, { method: "PATCH", cookie: t.cookie, params: { courseId: a.json.id }, body: { category: "hsc-ict" } });
    expect((await Course.findById(a.json.id).lean())!).toMatchObject({ summary: "Kept", description: "Kept too", published: true, category: "hsc-ict" });
  });
});
