import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** رأسٌ موحّد لصفحات الأقسام (عرض الكل): زرّ رجوع + عنوان + وصفٌ + شارةٌ اختياريّة. */
export function SectionPageHeader({
  title,
  subtitle,
  backHref = "/",
  live,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Link href={backHref} aria-label="رجوع" className="bg-card2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl border border-line text-neutral-200 hover:border-gold-500/50">
        <ChevronRight className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-neutral-100">
          {title}
          {live && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-petrol">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-petrol" />
              </span>
              مباشر
            </span>
          )}
        </h1>
        {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
      </div>
    </div>
  );
}
