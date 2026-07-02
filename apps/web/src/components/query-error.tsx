"use client";

import { RefreshCcw } from "lucide-react";

/** حالة خطأ موحّدة للاستعلامات الفاشلة مع زر إعادة محاولة. */
export function QueryError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger/20 bg-danger/5 p-8 text-center">
      <p className="text-sm text-neutral-700">{message ?? "تعذّر تحميل البيانات."}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        <RefreshCcw className="h-4 w-4" /> إعادة المحاولة
      </button>
    </div>
  );
}
