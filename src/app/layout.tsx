import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const hind = Hind_Siliguri({ variable: "--font-hind", subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["600", "700", "800"] });

const SITE_URL = process.env.APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";
const DESCRIPTION = "Onkur (অঙ্কুরণ) — learn HSC ICT and modern web development through structured video lessons, practical resources and guidance from dedicated teachers.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Onkur — HSC ICT & Web Development Courses | অঙ্কুরণ", template: "%s · Onkur" },
  description: DESCRIPTION,
  applicationName: "Onkur",
  openGraph: {
    type: "website",
    siteName: "Onkur — অঙ্কুরণ",
    title: "Onkur — Learn Today. Build Tomorrow.",
    description: DESCRIPTION,
    images: [{ url: "/brand/logo-wordmark-480.png", alt: "অঙ্কুরণ Onkur logo" }],
    locale: "en_BD",
  },
  twitter: { card: "summary", title: "Onkur — Learn Today. Build Tomorrow.", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#1555a4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hind.variable} ${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <a href="#main" className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">{children}</main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
