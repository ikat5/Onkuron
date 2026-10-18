/**
 * DEVELOPMENT ONLY: inserts a few clearly labelled demo courses (unpublished
 * by default, no media, no students, no payments). Refuses to run in
 * production. Remove them with `npm run seed:demo -- --remove`.
 */
import { connectDB, disconnectDB } from "@/lib/db";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { ensurePlatformSettings } from "@/services/teacher-seed";

const DEMO = [
  {
    slug: "demo-hsc-physics-foundations",
    title: "[Demo] HSC Physics Foundations",
    summary: "Demo course for development — vectors, motion and Newton's laws.",
    price: 1500,
    lessons: ["Vectors and scalars", "Motion in one dimension", "Newton's laws of motion"],
  },
  {
    slug: "demo-spoken-english",
    title: "[Demo] Spoken English Basics",
    summary: "Demo course for development — everyday conversation practice.",
    price: 800,
    lessons: ["Introducing yourself", "Asking for directions", "Talking about your day"],
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("✘ Refusing to seed demo data in production.");
    process.exitCode = 1;
    return;
  }
  await connectDB();
  try {
    if (process.argv.includes("--remove")) {
      const demo = await Course.find({ isDemo: true }).select("_id").lean();
      await Lesson.deleteMany({ courseId: { $in: demo.map((d) => d._id) } });
      const res = await Course.deleteMany({ isDemo: true });
      console.log(`✔ Removed ${res.deletedCount} demo course(s).`);
      return;
    }
    await ensurePlatformSettings();
    const publish = process.argv.includes("--publish");
    for (const d of DEMO) {
      const res = await Course.updateOne(
        { slug: d.slug },
        {
          $setOnInsert: {
            slug: d.slug, title: d.title, summary: d.summary, price: d.price, isDemo: true, published: publish,
            description: "This is a demonstration course created by `npm run seed:demo`. It contains no real content.",
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) {
        const course = await Course.findOne({ slug: d.slug }).lean();
        await Lesson.insertMany(d.lessons.map((title, order) => ({ courseId: course!._id, title, order, description: "Demo lesson." })));
        console.log(`✔ Created ${d.title}`);
      } else {
        console.log(`• ${d.title} already exists`);
      }
    }
  } finally {
    await disconnectDB();
  }
}

main().catch((e) => {
  console.error(`✘ ${(e as Error).message}`);
  process.exitCode = 1;
});
