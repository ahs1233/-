"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, X } from "lucide-react";
import { Button, Input } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

/**
 * رافع صور المنتجات. يدعم ثلاث طرق بحسب التوفّر:
 *  1) رفع موقّع إلى S3 إن كان مهيّأً (أفضل للإنتاج الكبير).
 *  2) رفع مباشر من الجهاز بلا أي إعداد: تُصغَّر الصورة في المتصفّح وتُخزَّن
 *     كـ data URL — يعمل فوراً من كاميرا/معرض الهاتف.
 *  3) لصق رابط صورة جاهز.
 */
async function fileToCanvas(file: File, maxSize = 1200): Promise<HTMLCanvasElement> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("تعذّر قراءة الصورة — جرّب صورة JPG أو PNG"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** يصغّر الصورة ويعيدها JPEG Blob — يوحّد الصيغة (يحلّ HEIC على سفاري) ويوفّر الحجم. */
async function fileToJpegBlob(file: File, maxSize = 1200, quality = 0.8): Promise<Blob> {
  const canvas = await fileToCanvas(file, maxSize);
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("تعذّر ضغط الصورة"))), "image/jpeg", quality);
  });
}

async function fileToResizedDataUrl(file: File, maxSize = 800, quality = 0.7): Promise<string> {
  const canvas = await fileToCanvas(file, maxSize);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ImageUploader({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const status = trpc.upload.status.useQuery();
  const presign = trpc.upload.presign.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (value.length >= 8) {
      setError("الحد الأقصى ٨ صور");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (status.data?.configured) {
        // التخزين مهيّأ: نضغط دائماً إلى JPEG ثم نرفع عبر رابط موقّع
        // (يوحّد الصيغ — حتى HEIC من الآيفون — ويوفّر حجم النقل)
        const blob = await fileToJpegBlob(file);
        const { uploadUrl, publicUrl } = await presign.mutateAsync({
          contentType: "image/jpeg",
          purpose: "product",
        });
        const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
        if (!res.ok) throw new Error("فشل رفع الصورة");
        onChange([...value, publicUrl]);
      } else {
        // رفع مباشر بلا إعداد (data URL مُصغّر)
        const dataUrl = await fileToResizedDataUrl(file);
        onChange([...value, dataUrl]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في معالجة الصورة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute start-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-brand-400 hover:text-brand-500"
        >
          {busy ? "…" : <ImagePlus className="h-6 w-6" />}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => setShowUrl((s) => !s)}
        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600"
      >
        <Link2 className="h-3.5 w-3.5" /> أو ألصق رابط صورة
      </button>

      {showUrl && (
        <div className="flex gap-2">
          <Input placeholder="https://…" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (/^https:\/\/\S+$/.test(urlInput.trim()) && value.length < 8) {
                onChange([...value, urlInput.trim()]);
                setUrlInput("");
                setShowUrl(false);
              } else {
                setError("أدخل رابط https صالحاً");
              }
            }}
          >
            إضافة
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-neutral-400">يمكنك رفع صورة من هاتفك مباشرةً — ستُصغَّر تلقائياً.</p>
    </div>
  );
}
