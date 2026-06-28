"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

/**
 * رافع صور: يستخدم رابطاً موقّعاً مسبقاً عند تهيئة التخزين، وإلا يتيح لصق رابط صورة.
 * يبقى التدفّق يعمل في بيئات التطوير دون S3.
 */
export function ImageUploader({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const status = trpc.upload.status.useQuery();
  const presign = trpc.upload.presign.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ct = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/avif";
      const { uploadUrl, publicUrl } = await presign.mutateAsync({ contentType: ct, purpose: "product" });
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error("فشل رفع الصورة");
      onChange([...value, publicUrl]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في الرفع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute start-0 top-0 bg-danger px-1 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {status.data?.configured ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => fileRef.current?.click()}>
            + رفع صورة
          </Button>
        </>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="ألصق رابط صورة (https://…)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (/^https?:\/\//.test(urlInput)) {
                onChange([...value, urlInput.trim()]);
                setUrlInput("");
              }
            }}
          >
            إضافة
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
