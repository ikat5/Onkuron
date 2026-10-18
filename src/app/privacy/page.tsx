import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Onkur collects, uses and protects your personal information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="19 October 2026">
      <p>This policy explains what personal information Onkur (অঙ্কুরণ) collects when you use this website, why we collect it and how you can contact us about it.</p>
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and mobile number. Passwords are stored only as a secure one-way hash.</li>
        <li><strong>Enrollment and payment details:</strong> the payment method, transaction ID, sender number and amount you submit so a teacher can verify your payment. We never ask for PINs, passwords or OTPs.</li>
        <li><strong>Learning activity:</strong> which lessons you have watched or completed and your playback position, so your progress can be saved.</li>
        <li><strong>Messages:</strong> messages you send to teachers and messages sent through the contact form.</li>
        <li><strong>Security records:</strong> limited technical information such as sign-in events, used to protect accounts and prevent abuse.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To create and secure your account and verify your email address.</li>
        <li>To review enrollment requests and give approved students access to course materials.</li>
        <li>To send you emails about your account and enrollments.</li>
        <li>To answer your questions and messages.</li>
      </ul>
      <h2>Cookies</h2>
      <p>We use one essential cookie to keep you signed in. We do not use advertising cookies. Your playback-speed preference may be remembered in your browser&apos;s local storage.</p>
      <h2>Services we rely on</h2>
      <ul>
        <li><strong>YouTube</strong> streams lesson and introduction videos through its privacy-enhanced embedded player. When you play a video, YouTube processes data according to its own privacy policy.</li>
        <li><strong>Cloudinary</strong> stores course thumbnails, profile photos and lesson files.</li>
        <li><strong>Our database and email providers</strong> store account data and deliver our emails.</li>
      </ul>
      <h2>Sharing</h2>
      <p>We do not sell your personal information. Your payment and enrollment details are visible only to the teacher account that verifies enrollments.</p>
      <h2>Your choices</h2>
      <p>You can update your password from your account page and ask us to correct or delete your information by emailing us. Some records, such as payment verification history, may need to be kept to resolve disputes.</p>
      <h2>Contact</h2>
      <p>
        Questions about this policy: <a className="font-semibold text-brand-700 underline" href="mailto:info.onkuron@gmail.com">info.onkuron@gmail.com</a>
      </p>
    </LegalPage>
  );
}
