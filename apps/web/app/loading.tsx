import { BrandMark } from "@/src/components/brand-logo";

/** حالة تحميل عامة أثناء جلب صفحات الخادم. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <BrandMark className="h-12 w-12 animate-pulse" />
      <p className="text-sm text-neutral-400">جارٍ التحميل…</p>
    </div>
  );
}
