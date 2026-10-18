import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { Container } from "@/components/ui";
import { CONTACT_EMAIL } from "@/services/contact";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Questions about a course, enrollment or payment? Contact Onkur at info.onkuron@gmail.com or send us a message.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-night-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(242,138,67,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(42,107,192,0.45),transparent_55%)]" />
        <Container className="relative py-16">
          <p className="eyebrow text-sun-400">Contact us</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">We&apos;re happy to help</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100/85">Questions about a course, enrollment or a payment? Send a message and we&apos;ll reply by email.</p>
        </Container>
      </section>
      <Container className="py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
          <aside className="space-y-5">
            <a href={`mailto:${CONTACT_EMAIL}`} className="card lift group flex items-center gap-4 p-6 hover:border-brand-200">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white transition group-hover:bg-sun-500 group-hover:text-ink">
                <Icon name="mail" className="size-6" />
              </span>
              <span>
                <span className="block text-xs font-semibold tracking-wide text-muted uppercase">Email</span>
                <span className="font-bold break-all text-ink">{CONTACT_EMAIL}</span>
              </span>
            </a>
            <div className="card space-y-3 p-6 text-sm text-muted">
              <p className="font-semibold text-ink">Already a student?</p>
              <p>Sign in and use Messages in your dashboard, or the “Ask your teacher” box inside any lesson — your question reaches the teacher with the lesson attached.</p>
            </div>
            <div className="card space-y-3 p-6 text-sm text-muted">
              <p className="font-semibold text-ink">About payments</p>
              <p>Never send PINs, passwords or OTPs to anyone — including us. We only ever need your transaction ID.</p>
            </div>
          </aside>
          <section aria-labelledby="form-title" className="card p-6 sm:p-8">
            <h2 id="form-title" className="text-2xl font-extrabold text-ink">
              Send a message
            </h2>
            <p className="mt-1 text-sm text-muted">All fields are required.</p>
            <ContactForm />
          </section>
        </div>
      </Container>
    </>
  );
}
