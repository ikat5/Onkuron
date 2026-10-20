"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import { Uploader } from "@/components/teacher/uploader";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";

/** Group photo of the whole teacher panel, shown at the top of Meet Our Teachers. */
export function TeamPhoto({ url, canUpload }: { url?: string; canUpload: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<string | undefined>();
  const photoUrl = url && url !== removed ? url : undefined;

  async function remove() {
    setBusy(true);
    const res = await api("/api/teacher/settings/team-photo", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "error");
    setRemoved(photoUrl);
    setConfirm(false);
    toast("Group photo removed.");
    router.refresh();
  }

  return (
    <section className="card mb-6 grid overflow-hidden md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative aspect-video bg-gradient-to-br from-brand-600 to-night-800">
        {photoUrl ? (
          <Image src={photoUrl} alt="Teacher panel group photo" fill sizes="(min-width: 768px) 60vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/80">
            <Icon name="users" className="size-12" />
            <span className="text-sm">No group photo yet</span>
          </div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <h2 className="font-bold text-ink">Teacher panel group photo</h2>
        <p className="text-sm text-muted">Shown at the top of Meet Our Teachers, above the individual teachers.</p>
        {!canUpload ? (
          <p className="text-xs text-sun-700">Uploads are unavailable until Cloudinary is configured.</p>
        ) : (
          <>
            <Uploader kind="team_photo" label={photoUrl ? "Replace group photo" : "Upload group photo"} onDone={() => router.refresh()} />
            <p className="text-xs text-muted">A wide (landscape) JPG, PNG or WebP works best.</p>
            {photoUrl && (
              <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => setConfirm(true)}>
                Remove group photo
              </button>
            )}
          </>
        )}
      </div>
      <ConfirmDialog open={confirm} title="Remove group photo?" confirmLabel="Remove photo" busy={busy} onConfirm={remove} onCancel={() => setConfirm(false)}>
        <p>The photo will be removed from Meet Our Teachers and deleted from storage.</p>
      </ConfirmDialog>
    </section>
  );
}
