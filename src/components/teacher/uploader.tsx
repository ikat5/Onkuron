"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api-client";

/** Lesson videos are YouTube links, so only images and documents are uploaded. */
export type UploadKind = "thumbnail" | "teacher_photo" | "pdf" | "slides" | "document";

interface SignResponse {
  intentId: string;
  uploadUrl: string;
  fields: Record<string, string | number | boolean>;
  chunkSize: number;
}

const ACCEPT: Record<UploadKind, string> = {
  thumbnail: "image/jpeg,image/png,image/webp",
  teacher_photo: "image/jpeg,image/png,image/webp",
  pdf: "application/pdf,.pdf",
  slides: ".ppt,.pptx,.odp,.key",
  document: ".doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.csv",
};

function postPart(url: string, form: FormData, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error((body.error as { message?: string })?.message ?? `Upload failed (${xhr.status})`));
    };
    xhr.send(form);
  });
}

/**
 * Direct, signed browser → Cloudinary upload. The server signs the request
 * (the API secret never reaches the browser), large files are sent in 20 MB
 * chunks, and the server verifies the stored asset before saving it.
 */
async function directUpload(sign: SignResponse, file: File, onProgress: (pct: number) => void) {
  const fieldsForm = () => {
    const f = new FormData();
    for (const [k, v] of Object.entries(sign.fields)) f.append(k, String(v));
    return f;
  };
  if (file.size <= sign.chunkSize) {
    const f = fieldsForm();
    f.append("file", file);
    await postPart(sign.uploadUrl, f, {}, (l) => onProgress((l / file.size) * 100));
    return;
  }
  const uploadId = crypto.randomUUID();
  for (let start = 0; start < file.size; start += sign.chunkSize) {
    const end = Math.min(start + sign.chunkSize, file.size);
    const f = fieldsForm();
    f.append("file", file.slice(start, end), file.name);
    await postPart(
      sign.uploadUrl,
      f,
      { "X-Unique-Upload-Id": uploadId, "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
      (l) => onProgress(((start + l) / file.size) * 100),
    );
  }
}

export function Uploader({
  kind,
  courseId,
  profileId,
  lessonId,
  resourceId,
  label,
  needsTitle = false,
  title: externalTitle,
  onDone,
}: {
  kind: UploadKind;
  /** Omitted for the teacher profile photo. */
  courseId?: string;
  /** Teacher profile receiving a "teacher_photo" upload. */
  profileId?: string;
  lessonId?: string;
  resourceId?: string;
  label: string;
  needsTitle?: boolean;
  /** Title supplied by the parent form instead of the built-in title input. */
  title?: string;
  onDone?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function start(file: File) {
    setError(null);
    const resourceTitle = (externalTitle ?? title).trim();
    if ((needsTitle || externalTitle !== undefined) && !resourceTitle) {
      setError("Enter a title first");
      return;
    }
    setStage("Preparing…");
    setProgress(0);
    const signed = await api<SignResponse>("/api/teacher/uploads/sign", {
      body: { kind, courseId, profileId, lessonId, resourceId, title: needsTitle || externalTitle !== undefined ? resourceTitle : undefined, fileName: file.name, fileSize: file.size, mimeType: file.type },
    });
    if (!signed.ok) {
      setProgress(null);
      setError(signed.error.message);
      return;
    }
    try {
      setStage("Uploading…");
      await directUpload(signed.data, file, (p) => setProgress(Math.min(99, Math.round(p))));
    } catch (e) {
      setProgress(null);
      setError((e as Error).message);
      return;
    }
    setStage("Verifying…");
    const done = await api("/api/teacher/uploads/complete", { body: { intentId: signed.data.intentId } });
    if (!done.ok) {
      setProgress(null);
      setError(done.error.message);
      return;
    }
    setProgress(100);
    setStage("Uploaded ✓");
    setTitle("");
    if (inputRef.current) inputRef.current.value = "";
    onDone?.();
  }

  const busy = progress !== null && progress < 100;
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {needsTitle && <input className="input sm:max-w-56" placeholder="Title (e.g. Chapter 1 notes)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} aria-label="Resource title" disabled={busy} />}
        <label className={`btn-outline cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {label}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT[kind]}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) start(f);
            }}
          />
        </label>
      </div>
      {progress !== null && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-50" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-leaf-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {stage} {progress < 100 && `${progress}%`}
          </p>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
