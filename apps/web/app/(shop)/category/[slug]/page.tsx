import { notFound } from "next/navigation";
import { getServerApi } from "@/src/trpc/server";
import { getGovernorate } from "@/src/lib/governorate";
import { ProductCard } from "@/src/components/product-card";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const api = await getServerApi();
  const gov = getGovernorate();
  const category = await api.catalog.categoryBySlug({ slug: params.slug });
  if (!category) notFound();
  const products = await api.catalog.products({ categoryId: category.id, sort: "newest", limit: 30, governorateId: gov?.id });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{category.nameAr}</h1>
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
