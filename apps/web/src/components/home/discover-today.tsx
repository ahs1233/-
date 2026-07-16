import Link from "next/link";
import { Sparkles, ChevronLeft } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/src/components/product-card";

const RAIL = "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * «اكتشف اليوم» — تشكيلةٌ منسّقة تتجدّد يوميّاً (قسم today من محرّك الاكتشاف). إطارٌ مميّز
 * يعطي المستخدم سبباً للعودة كلّ يوم حتّى دون نيّة شراء.
 */
export function DiscoverToday({ items, href }: { items: ProductCardData[]; href?: string }) {
  if (!items.length) return null;
  return (
    <section className="-mx-4 bg-gradient-to-b from-brand-900/40 to-transparent px-4 py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold leading-tight text-neutral-100">اكتشف اليوم</h2>
          <p className="text-[11px] text-neutral-400">تشكيلةٌ تتجدّد يوميّاً — خصّيصاً لك</p>
        </div>
        {href && (
          <Link href={href} className="ms-auto flex items-center gap-0.5 text-sm font-medium text-gold-400 hover:text-gold-300">
            الكل <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className={RAIL}>
        {items.map((p) => (
          <div key={p.id} className="w-44 flex-shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
