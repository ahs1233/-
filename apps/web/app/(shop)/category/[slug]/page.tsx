import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";
import { ProductCard } from "@/src/components/product-card";
import { SubMarketGrid } from "@/src/components/category/sub-market-grid";
import { CategoryIcon } from "@/src/components/category-icon";
import { decodeSlug } from "@/src/lib/slug";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const api = await getServerApi();
    const category = await api.catalog.categoryBySlug({ slug: decodeSlug(params.slug) });
    if (!category) return { title: "فئة غير موجودة" };
    return {
      title: category.nameAr,
      description: `تسوّق ${category.nameAr} من تجّار محافظتك — الدفع عند الاستلام في السوگ.`,
    };
  } catch {
    return { title: "السوگ" };
  }
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const api = await getServerApi();
  const gov = getGovernorate();
  const category = await api.catalog.categoryBySlug({ slug: decodeSlug(params.slug) });
  if (!category) notFound();
  const products = await api.catalog.products({ categoryId: category.id, sort: "newest", limit: 30, governorateId: gov?.id });
  const hasChildren = category.children.length > 0;

  return (
    <div className="space-y-5">
      {/* رأس الفئة كسوقٍ مستقلّ */}
      <header className="flex items-center gap-3">
        <span className="bg-card2 grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl border border-line text-gold-300">
          <CategoryIcon name={category.icon} className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          {category.parent && (
            <Link href={`/category/${category.parent.slug}`} className="flex items-center gap-0.5 text-xs font-medium text-gold-400 hover:text-gold-300">
              <ChevronLeft className="h-3.5 w-3.5 rotate-180" /> {category.parent.nameAr}
            </Link>
          )}
          <h1 className="truncate text-xl font-extrabold text-neutral-100">{category.nameAr}</h1>
        </div>
      </header>

      {/* أقسام هذه الفئة كبوّاباتٍ مستقلّة — «كأنّ كلّاً منها سوق» */}
      {hasChildren && <SubMarketGrid title={`أقسام ${category.nameAr}`} items={category.children} />}

      {/* منتجات الفئة (وكلّ أقسامها الفرعيّة) */}
      {products.items.length > 0 ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            {hasChildren ? `كلّ منتجات ${category.nameAr}` : "المنتجات"}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : (
        !hasChildren && (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-500">
            لا توجد منتجات في هذه الفئة بعد.
          </p>
        )
      )}
    </div>
  );
}
