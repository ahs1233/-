import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";
import { StoreRailCard, type StoreRailData } from "@/src/components/home/store-rail-card";

/** رأس قسمٍ بنسق Snapp: أيقونة/رمز + علامةٌ ذهبيّة + عنوان نيليّ + «الكل». */
function RailHead({ emoji, title, href }: { emoji?: string; title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
        <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
        {emoji && <span aria-hidden>{emoji}</span>}
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-sm font-medium text-gold-700 hover:text-gold-600">
          الكل <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

const RAIL = "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** شريطٌ أفقيّ من بطاقات المنتجات. */
export function ProductRail({
  emoji,
  title,
  href,
  items,
}: {
  emoji?: string;
  title: string;
  href?: string;
  items: ProductCardData[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <RailHead emoji={emoji} title={title} href={href} />
      <div className={RAIL}>
        {items.map((p) => (
          <div key={p.id} className="w-40 flex-shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** شريطٌ أفقيّ من بطاقات المتاجر. */
export function StoreRail({
  emoji,
  title,
  href,
  items,
}: {
  emoji?: string;
  title: string;
  href?: string;
  items: StoreRailData[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <RailHead emoji={emoji} title={title} href={href} />
      <div className={RAIL}>
        {items.map((s) => (
          <div key={s.id} className="w-44 flex-shrink-0">
            <StoreRailCard store={s} />
          </div>
        ))}
      </div>
    </section>
  );
}
