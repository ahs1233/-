"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, X } from "lucide-react";
import { trpc } from "@/src/trpc/react";

/**
 * حقل صورةٍ واحدة للأدمن (صور المحافظات/الإعلانات). ثلاث طرق حسب التوفّر:
 *  1) رفع موقّع إلى S3 إن كان التخزين مهيّأً.
 *  2) رفعٌ مباشر بلا إعداد: تُصغَّر الصورة في المتصفّح وتُخزَّن data URL.
 *  3) لصق رابط https.
 */
async function fileToCanvas(file: File, maxSize: number): Promise<HTMLCanvasElement> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("تعذّر قراءة الصورة"));
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
// عند تهيئة S3 لا يوجد سقفٌ عمليّ — نرفع بدقّةٍ عالية.
async function fileToJpegBlob(file: File): Promise<Blob> {
  const canvas = await fileToCanvas(file, 2400);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("تعذّر ضغط الصورة"))), "image/jpeg", 0.9),
  );
}

// حدّ طول data URL (بالأحرف) — دون سقف المدقّق (3,000,000) بهامشٍ أمان.
const DATA_URL_MAX = 2_850_000;

/**
 * ترميزٌ متكيّف: يُبقي أكبر بُعدٍ عالياً (حتى ٢٠٠٠px) ويخفض الجودة تدريجيّاً
 * فقط عند اللزوم للبقاء تحت سقف التخزين — فلا تخرج الصورة منخفضة الدقّة بلا داعٍ.
 */
async function fileToDataUrlAdaptive(file: File): Promise<string> {
  let maxSize = 2000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = await fileToCanvas(file, maxSize);
    for (const q of [0.9, 0.84, 0.78, 0.7]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= DATA_URL_MAX) return url;
    }
    maxSize = Math.round(maxSize * 0.8); // ما زالت كبيرة → قلّل الأبعاد ثم أعد المحاولة
  }
  const canvas = await fileToCanvas(file, 1100);
  return canvas.toDataURL("image/jpeg", 0.6);
}

export function ImageField({
  value,
  onChange,
  purpose,
  aspect = "aspect-[16/9]",
}: {
  value: string;
  onChange: (url: string) => void;
  purpose: "gov" | "ad";
  aspect?: string;
}) {
  const status = trpc.admin.storageStatus.useQuery();
  const presign = trpc.admin.presignImage.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (status.data?.configured) {
        const blob = await fileToJpegBlob(file);
        const { uploadUrl, publicUrl } = await presign.mutateAsync({ contentType: "image/jpeg", purpose });
        const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
        if (!res.ok) throw new Error("فشل رفع الصورة");
        onChange(publicUrl);
      } else {
        onChange(await fileToDataUrlAdaptive(file));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ في معالجة الصورة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className={`relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 ${aspect}`}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="إزالة الصورة"
              className="absolute start-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-neutral-400 transition hover:text-brand-500"
          >
            <ImagePlus className="h-7 w-7" />
            <span className="text-xs font-medium">{busy ? "…جارٍ" : "ارفع صورة"}</span>
          </button>
        )}
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

      <div className="flex items-center gap-3">
        {value && (
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            استبدال
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600"
        >
          <Link2 className="h-3.5 w-3.5" /> رابط صورة
        </button>
      </div>

      {showUrl && (
        <div className="flex gap-2">
          <input
            dir="ltr"
            placeholder="https://…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const v = urlInput.trim();
              if (/^https:\/\/\S+$/.test(v) || v.startsWith("/")) {
                onChange(v);
                setUrlInput("");
                setShowUrl(false);
                setError(null);
              } else setError("أدخل رابط https صالحاً");
            }}
            className="h-9 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white"
          >
            إضافة
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
