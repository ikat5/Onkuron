import { z } from "zod";
import { parseYouTubeUrl } from "@/lib/youtube";
import { CATEGORY_IDS } from "@/lib/categories";
import { TEAM_IDS } from "@/lib/team";

/**
 * Request schemas shared by API routes and client forms. Objects are strict
 * about types (strings only), which also blocks NoSQL operator injection such
 * as `{ "email": { "$ne": null } }`. Unknown keys are stripped by Zod.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "Enter a valid email address" }));

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

/** Bangladeshi mobile number, e.g. 01712345678 or +8801712345678. */
export const bdPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"))
  .transform((v) => v.replace(/^\+?88/, ""));

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name").max(100),
    email: emailSchema,
    phone: bdPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
  next: z.string().max(512).optional(),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(100) });
export const resendSchema = z.object({ email: emailSchema });
export const forgotSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(100), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: "Choose a different password" });

export const PAYMENT_METHODS = ["bkash", "nagad", "rocket"] as const;
export const PAYMENT_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
};

export const enrollmentSchema = z.object({
  courseId: objectIdSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  transactionId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,30}$/, "Transaction ID must be 6–30 letters or digits"),
  senderNumber: bdPhoneSchema,
});

export const decisionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Give the student a reason").max(500),
});

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(160);

const courseFields = z.object({
  title: z.string().trim().min(3).max(150),
  slug: slugSchema.optional(),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(10000),
  price: z.coerce.number().int("Use whole taka").min(1, "Price must be at least ৳1").max(1_000_000),
  /** "" clears the category. */
  category: z.union([z.enum(CATEGORY_IDS), z.literal("")]).optional(),
  published: z.boolean(),
});

export const courseSchema = courseFields.extend({
  summary: courseFields.shape.summary.default(""),
  description: courseFields.shape.description.default(""),
  published: courseFields.shape.published.default(false),
});

/** Partial update: no defaults, so omitted fields are left unchanged (never reset). */
export const courseUpdateSchema = courseFields.partial();

/**
 * A YouTube link pasted by the teacher. Parsed into a bare video ID here, so
 * routes only ever see an ID taken from a recognised YouTube host. An empty
 * string means "no video" (null).
 */
export const youtubeUrlSchema = z
  .string()
  .trim()
  .max(500)
  .transform((v, ctx) => {
    if (v === "") return null;
    const id = parseYouTubeUrl(v);
    if (!id) {
      ctx.addIssue({ code: "custom", message: "Paste a valid YouTube video link (youtube.com/watch, youtu.be, /embed or /shorts)" });
      return z.NEVER;
    }
    return id;
  });

const lessonFields = z.object({
  title: z.string().trim().min(2, "Use at least 2 characters").max(150),
  description: z.string().trim().max(5000).default(""),
  youtubeUrl: youtubeUrlSchema.optional(),
});

export const lessonSchema = lessonFields.transform(({ youtubeUrl, ...rest }) => ({ ...rest, youtubeVideoId: youtubeUrl ?? null }));

export const lessonUpdateSchema = lessonFields
  .partial()
  .extend({ move: z.enum(["up", "down"]).optional() })
  .transform(({ youtubeUrl, ...rest }) => ({ ...rest, youtubeVideoId: youtubeUrl }));

export const lessonOrderSchema = z.object({
  lessonIds: z.array(objectIdSchema).min(1).max(500),
});

/** External learning links must be plain https URLs (no credentials, no other schemes). */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Enter a full https:// link");

export const resourceTitleSchema = z.string().trim().min(1, "Give the resource a title").max(150);

export const linkResourceSchema = z.object({
  title: resourceTitleSchema,
  url: httpsUrlSchema,
});

export const resourceUpdateSchema = z.object({
  title: resourceTitleSchema.optional(),
  url: httpsUrlSchema.optional(),
});

const seconds = z.number().finite().min(0).max(24 * 60 * 60);

export const progressSchema = z.object({
  /** Identifies the video the numbers refer to (e.g. "yt:VIDEO_ID"). */
  videoKey: z.string().trim().max(200).optional(),
  positionSeconds: seconds.optional(),
  durationSeconds: seconds.optional(),
  /** Seconds actually played since the previous report (seeks excluded by the player). */
  watchedDelta: z.number().finite().min(0).max(600).optional(),
  completed: z.boolean().optional(),
});

export const UPLOAD_KINDS = ["thumbnail", "teacher_photo", "team_photo", "video", "pdf", "slides", "document"] as const;

export const signUploadSchema = z.object({
  kind: z.enum(UPLOAD_KINDS),
  courseId: objectIdSchema.optional(),
  /** Teacher profile receiving a "teacher_photo" upload. */
  profileId: objectIdSchema.optional(),
  lessonId: objectIdSchema.optional(),
  resourceId: objectIdSchema.optional(),
  title: z.string().trim().min(1).max(150).optional(),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().trim().max(150),
});

export const completeUploadSchema = z.object({ intentId: objectIdSchema });

export const messageSchema = z.object({
  /** Optional course/lesson the message is about; verified against the student's enrollment. */
  context: z.object({ courseId: objectIdSchema, lessonId: objectIdSchema.optional() }).optional(),
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Messages are limited to 2000 characters")
    // Strip control characters other than newlines and tabs.
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")),
});

export const settingsSchema = z.object({
  paymentNumbers: z.object({
    bkash: z.union([bdPhoneSchema, z.literal("")]).optional(),
    nagad: z.union([bdPhoneSchema, z.literal("")]).optional(),
    rocket: z
      .string()
      .trim()
      .regex(/^$|^[0-9]{11,12}$/, "Rocket numbers are 11–12 digits")
      .optional(),
  }),
  paymentInstructions: z.string().trim().max(2000).default(""),
  supportEmail: z.union([emailSchema, z.literal("")]).optional(),
  supportPhone: z.union([bdPhoneSchema, z.literal("")]).optional(),
});

/** Platform introduction (homepage + dashboards). */
export const introSchema = z
  .object({
    youtubeUrl: youtubeUrlSchema,
    title: z.string().trim().max(120).default(""),
    text: z.string().trim().max(1500).default(""),
  })
  .transform(({ youtubeUrl, ...rest }) => ({ ...rest, youtubeVideoId: youtubeUrl }));

const shortText = (max: number) => z.string().trim().max(max);

/** An optional https link that must point at one of `hosts` (or a subdomain). Empty string = no link. */
const profileLink = (hosts: string[], message: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => {
      if (v === "") return true;
      try {
        const u = new URL(v);
        const host = u.hostname.toLowerCase();
        return u.protocol === "https:" && hosts.some((h) => host === h || host.endsWith(`.${h}`));
      } catch {
        return false;
      }
    }, message)
    .default("");
const tagList = z
  .array(z.string().trim().min(1).max(60))
  .max(20, "Use at most 20 items")
  .transform((items) => [...new Set(items)]);

export const teacherProfileSchema = z
  .object({
    /** Only used when creating; a profile never moves to another team. */
    team: z.enum(TEAM_IDS).default("teacher"),
    published: z.boolean().default(false),
    displayName: z.string().trim().min(2, "Enter the public display name").max(80),
    slug: slugSchema.max(80).optional().or(z.literal("")),
    headline: shortText(120).default(""),
    qualification: shortText(160).default(""),
    facebookUrl: profileLink(["facebook.com", "fb.com"], "Enter an https://facebook.com/… link"),
    youtubeChannelUrl: profileLink(["youtube.com"], "Enter an https://youtube.com/… channel link"),
    shortBio: shortText(300).default(""),
    bio: shortText(5000).default(""),
    philosophy: shortText(1500).default(""),
    subjects: tagList.default([]),
    expertise: tagList.default([]),
    achievements: z
      .array(
        z.object({
          title: z.string().trim().min(2, "Give the achievement a title").max(120),
          description: shortText(400).default(""),
          year: z.union([z.number().int().min(1950).max(2100), z.null()]).optional(),
        }),
      )
      .max(30, "Use at most 30 achievements")
      .default([]),
    courseIds: z
      .array(objectIdSchema)
      .max(200)
      .default([])
      .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]),
    youtubeUrl: youtubeUrlSchema.optional(),
  })
  .transform(({ youtubeUrl, ...rest }) => ({ ...rest, youtubeVideoId: youtubeUrl ?? null }));

export const teacherOrderSchema = z.object({ team: z.enum(TEAM_IDS).default("teacher"), profileIds: z.array(objectIdSchema).min(1).max(200) });

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: emailSchema,
  subject: z.string().trim().min(3, "Enter a subject").max(150),
  message: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters")
    .max(4000, "Messages are limited to 4000 characters")
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")),
  /** Honeypot: real visitors never see or fill this field. */
  website: z.string().max(200).optional(),
  /** Milliseconds since the form was rendered (bots submit instantly). */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type LessonUpdateInput = z.infer<typeof lessonUpdateSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type IntroInput = z.infer<typeof introSchema>;
export type TeacherProfileInput = z.infer<typeof teacherProfileSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
