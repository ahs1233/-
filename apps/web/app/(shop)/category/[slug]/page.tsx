import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";
import { ProductCard } from "@/src/components/product-card";
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-brand-800">{category.nameAr}</h1>
      {products.items.length === 0 ? (
        <p className="text-neutral-500">لا توجد منتجات في هذه الفئة.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
