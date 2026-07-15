import Link from "next/link";
import { CategoryIcon } from "@/src/components/category-icon";

export interface SubMarketItem {
  id: string;
  nameAr: string;
  slug: string;
  icon: string | null;
}

/**
 * شبكةُ «أسواقٍ فرعيّة» — كلّ فئةٍ داخل السوق تُعرض كبوّابةٍ مستقلّة (أيقونة + اسم).
 * تُستعمل عند دخول أيّ سوق/فئة: تُظهر أقسامه كأنّ كلّاً منها سوقٌ قائمٌ بذاته.
 */
export function SubMarketGrid({ title, items }: { title: string; items: SubMarketItem[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
        <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2">
            <span className="bg-card2 grid aspect-square w-full place-items-center rounded-2xl border border-line text-gold-300 shadow-sm transition group-hover:border-gold-500/50 group-hover:bg-card">
              <CategoryIcon name={c.icon} className="h-7 w-7" />
            </span>
            <span className="line-clamp-1 text-center text-[12px] font-semibold text-neutral-200">{c.nameAr}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
