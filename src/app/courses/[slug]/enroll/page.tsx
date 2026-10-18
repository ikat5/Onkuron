import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { Alert, Container, formatTaka } from "@/components/ui";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { Course } from "@/models/Course";
import { Enrollment } from "@/models/Enrollment";
import { getSettings } from "@/services/settings";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "@/lib/validation";
import { EnrollForm } from "./enroll-form";

export const metadata: Metadata = { title: "Enroll" };

export default async function EnrollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/courses/${slug}/enroll`);
  if (user.role !== "student") redirect(`/courses/${slug}`);
  await connectDB();
  const course = await Course.findOne({ slug, published: true }).select("title price slug").lean();
  if (!course) notFound();

  const active = await Enrollment.findOne({ studentId: new Types.ObjectId(user.id), courseId: course._id, active: true }).lean();
  if (active) redirect(`/courses/${slug}`);

  const settings = await getSettings();
  const methods = PAYMENT_METHODS.filter((m) => settings.paymentNumbers[m]).map((m) => ({ id: m, label: PAYMENT_LABELS[m], number: settings.paymentNumbers[m] }));

  return (
    <Container className="max-w-3xl py-10">
      <Link href={`/courses/${slug}`} className="text-sm text-brand-600 hover:underline">
        ← Back to course
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-brand-700">Enroll in {course.title}</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold text-ink">1. Send the payment</h2>
          <p className="text-sm text-muted">
            Send exactly <strong className="text-sun-600">{formatTaka(course.price)}</strong> using <em>Send Money</em> to one of these numbers:
          </p>
          {methods.length === 0 ? (
            <Alert tone="warning">Payment numbers have not been set up yet. Please message the teacher before paying.</Alert>
          ) : (
            <ul className="space-y-2">
              {methods.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="font-semibold">{m.label}</span>
                  <span className="font-mono">{m.number}</span>
                </li>
              ))}
            </ul>
          )}
          {settings.paymentInstructions && <p className="text-sm whitespace-pre-line text-muted">{settings.paymentInstructions}</p>}
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-ink">2. Submit your transaction details</h2>
          <EnrollForm courseId={String(course._id)} methods={methods.map(({ id, label }) => ({ id, label }))} />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        Payments are verified manually by our teacher. Submitting this form does not confirm your payment — you&apos;ll get an email once it&apos;s reviewed.
      </p>
    </Container>
  );
}
