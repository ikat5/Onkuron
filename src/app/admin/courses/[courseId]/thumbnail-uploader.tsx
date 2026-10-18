"use client";

import { useRouter } from "next/navigation";
import { Uploader } from "@/components/teacher/uploader";

export function ThumbnailUploader({ courseId, hasThumbnail }: { courseId: string; hasThumbnail: boolean }) {
  const router = useRouter();
  return <Uploader kind="thumbnail" courseId={courseId} label={hasThumbnail ? "Replace image" : "Upload image"} onDone={() => router.refresh()} />;
}
