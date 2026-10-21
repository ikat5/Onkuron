import { afterEach, describe, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import * as home from "@/app/api/home/route";
import * as publicCategories from "@/app/api/categories/route";
import * as categories from "@/app/api/teacher/categories/route";
import * as categoryOne from "@/app/api/teacher/categories/[categoryId]/route";
import * as categoryOrder from "@/app/api/teacher/categories/order/route";
import * as topics from "@/app/api/teacher/topics/route";
import * as topicOne from "@/app/api/teacher/topics/[topicId]/route";
import * as topicOrder from "@/app/api/teacher/topics/order/route";
import * as intro from "@/app/api/teacher/settings/intro/route";
import * as introThumb from "@/app/api/teacher/settings/intro/thumbnail/route";
import * as introVideo from "@/app/api/teacher/settings/intro/video/route";
import * as courses from "@/app/api/teacher/courses/route";
import * as sign from "@/app/api/teacher/uploads/sign/route";
import * as complete from "@/app/api/teacher/uploads/complete/route";
import { resetCloudinaryForTests } from "@/lib/cloudinary";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { DEFAULT_TOPICS } from "@/lib/interactive";
import { AssetDeletion } from "@/models/AssetDeletion";
import { Category } from "@/models/Category";
import { Course } from "@/models/Course";
import { Setting } from "@/models/Setting";
import { listCategories } from "@/services/categories";
import { listPublishedCourses } from "@/services/courses";
import { listPublicTopics, listTopics } from "@/services/interactive";
import { getIntro } from "@/services/settings";
import { call, createUser } from "./helpers/http";

afterEach(() => {
  vi.restoreAllMocks();
  resetCloudinaryForTests();
});

const people = async () => ({ t: await createUser({ role: "teacher", email: "teacher@example.test" }), s: await createUser({ email: "s1@example.test" }) });

function mockCloudinaryImage(format = "jpg") {
  vi.spyOn(cloudinary.api, "resource").mockImplementation((async (publicId: string, opts: { resource_type: string; type: string }) => ({
    public_id: publicId,
    resource_type: opts.resource_type,
    type: opts.type,
    format,
    bytes: 1000,
    version: 1,
    secure_url: `https://res.cloudinary.com/demo-cloud/${opts.resource_type}/upload/v1/${publicId}.${format}`,
  })) as never);
}

const image = { fileName: "card.jpg", fileSize: 200_000, mimeType: "image/jpeg" };

describe("homepage promotional video", () => {
  it("is switched on and off by the admin, with an uploaded poster image", async () => {
    const { t, s } = await people();
    expect((await getIntro()).enabled).toBe(true);

    const body = { youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", title: "Meet Onkur", text: "Promo", enabled: false };
    expect((await call(intro.PUT, { method: "PUT", cookie: s.cookie, body })).status).toBe(403);
    const off = await call(intro.PUT, { method: "PUT", cookie: t.cookie, body });
    expect(off.json.intro).toMatchObject({ enabled: false, youtubeVideoId: "dQw4w9WgXcQ" });
    expect((await call(home.GET)).json.promo).toBeNull();

    await call(intro.PUT, { method: "PUT", cookie: t.cookie, body: { ...body, enabled: true } });
    expect((await call(home.GET)).json.promo).toMatchObject({ youtubeVideoId: "dQw4w9WgXcQ", title: "Meet Onkur", thumbnailUrl: null });

    const signed = await call(sign.POST, { cookie: t.cookie, body: { kind: "promo_thumbnail", ...image } });
    expect(signed.status).toBe(200);
    expect(signed.json.fields.public_id).toMatch(/^onkuron\/site\/promo_thumbnail\/[a-f0-9]{24}$/);
    expect((await call(sign.POST, { cookie: t.cookie, body: { kind: "promo_thumbnail", ...image, fileName: "x.svg", mimeType: "image/svg+xml" } })).status).toBe(400);
    mockCloudinaryImage();
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: signed.json.intentId } })).status).toBe(200);
    expect((await call(home.GET)).json.promo.thumbnailUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);

    expect((await call(introThumb.DELETE, { method: "DELETE", cookie: s.cookie })).status).toBe(403);
    expect((await call(introThumb.DELETE, { method: "DELETE", cookie: t.cookie })).json.intro.thumbnailUrl).toBeUndefined();
    expect(await AssetDeletion.countDocuments({ publicId: signed.json.fields.public_id })).toBe(1);
  });
});

describe("promotional video file", () => {
  const video = { fileName: "promo.mp4", fileSize: 30_000_000, mimeType: "video/mp4" };

  it("is uploaded, replaced and deleted by the admin; a YouTube link replaces the file", async () => {
    const { t, s } = await people();
    await call(intro.PUT, { method: "PUT", cookie: t.cookie, body: { youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", title: "Meet Onkur", text: "", enabled: true } });
    expect((await call(sign.POST, { cookie: s.cookie, body: { kind: "promo_video", ...video } })).status).toBe(403);
    expect((await call(sign.POST, { cookie: t.cookie, body: { kind: "promo_video", ...video, fileName: "promo.exe", mimeType: "application/octet-stream" } })).status).toBe(400);

    const upload = async () => {
      const signed = await call(sign.POST, { cookie: t.cookie, body: { kind: "promo_video", ...video } });
      expect(signed.status).toBe(200);
      expect(signed.json.fields.public_id).toMatch(/^onkuron\/site\/promo_video\/[a-f0-9]{24}$/);
      expect(signed.json.uploadUrl).toMatch(/\/video\/upload$/);
      expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: signed.json.intentId } })).status).toBe(200);
      return signed.json.fields.public_id as string;
    };
    mockCloudinaryImage("mp4");
    const first = await upload();
    let promo = (await call(home.GET)).json.promo;
    expect(promo.videoUrl).toMatch(/^https:\/\/res\.cloudinary\.com\/.*\.mp4$/);
    expect(promo.youtubeVideoId).toBeNull(); // the file replaced the YouTube link

    await upload(); // replace: the old file is queued for deletion
    expect(await AssetDeletion.countDocuments({ publicId: first })).toBe(1);

    await call(intro.PUT, { method: "PUT", cookie: t.cookie, body: { youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", title: "Meet Onkur", text: "", enabled: true } });
    promo = (await call(home.GET)).json.promo;
    expect(promo).toMatchObject({ youtubeVideoId: "dQw4w9WgXcQ", videoUrl: null });

    expect((await call(introVideo.DELETE, { method: "DELETE", cookie: s.cookie })).status).toBe(403);
    const deleted = await call(introVideo.DELETE, { method: "DELETE", cookie: t.cookie });
    expect(deleted.json.intro.youtubeVideoId).toBeUndefined();
    expect(deleted.json.intro.videoUrl).toBeUndefined();
    expect(await AssetDeletion.countDocuments({ reason: { $in: ["promo_video_replaced", "replaced_promo_video"] } })).toBe(2);
  });
});

describe("learning categories (admin-managed)", () => {
  const base = { name: "Web Development", description: "Build real websites.", label: "New", icon: "code", published: false };

  it("seeds only HSC ICT, once", async () => {
    const list = await call(publicCategories.GET);
    expect(list.json.categories.map((c: { slug: string }) => c.slug)).toEqual(["hsc-ict"]);
    expect(list.json.categories[0]).not.toHaveProperty("published");
    await Category.deleteMany({});
    expect((await call(publicCategories.GET)).json.categories).toHaveLength(0); // deleted stays deleted
  });

  it("creates, publishes, reorders and unpublishes a category; the public list follows", async () => {
    const { t, s } = await people();
    expect((await call(categories.POST, { cookie: s.cookie, body: base })).status).toBe(403);
    expect((await call(categories.POST, { body: base })).status).toBe(401);

    const created = await call(categories.POST, { cookie: t.cookie, body: base });
    expect(created.status).toBe(201);
    expect(created.json.category).toMatchObject({ slug: "web-development", name: "Web Development", published: false, label: "New" });
    const id = created.json.category.id;
    const slugs = async () => (await call(publicCategories.GET)).json.categories.map((c: { slug: string }) => c.slug);
    expect(await slugs()).not.toContain("web-development");

    await call(categoryOne.PUT, { method: "PUT", cookie: t.cookie, params: { categoryId: id }, body: { ...base, published: true } });
    expect((await slugs()).at(-1)).toBe("web-development");

    const all = (await call(categories.GET, { cookie: t.cookie })).json.categories as Array<{ id: string }>;
    const ids = [id, ...all.map((c) => c.id).filter((x) => x !== id)];
    expect((await call(categoryOrder.PUT, { method: "PUT", cookie: t.cookie, body: { ids } })).status).toBe(200);
    expect((await slugs())[0]).toBe("web-development");
    expect((await call(categoryOrder.PUT, { method: "PUT", cookie: t.cookie, body: { ids: ids.slice(1) } })).status).toBe(400); // incomplete list

    await call(categoryOne.PUT, { method: "PUT", cookie: t.cookie, params: { categoryId: id }, body: { ...base, published: false } });
    expect(await slugs()).not.toContain("web-development");
  });

  it("validates input, rejects duplicate names and never takes a slug from the admin", async () => {
    const { t } = await people();
    for (const body of [
      { ...base, name: "" },
      { ...base, icon: "skull" },
      { ...base, courseIds: ["nope"] },
      { ...base, name: { $ne: null } },
    ]) {
      expect((await call(categories.POST, { cookie: t.cookie, body })).status, JSON.stringify(body)).toBe(400);
    }
    const dup = await call(categories.POST, { cookie: t.cookie, body: { ...base, name: "HSC ICT" } });
    expect(dup.status).toBe(400);
    expect(dup.json.error.details.fields.name[0]).toMatch(/already exists/);
    // A slug sent by a client is ignored: it always comes from the name.
    const created = await call(categories.POST, { cookie: t.cookie, body: { ...base, slug: "my-own-url" } });
    expect(created.json.category.slug).toBe("web-development");
    // Names without Latin letters (e.g. Bangla) still get a valid URL.
    expect((await call(categories.POST, { cookie: t.cookie, body: { ...base, name: "পদার্থবিজ্ঞান" } })).json.category.slug).toMatch(/^category-[a-f0-9]{6}$/);
  });

  it("associates courses, keeps its URL when renamed, and deletes a category in use without deleting its courses", async () => {
    const { t } = await people();
    const course = await call(courses.POST, { cookie: t.cookie, body: { title: "HTML & CSS", price: 500, published: true } });
    const draft = await call(courses.POST, { cookie: t.cookie, body: { title: "Draft course", price: 500, published: false } });
    const created = await call(categories.POST, { cookie: t.cookie, body: { ...base, published: true, courseIds: [course.json.id, draft.json.id] } });
    const id = created.json.category.id;
    expect(created.json.category).toMatchObject({ courseCount: 1 }); // published courses only
    expect(created.json.category.courseIds.sort()).toEqual([course.json.id, draft.json.id].sort());

    const listed = await listPublishedCourses({ category: "web-development" }); // the catalogue filter the homepage box opens
    expect(listed.map((c) => c.title)).toEqual(["HTML & CSS"]);
    expect(listed[0].categoryName).toBe("Web Development");

    // Renaming keeps the URL (?category=web-development), so shared links and its courses stay put.
    const renamed = await call(categoryOne.PUT, { method: "PUT", cookie: t.cookie, params: { categoryId: id }, body: { ...base, name: "Web Design", published: true, slug: "web-dev" } });
    expect(renamed.json.category).toMatchObject({ name: "Web Design", slug: "web-development" });
    expect((await Course.findById(course.json.id).lean())!.category).toBe("web-development");

    // Deleting a category in use keeps its courses (published, just uncategorized).
    const deleted = await call(categoryOne.DELETE, { method: "DELETE", cookie: t.cookie, params: { categoryId: id } });
    expect(deleted.status).toBe(200);
    expect(deleted.json.uncategorized).toBe(2);
    expect(await Category.exists({ slug: "web-development" })).toBeNull();
    const kept = (await Course.findById(course.json.id).lean())!;
    expect(kept.category).toBeUndefined();
    expect(kept.published).toBe(true);
  });

  it("lists each subject once even when the database holds copies", async () => {
    // The state an earlier seeding bug left in a real database: no unique index, subjects stored several times.
    await Category.collection.dropIndex("slug_1").catch(() => undefined);
    const row = (slug: string, name: string) => ({ slug, name, description: "", icon: "book", published: true, order: 0 });
    await Category.insertMany([row("hsc-ict", "HSC ICT"), row("hsc-ict", "HSC ICT"), row("hsc-physics", "HSC Physics"), row("hsc-physics", "HSC Physics")]);
    await Setting.updateOne({ key: "platform" }, { $set: { "seeded.categories": true } }, { upsert: true });
    const { t } = await people();

    expect((await call(publicCategories.GET)).json.categories.map((c: { slug: string }) => c.slug)).toEqual(["hsc-ict", "hsc-physics"]); // no duplicate keys
    expect((await call(categories.GET, { cookie: t.cookie })).json.categories).toHaveLength(4); // the admin sees every row
    await Category.deleteMany({});
    await Category.createIndexes();
  });

  it("seeds exactly one copy when many first requests arrive at once", async () => {
    // A fresh production database has no unique slug index yet when the first requests race.
    await Category.collection.dropIndex("slug_1").catch(() => undefined);
    await Promise.all(Array.from({ length: 8 }, () => listCategories()));
    expect(await Category.countDocuments()).toBe(DEFAULT_CATEGORIES.length);
    await Category.createIndexes();
    await Promise.all(Array.from({ length: 8 }, () => listTopics()));
    expect(await listTopics()).toHaveLength(DEFAULT_TOPICS.length);
  });

  it("uploads a category image only for an existing category", async () => {
    const { t } = await people();
    const id = (await call(categories.POST, { cookie: t.cookie, body: base })).json.category.id;
    expect((await call(sign.POST, { cookie: t.cookie, body: { kind: "category_image", ...image } })).status).toBe(400);
    expect((await call(sign.POST, { cookie: t.cookie, body: { kind: "category_image", ...image, targetId: "a".repeat(24) } })).status).toBe(404);
    const signed = await call(sign.POST, { cookie: t.cookie, body: { kind: "category_image", ...image, targetId: id } });
    expect(signed.status).toBe(200);
    mockCloudinaryImage();
    expect((await call(complete.POST, { cookie: t.cookie, body: { intentId: signed.json.intentId } })).status).toBe(200);
    expect((await call(categoryOne.GET, { cookie: t.cookie, params: { categoryId: id } })).json.category.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });
});

describe("interactive lessons (admin-managed)", () => {
  const base = { title: "Number systems", chapter: "Chapter 3", chapterBn: "সংখ্যা পদ্ধতি", glyph: "1010", learn: ["Binary", "Hex"], module: "logic", published: false };

  it("seeds the five built-in labs and serves published ones only", async () => {
    const { t } = await people();
    const list = (await call(topics.GET, { cookie: t.cookie })).json.topics;
    expect(list).toHaveLength(DEFAULT_TOPICS.length);
    expect((await listPublicTopics())[0]).toMatchObject({ slug: "logic-gates", module: "logic" });

    const created = await call(topics.POST, { cookie: t.cookie, body: base });
    expect(created.status).toBe(201);
    expect(created.json.topic).toMatchObject({ slug: "number-systems", module: "logic", learn: ["Binary", "Hex"] });
    expect((await listPublicTopics()).map((x) => x.slug)).not.toContain("number-systems"); // draft
    expect((await call(home.GET)).json.interactive.topics.map((x: { slug: string }) => x.slug)).not.toContain("number-systems");

    const id = created.json.topic.id;
    await call(topicOne.PUT, { method: "PUT", cookie: t.cookie, params: { topicId: id }, body: { ...base, published: true, module: "" } });
    const shown = (await listPublicTopics()).find((x) => x.slug === "number-systems");
    expect(shown).toBeDefined();
    expect(shown!.module).toBeUndefined(); // the lab shows its "being prepared" state

    const ids = [id, ...list.map((x: { id: string }) => x.id)];
    await call(topicOrder.PUT, { method: "PUT", cookie: t.cookie, body: { ids } });
    expect((await call(home.GET)).json.interactive.topics[0].slug).toBe("number-systems");

    expect((await call(topicOne.DELETE, { method: "DELETE", cookie: t.cookie, params: { topicId: id } })).status).toBe(200);
    expect((await listTopics()).map((x) => x.slug)).not.toContain("number-systems");
  });

  it("links a lesson to a course and validates input (admin only)", async () => {
    const { t, s } = await people();
    expect((await call(topics.POST, { cookie: s.cookie, body: base })).status).toBe(403);
    for (const body of [
      { ...base, module: "astrology" },
      { ...base, title: "" },
      { ...base, courseId: "nope" },
      { ...base, learn: Array(9).fill("x") },
    ]) {
      expect((await call(topics.POST, { cookie: t.cookie, body })).status, JSON.stringify(body)).toBe(400);
    }
    expect((await call(topics.POST, { cookie: t.cookie, body: { ...base, courseId: "a".repeat(24) } })).status).toBe(400); // course must exist

    const course = await call(courses.POST, { cookie: t.cookie, body: { title: "HSC ICT Complete", price: 1000, published: true } });
    const created = await call(topics.POST, { cookie: t.cookie, body: { ...base, published: true, courseId: course.json.id } });
    expect((await listPublicTopics()).find((x) => x.slug === created.json.topic.slug)!.courseSlug).toBe(course.json.slug);
    expect((await call(topics.POST, { cookie: t.cookie, body: { ...base, slug: "logic-gates" } })).status).toBe(409);
  });
});
