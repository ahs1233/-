import Link from "next/link";
import { Home, Search } from "lucide-react";
import { BrandMark } from "@/src/components/brand-logo";

/** صفحة 404 عربية بهوية السوگ بدل صفحة Next الافتراضية. */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <BrandMark className="h-16 w-16 opacity-60" />
      <p className="text-5xl font-extrabold text-brand-700 nums">404</p>
      <h1 className="text-xl font-bold text-neutral-900">الصفحة غير موجودة</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        ربما حُذف المنتج أو تغيّر الرابط. تصفّح السوق أو ابحث عمّا تريد.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Home className="h-4 w-4" /> الرئيسية
        </Link>
        <Link
          href="/search"
          className="flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <Search className="h-4 w-4" /> البحث
        </Link>
      </div>
    </div>
  );
}
