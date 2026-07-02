"use client";

import { useEffect } from "react";
import { RefreshCcw, Home } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/src/components/brand-logo";

/** حدّ أخطاء عام: يلتقط أعطال الصفحات بدل شاشة انهيار بيضاء. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <BrandMark className="h-16 w-16 opacity-60" />
      <h1 className="text-xl font-bold text-neutral-900">حدث خطأ غير متوقّع</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        نعتذر عن الإزعاج. جرّب تحديث الصفحة، وإن استمرّت المشكلة عد لاحقاً.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <RefreshCcw className="h-4 w-4" /> إعادة المحاولة
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <Home className="h-4 w-4" /> الرئيسية
        </Link>
      </div>
      {error.digest && <p className="text-xs text-neutral-400 nums">رمز الخطأ: {error.digest}</p>}
    </div>
  );
}
