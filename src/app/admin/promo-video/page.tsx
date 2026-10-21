import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { featureStatus } from "@/lib/env";
import { getIntro } from "@/services/settings";
import { PromoForm } from "./promo-form";

export const metadata: Metadata = { title: "Promo video" };

export default async function PromoVideoPage() {
  await requireUser("/admin/promo-video", "teacher");
  await connectDB();
  const intro = await getIntro();
  return (
    <>
      <PageHeader
        title="Promo video"
        subtitle="The homepage hero right below the header. Saved changes are live on the next page load."
        action={
          <Link href="/" className="btn-outline shrink-0" target="_blank">
            <Icon name="external" /> Open homepage
          </Link>
        }
      />
      <PromoForm key={intro.videoUrl ?? intro.youtubeVideoId ?? "none"} initial={intro} canUpload={featureStatus().cloudinary.ok} />
    </>
  );
}
