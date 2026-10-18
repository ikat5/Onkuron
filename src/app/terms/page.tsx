import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms and Conditions", description: "The terms for using Onkur and enrolling in its courses.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions" updated="19 October 2026">
      <p>By creating an account or enrolling in a course on Onkur (অঙ্কুরণ), you agree to these terms.</p>
      <h2>Accounts</h2>
      <ul>
        <li>Give accurate information and keep your password private. You are responsible for activity on your account.</li>
        <li>One account is for one student. Do not share your access with others.</li>
      </ul>
      <h2>Enrollment and payment</h2>
      <ul>
        <li>Course prices are shown in Bangladeshi taka (BDT).</li>
        <li>You pay by mobile banking and submit the transaction ID. Access is granted only after a teacher verifies the payment; a request may be rejected if the payment cannot be verified.</li>
        <li>If you think a decision is wrong, contact us with your transaction details.</li>
      </ul>
      <h2>Course content</h2>
      <ul>
        <li>Lessons, notes and other materials are for your personal learning only. Do not copy, redistribute, re-upload or sell them.</li>
        <li>Videos are streamed through YouTube&apos;s embedded player; video links are not to be shared outside the platform.</li>
        <li>We may update, reorder or improve course content over time.</li>
      </ul>
      <h2>No guarantees</h2>
      <p>We work hard to make lessons clear and useful, but we cannot guarantee particular exam results, jobs or income.</p>
      <h2>Conduct</h2>
      <p>Be respectful in messages to teachers. We may suspend accounts that abuse the platform, share paid content or attempt to bypass access controls.</p>
      <h2>Changes</h2>
      <p>We may update these terms. Significant changes will be shown on this page with a new “last updated” date.</p>
      <h2>Contact</h2>
      <p>
        Questions: <a className="font-semibold text-brand-700 underline" href="mailto:info.onkuron@gmail.com">info.onkuron@gmail.com</a>
      </p>
    </LegalPage>
  );
}
